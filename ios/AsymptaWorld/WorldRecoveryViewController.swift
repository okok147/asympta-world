import UIKit
import UniformTypeIdentifiers

@MainActor
final class WorldRecoveryViewController: UIViewController, UIDocumentPickerDelegate {
    private let strings: WorldStrings
    private let makeSnapshot: () throws -> WorldRecoveryPayload
    private let apply: (WorldRecoveryPayload) throws -> Void
    private let stack = UIStackView()
    private let status = WorldTheme.label("", style:.footnote, muted:true)
    private var work: Task<Void,Never>?
    private var imported: Data?
    private var controls: [UIButton] = []
    private var busy = false

    init(strings: WorldStrings, makeSnapshot: @escaping () throws -> WorldRecoveryPayload, apply: @escaping (WorldRecoveryPayload) throws -> Void) {
        self.strings = strings; self.makeSnapshot = makeSnapshot; self.apply = apply
        super.init(nibName:nil,bundle:nil)
    }
    required init?(coder: NSCoder) { nil }
    deinit { work?.cancel() }
    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings.recovery(.title)
        view.backgroundColor = WorldTheme.paper
        let scroll = UIScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        stack.axis = .vertical; stack.spacing = 18; stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor), scroll.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor),
            scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor), scroll.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor, constant:22), stack.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor, constant:-22),
            stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor, constant:24), stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor, constant:-24),
            stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor, constant:-44)
        ])
        stack.addArrangedSubview(WorldTheme.label(strings.recovery(.introduction), style:.title3))
        stack.addArrangedSubview(WorldTheme.label(strings.recovery(.archiveNotice), style:.body, muted:true))
        button(.export,id:"world.recovery.export") { [weak self] in self?.askPhrase(importing:false) }
        button(.restore,id:"world.recovery.import") { [weak self] in self?.chooseFile() }
        status.accessibilityIdentifier = "world.recovery.status"
        stack.addArrangedSubview(status)
        navigationItem.backButtonDisplayMode = .minimal
    }
    private func button(_ title: WorldRecoveryCopy,id: String,action: @escaping ()->Void) {
        let button = WorldTheme.button(strings.recovery(title),symbol:title == .export ? "lock.doc" : "arrow.down.doc")
        button.accessibilityIdentifier = id
        button.addAction(UIAction { _ in action() },for:.touchUpInside)
        controls.append(button); stack.addArrangedSubview(button)
    }
    private func setBusy(_ value: Bool, copy: WorldRecoveryCopy = .working) {
        busy = value; controls.forEach { $0.isEnabled = !value }
        navigationController?.isModalInPresentation = value
        navigationItem.hidesBackButton = value
        status.text = value ? strings.recovery(copy) : nil
    }
    private func message(_ error: Error) {
        if case .revokedIdentity? = error as? WorldRecoveryError {
            status.text = strings.removal(.revoked)
            UIAccessibility.post(notification:.announcement, argument:status.text)
            return
        }
        let copy: WorldRecoveryCopy
        switch error as? WorldRecoveryError {
        case .invalidFile: copy = .invalid
        case .existingCircles: copy = .occupied
        case .network: copy = .network
        case .multipleScenes: copy = .multiwindow
        default: copy = .unavailable
        }
        status.text = strings.recovery(copy)
        UIAccessibility.post(notification:.announcement, argument:status.text)
    }
    private func chooseFile() {
        guard !busy else { return }
        do { try WorldRecoveryCommit.canReplace() } catch { message(error); return }
        let picker = UIDocumentPickerViewController(forOpeningContentTypes:[.data], asCopy:false)
        picker.allowsMultipleSelection = false; picker.delegate = self
        present(picker,animated:true)
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard urls.count == 1, let url = urls.first else { return }
        do {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            // Reading at most limit+1 prevents a malicious or accidental huge
            // document from allocating memory before the size check.
            let file = try FileHandle(forReadingFrom:url); defer { try? file.close() }
            let data = try file.read(upToCount:WorldRecoveryCodec.maximumBytes + 1) ?? Data()
            guard data.count <= WorldRecoveryCodec.maximumBytes, !data.isEmpty else { throw WorldRecoveryError.invalidFile }
            imported = data
            askPhrase(importing:true)
        } catch { message(WorldRecoveryError.invalidFile) }
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { imported = nil }
    private func askPhrase(importing: Bool) {
        guard !busy else { return }
        let prompt = UIAlertController(title:strings.recovery(importing ? .restore : .export),message:strings.recovery(.phraseHint),preferredStyle:.alert)
        for key: WorldRecoveryCopy in importing ? [.phrase] : [.phrase, .confirmPhrase] {
            prompt.addTextField { [strings] field in
                field.isSecureTextEntry = true; field.autocorrectionType = .no; field.autocapitalizationType = .none
                field.spellCheckingType = .no; field.smartQuotesType = .no; field.smartDashesType = .no
                field.textContentType = .password
                field.placeholder = strings.recovery(key); field.accessibilityLabel = field.placeholder
                field.accessibilityIdentifier = key == .phrase ? "world.recovery.phrase" : "world.recovery.phraseConfirmation"
            }
        }
        prompt.addAction(UIAlertAction(title:strings.recovery(.cancel),style:.cancel) { [weak self, weak prompt] _ in
            prompt?.textFields?.forEach { $0.text = nil }; self?.imported = nil
        })
        prompt.addAction(UIAlertAction(title:strings.recovery(importing ? .decrypt : .encrypt),style:.default) { [weak self, weak prompt] _ in
            guard let prompt else { return }
            let phrase = prompt.textFields?.first?.text ?? ""
            let confirmation = prompt.textFields?.last?.text ?? ""
            prompt.textFields?.forEach { $0.text = nil }
            guard let self else { return }
            guard WorldRecoveryCodec.validPhrase(phrase), importing || phrase.utf8.elementsEqual(confirmation.utf8) else {
                self.message(WorldRecoveryError.invalidFile); return
            }
            self.process(phrase:phrase, importing:importing)
        })
        present(prompt,animated:true)
    }
    private func process(phrase: String, importing: Bool) {
        guard !busy else { return }
        let data = imported; imported = nil
        let snapshot: WorldRecoveryPayload?
        do { snapshot = importing ? nil : try makeSnapshot() } catch { message(error); return }
        setBusy(true)
        work = Task { [weak self] in
            guard let self else { return }
            do {
                if importing {
                    guard let data else { throw WorldRecoveryError.invalidFile }
                    let payload = try await Task.detached(priority:.userInitiated) { try WorldRecoveryCodec.decode(data,phrase:phrase) }.value
                    try Task.checkCancellation()
                    self.setBusy(true,copy:.verifying)
                    let verified = try await self.verify(payload)
                    try Task.checkCancellation()
                    self.setBusy(false)
                    self.review(verified.payload, skipped:verified.skipped)
                } else if let snapshot {
                    let encrypted = try await Task.detached(priority:.userInitiated) { try WorldRecoveryCodec.encode(snapshot,phrase:phrase) }.value
                    try Task.checkCancellation()
                    self.setBusy(false)
                    try self.share(encrypted)
                }
            } catch {
                self.setBusy(false)
                if !(error is CancellationError) { self.message(error) }
            }
        }
    }
    private func verify(_ payload: WorldRecoveryPayload) async throws -> (payload:WorldRecoveryPayload,skipped:Int) {
        try WorldRecoveryCommit.canReplace()
        try WorldRecoveryCodec.validate(payload)
        // Authenticate the candidate itself, including archives with no links.
        // The current installation is never replaced to perform this check.
        let removal: WorldRemovalStatus
        do {
            removal = try await WorldRemovalService.status(capability:payload.capabilityValue)
        } catch {
            if Task.isCancelled { throw CancellationError() }
            throw WorldRecoveryError.network
        }
        guard removal.status == .active else { throw WorldRecoveryError.revokedIdentity }
        try Task.checkCancellation()
        let session = URLSession(configuration:.ephemeral, delegate:WorldRemovalRedirectGuard(), delegateQueue:nil)
        defer { session.invalidateAndCancel() }
        var links: [WorldRecoveryPayload.Link] = []
        for (index,link) in payload.links.enumerated() {
            try Task.checkCancellation()
            if index > 0 { try await Task.sleep(for:.milliseconds(1250)) }
            var request = URLRequest(url:WorldCloudSession.endpoint.appendingPathComponent("v1/circles/" + link.id))
            request.timeoutInterval = 18
            request.setValue("Bearer " + payload.capabilityValue,forHTTPHeaderField:"Authorization")
            let data: Data; let response: URLResponse
            do { (data,response) = try await session.data(for:request) } catch { throw WorldRecoveryError.network }
            guard let http = response as? HTTPURLResponse else { throw WorldRecoveryError.network }
            if http.statusCode == 403 || http.statusCode == 404 { continue }
            guard http.statusCode == 200, data.count <= 480_000,
                  let value = try? JSONDecoder().decode(WorldCircleSnapshot.self,from:data), value.circle.id == link.id else { throw WorldRecoveryError.network }
            links.append(.init(id:link.id,title:value.circle.title))
        }
        let selected = payload.selected.flatMap { id in links.contains { $0.id == id } ? id : nil }
        let next = WorldRecoveryPayload(version:1,capabilityValue:payload.capabilityValue,links:links,selected:selected,abilities:payload.abilities,createdAt:payload.createdAt)
        try WorldRecoveryCodec.validate(next)
        return (next,payload.links.count - links.count)
    }
    private func review(_ payload: WorldRecoveryPayload,skipped: Int) {
        var detail = strings.recoveryCount(.snapshot,payload.links.count)
        if skipped > 0 { detail += "\n" + strings.recoveryCount(.skipped,skipped) }
        detail = String(format:strings.recovery(.reviewDetail),locale:strings.language.locale,detail)
        let alert = UIAlertController(title:strings.recovery(.review),message:detail,preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:strings.recovery(.cancel),style:.cancel))
        alert.addAction(UIAlertAction(title:strings.recovery(.confirm),style:.destructive) { [weak self] _ in
            guard let self else { return }
            do { try self.apply(payload) } catch { self.message(error) }
        })
        present(alert,animated:true)
    }
    private func share(_ encrypted: Data) throws {
        try WorldRemovalJournal.requireAbsent()
        let fm = FileManager.default
        let folder = fm.temporaryDirectory.appendingPathComponent("WorldRecovery-" + UUID().uuidString,isDirectory:true)
        do {
            try fm.createDirectory(at:folder,withIntermediateDirectories:false,attributes:[.protectionKey:FileProtectionType.complete])
            let file = folder.appendingPathComponent("Asympta-World.worldbackup")
            try encrypted.write(to:file,options:[.atomic, .completeFileProtection])
            let sheet = UIActivityViewController(activityItems:[file],applicationActivities:nil)
            sheet.popoverPresentationController?.sourceView = controls.first
            sheet.popoverPresentationController?.sourceRect = controls.first?.bounds ?? .zero
            sheet.completionWithItemsHandler = { _,_,_,_ in try? fm.removeItem(at:folder) }
            present(sheet,animated:true)
        } catch { try? fm.removeItem(at:folder); throw error }
    }
}

@MainActor
final class WorldRecoveryStartupViewController: UIViewController {
    var retry: (() -> Void)?
    override func viewDidLoad() {
        super.viewDidLoad()
        let s = WorldStrings(language:.deviceDefault)
        view.backgroundColor = WorldTheme.paper
        let message = WorldTheme.label(s.recovery(.startup),style:.body)
        let button = WorldTheme.button(s.recovery(.retry),symbol:"arrow.clockwise")
        button.accessibilityIdentifier = "world.recovery.startup.retry"
        button.addAction(UIAction { [weak self] _ in self?.retry?() },for:.touchUpInside)
        let stack = UIStackView(arrangedSubviews:[message,button]); stack.axis = .vertical; stack.spacing = 22
        stack.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(stack)
        NSLayoutConstraint.activate([stack.centerXAnchor.constraint(equalTo:view.centerXAnchor),stack.centerYAnchor.constraint(equalTo:view.safeAreaLayoutGuide.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo:view.safeAreaLayoutGuide.leadingAnchor,constant:24),stack.trailingAnchor.constraint(lessThanOrEqualTo:view.safeAreaLayoutGuide.trailingAnchor,constant:-24),stack.widthAnchor.constraint(lessThanOrEqualToConstant:440)])
    }
}
