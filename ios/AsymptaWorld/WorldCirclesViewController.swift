import UIKit

@MainActor
class WorldCirclePaperViewController: UIViewController {
    let strings: WorldStrings
    let stack = UIStackView()
    let scroll = UIScrollView()

    init(strings: WorldStrings) {
        self.strings = strings
        super.init(nibName:nil, bundle:nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = WorldTheme.paper
        view.accessibilityLanguage = strings.language.rawValue
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.keyboardDismissMode = .interactive
        view.addSubview(scroll)
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        let content = scroll.contentLayoutGuide
        let frame = scroll.frameLayoutGuide
        let readable = stack.widthAnchor.constraint(equalTo:frame.widthAnchor, constant:-40)
        readable.priority = .defaultHigh
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor),
            scroll.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo:view.keyboardLayoutGuide.topAnchor),
            content.widthAnchor.constraint(equalTo:frame.widthAnchor),
            stack.centerXAnchor.constraint(equalTo:content.centerXAnchor),
            stack.topAnchor.constraint(equalTo:content.topAnchor, constant:20),
            stack.bottomAnchor.constraint(equalTo:content.bottomAnchor, constant:-34),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant:540),
            stack.widthAnchor.constraint(lessThanOrEqualTo:frame.widthAnchor, constant:-36),
            readable
        ])
        navigationItem.largeTitleDisplayMode = .never
    }

    func clearPage() {
        for child in stack.arrangedSubviews {
            stack.removeArrangedSubview(child)
            child.removeFromSuperview()
        }
    }

    func titleBlock(_ title: String, detail: String? = nil) {
        let label = WorldTheme.label(title, style:.title1)
        label.accessibilityTraits.insert(.header)
        stack.addArrangedSubview(label)
        if let detail { stack.addArrangedSubview(WorldTheme.label(detail, style:.subheadline, muted:true)) }
        stack.setCustomSpacing(20, after:stack.arrangedSubviews.last!)
    }

    func action(_ key: WorldStrings.Key, _ symbol: String, id: String,
                filled: Bool = false, run: @escaping () -> Void) -> UIButton {
        let button = WorldTheme.button(strings[key], symbol:symbol, filled:filled)
        button.accessibilityIdentifier = id
        button.addAction(UIAction { _ in run() }, for:.touchUpInside)
        return button
    }

    func message(_ text: String) {
        let label = WorldTheme.label(text, style:.footnote, muted:true)
        label.accessibilityIdentifier = "world.circle.message"
        stack.addArrangedSubview(label)
    }

    func notify(_ text: String) {
        let alert = UIAlertController(title:nil, message:text, preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:strings[.close], style:.cancel))
        present(alert, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    func confirm(_ title: WorldStrings.Key, detail: WorldStrings.Key, run: @escaping () -> Void) {
        let alert = UIAlertController(title:strings[title], message:strings[detail], preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:strings[.cancel], style:.cancel))
        alert.addAction(UIAlertAction(title:strings[title], style:.destructive) { _ in run() })
        present(alert, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    func date(_ stamp: Double) -> String {
        strings.date(Date(timeIntervalSince1970:stamp / 1000))
    }

    func count(_ count: Int, _ key: WorldStrings.Key) -> String {
        String(format:strings[key], locale:strings.language.locale, count)
    }
}

/// A paper surface that reads as one accessible action, even when its labels wrap.
final class WorldCircleSlip: UIButton {
    init(title: String, detail: String?, footer: String?, ink: UInt32, style: WorldCircleInkStyle? = nil, id: String, onOpen: @escaping () -> Void) {
        super.init(frame:.zero)
        accessibilityIdentifier = id
        accessibilityLabel = [title,detail,footer].compactMap { $0 }.joined(separator:", ")
        backgroundColor = WorldTheme.mapPaper.withAlphaComponent(0.38)
        layer.cornerRadius = 16
        layer.borderColor = WorldTheme.line.cgColor
        layer.borderWidth = 0.65
        let seal = WorldCircleSeal(ink:ink,style:style)
        seal.widthAnchor.constraint(equalToConstant:46).isActive = true
        seal.heightAnchor.constraint(equalToConstant:46).isActive = true
        let labels = UIStackView()
        labels.axis = .vertical
        labels.spacing = 5
        let heading = WorldTheme.label(title, style:.headline)
        heading.numberOfLines = 4
        labels.addArrangedSubview(heading)
        if let detail {
            let label = WorldTheme.label(detail, style:.subheadline, muted:true)
            label.numberOfLines = 3
            labels.addArrangedSubview(label)
        }
        if let footer { labels.addArrangedSubview(WorldTheme.label(footer, style:.caption1, muted:true)) }
        let row = UIStackView(arrangedSubviews:[seal,labels])
        row.alignment = .center
        row.spacing = 10
        row.isUserInteractionEnabled = false
        row.accessibilityElementsHidden = true
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo:leadingAnchor, constant:12),
            row.trailingAnchor.constraint(equalTo:trailingAnchor, constant:-14),
            row.topAnchor.constraint(equalTo:topAnchor, constant:12),
            row.bottomAnchor.constraint(equalTo:bottomAnchor, constant:-12)
        ])
        addAction(UIAction { _ in onOpen() }, for:.touchUpInside)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var isHighlighted: Bool {
        didSet { alpha = isHighlighted ? 0.72 : 1 }
    }
}

