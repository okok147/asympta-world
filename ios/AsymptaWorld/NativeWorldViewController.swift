import UIKit
import CoreLocation

final class NativeWorldViewController: UIViewController, UIAdaptivePresentationControllerDelegate {
    private let store = WorldStore()
    private let cloud = WorldCloudSession()
    private let location = WorldLocation()
    private lazy var social = WorldSocialClient { [weak self] path in self?.cloud.circleRequest(path) }
    private let atlas = UIView()
    private let heading = UIStackView()
    private let headingTitle = WorldTheme.label("Asympta World", style:.title2)
    private let headingContext = WorldTheme.label("", style:.footnote, muted:true)
    private let modeButton = UIButton(type:.system)
    private let spaceButton = UIButton(type:.system)
    private let circlesButton = UIButton(type:.system)
    private let areaButton = UIButton(type:.system)
    private let circleUnread = UILabel()
    private var areaCount = 0
    private var unreadCount = 0
    private var unreadIncomplete = false
    private var inboxTask: Task<Void,Never>?
    private var areaLink: WorldCircleLink?
    private var areaLinkRegion: String?
    private var lastAvailableRegion: String?
    private var summaryTask: Task<Void,Never>?
    private let overviewButton = UIButton(type:.system)
    private let recenterButton = UIButton(type:.system)
    private let mapCredit = UIButton(type:.system)
    private var atlasTrailing: NSLayoutConstraint!
    private var atlasBottom: NSLayoutConstraint!
    private var locationCard: UIStackView?
    private var locationMessage: WorldStrings.Key?
    private var nearbyEnabled = UserDefaults.standard.object(forKey:"world.nearbyEnabled") as? Bool ?? true
    private var mapReady = false
    private var mapCell: WorldMapCell?
    private var pendingRegion: (point: CGPoint, radius: Double)?
    private var connected = false
    private var nearbyPeers: [WorldCloudPeer] = []

