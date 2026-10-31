import UIKit

struct WorldArt {
    struct Manifest: Decodable {
        struct Canvas: Decodable { let width: CGFloat; let height: CGFloat }
        struct Frame: Decodable {
            let x: CGFloat
            let y: CGFloat
            let width: CGFloat
            let height: CGFloat
            var rect: CGRect { CGRect(x: x, y: y, width: width, height: height) }
        }
        struct Asset: Decodable { let file: String; let frame: Frame }
        let canvas: Canvas
        let assets: [String: Asset]
    }

    let size: CGSize
    let terrain: UIImage
    let paper: UIImage
    let brand: UIImage
    let portraits: [WorldResident: UIImage]
    let frames: [WorldResident: CGRect]

    init(bundle: Bundle = .main) throws {
        guard let folder = bundle.url(forResource: "Art", withExtension: nil) else {
            throw CocoaError(.fileNoSuchFile)
        }
        let manifest = try JSONDecoder().decode(Manifest.self,
                                               from: Data(contentsOf: folder.appendingPathComponent("manifest.json")))
        guard manifest.canvas.width > 0, manifest.canvas.height > 0 else {
            throw CocoaError(.fileReadCorruptFile)
        }
        func image(_ file: String) throws -> UIImage {
            guard !file.contains("/"), !file.contains(".."),
                  let result = UIImage(contentsOfFile: folder.appendingPathComponent(file).path) else {
                throw CocoaError(.fileReadCorruptFile)
            }
            return result
        }
        size = CGSize(width: manifest.canvas.width, height: manifest.canvas.height)
        terrain = try image("terrain.png")
        paper = try image("paper.png")
        brand = try image("brand.png")
        var portraits: [WorldResident: UIImage] = [:]
        var frames: [WorldResident: CGRect] = [:]
        for resident in WorldResident.allCases {
            guard let asset = manifest.assets[resident.rawValue],
                  asset.frame.width > 0, asset.frame.height > 0 else {
                throw CocoaError(.fileReadCorruptFile)
            }
            portraits[resident] = try image(asset.file)
            frames[resident] = asset.frame.rect
        }
        self.portraits = portraits
        self.frames = frames
    }
}

private final class ResidentControl: UIControl {
    let resident: WorldResident
    let imageView: UIImageView
    let originalFrame: CGRect

    init(resident: WorldResident, image: UIImage, frame: CGRect) {
        self.resident = resident
        originalFrame = frame
        imageView = UIImageView(image: image)
        super.init(frame: frame)
        imageView.contentMode = .scaleAspectFit
        imageView.isUserInteractionEnabled = false
        addSubview(imageView)
        isAccessibilityElement = true
        accessibilityTraits = .button
        accessibilityIdentifier = "world.resident.\(resident.rawValue)"
        backgroundColor = .clear
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func updateHitArea(zoom: CGFloat) {
        let minimum = 44 / max(zoom, 0.01)
        let size = CGSize(width: max(originalFrame.width, minimum),
                          height: max(originalFrame.height, minimum))
        bounds = CGRect(origin: .zero, size: size)
        center = CGPoint(x: originalFrame.midX, y: originalFrame.midY)
        imageView.frame = CGRect(x: (size.width - originalFrame.width) / 2,
                                 y: (size.height - originalFrame.height) / 2,
                                 width: originalFrame.width, height: originalFrame.height)
    }

    // Core Animation moves the artwork and its full 44pt touch area together.
    // UIKit normally hit-tests the final model position, not the rendered one.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        guard let parent = superview else { return super.point(inside: point, with: event) }
        let liveFrame = layer.presentation()?.frame ?? frame
        return liveFrame.contains(convert(point, to: parent))
    }

    override var accessibilityFrame: CGRect {
        get {
            guard let parent = superview else { return super.accessibilityFrame }
            return parent.convert(layer.presentation()?.frame ?? frame, to: nil)
        }
        set { super.accessibilityFrame = newValue }
    }

