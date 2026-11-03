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

final class PaperMenuView: UIView {
    private let paper = UIView()
    private let toggle = UIButton(type: .system)
    private let divider = UIView()
    private var buttons: [WorldSection: UIButton] = [:]
    private var mapButtons: [UIButton] = []
    private var strings: WorldStrings
    private(set) var isExpanded = false
    private var selected = WorldSection.world
    var onSelect: ((WorldSection) -> Void)?
    var onMapAction: ((Int) -> Void)?
    var onExpansionChanged: ((Bool) -> Void)?

    init(paper image: UIImage, strings: WorldStrings) {
        self.strings = strings
        super.init(frame:.zero)
        accessibilityIdentifier = "world.paper-menu"
        paper.backgroundColor = UIColor(hex:0xfdfbf6).withAlphaComponent(0.98)
        paper.layer.cornerRadius = 22
        paper.layer.borderColor = WorldTheme.line.cgColor
        paper.layer.borderWidth = 0.7
        paper.layer.shadowColor = WorldTheme.ink.cgColor
        paper.layer.shadowOffset = CGSize(width:0,height:5)
        paper.layer.shadowRadius = 13; paper.layer.shadowOpacity = 0.07
        addSubview(paper); paper.isHidden = true
        for section in WorldSection.allCases {
            let button = UIButton(type:.system)
            button.tag = section.rawValue
            button.accessibilityIdentifier = "world.menu.\(section)"
            button.contentHorizontalAlignment = .leading
            button.addTarget(self,action:#selector(sectionTapped(_:)),for:.touchUpInside)
            paper.addSubview(button); buttons[section] = button
        }
        divider.backgroundColor = WorldTheme.line
        paper.addSubview(divider)
        for (i,symbol) in ["minus","location","plus","arrow.up.left.and.arrow.down.right"].enumerated() {
            let button = UIButton(type:.system)
            button.tag = i
            button.tintColor = WorldTheme.muted
            button.setImage(UIImage(systemName:symbol,withConfiguration:UIImage.SymbolConfiguration(pointSize:16,weight:.light)),for:.normal)
            button.accessibilityIdentifier = ["world.zoom.out","world.recenter","world.zoom.in","world.overview"][i]
            button.addTarget(self,action:#selector(mapTapped(_:)),for:.touchUpInside)
            paper.addSubview(button); mapButtons.append(button)
        }
        toggle.accessibilityIdentifier = "world.menu.toggle"
        toggle.addTarget(self,action:#selector(toggleMenu),for:.touchUpInside)
        toggle.backgroundColor = UIColor(hex:0xfffcf7).withAlphaComponent(0.96)
        toggle.tintColor = WorldTheme.ink
        toggle.layer.cornerRadius = 17
        toggle.layer.borderWidth = 0.7
        toggle.layer.borderColor = WorldTheme.line.cgColor
        toggle.layer.shadowColor = WorldTheme.ink.cgColor
        toggle.layer.shadowOpacity = 0.05; toggle.layer.shadowRadius = 5
        toggle.layer.shadowOffset = CGSize(width:0,height:2)
        addSubview(toggle)
        updateLabels()
    }
    required init?(coder:NSCoder) { fatalError("init(coder:) has not been implemented") }
    private var rowHeight: CGFloat { traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? 54 : 44 }
    private var cardWidth: CGFloat { traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? 205 : 184 }
    override var intrinsicContentSize: CGSize { CGSize(width:isExpanded ? cardWidth+63 : 48,height:isExpanded ? rowHeight*4+70 : 48) }
    override func layoutSubviews() {
        super.layoutSubviews()
        toggle.frame = CGRect(x:bounds.width-48,y:bounds.height-48,width:48,height:48)
        paper.frame = CGRect(x:0,y:0,width:bounds.width-63,height:bounds.height)
        for section in WorldSection.allCases { buttons[section]?.frame = CGRect(x:8,y:8+CGFloat(section.rawValue)*rowHeight,width:paper.bounds.width-16,height:rowHeight) }
        divider.frame = CGRect(x:16,y:rowHeight*4+15,width:paper.bounds.width-32,height:0.7)
        let width = (paper.bounds.width-8)/4
        for (i,button) in mapButtons.enumerated() { button.frame = CGRect(x:4+CGFloat(i)*width,y:rowHeight*4+21,width:width,height:44) }
        paper.layer.shadowPath = UIBezierPath(roundedRect:paper.bounds,cornerRadius:22).cgPath
    }
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        toggle.frame.contains(point) || (isExpanded && paper.frame.contains(point))
    }
    func apply(strings:WorldStrings) { self.strings = strings; updateLabels() }
    func select(_ section:WorldSection) { selected = section; updateLabels() }
    func collapse() { setExpanded(false) }
    private func updateLabels() {
        for section in WorldSection.allCases {
            guard let button = buttons[section] else { continue }
            var config = UIButton.Configuration.plain()
            config.image = UIImage(systemName:section.symbol,withConfiguration:UIImage.SymbolConfiguration(pointSize:18,weight:.light))
            config.imagePadding = 11
            config.title = strings[section.titleKey]
            config.baseForegroundColor = WorldTheme.ink
            config.background.backgroundColor = section == selected ? UIColor(hex:0xede9e0).withAlphaComponent(0.6) : .clear
            config.background.cornerRadius = 13
            config.contentInsets = NSDirectionalEdgeInsets(top:6,leading:11,bottom:6,trailing:5)
            config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
                var result = incoming; result.font = WorldTheme.font(.subheadline,handwritten:true); return result
            }
            button.configuration = config
            button.accessibilityLabel = strings[section.titleKey]
            button.accessibilityTraits = section == selected ? [.button,.selected] : .button
        }
        toggle.setImage(UIImage(systemName:isExpanded ? "xmark" : "line.3.horizontal.decrease",withConfiguration:UIImage.SymbolConfiguration(pointSize:19,weight:.light)),for:.normal)
        toggle.accessibilityLabel = strings[isExpanded ? .closeMenu : .openMenu]
        toggle.accessibilityValue = isExpanded ? strings[selected.titleKey] : nil
        let labels:[WorldStrings.Key] = [.zoomOut,.recenter,.zoomIn,.overview]
        for (i,button) in mapButtons.enumerated() { button.accessibilityLabel = strings[labels[i]] }
    }
    private func setExpanded(_ expanded:Bool) {
        guard expanded != isExpanded else { return }
        isExpanded = expanded
        paper.isHidden = !expanded
        invalidateIntrinsicContentSize(); superview?.layoutIfNeeded(); updateLabels()
        onExpansionChanged?(expanded)
        if expanded && !UIAccessibility.isReduceMotionEnabled {
            paper.alpha = 0; paper.transform = CGAffineTransform(translationX:17,y:7).scaledBy(x:0.92,y:0.92)
            UIView.animate(withDuration:0.28,delay:0,options:[.beginFromCurrentState,.curveEaseOut]) { self.paper.alpha = 1; self.paper.transform = .identity }
        } else { paper.alpha = 1; paper.transform = .identity }
        if expanded { UIAccessibility.post(notification:.layoutChanged,argument:buttons[selected]) }
    }
    override func traitCollectionDidChange(_ previous:UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        if previous?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory { invalidateIntrinsicContentSize(); setNeedsLayout(); updateLabels() }
    }
    @objc private func toggleMenu() { setExpanded(!isExpanded) }
    @objc private func sectionTapped(_ sender:UIButton) {
        guard let section = WorldSection(rawValue:sender.tag) else { return }
        select(section); collapse(); onSelect?(section)
    }
    @objc private func mapTapped(_ sender:UIButton) { collapse(); onMapAction?(sender.tag) }
}
