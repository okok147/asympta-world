import UIKit

@MainActor
final class WorldRemovalProgressViewController: WorldCirclePaperViewController {
    private let heading = WorldTheme.label("", style:.title1)
    private let detail = WorldTheme.label("", style:.body)
    private let counts = WorldTheme.label("", style:.headline)
    private let statusLabel = WorldTheme.label("", style:.body, muted:true)
    private let progress = UIProgressView(progressViewStyle:.default)
    private let activity = UIActivityIndicatorView(style:.medium)
    private var retryButton: UIButton!
    private var startButton: UIButton!
    private var work: Task<Void,Never>?
    private var runID: UUID?
    private var visible = false
    private var finished = false
    private var lastPhase: WorldRemovalRecord.Phase?
    private let recheckStartupIfAbsent: Bool

    init(recheckStartupIfAbsent: Bool = false) {
        self.recheckStartupIfAbsent = recheckStartupIfAbsent
        // Reading personal settings is safe; no cloud/session or credential is
        // constructed. An unreadable removal journal never selects a normal root.
        let store = WorldStore()
        super.init(strings:store.strings)
    }

    required init?(coder: NSCoder) { return nil }

    deinit {
        work?.cancel()
        NotificationCenter.default.removeObserver(self)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        isModalInPresentation = true
        view.accessibilityIdentifier = "world.removal.progress"
        heading.text = strings.removal(.progressTitle)
        heading.accessibilityTraits.insert(.header)
        heading.accessibilityIdentifier = "world.removal.progress.title"
        detail.text = strings.removal(.progressDetail)
        counts.accessibilityIdentifier = "world.removal.progress.counts"
        counts.isHidden = true
        progress.accessibilityIdentifier = "world.removal.progress.value"
        progress.accessibilityLabel = strings.removal(.progressTitle)
        progress.progressTintColor = WorldTheme.ink
        progress.trackTintColor = WorldTheme.line
        progress.isHidden = true
        statusLabel.text = strings.removal(.working)
        statusLabel.accessibilityIdentifier = "world.removal.progress.status"
        activity.color = WorldTheme.ink
        activity.hidesWhenStopped = true
        activity.isAccessibilityElement = false
        retryButton = WorldTheme.button(strings[.retry], symbol:"arrow.clockwise")
        retryButton.accessibilityIdentifier = "world.removal.progress.retry"
        retryButton.addAction(UIAction { [weak self] _ in self?.beginWork() }, for:.touchUpInside)
        startButton = WorldTheme.button(strings.removal(.startNew), symbol:"sparkles", filled:true)
        startButton.titleLabel?.numberOfLines = 0
        startButton.accessibilityIdentifier = "world.removal.start-new"
        startButton.isHidden = true
        startButton.addAction(UIAction { [weak self] _ in self?.startNewWorld() }, for:.touchUpInside)
        [heading, detail, counts, progress, statusLabel, activity, retryButton!, startButton!].forEach {
            stack.addArrangedSubview($0)
        }
        stack.addArrangedSubview(WorldTheme.label(strings.removal(.scope), style:.footnote, muted:true))
        stack.addArrangedSubview(WorldTheme.label(strings.removal(.independent), style:.footnote, muted:true))
        NotificationCenter.default.addObserver(self, selector:#selector(activated(_:)), name:UIScene.didActivateNotification, object:nil)
        NotificationCenter.default.addObserver(self, selector:#selector(deactivated(_:)), name:UIScene.willDeactivateNotification, object:nil)
        NotificationCenter.default.addObserver(self, selector:#selector(motionChanged), name:UIAccessibility.reduceMotionStatusDidChangeNotification, object:nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        visible = true
        beginWork()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        visible = false
        pause()
    }

    private func render(_ record: WorldRemovalRecord) {
        finished = record.phase == .finished
        heading.text = strings.removal(finished ? .finishedTitle : .progressTitle)
        detail.text = strings.removal(finished ? .finishedDetail : .progressDetail)
        if let value = record.progress {
            counts.isHidden = false
            progress.isHidden = false
            counts.text = strings.removalCounts(completed:value.completed, remaining:value.remaining)
            let total = value.completed + value.remaining
            let fraction: Float = value.status == .removed ? 1 : (total == 0 ? 0 : Float(Double(value.completed) / Double(total)))
            progress.setProgress(fraction, animated:false)
            progress.accessibilityValue = counts.text
        }
        switch record.phase {
        case .pending: statusLabel.text = strings.removal(.working)
        case .remoteConfirmed: statusLabel.text = strings.removal(.finishing)
        case .finished: statusLabel.text = nil
        }
        retryButton.isHidden = finished
        startButton.isHidden = !finished
        if finished { activity.stopAnimating() }
        if lastPhase != record.phase {
            lastPhase = record.phase
            UIAccessibility.post(notification:.announcement, argument:finished ? heading.text : statusLabel.text)
        }
    }

    private func showError(_ error: Error) {
        let copy: WorldRemovalCopy
        if let problem = error as? WorldRemovalError {
            switch problem {
            case .network: copy = .networkError
            case .singleWindow: copy = .singleWindow
            default: copy = .localError
            }
        } else {
            copy = error is URLError ? .networkError : .localError
        }
        statusLabel.text = strings.removal(copy)
        retryButton.isHidden = false
        retryButton.isEnabled = true
        activity.stopAnimating()
        UIAccessibility.post(notification:.announcement, argument:statusLabel.text)
    }

    private func beginWork() {
        guard visible, work == nil, view.window?.windowScene?.activationState == .foregroundActive else { return }
        let id = UUID()
        runID = id
        retryButton.isEnabled = false
        startButton.isEnabled = false
        if !finished && !UIAccessibility.isReduceMotionEnabled { activity.startAnimating() }
        work = Task { [weak self] in
            guard let self else { return }
            do {
                try WorldRemovalPresentation.requireForeground(in:self.view.window)
                guard var record = try WorldRemovalJournal.load() else {
                    // Only a startup read-error surface may route again after a
                    // readable Keychain proves there is no removal journal.
                    // An already confirmed removal surface never takes this path.
                    guard self.recheckStartupIfAbsent, let window = self.view.window else {
                        throw WorldRemovalError.invalidRecord
                    }
                    SceneDelegate.installWorld(in:window)
                    return
                }
                try WorldRemovalJournal.check(record)
                self.render(record)
                if record.phase == .pending {
                    // Repeating this desired-state POST after an uncertain reply
                    // is safe. Polls after it are reads, not erasure scheduling.
                    let value = try await WorldRemovalService.submit(record.intent)
                    try Task.checkCancellation()
                    guard self.runID == id else { throw CancellationError() }
                    record = try WorldRemovalJournal.record(value, for:record.intent)
                    self.render(record)
                    while record.phase == .pending {
                        try await Task.sleep(for:.seconds(4))
                        try Task.checkCancellation()
                        try WorldRemovalPresentation.requireForeground(in:self.view.window)
                        try WorldRemovalJournal.check(record)
                        let value = try await WorldRemovalService.status(capability:record.intent.capability)
                        try Task.checkCancellation()
                        guard self.runID == id else { throw CancellationError() }
                        record = try WorldRemovalJournal.record(value, for:record.intent)
                        self.render(record)
                    }
                }
                try Task.checkCancellation()
                guard self.runID == id else { throw CancellationError() }
                if record.phase == .remoteConfirmed {
                    try WorldRemovalPresentation.requireForeground(in:self.view.window)
                    // Entirely local replay: recorded confirmation requires no
                    // further service call, even after the credential is absent.
                    try WorldRemovalCleanup.finalize(record.intent)
                    guard let final = try WorldRemovalJournal.load(), final.intent == record.intent,
                          final.phase == .finished else { throw WorldRemovalError.invalidRecord }
                    record = final
                }
                self.render(record)
            } catch {
                if !Task.isCancelled && self.runID == id { self.showError(error) }
            }
            if self.runID == id {
                self.work = nil
                self.runID = nil
                self.activity.stopAnimating()
                self.retryButton.isEnabled = true
                self.startButton.isEnabled = true
            }
        }
    }

    private func pause() {
        runID = nil
        work?.cancel()
        work = nil
        activity.stopAnimating()
        retryButton?.isEnabled = true
        startButton?.isEnabled = true
        if !finished { statusLabel.text = strings.removal(.paused) }
    }

    private func startNewWorld() {
        guard work == nil, let window = view.window else { return }
        do {
            try WorldRemovalPresentation.requireForeground(in:window)
            try WorldRemovalJournal.startNewWorld()
            SceneDelegate.installWorld(in:window)
        } catch { showError(error) }
    }

    @objc private func activated(_ notification: Notification) {
        guard (notification.object as? UIScene) === view.window?.windowScene else { return }
        beginWork()
    }

    @objc private func deactivated(_ notification: Notification) {
        guard (notification.object as? UIScene) === view.window?.windowScene else { return }
        pause()
    }

    @objc private func motionChanged() {
        if UIAccessibility.isReduceMotionEnabled { activity.stopAnimating() }
        else if work != nil && !finished { activity.startAnimating() }
    }
}
