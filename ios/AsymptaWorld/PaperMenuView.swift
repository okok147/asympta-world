import UIKit

enum WorldSection: Int, CaseIterable {
    case world, meet, aura, me

    var titleKey: WorldStrings.Key {
        switch self { case .world: return .world; case .meet: return .meet; case .aura: return .aura; case .me: return .me }
    }
    var symbol: String {
        switch self { case .world: return "map"; case .meet: return "person.2"; case .aura: return "sparkles"; case .me: return "person.crop.circle" }
    }
}

private final class PaperSurface: UIView {
    private let texture: UIImageView
    private let edge = CAShapeLayer()

    init(image: UIImage) {
        texture = UIImageView(image: image)
        super.init(frame: .zero)
        texture.contentMode = .scaleToFill
        texture.isUserInteractionEnabled = false
        addSubview(texture)
        layer.shadowColor = WorldTheme.ink.cgColor
        layer.shadowOpacity = 0.13
        layer.shadowOffset = CGSize(width: 0, height: 3)
        layer.shadowRadius = 9
        edge.fillColor = UIColor.clear.cgColor
        edge.strokeColor = WorldTheme.line.cgColor
        edge.lineWidth = 0.7
        layer.addSublayer(edge)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        texture.frame = bounds
        guard bounds.width > 8, bounds.height > 8 else { return }
        // A restrained, deterministic paper edge. Real controls remain separate.
        let path = UIBezierPath()
        path.move(to: CGPoint(x: 7, y: 3))
        path.addLine(to: CGPoint(x: bounds.width * 0.23, y: 2))
        path.addLine(to: CGPoint(x: bounds.width * 0.46, y: 4))
        path.addLine(to: CGPoint(x: bounds.width * 0.74, y: 1))
        path.addLine(to: CGPoint(x: bounds.width - 6, y: 4))
        path.addQuadCurve(to: CGPoint(x: bounds.width - 2, y: 10), controlPoint: CGPoint(x: bounds.width, y: 3))
        path.addLine(to: CGPoint(x: bounds.width - 3, y: bounds.height * 0.55))
        path.addLine(to: CGPoint(x: bounds.width - 1, y: bounds.height - 8))
        path.addQuadCurve(to: CGPoint(x: bounds.width - 8, y: bounds.height - 2), controlPoint: CGPoint(x: bounds.width, y: bounds.height))
        path.addLine(to: CGPoint(x: bounds.width * 0.62, y: bounds.height - 3))
        path.addLine(to: CGPoint(x: bounds.width * 0.33, y: bounds.height - 1))
        path.addLine(to: CGPoint(x: 7, y: bounds.height - 4))
        path.addQuadCurve(to: CGPoint(x: 2, y: bounds.height - 10), controlPoint: CGPoint(x: 0, y: bounds.height))
        path.addLine(to: CGPoint(x: 3, y: bounds.height * 0.55))
        path.addLine(to: CGPoint(x: 1, y: 9))
        path.addQuadCurve(to: CGPoint(x: 7, y: 3), controlPoint: CGPoint(x: 1, y: 2))
        path.close()
        let mask = CAShapeLayer()
        mask.path = path.cgPath
        texture.layer.mask = mask
        edge.path = path.cgPath
        layer.shadowPath = path.cgPath
    }
}

private final class SproutView: UIView {
    override func draw(_ rect: CGRect) {
        let stem = UIBezierPath()
        stem.move(to: CGPoint(x: rect.midX, y: rect.height - 8))
        stem.addCurve(to: CGPoint(x: rect.midX + 2, y: 9),
                      controlPoint1: CGPoint(x: rect.midX - 4, y: rect.height * 0.6),
                      controlPoint2: CGPoint(x: rect.midX + 5, y: rect.height * 0.5))
        WorldTheme.ink.withAlphaComponent(0.78).setStroke()
        stem.lineWidth = 1.8
        stem.lineCapStyle = .round
        stem.stroke()
        let leaf = UIBezierPath()
        leaf.move(to: CGPoint(x: rect.midX + 1, y: 25))
        leaf.addQuadCurve(to: CGPoint(x: rect.width - 4, y: 5), controlPoint: CGPoint(x: rect.midX + 2, y: 6))
        leaf.addQuadCurve(to: CGPoint(x: rect.midX + 1, y: 25), controlPoint: CGPoint(x: rect.width - 2, y: 22))
        leaf.close()
        WorldTheme.leaf.withAlphaComponent(0.9).setFill()
        leaf.fill()
        let other = UIBezierPath()
        other.move(to: CGPoint(x: rect.midX, y: 30))
        other.addQuadCurve(to: CGPoint(x: 4, y: 14), controlPoint: CGPoint(x: 3, y: 29))
        other.addQuadCurve(to: CGPoint(x: rect.midX, y: 30), controlPoint: CGPoint(x: rect.midX - 2, y: 15))
        other.close()
        WorldTheme.leaf.withAlphaComponent(0.7).setFill()
        other.fill()
        let ground = UIBezierPath(ovalIn: CGRect(x: rect.midX - 8, y: rect.height - 10, width: 16, height: 4))
        WorldTheme.ink.withAlphaComponent(0.15).setFill()
        ground.fill()
    }
}

