import UIKit

/// The reference artwork is bundled, offline and separate from the user's saved state.
struct WorldArt {
    struct Topology: Decodable {
        struct Stroke: Decodable { let id: String; let kind: String; let points: [[CGFloat]] }
        let strokes: [Stroke]
        let nodes: [[CGFloat]]
    }
    let topology: Topology
    let paper: UIImage
    let portraits: [WorldResident: UIImage]
    let positions: [WorldResident: CGPoint] = [
        .fox: CGPoint(x: 20, y: -155), .reader: CGPoint(x: -118, y: 140),
        .bear: CGPoint(x: 92, y: 260), .tea: CGPoint(x: 530, y: 95),
        .cat: CGPoint(x: -670, y: -390)
    ]

    init(bundle: Bundle = .main) throws {
        guard let art = bundle.url(forResource: "Art", withExtension: nil) else { throw CocoaError(.fileNoSuchFile) }
        let folder = art.appendingPathComponent("Sketch")
        topology = try JSONDecoder().decode(Topology.self, from: Data(contentsOf: folder.appendingPathComponent("topology.json")))
        guard let grain = UIImage(contentsOfFile: folder.appendingPathComponent("grain.png").path) else { throw CocoaError(.fileReadCorruptFile) }
        paper = grain
        var pictures: [WorldResident: UIImage] = [:]
        for resident in WorldResident.allCases {
            guard let image = UIImage(contentsOfFile: folder.appendingPathComponent(resident.rawValue + ".png").path) else { throw CocoaError(.fileReadCorruptFile) }
            pictures[resident] = image
        }
        portraits = pictures
    }
}

private final class ResidentControl: UIControl {
    let resident: WorldResident
    private let picture: UIImageView
    private let aura = CAGradientLayer()
    private let dot = UIView()
    private var moving = false

    init(resident: WorldResident, image: UIImage) {
        self.resident = resident
        picture = UIImageView(image: image)
        super.init(frame: CGRect(x: 0, y: 0, width: 50, height: 54))
        aura.type = .radial
        aura.startPoint = CGPoint(x: 0.5, y: 0.5)
        aura.endPoint = CGPoint(x: 1, y: 1)
        aura.colors = [WorldTheme.leaf.withAlphaComponent(0.17).cgColor, UIColor.clear.cgColor]
        aura.locations = [0, 0.7]
        layer.addSublayer(aura)
        picture.contentMode = .scaleAspectFit
        picture.isUserInteractionEnabled = false
        addSubview(picture)
        dot.backgroundColor = WorldTheme.leaf.withAlphaComponent(0.65)
        dot.layer.cornerRadius = 1.5
        dot.isHidden = resident != .fox
        addSubview(dot)
        isAccessibilityElement = true
        accessibilityTraits = .button
        accessibilityIdentifier = "world.resident.\(resident.rawValue)"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func update(magnification: CGFloat, color: UIColor) {
        // Artwork stays delicate; its real touch target never shrinks below 50 × 54pt.
        let size = CGSize(width: 39 * magnification, height: 42 * magnification)
        picture.frame = CGRect(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2, width: size.width, height: size.height)
        aura.frame = bounds.insetBy(dx: -2, dy: -2)
        aura.colors = [color.withAlphaComponent(0.17).cgColor, UIColor.clear.cgColor]
        dot.frame = CGRect(x: bounds.midX - 1.5, y: picture.frame.maxY + 2, width: 3, height: 3)
    }

    func setMoving(_ enabled: Bool) {
        guard moving != enabled else { return }
        moving = enabled
        picture.layer.removeAnimation(forKey: "quiet-breath")
        aura.removeAnimation(forKey: "soft-aura")
        guard enabled else { return }
        let breath = CAKeyframeAnimation(keyPath: "transform.translation.y")
        breath.values = [0, -1.6, 0]
        breath.duration = resident == .fox || resident == .bear ? 2.25 : 5.8
        breath.repeatCount = .infinity
        breath.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        picture.layer.add(breath, forKey: "quiet-breath")
        let glow = CABasicAnimation(keyPath: "opacity")
        glow.fromValue = 0.6; glow.toValue = 1
        glow.duration = 5.8; glow.autoreverses = true; glow.repeatCount = .infinity
        aura.add(glow, forKey: "soft-aura")
    }
}

/// Draws only the current viewport. No giant bitmap or continuously running render loop.
final class WorldCanvasView: UIView, UIGestureRecognizerDelegate {
    private struct PencilStroke { let path: CGPath; let kind: String; let shade: CGPath }
    private let art: WorldArt
    private var strokes: [PencilStroke] = []
    private var residents: [WorldResident: ResidentControl] = [:]
    private var camera = CGPoint(x: 10, y: 0)
    private var zoom: CGFloat = 0.98
    private var movement = true
    private var sceneActive = false
    private var mood = AuraMood.gentle
    private var strings = WorldStrings(language: .deviceDefault)
    var onResidentTap: ((WorldResident) -> Void)?
    var onMapInteraction: (() -> Void)?
    var isAtOverview: Bool { zoom <= 0.335 }

