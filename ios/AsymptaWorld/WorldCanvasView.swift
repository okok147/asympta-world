import UIKit

/// Bundled artwork is presentation only; resident raw IDs and personal saves remain stable.
struct WorldArt {
    let paper: UIImage
    let portraits: [WorldResident: UIImage]

    init(bundle: Bundle = .main) throws {
        guard let art = bundle.url(forResource: "Art", withExtension: nil),
              let sheet = UIImage(contentsOfFile: art.appendingPathComponent("Halftone/companions.png").path)?.cgImage else {
            throw CocoaError(.fileReadCorruptFile)
        }
        // Five equal source cells, with transparent padding retained in the original PNG.
        let order: [WorldResident] = [.fox, .cat, .tea, .reader, .bear]
        let cell = CGFloat(sheet.width) / 5
        var pictures: [WorldResident: UIImage] = [:]
        for (index, resident) in order.enumerated() {
            let rect = CGRect(x: CGFloat(index) * cell + cell * 0.065,
                              y: CGFloat(sheet.height) * 0.22,
                              width: cell * 0.87, height: CGFloat(sheet.height) * 0.52).integral
            guard let image = sheet.cropping(to: rect) else { throw CocoaError(.fileReadCorruptFile) }
            pictures[resident] = UIImage(cgImage: image, scale: 2, orientation: .up)
        }
        portraits = pictures
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
        paper = UIGraphicsImageRenderer(size: CGSize(width: 192, height: 192), format: format).image { renderer in
            WorldTheme.paper.setFill(); renderer.fill(CGRect(x: 0, y: 0, width: 192, height: 192))
            var seed: UInt64 = 731
            for _ in 0..<1600 {
                seed = seed &* 6364136223846793005 &+ 1
                let x = CGFloat((seed >> 32) % 1920) / 10
                seed = seed &* 6364136223846793005 &+ 1
                let y = CGFloat((seed >> 32) % 1920) / 10
                UIColor(hex: 0x968b7b).withAlphaComponent(0.025).setFill()
                renderer.cgContext.fillEllipse(in: CGRect(x: x, y: y, width: 0.6, height: 0.35))
            }
        }
    }
}

/// A static, seeded ink impression: no per-frame random noise or gradient glow.
private final class HalftoneAuraView: UIView {
    var ink = WorldTheme.coral { didSet { setNeedsDisplay() } }
    override init(frame: CGRect) { super.init(frame: frame); backgroundColor = .clear; isUserInteractionEnabled = false }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext(), bounds.width > 0 else { return }
        let rx = bounds.width / 2, ry = bounds.height / 2
        let step: CGFloat = 2.4
        for row in 0...Int(bounds.height / step) {
            for column in 0...Int(bounds.width / step) {
                let n = CGFloat(row * 131 + column * 37)
                let x = CGFloat(column) * step + sin(n * 1.7) * 0.55
                let y = CGFloat(row) * step + cos(n * 0.93) * 0.55
                let radius = hypot((x-rx)/rx, (y-ry)/ry)
                guard radius < 1 else { continue }
                let fade = pow(1-radius, 0.65)
                let dot = 0.35 + fade * 0.42
                ctx.setFillColor(ink.withAlphaComponent((0.07 + fade * 0.30)).cgColor)
                ctx.fillEllipse(in: CGRect(x:x-dot/2,y:y-dot/2,width:dot,height:dot))
            }
        }
    }
}

