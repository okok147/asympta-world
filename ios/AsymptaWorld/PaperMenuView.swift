import UIKit

enum WorldSection: Int, CaseIterable {
    case world, meet, aura, me
    var titleKey: WorldStrings.Key {
        switch self { case .world: return .explore; case .meet: return .friends; case .aura: return .aura; case .me: return .home }
    }
    var symbol: String {
        switch self { case .world: return "safari"; case .meet: return "person.2.fill"; case .aura: return "sparkles"; case .me: return "house.fill" }
    }
}

/// Three always-visible destinations; the profile retains Aura/settings/journal access.
final class PaperMenuView: UIView {
    private var buttons: [WorldSection: UIButton] = [:]
    private var strings: WorldStrings
    private var selected = WorldSection.world
    var onSelect: ((WorldSection) -> Void)?
    init(paper image: UIImage, strings: WorldStrings) {
        self.strings = strings; super.init(frame:.zero)
        accessibilityIdentifier = "world.paper-menu"
        for section in [WorldSection.me,.world,.meet] {
            let button = UIButton(type:.system); button.tag = section.rawValue
            button.accessibilityIdentifier = "world.menu.\(section)"
            button.addTarget(self,action:#selector(tapped(_:)),for:.touchUpInside)
            addSubview(button); buttons[section] = button
        }
        updateLabels()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override var intrinsicContentSize: CGSize { CGSize(width:320,height:traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? 88 : 66) }
    override func layoutSubviews() {
        super.layoutSubviews()
        for (i,section) in [WorldSection.me,.world,.meet].enumerated() {
            buttons[section]?.frame = CGRect(x:CGFloat(i)*bounds.width/3,y:0,width:bounds.width/3,height:bounds.height)
        }
    }
    func apply(strings: WorldStrings) { self.strings = strings; updateLabels(); invalidateIntrinsicContentSize() }
    func select(_ section: WorldSection) { selected = section; updateLabels() }
    func collapse() {}
    private func updateLabels() {
        for (section,button) in buttons {
            var config = UIButton.Configuration.plain()
            config.image = UIImage(systemName:section.symbol,withConfiguration:UIImage.SymbolConfiguration(pointSize:24,weight:.light))
            config.imagePlacement = .top; config.imagePadding = 7
            config.attributedTitle = AttributedString(NSAttributedString(string:strings[section.titleKey].uppercased(with:strings.language.locale),attributes:[.kern:1.8]))
            config.baseForegroundColor = section == selected ? WorldTheme.coral : WorldTheme.blue
            config.contentInsets = NSDirectionalEdgeInsets(top:4,leading:2,bottom:4,trailing:2)
            config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { a in
                var result = a; result.font = WorldTheme.font(.subheadline); return result
            }
            button.configuration = config
            button.accessibilityLabel = strings[section.titleKey]
            button.accessibilityTraits = section == selected ? [.button,.selected] : .button
        }
    }
    @objc private func tapped(_ sender: UIButton) {
        guard let section = WorldSection(rawValue:sender.tag) else { return }
        select(section); onSelect?(section)
    }
}