    init(art: WorldArt) {
        self.art = art
        super.init(frame: .zero)
        isOpaque = true
        backgroundColor = WorldTheme.paper
        accessibilityIdentifier = "world.canvas"
        for (index, stroke) in art.topology.strokes.enumerated() {
            let points = Self.sample(stroke.points, seed: index + 3)
            let line = CGMutablePath(), shade = CGMutablePath()
            for (i, p) in points.enumerated() {
                if i == 0 || (i > 2 && i % 173 == 0 && (index + 1) % 3 == 0) { line.move(to: p) }
                else { line.addLine(to: p) }
                if i % 39 == 0 { shade.move(to: CGPoint(x: p.x - 0.85, y: p.y + 0.6)) }
                else if i % 39 < 9 { shade.addLine(to: CGPoint(x: p.x - 0.85, y: p.y + 0.6)) }
            }
            strokes.append(PencilStroke(path: line, kind: stroke.kind, shade: shade))
        }
        for resident in WorldResident.allCases {
            guard let image = art.portraits[resident] else { continue }
            let control = ResidentControl(resident: resident, image: image)
            control.addTarget(self, action: #selector(residentTapped(_:)), for: .touchUpInside)
            addSubview(control)
            residents[resident] = control
        }
        let pan = UIPanGestureRecognizer(target: self, action: #selector(panned(_:)))
        pan.maximumNumberOfTouches = 1
        pan.delegate = self
        addGestureRecognizer(pan)
        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched(_:)))
        addGestureRecognizer(pinch)
        let double = UITapGestureRecognizer(target: self, action: #selector(doubleTapped(_:)))
        double.numberOfTapsRequired = 2
        double.delegate = self
        addGestureRecognizer(double)
        isAccessibilityElement = false
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() { super.layoutSubviews(); refresh() }

    private static func sample(_ coordinates: [[CGFloat]], seed: Int) -> [CGPoint] {
        let knots = coordinates.compactMap { a -> CGPoint? in a.count == 2 ? CGPoint(x: a[0], y: a[1]) : nil }
        guard knots.count > 1 else { return knots }
        var result: [CGPoint] = []
        for j in 0..<(knots.count - 1) {
            let p0 = knots[max(0, j - 1)], p1 = knots[j], p2 = knots[j + 1], p3 = knots[min(knots.count - 1, j + 2)]
            let steps = max(5, Int(ceil(hypot(p2.x - p1.x, p2.y - p1.y) / 9)))
            for i in 0..<steps {
                let t = CGFloat(i) / CGFloat(steps), t2 = t * t, t3 = t2 * t
                func value(_ a: CGFloat, _ b: CGFloat, _ c: CGFloat, _ d: CGFloat) -> CGFloat {
                    (2*b + (-a+c)*t + (2*a-5*b+4*c-d)*t2 + (-a+3*b-3*c+d)*t3) * 0.5
                }
                let n = CGFloat(result.count), s = CGFloat(seed)
                let wobble = (sin(n * 0.69 + s) * 0.77 + sin(n * 0.21 + s * 2.3) * 0.38) * 2
                result.append(CGPoint(x: value(p0.x,p1.x,p2.x,p3.x) + wobble, y: value(p0.y,p1.y,p2.y,p3.y) + wobble))
            }
        }
        result.append(knots[knots.count - 1])
        return result
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        WorldTheme.paper.setFill(); ctx.fill(bounds)
        ctx.saveGState()
        ctx.translateBy(x: bounds.midX - camera.x * zoom, y: bounds.midY - camera.y * zoom)
        ctx.scaleBy(x: zoom, y: zoom)
        ctx.setLineCap(.round); ctx.setLineJoin(.round)
        for stroke in strokes {
            let road = stroke.kind == "road", trail = stroke.kind == "trail"
            let color = road ? UIColor(hex: 0x605b53) : UIColor(hex: 0x948f85)
            ctx.setStrokeColor(color.withAlphaComponent(road ? 0.38 : trail ? 0.24 : 0.28).cgColor)
            ctx.setLineWidth(road ? 1.22 : trail ? 1 : 1.15)
            ctx.setLineDash(phase: 0, lengths: trail ? [5, 13] : [])
            ctx.addPath(stroke.path); ctx.strokePath()
            if !trail {
                ctx.setStrokeColor(color.withAlphaComponent(0.13).cgColor)
                ctx.setLineWidth(0.45); ctx.addPath(stroke.shade); ctx.strokePath()
            }
        }
        ctx.setLineDash(phase: 0, lengths: [])
        ctx.setLineWidth(1.08); ctx.setStrokeColor(UIColor(hex: 0x979082).withAlphaComponent(0.3).cgColor)
        for p in art.topology.nodes where p.count == 2 { ctx.strokeEllipse(in: CGRect(x: p[0]-4,y:p[1]-3.75,width:8,height:7.5)) }
        let places: [(CGPoint, WorldStrings.Key)] = [
            (CGPoint(x:-125,y:-95),.glimmerField),(CGPoint(x:440,y:-370),.inkBank),
            (CGPoint(x:-990,y:385),.slowHill),(CGPoint(x:-1520,y:1120),.seaEdge),
            (CGPoint(x:1250,y:550),.eveningWay),(CGPoint(x:1350,y:-1160),.paperRiver),
            (CGPoint(x:100,y:1210),.littlePath),(CGPoint(x:-1100,y:-1160),.farAway)
        ]
        let font = UIFont(name: "KaitiTC-Regular", size: 13) ?? UIFont.italicSystemFont(ofSize: 13)
        let attributes: [NSAttributedString.Key: Any] = [.font:font,.foregroundColor:UIColor(hex:0x8a8378).withAlphaComponent(zoom < 0.55 ? 0.35 : 0.42)]
        for (position,key) in places {
            let text = strings[key] as NSString, size = text.size(withAttributes: attributes)
            text.draw(at: CGPoint(x:position.x-size.width/2,y:position.y-size.height),withAttributes: attributes)
        }
        ctx.restoreGState()
        ctx.saveGState(); ctx.setBlendMode(.multiply); ctx.setAlpha(0.58)
        UIColor(patternImage: art.paper).setFill(); ctx.fill(bounds); ctx.restoreGState()
    }

    private func mapPoint(_ screen: CGPoint) -> CGPoint { CGPoint(x:camera.x+(screen.x-bounds.midX)/zoom,y:camera.y+(screen.y-bounds.midY)/zoom) }
    private func refresh() {
        guard bounds.width > 0 else { return }
        camera.x = min(2030,max(-2030,camera.x)); camera.y = min(2240,max(-2020,camera.y))
        CATransaction.begin(); CATransaction.setDisableActions(true)
        let magnification = min(1.13,max(0.69,0.65+zoom*0.25))
        for (resident, control) in residents {
            guard let p = art.positions[resident] else { continue }
            control.center = CGPoint(x:(p.x-camera.x)*zoom+bounds.midX,y:(p.y-camera.y)*zoom+bounds.midY)
            control.isHidden = !bounds.insetBy(dx:-35,dy:-35).intersects(control.frame)
            let color = resident == .fox ? mood.color : resident == .reader ? UIColor(hex:0x9eb7c4) : WorldTheme.leaf
            control.update(magnification:magnification,color:color)
            control.setMoving(movement && sceneActive && window != nil && !control.isHidden && !UIAccessibility.isReduceMotionEnabled)
        }
        CATransaction.commit()
        accessibilityElements = WorldResident.allCases.compactMap { residents[$0] }.filter { !$0.isHidden }
        setNeedsDisplay()
    }
    func overview(animated: Bool = true) { onMapInteraction?(); zoom = 0.33; camera = .zero; refresh() }
    func recenter() { onMapInteraction?(); camera = CGPoint(x:10,y:0); zoom = 0.98; refresh() }
    func adjustZoom(_ factor: CGFloat) { onMapInteraction?(); zoomAt(factor, anchor:CGPoint(x:bounds.midX,y:bounds.midY)) }
    private func zoomAt(_ factor: CGFloat, anchor: CGPoint) {
        let origin = mapPoint(anchor)
        zoom = min(2.15,max(0.33,zoom*factor))
        camera = CGPoint(x:origin.x-(anchor.x-bounds.midX)/zoom,y:origin.y-(anchor.y-bounds.midY)/zoom)
        refresh()
    }
    func focus(on resident: WorldResident) {
        guard let p = art.positions[resident] else { return }
        camera = p; zoom = max(0.98,zoom); refresh()
    }
    func apply(state: WorldState, strings: WorldStrings) {
        self.strings = strings; movement = state.movement; mood = state.aura
        for (resident,control) in residents {
            control.accessibilityLabel = strings[resident.nameKey]
            control.accessibilityHint = strings[.visit]
            control.accessibilityValue = state.favorites.contains(resident) ? strings[.favorited] : nil
        }
        accessibilityLabel = strings[.world]
        accessibilityCustomActions = [UIAccessibilityCustomAction(name:strings[.overview],target:self,selector:#selector(accessibleOverview))]
        refresh()
    }
    func setSceneActive(_ active: Bool) { sceneActive = active; refresh() }
    override func didMoveToWindow() { super.didMoveToWindow(); refresh() }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool { !(touch.view is UIControl) }
    @objc private func accessibleOverview() -> Bool { overview(); return true }
    @objc private func residentTapped(_ sender: ResidentControl) { onMapInteraction?(); onResidentTap?(sender.resident) }
    @objc private func panned(_ gesture: UIPanGestureRecognizer) {
        if gesture.state == .began { onMapInteraction?() }
        let delta = gesture.translation(in:self)
        camera.x -= delta.x/zoom; camera.y -= delta.y/zoom
        gesture.setTranslation(.zero,in:self); refresh()
    }
    @objc private func pinched(_ gesture: UIPinchGestureRecognizer) {
        if gesture.state == .began { onMapInteraction?() }
        zoomAt(gesture.scale,anchor:gesture.location(in:self)); gesture.scale = 1
    }
    @objc private func doubleTapped(_ gesture: UITapGestureRecognizer) {
        onMapInteraction?()
        if zoom > 1.5 { recenter() } else { zoomAt(1.6,anchor:gesture.location(in:self)) }
    }
}