    private var art: WorldArt?
    private var canvas: WorldCanvasView?
    private var errorStack: UIStackView?
    private var inspector: UINavigationController?
    private var inspectorConstraints: [NSLayoutConstraint] = []
    private var inspectorWidthConstraint: NSLayoutConstraint?
    private var inspectorAtSide: Bool?
    private var isClosingPanel = false
    private var retiredForRecovery = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = WorldTheme.mapPaper
        Task { await WorldKeepsakesStore.shared.refresh() }
        let notifications = NotificationCenter.default
        notifications.addObserver(self, selector:#selector(stateChanged), name:.watercolorWorldDidChange, object:store)
        notifications.addObserver(self, selector:#selector(sceneActivated(_:)), name:UIScene.didActivateNotification, object:nil)
        notifications.addObserver(self, selector:#selector(sceneDeactivated(_:)), name:UIScene.willDeactivateNotification, object:nil)
        notifications.addObserver(self, selector:#selector(inboxChanged), name:.worldSocialInboxDidChange, object:social)
        notifications.addObserver(self, selector:#selector(stateChanged), name:UIAccessibility.reduceMotionStatusDidChangeNotification, object:nil)
        notifications.addObserver(self, selector:#selector(stateChanged), name:UIContentSizeCategory.didChangeNotification, object:nil)

        atlas.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(atlas)
        atlasTrailing = atlas.trailingAnchor.constraint(equalTo:view.trailingAnchor)
        atlasBottom = atlas.bottomAnchor.constraint(equalTo:view.bottomAnchor)
        NSLayoutConstraint.activate([
            atlas.leadingAnchor.constraint(equalTo:view.leadingAnchor), atlas.topAnchor.constraint(equalTo:view.topAnchor),
            atlasTrailing, atlasBottom
        ])
        openWorld()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if view.window?.windowScene?.activationState == .foregroundActive { setActivity(true) }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        layoutInspector()
        canvas?.captionTopEdge = max(heading.frame.maxY, locationCard?.frame.maxY ?? 0)
        canvas?.captionBottomInset = 66 + (areaButton.isHidden ? 0 : areaButton.bounds.height + 10)
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    private func openWorld() {
        do {
            let art = try WorldArt(userInk:cloud.identityInk)
            self.art = art
            errorStack?.removeFromSuperview()
            errorStack = nil
            let world = WorldCanvasView(art:art, userInk:cloud.identityInk)
            world.frame = atlas.bounds
            world.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            world.onAgentTap = { [weak self, weak world] id in
                guard let snapshot = world?.snapshot(id) else { return }
                self?.show(.agent(snapshot))
            }
            world.onAuraGroupTap = { [weak self] values in self?.show(.auras(values)) }
            atlas.addSubview(world)
            canvas = world
            world.restoreAbilities(cloud.abilities)
            world.onGrowth = { [weak self] values in self?.cloud.record(values) }
            cloud.onAbilities = { [weak world] values in world?.restoreAbilities(values) }
            cloud.currentActivity = { [weak world] in world?.snapshot(0)?.activity.rawValue ?? 0 }
            cloud.onPeers = { [weak self, weak world] peers in
                guard let self else { return }
                self.nearbyPeers = peers
                if self.mapReady { world?.setPeers(peers) }
            }
            cloud.onConnection = { [weak self] value in self?.connected = value }
            cloud.onMap = { [weak self, weak world] sheet in
                guard let self, self.nearbyEnabled, let region = self.pendingRegion,
                      let cell = self.mapCell, sheet.cellX == cell.x, sheet.cellY == cell.y else { return }
                world?.locateUser(region.point, radius:region.radius)
                world?.setMap(sheet)
                self.mapReady = true
                world?.setPeers(self.nearbyPeers)
                self.locationMessage = nil
                self.updateModeUI()
                self.refreshCircleSummary()
            }
            cloud.onMapFailure = { [weak self] in self?.mapFailed() }
            location.onLocation = { [weak self, weak world] coordinate, accuracy in
                guard let self, self.nearbyEnabled else { return }
                let cell = WorldMapCell(coordinate)
                let region = (cell.approximatePoint(coordinate), max(200,accuracy))
                self.pendingRegion = region
                if self.mapCell != cell {
                    self.mapCell = cell
                    self.mapReady = false
                    self.locationMessage = .mapLoading
                    world?.showLocalWorld()
                    self.updateModeUI()
                } else if self.mapReady {
                    world?.locateUser(region.0, radius:region.1)
                }
                self.cloud.updateLocation(coordinate, accuracy:accuracy)
            }
            location.onStatus = { [weak self] status in
                guard let self, self.nearbyEnabled else { return }
                if status == .denied || status == .restricted {
                    self.resetGeography()
                }
                self.updateModeUI()
            }
            location.onFailure = { [weak self] in self?.mapFailed() }
            configureAtlasControls()
            applyState()
        } catch {
            showArtError()
        }
    }

    private func setActivity(_ active: Bool) {
        guard !retiredForRecovery else { return }
        canvas?.setSceneActive(active)
        location.setActive(active && nearbyEnabled)
        cloud.setActive(active)
        if active {
            refreshCircleSummary()
            refreshInboxBadge()
        } else {
            summaryTask?.cancel()
            inboxTask?.cancel()
        }
    }

    private func resetGeography() {
        mapReady = false
        mapCell = nil
        pendingRegion = nil
        locationMessage = nil
        cloud.clearLocation()
        canvas?.showLocalWorld()
    }

    private func selectLocalWorld() {
        nearbyEnabled = false
        UserDefaults.standard.set(false, forKey:"world.nearbyEnabled")
        location.setActive(false)
        resetGeography()
        updateModeUI()
    }

    private func selectNearbyMap() {
        nearbyEnabled = true
        UserDefaults.standard.set(true, forKey:"world.nearbyEnabled")
        let active = view.window?.windowScene?.activationState == .foregroundActive
        location.setActive(active)
        if location.authorization == .notDetermined { location.request() }
        updateModeUI()
    }

    private func mapFailed() {
        guard nearbyEnabled, !mapReady else { return }
        locationMessage = .mapUnavailable
        updateModeUI()
    }

    private func applyState() {
        let strings = store.strings
        view.accessibilityLanguage = store.state.language.rawValue
        canvas?.apply(state:store.state, strings:strings)
        spaceButton.accessibilityLabel = strings[.personalCorner]
        circlesButton.accessibilityLabel = strings[.circles]
        overviewButton.accessibilityLabel = strings[.overview]
        recenterButton.accessibilityLabel = strings[.returnToLight]
        mapCredit.setTitle(strings[.mapAttribution], for:.normal)
        updateModeUI()
    }

    private func configureAtlasControls() {
        func icon(_ button: UIButton, symbol: String, id: String, action: UIAction? = nil) {
            var config = UIButton.Configuration.plain()
            config.image = UIImage(systemName:symbol, withConfiguration:UIImage.SymbolConfiguration(pointSize:19, weight:.medium))
            config.baseForegroundColor = WorldTheme.ink
            config.baseBackgroundColor = .clear
            config.contentInsets = .zero
            button.configuration = config
            button.accessibilityIdentifier = id
            button.widthAnchor.constraint(equalToConstant:44).isActive = true
            button.heightAnchor.constraint(equalToConstant:44).isActive = true
            if let action { button.addAction(action, for:.touchUpInside) }
        }
        func paperCapsule(_ controls: [UIView]) -> UIStackView {
            let row = UIStackView(arrangedSubviews:controls)
            row.spacing = 2
            row.backgroundColor = WorldTheme.paper
            row.layer.cornerRadius = 23
            row.layer.borderColor = WorldTheme.line.cgColor
            row.layer.borderWidth = 0.6
            return row
        }

        icon(modeButton, symbol:"map", id:"world.mode")
        modeButton.showsMenuAsPrimaryAction = true
        icon(spaceButton, symbol:"person.crop.circle", id:"world.space", action:UIAction { [weak self] _ in self?.show(.me) })
        icon(circlesButton, symbol:"person.2", id:"world.circles", action:UIAction { [weak self] _ in self?.showCircles() })
        circleUnread.translatesAutoresizingMaskIntoConstraints = false
        circleUnread.backgroundColor = UIColor(hex:0x934932)
        circleUnread.textColor = .white
        circleUnread.font = UIFont.monospacedDigitSystemFont(ofSize:9, weight:.semibold)
        circleUnread.textAlignment = .center
        circleUnread.layer.cornerRadius = 7
        circleUnread.clipsToBounds = true
        circleUnread.isAccessibilityElement = false
        circleUnread.isHidden = true
        circlesButton.addSubview(circleUnread)
        NSLayoutConstraint.activate([
            circleUnread.topAnchor.constraint(equalTo:circlesButton.topAnchor, constant:4),
            circleUnread.trailingAnchor.constraint(equalTo:circlesButton.trailingAnchor, constant:-2),
            circleUnread.widthAnchor.constraint(equalToConstant:18),
            circleUnread.heightAnchor.constraint(equalToConstant:14)
        ])
        icon(overviewButton, symbol:"arrow.up.left.and.arrow.down.right", id:"world.camera.overview", action:UIAction { [weak self] _ in self?.canvas?.overview() })
        icon(recenterButton, symbol:"location", id:"world.camera.recenter", action:UIAction { [weak self] _ in self?.canvas?.recenter() })

        headingTitle.accessibilityTraits.insert(.header)
        let titles = UIStackView(arrangedSubviews:[headingTitle, headingContext])
        titles.axis = .vertical
        titles.spacing = 3
        heading.alignment = .center
        heading.spacing = 12
        heading.addArrangedSubview(titles)
        heading.addArrangedSubview(paperCapsule([modeButton, circlesButton, spaceButton]))

        let camera = paperCapsule([overviewButton, recenterButton])
        mapCredit.titleLabel?.font = WorldTheme.font(.caption2)
        mapCredit.titleLabel?.adjustsFontSizeToFitWidth = true
        mapCredit.titleLabel?.minimumScaleFactor = 0.72
        mapCredit.tintColor = WorldTheme.muted
        mapCredit.backgroundColor = WorldTheme.paper
        mapCredit.layer.cornerRadius = 8
        mapCredit.accessibilityIdentifier = "world.map.attribution"
        mapCredit.addAction(UIAction { _ in UIApplication.shared.open(URL(string:"https://www.openstreetmap.org/copyright")!) }, for:.touchUpInside)

        var areaConfiguration = UIButton.Configuration.tinted()
        areaConfiguration.image = UIImage(systemName:"circle.hexagongrid.fill")
        areaConfiguration.imagePadding = 7
        areaConfiguration.baseBackgroundColor = WorldTheme.paper
        areaConfiguration.baseForegroundColor = WorldTheme.ink
        areaConfiguration.cornerStyle = .capsule
        areaConfiguration.contentInsets = NSDirectionalEdgeInsets(top:7,leading:12,bottom:7,trailing:12)
        areaButton.configuration = areaConfiguration
        areaButton.titleLabel?.adjustsFontForContentSizeCategory = true
        areaButton.accessibilityIdentifier = "world.atlas.area-moments"
        areaButton.isHidden = true
        areaButton.addAction(UIAction { [weak self] _ in
            guard let self, let link = self.areaLink, self.areaLinkRegion == self.socialRegion else { return }
            self.showCircles(initialLink:link)
        }, for:.touchUpInside)

        [heading, camera, mapCredit, areaButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            atlas.addSubview($0)
        }
        let safe = atlas.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            heading.topAnchor.constraint(equalTo:safe.topAnchor, constant:12),
            heading.leadingAnchor.constraint(equalTo:safe.leadingAnchor, constant:18),
            heading.trailingAnchor.constraint(equalTo:safe.trailingAnchor, constant:-18),
            camera.trailingAnchor.constraint(equalTo:safe.trailingAnchor, constant:-16),
            camera.bottomAnchor.constraint(equalTo:safe.bottomAnchor, constant:-10),
            mapCredit.centerYAnchor.constraint(equalTo:camera.centerYAnchor),
            mapCredit.leadingAnchor.constraint(equalTo:safe.leadingAnchor, constant:16),
            mapCredit.trailingAnchor.constraint(lessThanOrEqualTo:camera.leadingAnchor, constant:-10),
            mapCredit.heightAnchor.constraint(greaterThanOrEqualToConstant:44),
            areaButton.leadingAnchor.constraint(equalTo:safe.leadingAnchor, constant:16),
            areaButton.trailingAnchor.constraint(lessThanOrEqualTo:safe.trailingAnchor, constant:-16),
            areaButton.bottomAnchor.constraint(equalTo:camera.topAnchor, constant:-10),
            areaButton.heightAnchor.constraint(greaterThanOrEqualToConstant:44)
        ])
    }

    private func updateModeUI() {
        guard canvas != nil else { return }
        let s = store.strings
        headingContext.text = s[mapReady ? .nearbyAtlas : .localAtlas]
        modeButton.accessibilityLabel = s[.atlasMode]
        modeButton.accessibilityValue = headingContext.text
        modeButton.menu = UIMenu(children:[
            UIAction(title:s[.nearbyAtlas], image:UIImage(systemName:"location"), state:nearbyEnabled ? .on : .off) { [weak self] _ in self?.selectNearbyMap() },
            UIAction(title:s[.localAtlas], image:UIImage(systemName:"sparkles"), state:nearbyEnabled ? .off : .on) { [weak self] _ in self?.selectLocalWorld() }
        ])
        mapCredit.isHidden = !mapReady
        let current = socialRegion
        if lastAvailableRegion != current {
            lastAvailableRegion = current
            NotificationCenter.default.post(name:.worldSocialRegionDidChange, object:self)
        }
        renderCircleSummary()
        updateLocationCard()
    }

    private func updateLocationCard() {
        locationCard?.removeFromSuperview()
        locationCard = nil
        guard nearbyEnabled, !mapReady else { return }

        let s = store.strings
        let status = location.authorization
        let denied = status == .denied || status == .restricted
        let title = WorldTheme.label(s[.locationMapTitle], style:.headline)
        let detail = WorldTheme.label(s[denied ? .locationDenied : locationMessage ?? .locationMapDetail], style:.footnote, muted:true)
        let key: WorldStrings.Key = denied ? .openSettings : locationMessage == .mapUnavailable ? .retry : .useLocation
        let button = WorldTheme.button(s[key], symbol:denied ? "location.slash" : "location", filled:true)
        button.accessibilityIdentifier = "world.location.enable"
        button.isHidden = locationMessage == .mapLoading && !denied
        button.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            if denied { UIApplication.shared.open(URL(string:UIApplication.openSettingsURLString)!) }
            else {
                if self.locationMessage == .mapUnavailable {
                    self.locationMessage = .mapLoading
                    self.updateLocationCard()
                    self.cloud.retryMap()
                }
                self.location.request()
            }
        }, for:.touchUpInside)
        let local = WorldTheme.button(s[.exploreLocalAtlas], symbol:"sparkles")
        local.accessibilityIdentifier = "world.location.local"
        local.addAction(UIAction { [weak self] _ in self?.selectLocalWorld() }, for:.touchUpInside)

        let card = UIStackView(arrangedSubviews:[title, detail, button, local])
        card.axis = .vertical
        card.spacing = 8
        card.isLayoutMarginsRelativeArrangement = true
        card.directionalLayoutMargins = NSDirectionalEdgeInsets(top:18, leading:18, bottom:10, trailing:18)
        card.backgroundColor = WorldTheme.paper
        card.layer.cornerRadius = 18
        card.layer.borderColor = WorldTheme.line.cgColor
        card.layer.borderWidth = 0.6
        card.translatesAutoresizingMaskIntoConstraints = false
        card.accessibilityIdentifier = "world.location.card"
        atlas.addSubview(card)
        locationCard = card
        let width = card.widthAnchor.constraint(equalToConstant:340)
        width.priority = .defaultHigh
        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo:heading.bottomAnchor, constant:14),
            card.centerXAnchor.constraint(equalTo:atlas.safeAreaLayoutGuide.centerXAnchor),
            card.leadingAnchor.constraint(greaterThanOrEqualTo:atlas.safeAreaLayoutGuide.leadingAnchor, constant:18),
            card.trailingAnchor.constraint(lessThanOrEqualTo:atlas.safeAreaLayoutGuide.trailingAnchor, constant:-18),
            width
        ])
    }

    private var hasRoomForInspector: Bool {
        view.bounds.width >= 880 && view.bounds.width > view.bounds.height
    }

    private var socialRegion: String? {
        guard mapReady, let cell = mapCell else { return nil }
        return "\(cell.x):\(cell.y)"
    }

    private func refreshCircleSummary() {
        guard !retiredForRecovery else { return }
        summaryTask?.cancel()
        guard canvas != nil, let link = social.selectedCircle, let region = socialRegion else {
            updateCircleSummary(link:nil, area:0)
            return
        }
        summaryTask = Task { [weak self] in
            guard let self else { return }
            do {
                let snapshot = try await social.snapshot(circleID:link.id)
                guard !Task.isCancelled, social.selectedCircle?.id == link.id, region == socialRegion else { return }
                let nearby = snapshot.moments.filter { $0.region == region }.count
                updateCircleSummary(link:link, area:nearby)
            } catch {
                guard !Task.isCancelled, social.isDefinitiveFailure(error) else { return }
                updateCircleSummary(link:nil, area:0)
            }
        }
    }

    @objc private func inboxChanged() {
        if view.window?.windowScene?.activationState == .foregroundActive { refreshInboxBadge() }
    }

    private func refreshInboxBadge() {
        guard !retiredForRecovery else { return }
        inboxTask?.cancel()
        let social = social
        inboxTask = Task { [weak self] in
            guard let inbox = try? await social.inbox(), !Task.isCancelled, let self else { return }
            updateInboxBadge(inbox)
        }
    }

    private func updateInboxBadge(_ inbox: WorldCircleInbox) {
        unreadCount = inbox.count
        unreadIncomplete = inbox.hasMore || inbox.partial
        renderCircleSummary()
    }

    private func updateCircleSummary(link: WorldCircleLink?, area: Int) {
        areaLink = link
        areaLinkRegion = socialRegion
        areaCount = area
        renderCircleSummary()
    }

    private func renderCircleSummary() {
        let s = store.strings
        circleUnread.isHidden = unreadCount == 0
        circleUnread.text = unreadCount > 9 ? "9+" : "\(unreadCount)\(unreadIncomplete ? "+" : "")"
        let unreadLabel: WorldStrings.Key = unreadIncomplete ? .circleInboxUnreadMoreFormat : .circleInboxUnreadFormat
        circlesButton.accessibilityValue = unreadCount == 0 ? nil : String(format:s[unreadLabel], locale:s.language.locale, unreadCount)
        areaButton.isHidden = areaCount == 0 || socialRegion == nil || areaLinkRegion != socialRegion
        let label = s.count(areaCount, .circleAreaCountFormat)
        areaButton.configuration?.title = label
        areaButton.accessibilityLabel = label
        view.setNeedsLayout()
    }

    private func canOpenPanel() -> Bool {
        guard presentedViewController == nil, !isClosingPanel else { return false }
        guard let inspector else { return true }
        guard let current = inspector.topViewController, current.presentedViewController == nil,
              inspector.presentedViewController == nil else { return false }
        // Preserve drafts and nested social navigation while the atlas remains interactive.
        guard current is WorldPanelsViewController ||
            (inspector.viewControllers.count == 1 && current is WorldCirclesViewController) else { return false }
        current.view.endEditing(true)
        return true
    }

    private func showCircles(initialLink: WorldCircleLink? = nil) {
        guard canOpenPanel() else { return }
        let panel = WorldCirclesViewController(client:social, strings:store.strings, region:{ [weak self] in self?.socialRegion },
                                               initialLink:initialLink, onArea:{ [weak self] link, count in
            guard let self else { return }
            self.summaryTask?.cancel()
            self.social.select(link)
            self.updateCircleSummary(link:link, area:count)
        }, onInbox:{ [weak self] inbox in
            self?.inboxTask?.cancel()
            self?.updateInboxBadge(inbox)
        }, onClose:{ [weak self] in self?.closePanel() })
        showPanel(panel, large:true)
    }

    private func show(_ content: WorldPanelsViewController.Content) {
        guard let art, canOpenPanel() else { return }
        let panel = WorldPanelsViewController(content:content, store:store, art:art) { [weak self] resident in
            self?.closePanel { [weak self] in self?.canvas?.focus(on:resident) }
        }
        panel.onRecovery = { [weak self, weak panel] in
            guard let self, let nav = panel?.navigationController else { return }
            let recovery = WorldRecoveryViewController(strings:self.store.strings, makeSnapshot:{ [weak self] in
                guard let self, !self.retiredForRecovery else { throw WorldRecoveryError.unavailable }
                return try self.cloud.recoverySnapshot(directory:self.social.recoveryDirectory())
            }, apply:{ [weak self] payload in
                guard let self else { throw WorldRecoveryError.unavailable }
                try self.applyRecovery(payload)
            })
            nav.pushViewController(recovery,animated:!UIAccessibility.isReduceMotionEnabled)
        }
        panel.onRemoval = { [weak self, weak panel] in
            guard let self, !self.retiredForRecovery, let nav = panel?.navigationController else { return }
            let removal = WorldRemovalViewController(strings:self.store.strings, makeIntent:{ [weak self] in
                guard let self, !self.retiredForRecovery else { throw WorldRemovalError.unavailable }
                let snapshot = try self.cloud.recoverySnapshot(directory:self.social.recoveryDirectory())
                return try WorldRemovalIntent.make(snapshot:snapshot, language:self.store.state.language)
            }, begin:{ [weak self] intent in
                guard let self else { throw WorldRemovalError.unavailable }
                try self.applyRemoval(intent)
            })
            nav.pushViewController(removal, animated:!UIAccessibility.isReduceMotionEnabled)
        }
        panel.cloudConnected = connected
        panel.growthSynced = cloud.growthSynced
        panel.onClose = { [weak self] in self?.closePanel() }
        if case .me = content { showPanel(panel, large:true) }
        else { showPanel(panel, large:false) }
    }

    private func applyRecovery(_ payload: WorldRecoveryPayload) throws {
        guard !retiredForRecovery, let window = view.window,
              window.windowScene?.activationState == .foregroundActive else { throw WorldRecoveryError.unavailable }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.filter { $0.activationState != .unattached }
        guard scenes.count == 1 else { throw WorldRecoveryError.multipleScenes }
        try WorldRecoveryCommit.stage(payload)
        retireForIdentityChange()
        // Rebuild only this scene. Failed replay presents the protected retry
        // surface; it never revives the old controller or creates an identity.
        dismiss(animated:false)
        SceneDelegate.installWorld(in:window)
    }

    private func applyRemoval(_ intent: WorldRemovalIntent) throws {
        guard !retiredForRecovery, let window = view.window else { throw WorldRemovalError.unavailable }
        try WorldRemovalPresentation.requireForeground(in:window)
        // No shutdown or request is permitted before this protected write succeeds.
        try WorldRemovalJournal.stage(intent)
        retireForIdentityChange()
        let install: () -> Void = { [weak window] in
            guard let window else { return }
            SceneDelegate.installWorld(in:window)
        }
        // Let existing presentation/disappearance saves finish before the standalone
        // removal surface can start its foreground work.
        if presentedViewController != nil { dismiss(animated:false, completion:install) }
        else { install() }
    }

    private func retireForIdentityChange() {
        retiredForRecovery = true
        view.endEditing(true)
        NotificationCenter.default.removeObserver(self)
        summaryTask?.cancel(); inboxTask?.cancel()
        summaryTask = nil; inboxTask = nil
        location.onLocation = nil; location.onStatus = nil; location.onFailure = nil
        location.setActive(false)
        canvas?.onGrowth = nil
        canvas?.setSceneActive(false)
        cloud.stopForRecovery()
        social.stopForRecovery()
    }

    private func showPanel(_ panel: UIViewController, large: Bool) {
        if let inspector {
            inspector.setViewControllers([panel], animated:false)
            UIAccessibility.post(notification:.screenChanged, argument:inspector.navigationBar)
            return
        }

        let nav = UINavigationController(rootViewController:panel)
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = WorldTheme.paper
        appearance.shadowColor = .clear
        appearance.titleTextAttributes = [.foregroundColor:WorldTheme.ink, .font:WorldTheme.font(.headline)]
        nav.navigationBar.standardAppearance = appearance
        nav.navigationBar.scrollEdgeAppearance = appearance
        nav.navigationBar.tintColor = WorldTheme.ink
        if hasRoomForInspector {
            addChild(nav)
            nav.view.translatesAutoresizingMaskIntoConstraints = false
            nav.view.backgroundColor = WorldTheme.paper
            nav.view.layer.borderColor = WorldTheme.line.cgColor
            nav.view.layer.borderWidth = 0.6
            nav.view.accessibilityIdentifier = "world.inspector"
            view.addSubview(nav.view)
            inspector = nav
            layoutInspector()
            nav.didMove(toParent:self)
            UIAccessibility.post(notification:.screenChanged, argument:nav.navigationBar)
        } else {
            nav.modalPresentationStyle = .pageSheet
            nav.preferredContentSize = CGSize(width:500, height:700)
            if let sheet = nav.sheetPresentationController {
                sheet.detents = [.custom(identifier:.init("paper")) { $0.maximumDetentValue * 0.78 }, .large()]
                if large { sheet.selectedDetentIdentifier = .large }
                else { sheet.selectedDetentIdentifier = .init("paper") }
                sheet.prefersGrabberVisible = true
                sheet.preferredCornerRadius = 24
            }
            nav.presentationController?.delegate = self
            canvas?.setCovered(true)
            present(nav, animated:!UIAccessibility.isReduceMotionEnabled)
        }
    }

    private func layoutInspector() {
        guard let inspector else { return }
        let side = hasRoomForInspector
        let width = min(min(max(view.bounds.width * 0.36, 360), 520), view.bounds.width - 480)
        guard inspectorAtSide != side else {
            if side, let inspectorWidthConstraint, inspectorWidthConstraint.constant != width {
                inspectorWidthConstraint.constant = width
            }
            return
        }
        inspectorAtSide = side
        NSLayoutConstraint.deactivate(inspectorConstraints)
        inspectorWidthConstraint = nil
        atlasTrailing.isActive = !side
        atlasBottom.isActive = side
        let panel = inspector.view!
        let edge = [
            panel.trailingAnchor.constraint(equalTo:view.trailingAnchor),
            panel.bottomAnchor.constraint(equalTo:view.bottomAnchor)
        ]
        if side {
            let widthConstraint = panel.widthAnchor.constraint(equalToConstant:width)
            inspectorWidthConstraint = widthConstraint
            inspectorConstraints = edge + [
                panel.topAnchor.constraint(equalTo:view.topAnchor),
                widthConstraint,
                atlas.trailingAnchor.constraint(equalTo:panel.leadingAnchor)
            ]
        } else {
            inspectorConstraints = edge + [
                panel.leadingAnchor.constraint(equalTo:view.leadingAnchor),
                panel.heightAnchor.constraint(equalTo:view.heightAnchor, multiplier:0.60),
                atlas.bottomAnchor.constraint(equalTo:panel.topAnchor)
            ]
        }
        NSLayoutConstraint.activate(inspectorConstraints)
    }

    private func closePanel(completion: (() -> Void)? = nil) {
        if let inspector {
            inspector.willMove(toParent:nil)
            NSLayoutConstraint.deactivate(inspectorConstraints)
            inspectorConstraints = []
            inspectorWidthConstraint = nil
            inspector.view.removeFromSuperview()
            inspector.removeFromParent()
            self.inspector = nil
            inspectorAtSide = nil
            atlasTrailing.isActive = true
            atlasBottom.isActive = true
            UIAccessibility.post(notification:.screenChanged, argument:headingTitle)
            completion?()
        } else {
            isClosingPanel = true
            dismiss(animated:!UIAccessibility.isReduceMotionEnabled) { [weak self] in
                self?.isClosingPanel = false
                self?.canvas?.setCovered(false)
                completion?()
            }
        }
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        canvas?.setCovered(false)
    }

    private func showArtError() {
        let s = store.strings
        errorStack?.removeFromSuperview()
        let title = WorldTheme.label(s[.artMissingTitle], style:.title2)
        let detail = WorldTheme.label(s[.artMissingDetail], muted:true)
        title.textAlignment = .center
        detail.textAlignment = .center
        let retry = WorldTheme.button(s[.retry], symbol:"arrow.clockwise")
        retry.addAction(UIAction { [weak self] _ in self?.openWorld() }, for:.touchUpInside)
        let stack = UIStackView(arrangedSubviews:[title,detail,retry])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo:view.safeAreaLayoutGuide.centerYAnchor),
            stack.centerXAnchor.constraint(equalTo:view.centerXAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo:view.safeAreaLayoutGuide.leadingAnchor, constant:28),
            stack.trailingAnchor.constraint(lessThanOrEqualTo:view.safeAreaLayoutGuide.trailingAnchor, constant:-28),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant:420)
        ])
        errorStack = stack
    }

    @objc private func stateChanged() { applyState() }
    @objc private func sceneActivated(_ notification: Notification) {
        if (notification.object as? UIScene) === view.window?.windowScene { setActivity(true) }
    }
    @objc private func sceneDeactivated(_ notification: Notification) {
        if (notification.object as? UIScene) === view.window?.windowScene { setActivity(false) }
    }
}
