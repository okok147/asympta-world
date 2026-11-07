import UIKit
import SafariServices

@MainActor
enum WorldRemovalPresentation {
    static func requireForeground(in window: UIWindow?) throws {
        guard let window, window.windowScene?.activationState == .foregroundActive else {
            throw WorldRemovalError.unavailable
        }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState != .unattached }
        guard scenes.count == 1 else { throw WorldRemovalError.singleWindow }
    }
}

@MainActor
final class WorldRemovalViewController: WorldCirclePaperViewController {
    private let makeIntent: () throws -> WorldRemovalIntent
    private let begin: (WorldRemovalIntent) throws -> Void
    private let statusLabel = WorldTheme.label("", style:.footnote, muted:true)
    private var intent: WorldRemovalIntent?
    private var retryButton: UIButton?
    private var continueButton: UIButton?

    init(strings: WorldStrings, makeIntent: @escaping () throws -> WorldRemovalIntent,
         begin: @escaping (WorldRemovalIntent) throws -> Void) {
        self.makeIntent = makeIntent
        self.begin = begin
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { return nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings.removal(.title)
        view.accessibilityIdentifier = "world.removal.review"
        navigationItem.hidesBackButton = true
        navigationItem.leftBarButtonItem = UIBarButtonItem(title:strings[.cancel], style:.plain,
                                                            target:self, action:#selector(cancel))
        navigationItem.leftBarButtonItem?.accessibilityIdentifier = "world.removal.cancel"
        loadIntent()
    }

    private func loadIntent() {
        clearPage()
        intent = nil
        titleBlock(strings.removal(.title))
        for copy: WorldRemovalCopy in [.scope, .effects, .localCleanup, .independent] {
            stack.addArrangedSubview(WorldTheme.label(strings.removal(copy)))
        }
        stack.addArrangedSubview(WorldTheme.label(strings.removal(.retained), style:.footnote, muted:true))
        let privacy = WorldTheme.button(strings.removal(.privacy), symbol:"hand.raised")
        privacy.accessibilityIdentifier = "world.removal.privacy"
        privacy.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            let page = SFSafariViewController(url:WorldCloudSession.endpoint.appendingPathComponent("privacy"))
            self.present(page, animated:!UIAccessibility.isReduceMotionEnabled)
        }, for:.touchUpInside)
        stack.addArrangedSubview(privacy)
        statusLabel.text = nil
        statusLabel.accessibilityIdentifier = "world.removal.review.status"
        do {
            let candidate = try makeIntent()
            try candidate.validate()
            intent = candidate
            let count = WorldTheme.label(strings.removalKnownCount(candidate.circleIDs.count), style:.headline)
            count.accessibilityIdentifier = "world.removal.known-count"
            stack.addArrangedSubview(count)
        } catch {
            statusLabel.text = strings.removal(.prepareError)
        }
        let next = WorldTheme.button(strings.removal(.continueRemoval), symbol:"person.crop.circle.badge.minus", filled:true)
        next.accessibilityIdentifier = "world.removal.review.confirm"
        next.titleLabel?.numberOfLines = 0
        next.isEnabled = intent != nil
        next.addAction(UIAction { [weak self] _ in self?.askConfirmation() }, for:.touchUpInside)
        continueButton = next
        stack.addArrangedSubview(next)
        stack.addArrangedSubview(statusLabel)
        let retry = WorldTheme.button(strings[.retry], symbol:"arrow.clockwise")
        retry.accessibilityIdentifier = "world.removal.review.retry"
        retry.isHidden = intent != nil
        retry.addAction(UIAction { [weak self] _ in self?.loadIntent() }, for:.touchUpInside)
        retryButton = retry
        stack.addArrangedSubview(retry)
    }

    private func askConfirmation() {
        guard let intent, presentedViewController == nil else { return }
        let alert = UIAlertController(title:strings.removal(.confirmTitle),
                                      message:strings.removalConfirmation(intent.circleIDs.count), preferredStyle:.alert)
        alert.view.accessibilityIdentifier = "world.removal.confirmation"
        let cancel = UIAlertAction(title:strings[.cancel], style:.cancel)
        alert.addAction(cancel)
        alert.preferredAction = cancel
        alert.addAction(UIAlertAction(title:strings.removal(.title), style:.destructive) { [weak self] _ in
            guard let self else { return }
            do {
                try self.begin(intent)
                self.continueButton?.isEnabled = false
            } catch {
                self.statusLabel.text = self.strings.removal(.prepareError)
                self.continueButton?.isEnabled = false
                self.retryButton?.isHidden = false
                UIAccessibility.post(notification:.announcement, argument:self.statusLabel.text)
            }
        })
        present(alert, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    @objc private func cancel() {
        navigationController?.popViewController(animated:!UIAccessibility.isReduceMotionEnabled)
    }
}
