import UIKit
import CoreLocation

final class NativeWorldViewController: UIViewController, UIAdaptivePresentationControllerDelegate {
    private let store = WorldStore()
    private let cloud = WorldCloudSession()
    private let location = WorldLocation()
    private var locationCard: UIStackView?
    private let mapCredit = UIButton(type:.system)
    private var mapReady = false, connected = false
    private var mapCell: WorldMapCell?
    private var locationMessage: WorldStrings.Key?

    private var art: WorldArt?
    private var canvas: WorldCanvasView?
    private var errorStack: UIStackView?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = WorldTheme.paper
        NotificationCenter.default.addObserver(self, selector: #selector(stateChanged),
                                               name: .watercolorWorldDidChange, object: store)
        NotificationCenter.default.addObserver(self, selector: #selector(activityChanged(_:)),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(activityChanged(_:)),
                                               name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged),
                                               name: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged),
                                               name: UIContentSizeCategory.didChangeNotification, object: nil)
        openWorld()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        canvas?.captionTopEdge = locationCard?.frame.maxY ?? 0
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    private func openWorld() {
        do {
            let art = try WorldArt(userInk:cloud.identityInk)
            self.art = art
            errorStack?.removeFromSuperview()
            errorStack = nil
            let world = WorldCanvasView(art: art,userInk:cloud.identityInk)
            world.frame = view.bounds
            world.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            world.onAgentTap = { [weak self, weak world] id in
                guard let snapshot = world?.snapshot(id) else { return }
                self?.show(.agent(snapshot))
            }
            world.onAuraGroupTap = { [weak self] values in self?.show(.auras(values)) }
            view.addSubview(world)
            canvas = world
            world.restoreAbilities(cloud.abilities)
            world.onGrowth = { [weak self] values in self?.cloud.record(values) }
            cloud.onAbilities = { [weak world] values in world?.restoreAbilities(values) }
            cloud.currentActivity = { [weak world] in world?.snapshot(0)?.activity.rawValue ?? 0 }
            cloud.onPeers = { [weak world] peers in world?.setPeers(peers) }
            cloud.onConnection = { [weak self] value in self?.connected = value }
            cloud.onMap = { [weak self,weak world] sheet in
                guard let self else { return }; world?.setMap(sheet); self.mapReady = true
                self.locationCard?.removeFromSuperview()
                self.locationCard = nil
                world?.captionTopEdge = 0
                self.mapCredit.isHidden = false
            }
            cloud.onMapFailure = { [weak self] in guard let self,!self.mapReady else { return }; self.locationMessage = .mapUnavailable; self.updateLocationCard() }
            location.onLocation = { [weak self,weak world] coordinate,accuracy in
                guard let self else { return }; let cell = WorldMapCell(coordinate)
                if self.mapCell != cell { self.mapCell = cell; self.mapReady = false; world?.clearMap(); self.mapCredit.isHidden = true }
                world?.locateUser(cell.approximatePoint(coordinate),radius:max(200,accuracy))
                self.cloud.updateLocation(coordinate,accuracy:accuracy)
                if !self.mapReady { self.locationMessage = .mapLoading; self.updateLocationCard() }
            }
            location.onStatus = { [weak self] _ in self?.updateLocationCard() }
            location.onFailure = { [weak self] in guard let self,!self.mapReady else { return }; self.locationMessage = .mapUnavailable; self.updateLocationCard() }
            configureMapCredit()
            updateLocationCard()
            applyState()
            updateActivity()
        } catch {
            showArtError()
        }
    }

    private func applyState() {
        let strings = store.strings
        view.accessibilityLanguage = store.state.language.rawValue
        canvas?.apply(state: store.state, strings: strings)
        mapCredit.setTitle(strings[.mapAttribution],for:.normal)
        updateLocationCard()
    }

    private func show(_ content: WorldPanelsViewController.Content) {
        guard let art, presentedViewController == nil else { return }
        let panel = WorldPanelsViewController(content: content, store: store, art: art) { [weak self] resident in
            guard let self else { return }
            self.dismiss(animated: !UIAccessibility.isReduceMotionEnabled) {
                self.canvas?.focus(on: resident)
                self.canvas?.setCovered(false)
            }
        }
        panel.cloudConnected = connected
        panel.growthSynced = cloud.growthSynced
        panel.onClose = { [weak self] in self?.canvas?.setCovered(false) }
        let navigation = UINavigationController(rootViewController: panel)
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = WorldTheme.paper
        appearance.shadowColor = .clear
        appearance.titleTextAttributes = [.foregroundColor: WorldTheme.ink, .font: WorldTheme.font(.headline)]
        navigation.navigationBar.standardAppearance = appearance
        navigation.navigationBar.scrollEdgeAppearance = appearance
        navigation.navigationBar.tintColor = WorldTheme.ink
        navigation.modalPresentationStyle = .pageSheet
        navigation.preferredContentSize = CGSize(width: 500, height: 700)
        if let sheet = navigation.sheetPresentationController {
            sheet.detents = [.custom(identifier:.init("paper")) { context in context.maximumDetentValue * 0.78 }, .large()]
            switch content {
            case .me: sheet.selectedDetentIdentifier = .large
            default: sheet.selectedDetentIdentifier = .init("paper")
            }
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 24
            sheet.prefersEdgeAttachedInCompactHeight = true
            sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = true
        }
        navigation.presentationController?.delegate = self
        canvas?.setCovered(true)
        present(navigation, animated: !UIAccessibility.isReduceMotionEnabled)
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        canvas?.setCovered(false)
    }

    private func showArtError() {
        let s = store.strings
        errorStack?.removeFromSuperview()
        let title = WorldTheme.label(s[.artMissingTitle], style: .title2)
        let detail = WorldTheme.label(s[.artMissingDetail], muted: true)
        title.textAlignment = .center
        detail.textAlignment = .center
        let retry = WorldTheme.button(s[.retry], symbol: "arrow.clockwise")
        retry.addAction(UIAction { [weak self] _ in self?.openWorld() }, for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [title, detail, retry])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -28),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 420)
        ])
        errorStack = stack
    }

    private func updateActivity() {
        let active = UIApplication.shared.applicationState == .active
        canvas?.setSceneActive(active); location.setActive(active); cloud.setActive(active)
    }

    private func configureMapCredit() {
        mapCredit.translatesAutoresizingMaskIntoConstraints = false
        mapCredit.titleLabel?.font = WorldTheme.font(.caption2); mapCredit.tintColor = WorldTheme.muted
        mapCredit.backgroundColor = WorldTheme.paper.withAlphaComponent(0.85); mapCredit.layer.cornerRadius = 6
        mapCredit.accessibilityIdentifier = "world.map.attribution"; mapCredit.isHidden = true
        mapCredit.addAction(UIAction { _ in UIApplication.shared.open(URL(string:"https://www.openstreetmap.org/copyright")!) },for:.touchUpInside)
        view.addSubview(mapCredit)
        NSLayoutConstraint.activate([mapCredit.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor,constant:-4),mapCredit.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor,constant:-10),mapCredit.heightAnchor.constraint(greaterThanOrEqualToConstant:28)])
    }
    private func updateLocationCard() {
        guard !mapReady,canvas != nil else { return }
        locationCard?.removeFromSuperview()
        let s = store.strings,status = location.authorization,denied = status == .denied || status == .restricted
        let title = WorldTheme.label(s[.locationMapTitle],style:.headline)
        let detail = WorldTheme.label(s[denied ? .locationDenied : locationMessage ?? .locationMapDetail],style:.footnote,muted:true)
        let key: WorldStrings.Key = denied ? .openSettings : locationMessage == .mapUnavailable ? .retry : .useLocation
        let button = WorldTheme.button(s[key],symbol:denied ? "location.slash":"location")
        button.accessibilityIdentifier = "world.location.enable"
        button.isHidden = locationMessage == .mapLoading && !denied
        button.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            if denied { UIApplication.shared.open(URL(string:UIApplication.openSettingsURLString)!) }
            else if self.locationMessage == .mapUnavailable { self.locationMessage = .mapLoading; self.updateLocationCard(); self.cloud.retryMap(); self.location.request() }
            else { self.location.request() }
        },for:.touchUpInside)
        let card = UIStackView(arrangedSubviews:[title,detail,button]); card.axis = .vertical; card.spacing = 10
        card.isLayoutMarginsRelativeArrangement = true; card.layoutMargins = UIEdgeInsets(top:16,left:16,bottom:16,right:16)
        card.backgroundColor = WorldTheme.paper.withAlphaComponent(0.96); card.layer.cornerRadius = 16; card.translatesAutoresizingMaskIntoConstraints = false
        card.accessibilityIdentifier = "world.location.card"; view.addSubview(card); locationCard = card
        NSLayoutConstraint.activate([card.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:20),card.centerXAnchor.constraint(equalTo:view.centerXAnchor),card.widthAnchor.constraint(lessThanOrEqualToConstant:320),card.leadingAnchor.constraint(greaterThanOrEqualTo:view.leadingAnchor,constant:18),card.trailingAnchor.constraint(lessThanOrEqualTo:view.trailingAnchor,constant:-18)])
    }

    @objc private func stateChanged() { applyState() }
    @objc private func activityChanged(_ notification: Notification) {
        updateActivity()
    }
    @objc private func accessibilityChanged() { applyState(); updateActivity() }
}