final class WorldCirclesViewController: WorldCirclePaperViewController {
    private let client: WorldSocialClient
    private let region: () -> String?
    private let onClose: () -> Void
    private let onArea: (WorldCircleLink, Int) -> Void
    private let onInbox: (WorldCircleInbox) -> Void
    private let initialLink: WorldCircleLink?
    private var openedInitial = false

    init(client: WorldSocialClient, strings: WorldStrings, region: @escaping () -> String?,
         initialLink: WorldCircleLink? = nil, onArea: @escaping (WorldCircleLink,Int) -> Void,
         onInbox: @escaping (WorldCircleInbox) -> Void,
         onClose: @escaping () -> Void) {
        self.client = client
        self.region = region
        self.initialLink = initialLink
        self.onArea = onArea
        self.onInbox = onInbox
        self.onClose = onClose
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings[.circles]
        navigationItem.rightBarButtonItem = WorldTheme.closeItem(title:strings[.close], target:self, action:#selector(close))
        navigationItem.rightBarButtonItem?.accessibilityIdentifier = "world.circle.close"
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        rebuild()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if let initialLink, !openedInitial {
            openedInitial = true
            open(initialLink, areaOnly:true, animated:false)
        }
    }

    private func rebuild() {
        clearPage()
        let seal = WorldCircleSeal(ink:0xb76b48)
        seal.heightAnchor.constraint(equalToConstant:78).isActive = true
        stack.addArrangedSubview(seal)
        titleBlock(strings[.circleHomeTitle], detail:strings[.circleHomeDetail])
        if !client.links.isEmpty {
            stack.addArrangedSubview(action(.circleInbox, "tray", id:"world.circle.inbox") { [weak self] in
                guard let self else { return }
                let inbox = WorldCircleInboxViewController(client:client, strings:strings, onInbox:onInbox)
                navigationController?.pushViewController(inbox, animated:!UIAccessibility.isReduceMotionEnabled)
            })
        }
        for link in client.links {
            stack.addArrangedSubview(WorldCircleSlip(title:link.title, detail:strings[.circlePrivate], footer:nil,
                                                     ink:0x678b99, id:"world.circle.link") { [weak self] in self?.open(link) })
        }
        stack.addArrangedSubview(action(.circleCreate, "plus", id:"world.circle.create", filled:true) { [weak self] in self?.enter(.create) })
        stack.addArrangedSubview(action(.circleJoin, "key", id:"world.circle.join") { [weak self] in self?.enter(.join) })
        let keepsakes = WorldTheme.button("World Keepsakes", symbol:"book.closed")
        keepsakes.accessibilityIdentifier = "world.keepsakes.open"
        keepsakes.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            let page = WorldKeepsakesViewController(strings:strings)
            navigationController?.pushViewController(page, animated:!UIAccessibility.isReduceMotionEnabled)
        }, for:.touchUpInside)
        stack.addArrangedSubview(keepsakes)
        message(strings[.circleBeta])
    }

    private func enter(_ kind: WorldCircleEntryViewController.Kind) {
        let controller = WorldCircleEntryViewController(kind:kind, client:client, strings:strings) { [weak self] circle in
            guard let self, let nav = self.navigationController else { return }
            let link = WorldCircleLink(id:circle.id,title:circle.title)
            let feed = self.feed(link, areaOnly:false)
            nav.setViewControllers([self,feed], animated:!UIAccessibility.isReduceMotionEnabled)
        }
        navigationController?.pushViewController(controller, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func open(_ link: WorldCircleLink, areaOnly: Bool = false, animated: Bool = true) {
        navigationController?.pushViewController(feed(link,areaOnly:areaOnly), animated:animated && !UIAccessibility.isReduceMotionEnabled)
    }

    private func feed(_ link: WorldCircleLink, areaOnly: Bool) -> WorldCircleFeedViewController {
        WorldCircleFeedViewController(link:link, client:client, strings:strings, region:region,
                                      areaOnly:areaOnly, onArea:onArea)
    }

    @objc private func close() { onClose() }
}

private final class WorldCircleInboxViewController: WorldCirclePaperViewController {
    private let client: WorldSocialClient
    private let onInbox: (WorldCircleInbox) -> Void
    private let refresh = UIRefreshControl()
    private var loadTask: Task<Void,Never>?

    init(client: WorldSocialClient, strings: WorldStrings, onInbox: @escaping (WorldCircleInbox) -> Void) {
        self.client = client
        self.onInbox = onInbox
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings[.circleInbox]
        titleBlock(strings[.circleInbox], detail:strings[.circleInboxDetail])
        message(strings[.circleInboxLoading])
        scroll.refreshControl = refresh
        refresh.addAction(UIAction { [weak self] _ in self?.reload() }, for:.valueChanged)
        let item = UIBarButtonItem(image:UIImage(systemName:"arrow.clockwise"), style:.plain,
                                   target:self, action:#selector(reload))
        item.accessibilityLabel = strings[.retry]
        item.accessibilityIdentifier = "world.circle.inbox.refresh"
        navigationItem.rightBarButtonItem = item
        NotificationCenter.default.addObserver(self, selector:#selector(activated(_:)),
                                                name:UIScene.didActivateNotification, object:nil)
        NotificationCenter.default.addObserver(self, selector:#selector(inboxChanged),
                                                name:.worldSocialInboxDidChange, object:client)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        reload()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        loadTask?.cancel()
        refresh.endRefreshing()
    }

    @objc private func activated(_ notification: Notification) {
        guard navigationController?.topViewController === self,
              let scene = viewIfLoaded?.window?.windowScene,
              (notification.object as? UIScene) === scene else { return }
        reload()
    }

    @objc private func inboxChanged() {
        if navigationController?.topViewController === self { reload() }
    }

    @objc private func reload() {
        loadTask?.cancel()
        let client = client
        loadTask = Task { [weak self] in
            guard let inbox = try? await client.inbox(), !Task.isCancelled, let self else { return }
            refresh.endRefreshing()
            onInbox(inbox)
            render(inbox)
        }
    }

    private func render(_ inbox: WorldCircleInbox) {
        clearPage()
        titleBlock(strings[.circleInbox], detail:strings[.circleInboxDetail])
        let entries = inbox.groups.flatMap { group in group.activity.map { (circle:group.circle, reply:$0) } }
            .sorted { lhs, rhs in
                if lhs.reply.createdAt != rhs.reply.createdAt { return lhs.reply.createdAt > rhs.reply.createdAt }
                if lhs.circle.id != rhs.circle.id { return lhs.circle.id < rhs.circle.id }
                return lhs.reply.replyID > rhs.reply.replyID
            }
        if inbox.partial {
            message(strings[.circleInboxPartial])
            stack.addArrangedSubview(action(.retry,"arrow.clockwise",id:"world.circle.inbox.retry") { [weak self] in self?.reload() })
        } else if entries.isEmpty {
            message(strings[.circleInboxEmpty])
        }
        for (index, entry) in entries.prefix(40).enumerated() {
            let reply = entry.reply
            let source = [entry.circle.title, date(reply.createdAt)].joined(separator:" · ")
            stack.addArrangedSubview(WorldCircleSlip(
                title:reply.author.name, detail:reply.text, footer:source, ink:0xc27d55,
                style:reply.author.style.flatMap(WorldCircleInkStyle.init(rawValue:)),
                id:"world.circle.inbox.reply.\(index)"
            ) { [weak self] in
                guard let self else { return }
                let detail = WorldMomentViewController(circle:entry.circle, momentID:reply.momentID,
                                                       client:client, strings:strings, onChanged:{})
                navigationController?.pushViewController(detail, animated:!UIAccessibility.isReduceMotionEnabled)
            })
        }
        if inbox.hasMore || entries.count > 40 { message(strings[.circleInboxRecent]) }
    }
}

private final class WorldCircleEntryViewController: WorldCirclePaperViewController {
    enum Kind { case create, join }
    private let kind: Kind
    private let client: WorldSocialClient
    private let onEntered: (WorldCircle) -> Void
    private let circleID = WorldSocialClient.identifier()
    private let titleOrCode = UITextField()
    private let name = UITextField()
    private let problem = WorldTheme.label("", style:.footnote, muted:true)
    private var submit: UIButton?
    private var pending = false

    init(kind: Kind, client: WorldSocialClient, strings: WorldStrings, onEntered: @escaping (WorldCircle) -> Void) {
        self.kind = kind
        self.client = client
        self.onEntered = onEntered
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        let isCreate = kind == .create
        let heading: WorldStrings.Key = isCreate ? .circleCreate : .circleJoin
        title = strings[heading]
        titleBlock(strings[heading], detail:strings[isCreate ? .circleCreateDetail : .circleJoinDetail])
        prepare(titleOrCode, isCreate ? .circleTitle : .circleCode, id:isCreate ? "world.circle.title" : "world.circle.code")
        prepare(name, .circleNameHint, id:"world.circle.name")
        if !isCreate {
            titleOrCode.autocapitalizationType = .none
            titleOrCode.autocorrectionType = .no
            titleOrCode.spellCheckingType = .no
            titleOrCode.font = UIFontMetrics(forTextStyle:.body).scaledFont(for:UIFont.monospacedSystemFont(ofSize:14,weight:.regular))
        }
        let button = action(heading,isCreate ? "plus" : "key",id:"world.circle.entry.submit",filled:true) { [weak self] in self?.save() }
        stack.addArrangedSubview(button)
        submit = button
        problem.accessibilityIdentifier = "world.circle.entry.error"
        problem.isHidden = true
        stack.addArrangedSubview(problem)
    }

    private func prepare(_ field: UITextField, _ key: WorldStrings.Key, id: String) {
        stack.addArrangedSubview(WorldTheme.label(strings[key],style:.headline))
        field.font = WorldTheme.font()
        field.adjustsFontForContentSizeCategory = true
        field.accessibilityLabel = strings[key]
        field.accessibilityIdentifier = id
        field.borderStyle = .roundedRect
        field.textColor = WorldTheme.ink
        field.backgroundColor = .white.withAlphaComponent(0.36)
        field.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive = true
        stack.addArrangedSubview(field)
    }

    private func save() {
        guard !pending else { return }
        let text = titleOrCode.text?.trimmingCharacters(in:.whitespacesAndNewlines) ?? ""
        let alias = name.text?.trimmingCharacters(in:.whitespacesAndNewlines) ?? ""
        guard !text.isEmpty, !alias.isEmpty, alias.count <= 36, kind != .create || text.count <= 64 else {
            problem.text = strings[.circleCheckFields]
            problem.isHidden = false
            return
        }
        view.endEditing(true)
        pending = true
        submit?.isEnabled = false
        titleOrCode.isEnabled = false
        name.isEnabled = false
        navigationItem.hidesBackButton = true
        isModalInPresentation = true
        problem.isHidden = true
        Task { [self] in
            defer {
                pending = false
                submit?.isEnabled = true
                titleOrCode.isEnabled = true
                name.isEnabled = true
                navigationItem.hidesBackButton = false
                isModalInPresentation = false
            }
            do {
                let circle = try await (kind == .create
                    ? client.create(circleID:circleID,title:text,name:alias)
                    : client.join(code:text,name:alias))
                onEntered(circle)
            } catch {
                problem.text = client.errorText(error,strings)
                problem.isHidden = false
                UIAccessibility.post(notification:.announcement, argument:problem.text)
            }
        }
    }
}

private final class WorldCircleFeedViewController: WorldCirclePaperViewController {
    private let link: WorldCircleLink
    private let client: WorldSocialClient
    private let region: () -> String?
    private let onArea: (WorldCircleLink,Int) -> Void
    private let refresh = UIRefreshControl()
    private var areaOnly: Bool
    private var result: WorldCircleSnapshot?
    private var error: Error?
    private var reading = false
    private var leaving = false
    private var visibleMomentLimit = 18

    init(link: WorldCircleLink, client: WorldSocialClient, strings: WorldStrings, region: @escaping () -> String?,
         areaOnly: Bool, onArea: @escaping (WorldCircleLink,Int) -> Void) {
        self.link = link
        self.client = client
        self.region = region
        self.areaOnly = areaOnly
        self.onArea = onArea
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = link.title
        refresh.addAction(UIAction { [weak self] _ in self?.reload() }, for:.valueChanged)
        scroll.refreshControl = refresh
        NotificationCenter.default.addObserver(self, selector:#selector(activated(_:)), name:UIScene.didActivateNotification, object:nil)
        NotificationCenter.default.addObserver(self, selector:#selector(regionChanged), name:.worldSocialRegionDidChange, object:nil)
        render()
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        reload()
    }

    @objc private func activated(_ notification: Notification) {
        guard navigationController?.topViewController === self,
              let scene = viewIfLoaded?.window?.windowScene,
              (notification.object as? UIScene) === scene else { return }
        reload()
    }

    @objc private func regionChanged() {
        if navigationController?.topViewController === self { render() }
    }

    private func reload() {
        guard !reading, !leaving else { return }
        reading = true
        Task { [self] in
            defer {
                reading = false
                refresh.endRefreshing()
                render()
            }
            do {
                result = try await client.snapshot(circleID:link.id)
                error = nil
            } catch {
                self.error = error
                if client.isDefinitiveFailure(error) { result = nil }
            }
        }
    }

    private func render() {
        let offset = scroll.contentOffset
        clearPage()
        guard let result else {
            if let error {
                message(client.errorText(error,strings))
                stack.addArrangedSubview(action(.retry,"arrow.clockwise",id:"world.circle.retry",filled:true) { [weak self] in self?.reload() })
                navigationItem.rightBarButtonItem = makeOptions()
            } else {
                let indicator = UIActivityIndicatorView(style:.medium)
                indicator.startAnimating()
                stack.addArrangedSubview(indicator)
                message(strings[.circleLoading])
            }
            return
        }
        let circle = result.circle
        let currentRegion = region()
        let areaMoments = currentRegion.map { area in result.moments.filter { $0.region == area } } ?? []
        if currentRegion == nil { areaOnly = false }
        onArea(link,areaMoments.count)
        navigationItem.rightBarButtonItems = [makeOptions(),makeRefresh()]
        titleBlock(circle.title, detail:strings[.circlePrivate] + "  ·  " + count(circle.memberCount,.circleMembersFormat))
        let composeTitle: WorldStrings.Key = WorldSocialClient.hasDraft(for:circle.id) ? .circleResumeDraft : .circleShareMoment
        stack.addArrangedSubview(action(composeTitle,"square.and.pencil",id:"world.circle.compose",filled:true) { [weak self] in self?.compose(circle) })
        let library = WorldTheme.button(strings.library(.library), symbol:"books.vertical")
        library.accessibilityIdentifier = "world.circle.library"
        library.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            let page = WorldLibraryViewController(circle:circle, client:client, strings:strings)
            navigationController?.pushViewController(page, animated:!UIAccessibility.isReduceMotionEnabled)
        }, for:.touchUpInside)
        stack.addArrangedSubview(library)
        if circle.canInvite && circle.memberCount == 1 {
            stack.addArrangedSubview(action(.circleInvite,"person.badge.plus",id:"world.circle.invite") { [weak self] in self?.invite() })
        }
        if !result.activity.isEmpty {
            let reply = result.activity[0]
            stack.addArrangedSubview(WorldCircleSlip(title:strings[.circleActivity],
                                                     detail:reply.author.name + "  ·  " + reply.text,
                                                     footer:count(result.activity.count,.circleRepliesFormat),
                                                     ink:0xc27d55,style:reply.author.style.flatMap(WorldCircleInkStyle.init(rawValue:)),id:"world.circle.activity") { [weak self] in self?.openActivity(circle) })
        }
        if currentRegion != nil {
            let segments = UISegmentedControl(items:[strings[.circleAllMoments],strings[.circleThisArea]])
            segments.selectedSegmentIndex = areaOnly ? 1 : 0
            segments.accessibilityIdentifier = "world.circle.area-filter"
            segments.addAction(UIAction { [weak self, weak segments] _ in
                guard let self, let segments else { return }
                self.areaOnly = segments.selectedSegmentIndex == 1
                self.visibleMomentLimit = 18
                self.render()
            }, for:.valueChanged)
            stack.addArrangedSubview(segments)
        }
        if let error { message(client.errorText(error,strings)) }
        let moments = areaOnly ? areaMoments : result.moments
        if moments.isEmpty {
            if areaOnly { message(strings[.circleAreaEmpty]) }
            else {
                let seal = WorldCircleSeal(ink:0x9685ac)
                seal.heightAnchor.constraint(equalToConstant:68).isActive = true
                stack.addArrangedSubview(seal)
                titleBlock(strings[.circleEmptyTitle],detail:strings[.circleEmptyDetail])
            }
        }
        for (index,moment) in moments.prefix(visibleMomentLimit).enumerated() {
            let colors = WorldPigment.placeColors
            let pigment = colors[Int(moment.id.utf8.first ?? 0) % colors.count]
            let title = moment.text.isEmpty ? (moment.photoDescription ?? strings[.circlePhoto]) : moment.text
            let meta = [moment.author.name,date(moment.createdAt)].joined(separator:"  ·  ")
            var signs: [String] = []
            if moment.hasPhoto { signs.append(strings[.circlePhoto]) }
            if moment.region != nil { signs.append(strings[.circleArea]) }
            if moment.replyCount > 0 { signs.append(count(moment.replyCount,.circleRepliesFormat)) }
            if moment.reactionCount > 0 { signs.append(count(moment.reactionCount,.circleReactionsFormat)) }
            let card = WorldCircleSlip(title:title,detail:meta,footer:signs.isEmpty ? nil : signs.joined(separator:"  ·  "),
                                       ink:pigment,style:moment.author.style.flatMap(WorldCircleInkStyle.init(rawValue:)),id:"world.circle.moment.\(index)") { [weak self] in self?.openMoment(circle,id:moment.id) }
            stack.addArrangedSubview(card)
        }
        if moments.count > visibleMomentLimit {
            stack.addArrangedSubview(action(.circleEarlierMoments,"arrow.down",id:"world.circle.earlier") { [weak self] in
                guard let self else { return }
                self.visibleMomentLimit += 18
                self.render()
            })
        }
        view.layoutIfNeeded()
        let maxOffset = max(-scroll.adjustedContentInset.top, scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom)
        scroll.contentOffset.y = max(-scroll.adjustedContentInset.top, min(offset.y,maxOffset))
    }

    private func makeRefresh() -> UIBarButtonItem {
        let item = UIBarButtonItem(image:UIImage(systemName:"arrow.clockwise"), style:.plain,target:self,action:#selector(refreshNow))
        item.accessibilityLabel = strings[.circleRefresh]
        item.accessibilityIdentifier = "world.circle.refresh"
        return item
    }

    @objc private func refreshNow() { reload() }

    private func makeOptions() -> UIBarButtonItem {
        var options = [UIAction(title:strings[.circleBlocked], image:UIImage(systemName:"hand.raised")) { [weak self] _ in self?.openSafety(.blocks) }]
        if let circle = result?.circle {
            options.insert(UIAction(title:strings[.circleStyle], image:UIImage(systemName:"paintpalette")) { [weak self] _ in
                guard let self else { return }
                let style = WorldCircleStyleViewController(circle:circle, client:self.client, strings:self.strings) { [weak self] in self?.reload() }
                self.navigationController?.pushViewController(style, animated:!UIAccessibility.isReduceMotionEnabled)
            }, at:0)
        }
        if result?.circle.canInvite == true {
            options.insert(UIAction(title:strings[.circleInvite], image:UIImage(systemName:"person.badge.plus")) { [weak self] _ in self?.invite() }, at:0)
            options.append(UIAction(title:strings[.circleReports], image:UIImage(systemName:"flag")) { [weak self] _ in self?.openSafety(.reports) })
            if let memberID = result?.circle.me.id {
                options.append(UIAction(title:strings[.circleManageMembers], image:UIImage(systemName:"person.2")) { [weak self] _ in self?.openSafety(.members(excluding:memberID)) })
            }
        }
        options.append(UIAction(title:strings[.circleLeave], image:UIImage(systemName:"rectangle.portrait.and.arrow.right"),
                                attributes:.destructive) { [weak self] _ in self?.confirmLeave() })
        let item = UIBarButtonItem(image:UIImage(systemName:"ellipsis.circle"),menu:UIMenu(children:options))
        item.accessibilityLabel = strings[.circleOptions]
        item.accessibilityIdentifier = "world.circle.options"
        return item
    }

    private func compose(_ circle: WorldCircle) {
        let editor = WorldMomentComposerViewController(circle:circle, region:region, client:client, strings:strings) { [weak self] id in
            guard let self, let nav = self.navigationController,
                  let index = nav.viewControllers.firstIndex(where: { $0 === self }) else { return }
            self.areaOnly = false
            nav.setViewControllers(Array(nav.viewControllers.prefix(index+1)) + [self.detail(circle,id:id)],
                                   animated:!UIAccessibility.isReduceMotionEnabled)
        }
        navigationController?.pushViewController(editor, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func openMoment(_ circle: WorldCircle, id: String) {
        navigationController?.pushViewController(detail(circle,id:id), animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func detail(_ circle: WorldCircle, id: String) -> WorldMomentViewController {
        WorldMomentViewController(circle:circle,momentID:id,client:client,strings:strings) { [weak self] in self?.reload() }
    }

    private func openActivity(_ circle: WorldCircle) {
        let controller = WorldCircleActivityViewController(circle:circle,client:client,strings:strings) { [weak self] in self?.reload() }
        navigationController?.pushViewController(controller,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func invite() {
        let controller = WorldCircleInviteViewController(circleID:link.id,client:client,strings:strings)
        navigationController?.pushViewController(controller,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func openSafety(_ kind: WorldCircleSafetyViewController.Kind) {
        let controller = WorldCircleSafetyViewController(kind:kind,circleID:link.id,client:client,strings:strings)
        navigationController?.pushViewController(controller,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func confirmLeave() {
        confirm(.circleLeave,detail:.circleLeaveDetail) { [weak self] in
            guard let self, !self.leaving else { return }
            self.leaving = true
            self.navigationItem.rightBarButtonItems = nil
            self.isModalInPresentation = true
            self.navigationItem.hidesBackButton = true
            self.view.isUserInteractionEnabled = false
            Task { [self] in
                defer {
                    self.leaving = false
                    self.isModalInPresentation = false
                    self.navigationItem.hidesBackButton = false
                    self.view.isUserInteractionEnabled = true
                }
                do {
                    try await self.client.leave(circleID:self.link.id)
                    self.onArea(self.link,0)
                    self.navigationController?.popViewController(animated:!UIAccessibility.isReduceMotionEnabled)
                } catch {
                    self.render()
                    self.notify(self.client.errorText(error,self.strings))
                }
            }
        }
    }
}

private final class WorldCircleInviteViewController: WorldCirclePaperViewController {
    private let circleID: String
    private let client: WorldSocialClient
    private var code: String?
    private var updating = false

    init(circleID: String, client: WorldSocialClient, strings: WorldStrings) {
        self.circleID = circleID
        self.client = client
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings[.circleInvite]
        load()
    }

    private func load(rotate: Bool = false) {
        guard !updating else { return }
        updating = true
        code = nil
        clearPage()
        titleBlock(strings[.circleInvite],detail:strings[.circleInviteDetail])
        let loading = UIActivityIndicatorView(style:.medium)
        loading.startAnimating()
        stack.addArrangedSubview(loading)
        Task { [self] in
            defer {
                updating = false
                stack.removeArrangedSubview(loading)
                loading.removeFromSuperview()
            }
            do {
                if rotate {
                    do { code = try await client.rotateInvitation(circleID:circleID) }
                    catch where !client.isDefinitiveFailure(error) {
                        // Reconcile using the current code instead of creating another invitation.
                        code = try await client.invite(circleID:circleID)
                    }
                } else { code = try await client.invite(circleID:circleID) }
                let label = WorldTheme.label(code ?? "",style:.body)
                label.font = UIFontMetrics(forTextStyle:.body).scaledFont(for:UIFont.monospacedSystemFont(ofSize:14,weight:.medium))
                label.textAlignment = .center
                label.lineBreakMode = .byCharWrapping
                label.accessibilityIdentifier = "world.circle.invite.code"
                stack.addArrangedSubview(label)
                stack.addArrangedSubview(action(.circleShareCode,"square.and.arrow.up",id:"world.circle.invite.share",filled:true) { [weak self] in self?.share() })
                stack.addArrangedSubview(action(.circleNewInvite,"arrow.trianglehead.clockwise",id:"world.circle.invite.rotate") { [weak self] in
                    self?.confirm(.circleNewInvite,detail:.circleNewInviteDetail) { [weak self] in self?.load(rotate:true) }
                })
            } catch {
                message(client.errorText(error,strings))
                stack.addArrangedSubview(action(.retry,"arrow.clockwise",id:"world.circle.invite.retry") { [weak self] in self?.load() })
            }
        }
    }

    private func share() {
        guard let code else { return }
        let activity = UIActivityViewController(activityItems:[strings[.circleInvite] + " · Asympta World\n" + code], applicationActivities:nil)
        let anchor = stack.arrangedSubviews.first { $0.accessibilityIdentifier == "world.circle.invite.share" } ?? view!
        activity.popoverPresentationController?.sourceView = anchor
        activity.popoverPresentationController?.sourceRect = anchor.bounds
        present(activity,animated:!UIAccessibility.isReduceMotionEnabled)
    }
}

private final class WorldCircleActivityViewController: WorldCirclePaperViewController {
    private let circle: WorldCircle
    private let client: WorldSocialClient
    private let onChanged: () -> Void
    private var reading = false

    init(circle: WorldCircle, client: WorldSocialClient, strings: WorldStrings, onChanged: @escaping () -> Void) {
        self.circle = circle
        self.client = client
        self.onChanged = onChanged
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        title = strings[.circleActivity]
        load()
    }

    private func load() {
        guard !reading else { return }
        reading = true
        clearPage()
        titleBlock(strings[.circleActivity])
        let indicator = UIActivityIndicatorView(style:.medium)
        indicator.startAnimating()
        stack.addArrangedSubview(indicator)
        Task { [self] in
            defer {
                reading = false
                stack.removeArrangedSubview(indicator)
                indicator.removeFromSuperview()
            }
            do {
                let snapshot = try await client.snapshot(circleID:circle.id)
                if snapshot.activity.isEmpty { message(strings[.circleActivityEmpty]) }
                for (index,reply) in snapshot.activity.enumerated() {
                    stack.addArrangedSubview(WorldCircleSlip(title:reply.author.name,detail:reply.text,footer:date(reply.createdAt),
                                                             ink:0xc27d55,style:reply.author.style.flatMap(WorldCircleInkStyle.init(rawValue:)),id:"world.circle.reply-activity.\(index)") { [weak self] in
                        guard let self else { return }
                        let detail = WorldMomentViewController(circle:self.circle,momentID:reply.momentID,
                                                               client:self.client,strings:self.strings,onChanged:self.onChanged)
                        self.navigationController?.pushViewController(detail,animated:!UIAccessibility.isReduceMotionEnabled)
                    })
                }
            } catch {
                message(client.errorText(error,strings))
                stack.addArrangedSubview(action(.retry,"arrow.clockwise",id:"world.circle.activity.retry") { [weak self] in self?.load() })
            }
        }
    }
}

private final class WorldCircleSafetyViewController: WorldCirclePaperViewController {
    enum Kind {
        case reports, blocks, members(excluding: String)

        var title: WorldStrings.Key {
            switch self {
            case .reports: return .circleReports
            case .blocks: return .circleBlocked
            case .members: return .circleManageMembers
            }
        }
    }
    private let kind: Kind
    private let circleID: String
    private let client: WorldSocialClient
    private var reading = false

    init(kind: Kind, circleID: String, client: WorldSocialClient, strings: WorldStrings) {
        self.kind = kind
        self.circleID = circleID
        self.client = client
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings[kind.title]
        load()
    }

    private func load() {
        guard !reading else { return }
        reading = true
        clearPage()
        titleBlock(strings[kind.title])
        let indicator = UIActivityIndicatorView(style:.medium)
        indicator.startAnimating()
        stack.addArrangedSubview(indicator)
        Task { [self] in
            defer {
                reading = false
                stack.removeArrangedSubview(indicator)
                indicator.removeFromSuperview()
            }
            do {
                switch kind {
                case .reports:
                    let reports = try await client.reports(circleID:circleID)
                    if reports.isEmpty { message(strings[.circleReportsEmpty]) }
                    for report in reports { show(report) }
                case .blocks:
                    let members = try await client.blocked(circleID:circleID)
                    if members.isEmpty { message(strings[.circleBlockedEmpty]) }
                    for member in members {
                        let title = member.name.isEmpty ? strings[.circleDepartedMember] : member.name
                        stack.addArrangedSubview(WorldTheme.label(title,style:.headline))
                        stack.addArrangedSubview(action(.circleUnblock,"hand.raised.slash",id:"world.circle.unblock") { [weak self] in
                            guard let self else { return }
                            self.apply { try await self.client.unblock(circleID:self.circleID,memberID:member.id) }
                        })
                    }
                case .members(let selfID):
                    let members = try await client.members(circleID:circleID).filter { $0.id != selfID }
                    if members.isEmpty { message(strings[.circleNoOtherMembers]) }
                    for member in members {
                        stack.addArrangedSubview(WorldTheme.label(member.name,style:.headline))
                        stack.addArrangedSubview(action(.circleRemoveMember,"person.badge.minus",id:"world.circle.member.remove") { [weak self] in
                            self?.confirm(.circleRemoveMember,detail:.circleRemoveMemberDetail) { [weak self] in
                                guard let self else { return }
                                self.apply { try await self.client.removeMember(circleID:self.circleID,memberID:member.id) }
                            }
                        })
                    }
                }
            } catch {
                message(client.errorText(error,strings))
                stack.addArrangedSubview(action(.retry,"arrow.clockwise",id:"world.circle.safety.retry") { [weak self] in self?.load() })
            }
        }
    }

    private func show(_ report: WorldCircleReport) {
        let detail = report.text.isEmpty ? strings[.circlePhoto] : report.text
        stack.addArrangedSubview(WorldCircleSlip(title:report.author.name,detail:detail,
                                                  footer:count(report.reportCount,.circleReportCountFormat),ink:0xbb6346,
                                                  id:"world.circle.report.link") { [weak self] in
            guard let self else { return }
            let review = WorldCircleReviewViewController(report:report,circleID:self.circleID,
                                                        client:self.client,strings:self.strings) { [weak self] in self?.load() }
            self.navigationController?.pushViewController(review, animated:!UIAccessibility.isReduceMotionEnabled)
        })
    }

    private func apply(_ operation: @escaping () async throws -> Void) {
        guard !reading else { return }
        reading = true
        stack.isUserInteractionEnabled = false
        Task { [self] in
            do {
                try await operation()
                reading = false
                stack.isUserInteractionEnabled = true
                load()
            } catch {
                reading = false
                stack.isUserInteractionEnabled = true
                notify(client.errorText(error,strings))
            }
        }
    }
}


private final class WorldCircleStyleViewController: WorldCirclePaperViewController {
    private let circle: WorldCircle
    private let client: WorldSocialClient
    private let onSave: () -> Void
    private var choice: WorldCircleInkStyle
    private var pending = false

    init(circle: WorldCircle, client: WorldSocialClient, strings: WorldStrings, onSave: @escaping () -> Void) {
        self.circle = circle
        self.client = client
        self.onSave = onSave
        choice = circle.me.style.flatMap(WorldCircleInkStyle.init(rawValue:)) ?? .clay
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings[.circleStyle]
        render()
    }

    private func render() {
        let offset = scroll.contentOffset
        clearPage()
        let seal = WorldCircleSeal(ink:choice.color,style:choice)
        seal.heightAnchor.constraint(equalToConstant:98).isActive = true
        stack.addArrangedSubview(seal)
        titleBlock(strings[.circleStyle],detail:strings[.circleStyleDetail])
        for style in WorldCircleInkStyle.allCases {
            let card = WorldCircleSlip(title:strings[style.name],detail:strings[style.note],footer:nil,
                                       ink:style.color,style:style,id:"world.circle.style." + style.rawValue) { [weak self] in
                self?.choice = style
                self?.render()
            }
            if choice == style {
                card.accessibilityTraits.insert(.selected)
                card.layer.borderColor = WorldTheme.ink.cgColor
                card.layer.borderWidth = 1
            }
            stack.addArrangedSubview(card)
        }
        stack.addArrangedSubview(action(.save,"checkmark",id:"world.circle.style.save",filled:true) { [weak self] in self?.save() })
        view.layoutIfNeeded()
        scroll.contentOffset = offset
    }

    private func save() {
        guard !pending else { return }
        pending = true
        stack.isUserInteractionEnabled = false
        navigationItem.hidesBackButton = true
        isModalInPresentation = true
        let chosen = choice
        Task { [self] in
            defer {
                pending = false
                stack.isUserInteractionEnabled = true
                navigationItem.hidesBackButton = false
                isModalInPresentation = false
            }
            do {
                try await client.setStyle(circleID:circle.id, style:chosen)
                onSave()
                navigationController?.popViewController(animated:!UIAccessibility.isReduceMotionEnabled)
            } catch { notify(client.errorText(error,strings)) }
        }
    }
}


private final class WorldCircleReviewViewController: WorldCirclePaperViewController {
    private let report: WorldCircleReport
    private let circleID: String
    private let client: WorldSocialClient
    private let onDecision: () -> Void
    private var changing = false

    init(report: WorldCircleReport, circleID: String, client: WorldSocialClient, strings: WorldStrings, onDecision: @escaping () -> Void) {
        self.report = report
        self.circleID = circleID
        self.client = client
        self.onDecision = onDecision
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings[.circleReportDetail]
        load()
    }

    private func load() {
        guard !changing else { return }
        changing = true
        clearPage()
        titleBlock(strings[.circleReportDetail])
        let indicator = UIActivityIndicatorView(style:.medium)
        indicator.startAnimating()
        stack.addArrangedSubview(indicator)
        Task { [self] in
            defer {
                changing = false
                stack.removeArrangedSubview(indicator)
                indicator.removeFromSuperview()
            }
            do {
                let detail = try await client.reportDetail(circleID:circleID, kind:report.kind, target:report.target)
                render(detail)
            } catch {
                message(client.errorText(error,strings))
                stack.addArrangedSubview(action(.retry,"arrow.clockwise",id:"world.circle.report.retry") { [weak self] in self?.load() })
            }
        }
    }

    private func render(_ detail: WorldCircleReportDetail) {
        let current = detail.report
        let meta = current.author.name + "  ·  " + date(current.createdAt)
        stack.addArrangedSubview(WorldTheme.label(meta,style:.headline))
        message(count(current.reportCount,.circleReportCountFormat))
        for reason in WorldCircleReportReason.allCases {
            if let count = current.reasons?[reason.rawValue], count > 0 {
                message(strings[reason.label] + "  ·  " + count.formatted(.number.locale(strings.language.locale)))
            }
        }
        if !current.text.isEmpty {
            stack.addArrangedSubview(WorldTheme.label(current.text,style:.body))
        }
        if let data = detail.photo, let photo = UIImage(data:data) {
            let picture = UIImageView(image:photo)
            picture.contentMode = .scaleAspectFit
            picture.clipsToBounds = true
            picture.backgroundColor = WorldTheme.mapPaper
            picture.layer.cornerRadius = 14
            picture.isAccessibilityElement = true
            picture.accessibilityLabel = detail.photoDescription ?? strings[.circlePhoto]
            picture.heightAnchor.constraint(equalToConstant:250).isActive = true
            stack.addArrangedSubview(picture)
        }
        stack.addArrangedSubview(action(.circleReportKeep,"checkmark",id:"world.circle.report.keep") { [weak self] in self?.decide(remove:false) })
        stack.addArrangedSubview(action(.circleReportRemove,"trash",id:"world.circle.report.remove") { [weak self] in
            self?.confirm(.circleReportRemove, detail:.circleReportRemoveDetail) { [weak self] in self?.decide(remove:true) }
        })
    }

    private func decide(remove: Bool) {
        guard !changing else { return }
        changing = true
        stack.isUserInteractionEnabled = false
        Task { [self] in
            defer {
                changing = false
                stack.isUserInteractionEnabled = true
            }
            do {
                if remove { try await client.moderate(circleID:circleID,kind:report.kind,target:report.target,action:"remove") }
                else { try await client.resolve(circleID:circleID,kind:report.kind,target:report.target) }
                onDecision()
                navigationController?.popViewController(animated:!UIAccessibility.isReduceMotionEnabled)
            } catch { notify(client.errorText(error,strings)) }
        }
    }
}