    func setMoving(_ enabled: Bool) {
        layer.removeAnimation(forKey: "quiet-wander")
        // These cutouts include a book/bucket, tea table, or Zzz. They stay still;
        // only the two self-contained walking characters wander.
        guard enabled, resident == .fox || resident == .bear else { return }
        let distance: CGFloat = resident == .fox ? 10 : 12
        let x = CAKeyframeAnimation(keyPath: "transform.translation.x")
        x.values = [0, 0, distance, distance, -distance / 2, 0]
        x.keyTimes = [0, 0.18, 0.42, 0.61, 0.84, 1]
        let y = CAKeyframeAnimation(keyPath: "transform.translation.y")
        y.values = [0, 0, -2, -2, 1, 0]
        y.keyTimes = x.keyTimes
        let group = CAAnimationGroup()
        group.animations = [x, y]
        group.duration = resident == .fox ? 28 : 36
        group.repeatCount = .infinity
        group.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        layer.add(group, forKey: "quiet-wander")
    }
}

final class WorldCanvasView: UIView, UIScrollViewDelegate {
    private let art: WorldArt
    private let scrollView = UIScrollView()
    private let content = UIView()
    private let terrain: UIImageView
    private let light = UIView()
    private var residents: [WorldResident: ResidentControl] = [:]
    private var lastSize = CGSize.zero
    private var movement = true
    private var sceneActive = false
    private var overviewPending = false

    var onResidentTap: ((WorldResident) -> Void)?
    var isAtOverview: Bool { abs(scrollView.zoomScale - scrollView.minimumZoomScale) < 0.005 }

    init(art: WorldArt) {
        self.art = art
        terrain = UIImageView(image: art.terrain)
        super.init(frame: .zero)
        backgroundColor = WorldTheme.paper
        scrollView.backgroundColor = .clear
        scrollView.delegate = self
        scrollView.bounces = true
        scrollView.bouncesZoom = true
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.decelerationRate = .normal
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.accessibilityIdentifier = "world.canvas"
        scrollView.isAccessibilityElement = false
        addSubview(scrollView)
        content.frame = CGRect(origin: .zero, size: art.size)
        terrain.frame = content.bounds
        terrain.contentMode = .scaleToFill
        terrain.isAccessibilityElement = false
        content.addSubview(terrain)
        scrollView.addSubview(content)
        scrollView.contentSize = art.size
        for resident in WorldResident.allCases {
            guard let image = art.portraits[resident], let frame = art.frames[resident] else { continue }
            let control = ResidentControl(resident: resident, image: image, frame: frame)
            control.addTarget(self, action: #selector(residentTapped(_:)), for: .touchUpInside)
            content.addSubview(control)
            residents[resident] = control
        }
        light.frame = content.bounds
        light.isUserInteractionEnabled = false
        content.addSubview(light)
        content.accessibilityElements = WorldResident.allCases.compactMap { residents[$0] }
        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(doubleTapped(_:)))
        doubleTap.numberOfTapsRequired = 2
        doubleTap.cancelsTouchesInView = false
        scrollView.addGestureRecognizer(doubleTap)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 0, bounds.height > 0, lastSize != bounds.size else { return }
        overviewPending = false
        let wasOverview = lastSize == .zero || isAtOverview
        let oldCenter = CGPoint(x: (scrollView.contentOffset.x + scrollView.bounds.width / 2) / max(scrollView.zoomScale, 0.01),
                                y: (scrollView.contentOffset.y + scrollView.bounds.height / 2) / max(scrollView.zoomScale, 0.01))
        scrollView.frame = bounds
        let fit = min(bounds.width / art.size.width, bounds.height / art.size.height)
        scrollView.minimumZoomScale = fit
        scrollView.maximumZoomScale = max(fit * 4, 1.4)
        if wasOverview {
            scrollView.setZoomScale(fit, animated: false)
        } else {
            scrollView.setZoomScale(max(fit, min(scrollView.zoomScale, scrollView.maximumZoomScale)), animated: false)
        }
        lastSize = bounds.size
        centerPaper()
        if wasOverview {
            scrollView.setContentOffset(CGPoint(x: -scrollView.contentInset.left, y: -scrollView.contentInset.top), animated: false)
        } else {
            center(on: oldCenter, animated: false)
        }
        updateHitAreas()
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { content }

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        centerPaper()
        updateHitAreas()
    }