private final class ResidentControl: UIControl {
    let resident: WorldResident
    private let picture: UIImageView
    private let aura = HalftoneAuraView()
    private var moving = false
    init(resident: WorldResident, image: UIImage) {
        self.resident = resident; picture = UIImageView(image: image)
        super.init(frame: CGRect(x:0,y:0,width:96,height:96))
        addSubview(aura)
        picture.contentMode = .scaleAspectFit; picture.isUserInteractionEnabled = false
        addSubview(picture)
        isAccessibilityElement = true; accessibilityTraits = .button
        accessibilityIdentifier = "world.resident.\(resident.rawValue)"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func update(magnification: CGFloat, color: UIColor) {
        let side: CGFloat = resident == .fox ? 62 : 55
        let size = side * magnification
        picture.frame = CGRect(x:(bounds.width-size)/2,y:(bounds.height-size)/2-5,width:size,height:size)
        aura.frame = CGRect(x:0,y:bounds.midY-24,width:bounds.width,height:57)
        aura.ink = color
    }
    func setMoving(_ enabled: Bool) {
        guard moving != enabled else { return }; moving = enabled
        picture.layer.removeAnimation(forKey:"quiet-breath")
        guard enabled else { return }
        let breath = CAKeyframeAnimation(keyPath:"transform.translation.y")
        breath.values = [0,-1,0]; breath.duration = 5.8; breath.repeatCount = .infinity
        breath.timingFunction = CAMediaTimingFunction(name:.easeInEaseOut)
        picture.layer.add(breath,forKey:"quiet-breath")
    }
}

/// Blank paper and independent touch controls. Camera never writes personal state.
final class WorldCanvasView: UIView, UIGestureRecognizerDelegate {
    private let art: WorldArt
    private var residents: [WorldResident: ResidentControl] = [:]
    private var camera = CGPoint.zero
    private var zoom: CGFloat = 1
    private var movement = true
    private var sceneActive = false
    private var mood = AuraMood.gentle
    var onResidentTap: ((WorldResident) -> Void)?
    var onMapInteraction: (() -> Void)?
    var isAtOverview: Bool { zoom <= 0.71 }
    private func position(_ resident: WorldResident) -> CGPoint {
        let p: CGPoint
        switch resident {
        case .fox: p = CGPoint(x:0.50,y:0.49)
        case .cat: p = CGPoint(x:0.25,y:0.30)
        case .tea: p = CGPoint(x:0.79,y:0.39)
        case .reader: p = CGPoint(x:0.17,y:0.66)
        case .bear: p = CGPoint(x:0.80,y:0.59)
        }
        return CGPoint(x:(p.x-0.5)*bounds.width,y:(p.y-0.5)*bounds.height)
    }
    init(art: WorldArt) {
        self.art = art; super.init(frame:.zero)
        isOpaque = true; backgroundColor = WorldTheme.paper; accessibilityIdentifier = "world.canvas"
        for resident in WorldResident.allCases {
            guard let image = art.portraits[resident] else { continue }
            let control = ResidentControl(resident:resident,image:image)
            control.addTarget(self,action:#selector(residentTapped(_:)),for:.touchUpInside)
            addSubview(control); residents[resident] = control
        }
        let pan = UIPanGestureRecognizer(target:self,action:#selector(panned(_:)))
        pan.maximumNumberOfTouches = 1; pan.delegate = self; addGestureRecognizer(pan)
        addGestureRecognizer(UIPinchGestureRecognizer(target:self,action:#selector(pinched(_:))))
        let double = UITapGestureRecognizer(target:self,action:#selector(doubleTapped(_:)))
        double.numberOfTapsRequired = 2; double.delegate = self; addGestureRecognizer(double)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() { super.layoutSubviews(); refresh() }
    override func draw(_ rect: CGRect) { UIColor(patternImage:art.paper).setFill(); UIRectFill(bounds) }
    private func mapPoint(_ p: CGPoint) -> CGPoint { CGPoint(x:camera.x+(p.x-bounds.midX)/zoom,y:camera.y+(p.y-bounds.midY)/zoom) }
    private func refresh() {
        guard bounds.width > 0 else { return }
        camera.x = min(bounds.width,max(-bounds.width,camera.x))
        camera.y = min(bounds.height,max(-bounds.height,camera.y))
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for (resident,control) in residents {
            let p = position(resident)
            control.center = CGPoint(x:(p.x-camera.x)*zoom+bounds.midX,y:(p.y-camera.y)*zoom+bounds.midY)
            control.isHidden = !bounds.intersects(control.frame)
            let color: UIColor = resident == .fox ? mood.color : [.reader,.tea].contains(resident) ? WorldTheme.blue : WorldTheme.straw
            control.update(magnification:min(1.3,max(0.8,zoom)),color:color)
            control.setMoving(movement && sceneActive && window != nil && !control.isHidden && !UIAccessibility.isReduceMotionEnabled)
        }
        CATransaction.commit()
        accessibilityElements = WorldResident.allCases.compactMap { residents[$0] }.filter { !$0.isHidden }
    }
    func overview(animated: Bool = true) { onMapInteraction?(); zoom = 0.7; camera = .zero; refresh() }
    func recenter() { onMapInteraction?(); camera = .zero; zoom = 1; refresh() }
    func adjustZoom(_ factor: CGFloat) { onMapInteraction?(); zoomAt(factor,anchor:CGPoint(x:bounds.midX,y:bounds.midY)) }
    private func zoomAt(_ factor: CGFloat, anchor: CGPoint) {
        let origin = mapPoint(anchor); zoom = min(2.15,max(0.7,zoom*factor))
        camera = CGPoint(x:origin.x-(anchor.x-bounds.midX)/zoom,y:origin.y-(anchor.y-bounds.midY)/zoom); refresh()
    }
    func focus(on resident: WorldResident) { camera = position(resident); zoom = 1.3; refresh() }
    func apply(state: WorldState, strings: WorldStrings) {
        movement = state.movement; mood = state.aura
        for (resident,control) in residents {
            control.accessibilityLabel = strings[resident.nameKey]; control.accessibilityHint = strings[.visit]
            control.accessibilityValue = state.favorites.contains(resident) ? strings[.favorited] : nil
        }
        accessibilityLabel = strings[.world]
        accessibilityCustomActions = [UIAccessibilityCustomAction(name:strings[.overview],target:self,selector:#selector(accessibleOverview)),UIAccessibilityCustomAction(name:strings[.recenter],target:self,selector:#selector(accessibleRecenter))]
        refresh()
    }
    func setSceneActive(_ active: Bool) { sceneActive = active; refresh() }
    override func didMoveToWindow() { super.didMoveToWindow(); refresh() }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool { !(touch.view is UIControl) }
    @objc private func accessibleOverview() -> Bool { overview(); return true }
    @objc private func accessibleRecenter() -> Bool { recenter(); return true }
    @objc private func residentTapped(_ sender: ResidentControl) { onMapInteraction?(); onResidentTap?(sender.resident) }
    @objc private func panned(_ gesture: UIPanGestureRecognizer) {
        if gesture.state == .began { onMapInteraction?() }
        let d = gesture.translation(in:self); camera.x -= d.x/zoom; camera.y -= d.y/zoom
        gesture.setTranslation(.zero,in:self); refresh()
    }
    @objc private func pinched(_ gesture: UIPinchGestureRecognizer) {
        if gesture.state == .began { onMapInteraction?() }
        zoomAt(gesture.scale,anchor:gesture.location(in:self)); gesture.scale = 1
    }
    @objc private func doubleTapped(_ gesture: UITapGestureRecognizer) { onMapInteraction?(); if zoom > 1.5 { recenter() } else { zoomAt(1.6,anchor:gesture.location(in:self)) } }
}
