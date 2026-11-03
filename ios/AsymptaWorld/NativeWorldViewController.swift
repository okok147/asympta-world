import UIKit

final class NativeWorldViewController: UIViewController, UIAdaptivePresentationControllerDelegate {
    private let store = WorldStore()
    private var art: WorldArt?
    private var canvas: WorldCanvasView?
    private var errorStack: UIStackView?
    private let zoomOut = UIButton(type:.system)
    private let zoomIn = UIButton(type:.system)
    private let returnToUser = UIButton(type:.system)

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
            world.onAgentTap = { [weak self, weak world] id in
                guard let snapshot = world?.snapshot(id) else { return }
                self?.show(.agent(snapshot))
            }
            view.addSubview(world)
            canvas = world

            let zoomRow = UIStackView(arrangedSubviews:[zoomOut,zoomIn,returnToUser])
            zoomRow.axis = .horizontal; zoomRow.spacing = 2
            zoomRow.translatesAutoresizingMaskIntoConstraints = false
            for (button,symbol,id,factor) in [(zoomOut,"minus","world.zoom.out",1/1.3),(zoomIn,"plus","world.zoom.in",1.3)] {
                button.setImage(UIImage(systemName:symbol,withConfiguration:UIImage.SymbolConfiguration(pointSize:17,weight:.light)),for:.normal)
                button.tintColor = WorldTheme.blue
                button.accessibilityIdentifier = id
                button.widthAnchor.constraint(equalToConstant:44).isActive = true
                button.heightAnchor.constraint(equalToConstant:44).isActive = true
                button.addAction(UIAction { [weak self] _ in self?.canvas?.adjustZoom(factor) },for:.touchUpInside)
            }
            returnToUser.setImage(UIImage(systemName:"location",withConfiguration:UIImage.SymbolConfiguration(pointSize:17,weight:.light)),for:.normal)
            returnToUser.tintColor = WorldTheme.blue
            returnToUser.accessibilityIdentifier = "world.recenter"
            returnToUser.widthAnchor.constraint(equalToConstant:44).isActive = true
            returnToUser.heightAnchor.constraint(equalToConstant:44).isActive = true
            returnToUser.addAction(UIAction { [weak self] _ in self?.canvas?.recenter() },for:.touchUpInside)
            world.onZoomChange = { [weak self] value in
                self?.zoomOut.isEnabled = value>0.451
                self?.zoomIn.isEnabled = value<3.499
            }
            view.addSubview(zoomRow)

            NSLayoutConstraint.activate([
                zoomRow.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor,constant:-20),
                zoomRow.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor,constant:10)
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
        zoomOut.accessibilityLabel = strings[.zoomOut]
        zoomIn.accessibilityLabel = strings[.zoomIn]
        returnToUser.accessibilityLabel = strings[.returnToLight]
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
        canvas?.setSceneActive(UIApplication.shared.applicationState == .active)
    }

    @objc private func stateChanged() { applyState() }
    @objc private func activityChanged(_ notification: Notification) {
        canvas?.setSceneActive(notification.name == UIApplication.didBecomeActiveNotification)
    }
    @objc private func accessibilityChanged() { applyState(); updateActivity() }
}
