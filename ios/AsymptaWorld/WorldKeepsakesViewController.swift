import UIKit
import StoreKit
import SafariServices

@MainActor
final class WorldKeepsakesViewController: WorldCirclePaperViewController {
    private let store = WorldKeepsakesStore.shared
    private let onUnlocked: (() -> Void)?
    private let offers = UIStackView()
    private let status = WorldTheme.label("", style:.footnote, muted:true)
    private let spinner = UIActivityIndicatorView(style:.medium)
    private let subscribe = WorldTheme.button("", symbol:"sparkles", filled:true)
    private let restore = WorldTheme.button("", symbol:"arrow.clockwise")
    private let manage = WorldTheme.button("", symbol:"person.crop.circle")
    private let retry = WorldTheme.button("", symbol:"arrow.clockwise")
    private var selectedID: String?
    private var renderedOffers = [String]()
    private var loadTask: Task<Void,Never>?
    private var didUnlock = false
    private var operationMessage: WorldKeepsakesCopy?
    private static let privacyURL = URL(string:"https://asympta-world-aura.asympta-invitation-service.workers.dev/privacy")!
    private static let termsURL = URL(string:"https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!

    init(strings: WorldStrings, onUnlocked: (() -> Void)? = nil) {
        self.onUnlocked = onUnlocked
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings.keepsakes(.title)
        let seal = WorldCircleSeal(ink:0xbb6346, style:.clay)
        seal.heightAnchor.constraint(equalToConstant:78).isActive = true
        stack.addArrangedSubview(seal)
        titleBlock(strings.keepsakes(.title), detail:strings.keepsakes(.introduction))
        feature(.paperTitle, detail:.paperDetail, symbol:"book.closed")
        feature(.attributionTitle, detail:.attributionDetail, symbol:"text.alignleft")
        feature(.sharingTitle, detail:.sharingDetail, symbol:"square.and.arrow.up")

        offers.axis = .vertical
        offers.spacing = 10
        offers.accessibilityIdentifier = "world.keepsakes.plans"
        stack.addArrangedSubview(offers)
        spinner.hidesWhenStopped = true
        stack.addArrangedSubview(spinner)
        status.accessibilityIdentifier = "world.keepsakes.status"
        status.accessibilityTraits.insert(.updatesFrequently)
        stack.addArrangedSubview(status)
        configure(subscribe, .subscribe, id:"world.keepsakes.subscribe") { [weak self] in self?.purchase() }
        configure(retry, .retry, id:"world.keepsakes.retry") { [weak self] in self?.reload() }
        configure(restore, .restore, id:"world.keepsakes.restore") { [weak self] in self?.restorePurchases() }
        configure(manage, .manage, id:"world.keepsakes.manage") { [weak self] in self?.manageSubscription() }
        [subscribe,retry,restore,manage].forEach(stack.addArrangedSubview)

        let renewal = WorldTheme.label(strings.keepsakes(.renewal), style:.footnote, muted:true)
        renewal.accessibilityIdentifier = "world.keepsakes.renewal"
        stack.addArrangedSubview(renewal)
        let privacy = WorldTheme.button(strings.keepsakes(.privacy),symbol:"hand.raised")
        privacy.accessibilityIdentifier = "world.keepsakes.privacy"
        privacy.addAction(UIAction { [weak self] _ in self?.open(Self.privacyURL) },for:.touchUpInside)
        let terms = WorldTheme.button(strings.keepsakes(.terms),symbol:"doc.text")
        terms.accessibilityIdentifier = "world.keepsakes.terms"
        terms.addAction(UIAction { [weak self] _ in self?.open(Self.termsURL) },for:.touchUpInside)
        stack.addArrangedSubview(privacy)
        stack.addArrangedSubview(terms)
        NotificationCenter.default.addObserver(self,selector:#selector(storeChanged),name:.worldKeepsakesDidChange,object:store)
        NotificationCenter.default.addObserver(self,selector:#selector(storeChanged),name:UIContentSizeCategory.didChangeNotification,object:nil)
        update()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        reload()
    }

    deinit {
        loadTask?.cancel()
        NotificationCenter.default.removeObserver(self)
    }

    private func feature(_ heading: WorldKeepsakesCopy, detail: WorldKeepsakesCopy, symbol: String) {
        let headingLabel = WorldTheme.label(strings.keepsakes(heading),style:.headline)
        headingLabel.accessibilityTraits.insert(.header)
        let icon = UIImageView(image:UIImage(systemName:symbol))
        icon.tintColor = WorldTheme.muted
        icon.isAccessibilityElement = false
        icon.widthAnchor.constraint(equalToConstant:24).isActive = true
        let titleRow = UIStackView(arrangedSubviews:[icon,headingLabel])
        titleRow.alignment = .center
        titleRow.spacing = 10
        let group = UIStackView(arrangedSubviews:[titleRow,WorldTheme.label(strings.keepsakes(detail),style:.subheadline,muted:true)])
        group.axis = .vertical
        group.spacing = 7
        stack.addArrangedSubview(group)
    }

    private func configure(_ button: UIButton, _ key: WorldKeepsakesCopy, id: String, run: @escaping () -> Void) {
        button.configuration?.title = strings.keepsakes(key)
        button.accessibilityIdentifier = id
        button.addAction(UIAction { _ in run() },for:.touchUpInside)
    }

    private func reload() {
        loadTask?.cancel()
        operationMessage = nil
        let store = store
        loadTask = Task { [weak self] in
            await store.refresh()
            guard !Task.isCancelled else { return }
            await store.loadProducts()
            guard !Task.isCancelled else { return }
            self?.update()
        }
    }

    @objc private func storeChanged() { update() }

    private func update() {
        guard isViewLoaded else { return }
        let available = store.products
        if selectedID == nil || !available.contains(where:{ $0.id == selectedID }) {
            selectedID = available.first?.id
        }
        // Rebuild only when the displayed offers change, preserving reading focus.
        let signature = available.map { $0.id + "|" + $0.displayPrice + "|" + String($0.price.description) } + [selectedID ?? "",String(store.hasAccess),traitCollection.preferredContentSizeCategory.rawValue]
        if signature != renderedOffers {
            renderedOffers = signature
            for child in offers.arrangedSubviews {
                offers.removeArrangedSubview(child)
                child.removeFromSuperview()
            }
            if store.hasAccess {
                let active = WorldTheme.label(strings.keepsakes(.active),style:.headline)
                active.accessibilityIdentifier = "world.keepsakes.active"
                offers.addArrangedSubview(active)
                offers.addArrangedSubview(WorldTheme.label(strings.keepsakes(.activeDetail),style:.subheadline,muted:true))
            } else {
                for product in available { offers.addArrangedSubview(offer(product)) }
            }
        }
        let working = store.checking || store.loadingProducts || store.busy
        if working { spinner.startAnimating() } else { spinner.stopAnimating() }
        let currentMessage = operationMessage ?? store.message
        let displayed = currentMessage ?? (store.checking ? .checking : store.loadingProducts ? .loading : nil)
        status.text = displayed.map(strings.keepsakes)
        status.isHidden = displayed == nil
        offers.isHidden = store.checking
        subscribe.isHidden = store.hasAccess || available.isEmpty || store.checking
        subscribe.isEnabled = !working && selectedID != nil
        retry.isHidden = !available.isEmpty || store.checking || store.loadingProducts
        retry.isEnabled = !working
        restore.isEnabled = !working
        manage.isEnabled = !working
        offers.isUserInteractionEnabled = !working
        if let product = available.first(where:{ $0.id == selectedID }) {
            subscribe.configuration?.title = strings.keepsakes(.subscribe)
            subscribe.configuration?.subtitle = price(product)
            subscribe.accessibilityLabel = strings.keepsakes(.subscribe) + ", " + price(product)
        }
        if store.hasAccess, !didUnlock, !store.busy {
            didUnlock = true
            onUnlocked?()
        }
    }

    private func offer(_ product: Product) -> UIButton {
        let selected = product.id == selectedID
        let yearly = product.id == WorldKeepsakesStore.yearlyID
        var configuration = UIButton.Configuration.plain()
        configuration.title = strings.keepsakes(yearly ? .yearly : .monthly)
        configuration.subtitle = price(product)
        configuration.titleAlignment = .leading
        configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var attributes = incoming
            attributes.font = WorldTheme.font(.body)
            return attributes
        }
        configuration.subtitleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var attributes = incoming
            attributes.font = WorldTheme.font(.footnote)
            return attributes
        }
        configuration.baseForegroundColor = WorldTheme.ink
        configuration.image = UIImage(systemName:selected ? "checkmark.circle.fill" : "circle")
        configuration.imagePadding = 12
        configuration.contentInsets = NSDirectionalEdgeInsets(top:14,leading:14,bottom:14,trailing:14)
        let button = UIButton(configuration:configuration)
        button.contentHorizontalAlignment = .leading
        button.layer.cornerRadius = 16
        button.layer.borderWidth = selected ? 1.4 : 0.7
        button.layer.borderColor = (selected ? WorldTheme.muted : WorldTheme.line).cgColor
        button.backgroundColor = selected ? WorldTheme.mapPaper.withAlphaComponent(0.55) : .clear
        button.titleLabel?.font = WorldTheme.font(.body)
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.titleLabel?.numberOfLines = 0
        button.heightAnchor.constraint(greaterThanOrEqualToConstant:68).isActive = true
        button.accessibilityIdentifier = yearly ? "world.keepsakes.plan.yearly" : "world.keepsakes.plan.monthly"
        button.accessibilityLabel = [configuration.title,configuration.subtitle].compactMap({ $0 }).joined(separator:", ")
        if selected { button.accessibilityTraits.insert(.selected) }
        button.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            selectedID = product.id
            operationMessage = nil
            update()
        },for:.touchUpInside)
        return button
    }

    private func price(_ product: Product) -> String {
        strings.keepsakesPrice(product.displayPrice,yearly:product.id == WorldKeepsakesStore.yearlyID)
    }

    private func purchase() {
        guard let product = store.products.first(where:{ $0.id == selectedID }), !store.busy else { return }
        operationMessage = nil
        let store = store
        Task { [weak self] in
            do {
                let outcome = try await store.purchase(product:product)
                if case .cancelled = outcome { self?.operationMessage = nil }
            } catch {
                self?.operationMessage = (error as? WorldKeepsakesStore.Failure)?.message ?? .purchaseFailed
            }
            self?.update()
        }
    }

    private func restorePurchases() {
        guard !store.busy else { return }
        operationMessage = nil
        let store = store
        Task { [weak self] in
            do { _ = try await store.restore() }
            catch { self?.operationMessage = .restoreFailed }
            self?.update()
        }
    }

    private func manageSubscription() {
        guard !store.busy, let scene = view.window?.windowScene else { return }
        operationMessage = nil
        let store = store
        Task { [weak self] in
            do { try await store.manage(windowScene:scene) }
            catch { self?.operationMessage = .manageFailed }
            self?.update()
        }
    }

    private func open(_ url: URL) {
        let browser = SFSafariViewController(url:url)
        present(browser,animated:!UIAccessibility.isReduceMotionEnabled)
    }
}