    func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
        if overviewPending { finishOverviewCentering() }
    }

    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) { overviewPending = false }

    func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) {
        if scrollView.pinchGestureRecognizer?.state == .began { overviewPending = false }
    }

    private func finishOverviewCentering() {
        overviewPending = false
        centerPaper()
        scrollView.setContentOffset(CGPoint(x: -scrollView.contentInset.left,
                                            y: -scrollView.contentInset.top), animated: false)
    }

    private func centerPaper() {
        let horizontal = max(0, (bounds.width - art.size.width * scrollView.zoomScale) / 2)
        let vertical = max(0, (bounds.height - art.size.height * scrollView.zoomScale) / 2)
        scrollView.contentInset = UIEdgeInsets(top: vertical, left: horizontal, bottom: vertical, right: horizontal)
    }

    private func updateHitAreas() {
        for control in residents.values { control.updateHitArea(zoom: scrollView.zoomScale) }
    }

    private func center(on point: CGPoint, animated: Bool) {
        let x = point.x * scrollView.zoomScale - scrollView.bounds.width / 2
        let y = point.y * scrollView.zoomScale - scrollView.bounds.height / 2
        let left = -scrollView.contentInset.left
        let top = -scrollView.contentInset.top
        let right = max(left, scrollView.contentSize.width - scrollView.bounds.width + scrollView.contentInset.right)
        let bottom = max(top, scrollView.contentSize.height - scrollView.bounds.height + scrollView.contentInset.bottom)
        scrollView.setContentOffset(CGPoint(x: min(max(x, left), right), y: min(max(y, top), bottom)), animated: animated)
    }

    func overview(animated: Bool = true) {
        let animate = animated && !UIAccessibility.isReduceMotionEnabled && !isAtOverview
        overviewPending = animate
        scrollView.setZoomScale(scrollView.minimumZoomScale, animated: animate)
        // The final inset belongs to the final zoom scale. Reading the old inset
        // while starting the animation miscenters tall art on a landscape iPad.
        if !animate { finishOverviewCentering() }
    }

    func focus(on resident: WorldResident) {
        overviewPending = false
        guard let frame = art.frames[resident] else { return }
        let target = min(scrollView.maximumZoomScale, max(scrollView.zoomScale, scrollView.minimumZoomScale * 2.3))
        let width = bounds.width / target
        let height = bounds.height / target
        let rect = CGRect(x: frame.midX - width / 2, y: frame.midY - height / 2, width: width, height: height)
        scrollView.zoom(to: rect, animated: !UIAccessibility.isReduceMotionEnabled)
    }

    func apply(state: WorldState, strings: WorldStrings) {
        movement = state.movement
        light.backgroundColor = state.aura.light
        for (resident, control) in residents {
            control.accessibilityLabel = strings[resident.nameKey]
            control.accessibilityHint = strings[.visit]
            control.accessibilityValue = state.favorites.contains(resident) ? strings[.favorited] : nil
        }
        scrollView.accessibilityLabel = strings[.world]
        scrollView.accessibilityCustomActions = [
            UIAccessibilityCustomAction(name: strings[.overview], target: self, selector: #selector(accessibleOverview))
        ]
        updateMovement()
    }

    func setSceneActive(_ active: Bool) {
        sceneActive = active
        updateMovement()
    }

    private func updateMovement() {
        let active = movement && sceneActive && window != nil && !UIAccessibility.isReduceMotionEnabled
        for control in residents.values { control.setMoving(active) }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        updateMovement()
    }

    @objc private func accessibleOverview() -> Bool { overview(); return true }

    @objc private func residentTapped(_ sender: ResidentControl) {
        onResidentTap?(sender.resident)
    }

    @objc private func doubleTapped(_ gesture: UITapGestureRecognizer) {
        if !isAtOverview { overview(); return }
        let point = gesture.location(in: content)
        let target = min(scrollView.maximumZoomScale, scrollView.minimumZoomScale * 2)
        scrollView.zoom(to: CGRect(x: point.x - bounds.width / target / 2,
                                  y: point.y - bounds.height / target / 2,
                                  width: bounds.width / target, height: bounds.height / target),
                        animated: !UIAccessibility.isReduceMotionEnabled)
    }
}