final class PaperMenuView: UIView {
    private let paper: PaperSurface
    private let toggle = UIButton(type: .custom)
    private let sprout = SproutView()
    private var buttons: [WorldSection: UIButton] = [:]
    private var strings: WorldStrings
    private(set) var isExpanded = false
    private var selected = WorldSection.world
    var onSelect: ((WorldSection) -> Void)?
    var onExpansionChanged: ((Bool) -> Void)?

    init(paper image: UIImage, strings: WorldStrings) {
        paper = PaperSurface(image: image)
        self.strings = strings
        super.init(frame: .zero)
        accessibilityIdentifier = "world.paper-menu"
        setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        addSubview(paper)
        paper.isHidden = true
        for section in WorldSection.allCases {
            let button = UIButton(type: .system)
            button.tag = section.rawValue
            button.accessibilityIdentifier = "world.menu.\(section)"
            button.addTarget(self, action: #selector(sectionTapped(_:)), for: .touchUpInside)
            button.tintColor = WorldTheme.ink
            paper.addSubview(button)
            buttons[section] = button
        }
        toggle.accessibilityIdentifier = "world.menu.toggle"
        toggle.addTarget(self, action: #selector(toggleMenu), for: .touchUpInside)
        toggle.backgroundColor = WorldTheme.paper.withAlphaComponent(0.92)
        toggle.layer.cornerRadius = 18
        toggle.layer.borderColor = WorldTheme.line.cgColor
        toggle.layer.borderWidth = 0.7
        toggle.layer.shadowColor = WorldTheme.ink.cgColor
        toggle.layer.shadowOpacity = 0.08
        toggle.layer.shadowRadius = 8
        toggle.layer.shadowOffset = CGSize(width: 0, height: 2)
        sprout.backgroundColor = .clear
        sprout.isUserInteractionEnabled = false
        toggle.addSubview(sprout)
        addSubview(toggle)
        updateLabels()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var intrinsicContentSize: CGSize {
        CGSize(width: isExpanded ? 326 : 56, height: 68)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        toggle.frame = CGRect(x: max(0, bounds.width - 56), y: 4, width: 56, height: 60)
        sprout.frame = CGRect(x: 9, y: 5, width: 38, height: 48)
        paper.frame = CGRect(x: 0, y: 0, width: max(0, bounds.width - 64), height: bounds.height)
        let cell = max(0, (paper.bounds.width - 12) / 4)
        for section in WorldSection.allCases {
            buttons[section]?.frame = CGRect(x: 6 + CGFloat(section.rawValue) * cell, y: 7,
                                              width: cell, height: max(44, bounds.height - 14))
        }
    }

    func apply(strings: WorldStrings) {
        self.strings = strings
        updateLabels()
    }

    func select(_ section: WorldSection) {
        selected = section
        updateLabels()
    }

    func collapse() {
        setExpanded(false)
    }

    private func updateLabels() {
        for section in WorldSection.allCases {
            guard let button = buttons[section] else { continue }
            var configuration = UIButton.Configuration.plain()
            configuration.image = UIImage(systemName: section.symbol,
                                          withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .light))
            configuration.imagePlacement = .top
            configuration.imagePadding = 3
            configuration.title = traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? nil : strings[section.titleKey]
            configuration.baseForegroundColor = WorldTheme.ink
            configuration.background.backgroundColor = selected == section ? WorldTheme.leaf.withAlphaComponent(0.09) : .clear
            configuration.background.cornerRadius = 8
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 4, leading: 2, bottom: 4, trailing: 2)
            button.configuration = configuration
            button.titleLabel?.font = WorldTheme.font(.caption1, handwritten: true)
            button.titleLabel?.adjustsFontForContentSizeCategory = true
            button.accessibilityLabel = strings[section.titleKey]
            button.accessibilityTraits = selected == section ? [.button, .selected] : .button
        }
        toggle.accessibilityLabel = strings[isExpanded ? .closeMenu : .openMenu]
        toggle.accessibilityValue = isExpanded ? strings[selected.titleKey] : nil
    }

    private func setExpanded(_ expanded: Bool) {
        guard expanded != isExpanded else { return }
        isExpanded = expanded
        paper.isHidden = !expanded
        invalidateIntrinsicContentSize()
        setNeedsLayout()
        updateLabels()
        onExpansionChanged?(expanded)
        if !UIAccessibility.isReduceMotionEnabled {
            UIView.animate(withDuration: 0.2, delay: 0, options: [.beginFromCurrentState, .curveEaseOut]) {
                self.superview?.layoutIfNeeded()
            }
        } else {
            superview?.layoutIfNeeded()
        }
        if expanded { UIAccessibility.post(notification: .layoutChanged, argument: buttons[selected]) }
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if previousTraitCollection?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory {
            updateLabels()
        }
    }

    @objc private func toggleMenu() { setExpanded(!isExpanded) }

    @objc private func sectionTapped(_ sender: UIButton) {
        guard let section = WorldSection(rawValue: sender.tag) else { return }
        select(section)
        onSelect?(section)
        if section == .world { collapse() }
    }
}
