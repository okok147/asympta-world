import UIKit

final class NativeWorldViewController: UIViewController, UIAdaptivePresentationControllerDelegate {
    private let store = WorldStore()
    private var art: WorldArt?
    private var canvas: WorldCanvasView?
    private var menu: PaperMenuView?
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

    deinit { NotificationCenter.default.removeObserver(self) }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    private func openWorld() {
        do {
            let art = try WorldArt()
            self.art = art
            errorStack?.removeFromSuperview()
            errorStack = nil
            let world = WorldCanvasView(art: art)
            world.frame = view.bounds
            world.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            world.onResidentTap = { [weak self] resident in self?.show(.resident(resident)) }
            view.addSubview(world)
            canvas = world

            let brand = UIStackView()
            brand.axis = .vertical; brand.spacing = 1
            brand.translatesAutoresizingMaskIntoConstraints = false
            brand.isUserInteractionEnabled = false
            brand.isAccessibilityElement = true
            brand.accessibilityLabel = "Asympta World"
            brand.accessibilityTraits = .header
            let word = UILabel()
            word.text = "Asympta ☼"
            word.textColor = WorldTheme.ink
            word.font = UIFont(name:"BradleyHandITCTT-Bold",size:32) ?? UIFont.italicSystemFont(ofSize:32)
            let subtitle = UILabel()
            subtitle.attributedText = NSAttributedString(string:"WORLD",attributes:[.font:UIFont.systemFont(ofSize:9,weight:.medium),.kern:3,.foregroundColor:WorldTheme.muted])
            brand.addArrangedSubview(word); brand.addArrangedSubview(subtitle)
            view.addSubview(brand)

            let paperMenu = PaperMenuView(paper: art.paper, strings: store.strings)
            paperMenu.translatesAutoresizingMaskIntoConstraints = false
            paperMenu.onSelect = { [weak self] section in self?.select(section) }
            paperMenu.onMapAction = { [weak self] action in
                switch action {
                case 0: self?.canvas?.adjustZoom(1/1.3)
                case 1: self?.canvas?.recenter()
                case 2: self?.canvas?.adjustZoom(1.3)
                default: self?.canvas?.overview()
                }
            }
            world.onMapInteraction = { [weak paperMenu] in paperMenu?.collapse() }
            view.addSubview(paperMenu)
            menu = paperMenu

            NSLayoutConstraint.activate([
                brand.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:18),
                brand.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor,constant:25),
                brand.widthAnchor.constraint(equalToConstant:190),
                paperMenu.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor,constant:-24),
                paperMenu.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor,constant:-23),
                paperMenu.leadingAnchor.constraint(greaterThanOrEqualTo:view.safeAreaLayoutGuide.leadingAnchor,constant:12)
            ])
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
        menu?.apply(strings: strings)
    }

    private func select(_ section: WorldSection) {
        switch section {
        case .world:
            // Returning from a panel keeps the person's camera exactly where it was.
            if presentedViewController != nil { dismiss(animated: !UIAccessibility.isReduceMotionEnabled) }
        case .meet: show(.meet)
        case .aura: show(.aura)
        case .me: show(.me)
        }
    }

    private func show(_ content: WorldPanelsViewController.Content) {
        guard let art, presentedViewController == nil else { return }
        menu?.collapse()
        let panel = WorldPanelsViewController(content: content, store: store, art: art) { [weak self] resident in
            guard let self else { return }
            self.dismiss(animated: !UIAccessibility.isReduceMotionEnabled) {
                self.menu?.select(.world)
                self.canvas?.focus(on: resident)
            }
        }
        panel.onClose = { [weak self] in self?.menu?.select(.world) }
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
        switch content {
        case .meet, .resident: menu?.select(.meet)
        case .aura: menu?.select(.aura)
        case .me: menu?.select(.me)
        }
        present(navigation, animated: !UIAccessibility.isReduceMotionEnabled)
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        menu?.select(.world)
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
        canvas?.setSceneActive(UIApplication.shared.applicationState == .active)
    }

    @objc private func stateChanged() { applyState() }
    @objc private func activityChanged(_ notification: Notification) {
        canvas?.setSceneActive(notification.name == UIApplication.didBecomeActiveNotification)
    }
    @objc private func accessibilityChanged() { applyState(); updateActivity() }
}
