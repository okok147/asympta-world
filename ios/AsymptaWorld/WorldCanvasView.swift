import UIKit

/// Fixed palette textures: no procedural drawing during simulation or gestures.
enum AuraInk {
    private static var cache: [UInt32: UIImage] = [:]
    static func image(_ hex: UInt32) -> UIImage {
        if let image = cache[hex] { return image }
        let format = UIGraphicsImageRendererFormat(); format.scale = 2
        let image = UIGraphicsImageRenderer(size:CGSize(width:96,height:96),format:format).image { renderer in
            let ctx = renderer.cgContext, ink = UIColor(hex:hex)
            for row in 0...48 {
                for column in 0...48 {
                    let n = CGFloat(row*131+column*37)
                    let x = CGFloat(column)*2+sin(n*1.7)*0.5, y = CGFloat(row)*2+cos(n*0.93)*0.5
                    let radius = hypot((x-48)/46,(y-48)/46)
                    guard radius<1 else { continue }
                    let fade = pow(1-radius,0.8), dot = 0.35+fade*0.65
                    ctx.setFillColor(ink.withAlphaComponent(0.07+fade*0.42).cgColor)
                    ctx.fillEllipse(in:CGRect(x:x-dot/2,y:y-dot/2,width:dot,height:dot))
                }
            }
            ctx.setFillColor(ink.withAlphaComponent(0.72).cgColor)
            ctx.fillEllipse(in:CGRect(x:44.5,y:44.5,width:7,height:7))
        }
        cache[hex] = image; return image
    }
}

/// Historical resident IDs remain valid favorites, now represented entirely by light.
struct WorldArt {
    let paper: UIImage
    let portraits: [WorldResident: UIImage]
    init(bundle: Bundle = .main) throws {
        portraits = Dictionary(uniqueKeysWithValues:WorldResident.allCases.enumerated().map { ($0.element,AuraInk.image(AuraActivity.allCases[$0.offset].ink)) })
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
        paper = UIGraphicsImageRenderer(size:CGSize(width:192,height:192),format:format).image { r in
            WorldTheme.paper.setFill(); r.fill(CGRect(x:0,y:0,width:192,height:192))
            var seed: UInt64 = 731
            for _ in 0..<1600 {
                seed = seed &* 6364136223846793005 &+ 1; let x = CGFloat((seed >> 32)%1920)/10
                seed = seed &* 6364136223846793005 &+ 1; let y = CGFloat((seed >> 32)%1920)/10
                UIColor(hex:0x968b7b).withAlphaComponent(0.025).setFill()
                r.cgContext.fillEllipse(in:CGRect(x:x,y:y,width:0.6,height:0.35))
            }
        }
    }
}

private final class AuraAccessibleElement: UIAccessibilityElement {
    weak var canvas: WorldCanvasView?
    let id: Int
    init(canvas: WorldCanvasView,id: Int) {
        self.canvas = canvas; self.id = id
        super.init(accessibilityContainer:canvas)
        isAccessibilityElement = true; accessibilityTraits = .button
        accessibilityIdentifier = "world.agent.\(id)"
    }
    override var accessibilityFrameInContainerSpace: CGRect {
        get { guard let p = canvas?.screenPoint(id) else { return .zero }; return CGRect(x:p.x-22,y:p.y-22,width:44,height:44) }
        set {}
    }
    override var accessibilityLabel: String? {
        get { canvas?.agentLabel(id) }
        set {}
    }
    override var accessibilityValue: String? {
        get { canvas?.agentValue(id) }
        set {}
    }
    override func accessibilityActivate() -> Bool { canvas?.selectAgent(id); return true }
    override func accessibilityElementDidBecomeFocused() { canvas?.focus(agent:id) }
}

private final class AuraFrameTarget: NSObject {
    weak var canvas: WorldCanvasView?
    @objc func frame(_ link: CADisplayLink) { canvas?.advance(link) }
}

/// One small model, one clock and one cached image layer per light; no character views.
final class WorldCanvasView: UIView, UIGestureRecognizerDelegate {
    private let simulation = AuraWorldSimulation()
    private var dots: [CALayer] = []
    private var shownActivities: [AuraActivity?] = []
    private var elements: [AuraAccessibleElement] = []
    private var camera = CGPoint(x:500,y:700)
    private var zoom: CGFloat = 2.4
    private var followsUser = true
    private let userRing = CAShapeLayer()
    private var movement = true, sceneActive = false, covered = false, held = false
    private var panning = false, pinching = false
    private var strings = WorldStrings(language:.deviceDefault)
    private var mood = AuraMood.gentle
    private var lastTimestamp: Double = 0
    private var displayLink: CADisplayLink?
    private let frameTarget = AuraFrameTarget()
    private var frameCount = 0, longIntervals = 0, cameraUpdates = 0
    private var elapsedIntervals: Double = 0, worstInterval: Double = 0, frameWork: Double = 0, cameraWork: Double = 0
    private let metricWriter = DispatchQueue(label:"com.asympta.world.scene-metrics",qos:.utility)
    var onAgentTap: ((Int)->Void)?
    var onMapInteraction: (() -> Void)?
    var onZoomChange: ((CGFloat)->Void)?
    var isAtOverview: Bool { zoom<=0.56 }
    private var viewport: CGRect { bounds.inset(by:UIEdgeInsets(top:safeAreaInsets.top+20,left:14,bottom:safeAreaInsets.bottom+26,right:14)) }
    private var fit: CGFloat { max(0.01,min(viewport.width/1000,viewport.height/1400)) }
    init(art: WorldArt) {
        super.init(frame:.zero)
        isOpaque = true; backgroundColor = UIColor(patternImage:art.paper); clipsToBounds = true
        accessibilityIdentifier = "world.canvas"
        for id in simulation.agents.indices {
            let dot = CALayer(); dot.bounds = CGRect(x:0,y:0,width:96,height:96)
            dot.contentsScale = 2
            dot.actions = ["position":NSNull(),"transform":NSNull(),"contents":NSNull(),"opacity":NSNull(),"hidden":NSNull()]
            layer.addSublayer(dot); dots.append(dot); shownActivities.append(nil)
            elements.append(AuraAccessibleElement(canvas:self,id:id))
        }
        userRing.bounds = CGRect(x:0,y:0,width:16,height:16)
        userRing.path = UIBezierPath(ovalIn:userRing.bounds).cgPath
        userRing.fillColor = UIColor.clear.cgColor
        userRing.strokeColor = WorldTheme.blue.withAlphaComponent(0.5).cgColor
        userRing.lineWidth = 0.65
        userRing.actions = ["position":NSNull(),"strokeColor":NSNull()]
        layer.addSublayer(userRing)
        accessibilityElements = elements
        frameTarget.canvas = self
        let pan = UIPanGestureRecognizer(target:self,action:#selector(panned(_:)))
        pan.maximumNumberOfTouches = 1; pan.delegate = self; addGestureRecognizer(pan)
        let pinch = UIPinchGestureRecognizer(target:self,action:#selector(pinched(_:)))
        pinch.delegate = self; addGestureRecognizer(pinch)
        let double = UITapGestureRecognizer(target:self,action:#selector(doubleTapped(_:)))
        double.numberOfTapsRequired = 2; double.delegate = self; addGestureRecognizer(double)
        let tap = UITapGestureRecognizer(target:self,action:#selector(tapped(_:)))
        tap.require(toFail:double); addGestureRecognizer(tap)
        NotificationCenter.default.addObserver(self,selector:#selector(powerChanged),name:.NSProcessInfoPowerStateDidChange,object:nil)
        NotificationCenter.default.addObserver(self,selector:#selector(powerChanged),name:ProcessInfo.thermalStateDidChangeNotification,object:nil)
        NotificationCenter.default.addObserver(self,selector:#selector(powerChanged),name:UIAccessibility.voiceOverStatusDidChangeNotification,object:nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    deinit { displayLink?.invalidate(); NotificationCenter.default.removeObserver(self) }
    override func layoutSubviews() { super.layoutSubviews(); project(geometry:true); syncClock() }
    fileprivate func screenPoint(_ id: Int) -> CGPoint {
        let p = simulation.agents[id].point, scale = fit*zoom
        return CGPoint(x:viewport.midX+(p.x-camera.x)*scale,y:viewport.midY+(p.y-camera.y)*scale)
    }
    private func mapPoint(_ p: CGPoint) -> CGPoint { CGPoint(x:camera.x+(p.x-viewport.midX)/(fit*zoom),y:camera.y+(p.y-viewport.midY)/(fit*zoom)) }
    private func project(geometry: Bool = false) {
        guard bounds.width>0 else { return }
        if followsUser { camera = simulation.agents[0].point }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        for id in dots.indices {
            let a = simulation.agents[id], dot = dots[id]
            dot.position = screenPoint(id)
            if geometry {
                let diameter: CGFloat = 116+CGFloat(id%4)*8
                dot.setAffineTransform(CGAffineTransform(scaleX:diameter*fit*zoom/96,y:diameter*fit*zoom/96))
            }
            dot.isHidden = !bounds.insetBy(dx:-45,dy:-45).contains(dot.position)
            if shownActivities[id] != a.activity {
                dot.contents = AuraInk.image(a.activity.ink).cgImage
                shownActivities[id] = a.activity
                if id==0 { userRing.strokeColor = UIColor(hex:a.activity.ink).withAlphaComponent(0.55).cgColor }
            }
            let moodAlpha: Float = mood == .restful ? 0.72 : mood == .gentle ? 0.86 : 1
            dot.opacity = (a.activity == .rest ? 0.72 : 0.94)*moodAlpha
        }
        userRing.position = screenPoint(0)
        userRing.isHidden = dots[0].isHidden
        CATransaction.commit()
    }
    private var mayMove: Bool { movement && sceneActive && !covered && !held && !panning && !pinching && window != nil && !UIAccessibility.isReduceMotionEnabled && !UIAccessibility.isVoiceOverRunning }
    private func syncClock() {
        if mayMove && displayLink == nil {
            let link = CADisplayLink(target:frameTarget,selector:#selector(AuraFrameTarget.frame(_:)))
            link.add(to:.main,forMode:.common); displayLink = link
        }
        let low = ProcessInfo.processInfo.isLowPowerModeEnabled || ProcessInfo.processInfo.thermalState == .serious || ProcessInfo.processInfo.thermalState == .critical
        displayLink?.preferredFrameRateRange = CAFrameRateRange(minimum:30,maximum:60,preferred:low ? 30 : 60)
        displayLink?.isPaused = !mayMove; lastTimestamp = 0
    }
    @objc private func powerChanged() { syncClock() }
    fileprivate func advance(_ link: CADisplayLink) {
        guard mayMove else { return }
        let start = CACurrentMediaTime(), time = link.targetTimestamp
        guard lastTimestamp>0 else { lastTimestamp = time; return }
        let interval = time-lastTimestamp; lastTimestamp = time
        guard interval>0 else { return }
        frameCount += 1; elapsedIntervals += interval; worstInterval = max(worstInterval,interval)
        if interval>0.025 { longIntervals += 1 }
        simulation.advance(min(interval,0.05)); project()
        frameWork += CACurrentMediaTime()-start
    }
    private func recordMetrics() {
        // Do not erase a real scene sample with a fresh launch that has not drawn a frame.
        guard frameCount>0 else { return }
        let counts = Dictionary(uniqueKeysWithValues:AuraActivity.allCases.map { activity in (String(activity.rawValue),simulation.agents.filter { $0.activity == activity }.count) })
        let snapshot: [String:Any] = ["build":Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") as? String ?? "?","agents":simulation.agents.count,"activities":counts,"completed_activities":simulation.completedActivities,"completed_encounters":simulation.completedEncounters,"travelling":simulation.agents.filter(\.travelling).count,"motion_callbacks":frameCount,"active_seconds":elapsedIntervals,"mean_callback_interval_ms":frameCount>0 ? elapsedIntervals/Double(frameCount)*1000 : 0,"intervals_over_25ms":longIntervals,"worst_interval_ms":worstInterval*1000,"mean_motion_work_ms":frameCount>0 ? frameWork/Double(frameCount)*1000 : 0,"camera_updates":cameraUpdates,"mean_camera_work_ms":cameraUpdates>0 ? cameraWork/Double(cameraUpdates)*1000 : 0,"cached_ink_textures":5,"scope":"actual simulation callback cadence and CPU work; not measured displayed FPS or matched baseline"]
        let url = FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("WorldSceneMetrics.json")
        metricWriter.async { if let data = try? JSONSerialization.data(withJSONObject:snapshot,options:.sortedKeys) { try? data.write(to:url,options:.atomic) } }
    }
    private func cameraChanged() {
        let start = CACurrentMediaTime(); project(geometry:true); cameraWork += CACurrentMediaTime()-start; cameraUpdates += 1
        accessibilityValue = String(format:"%.0f%%",zoom*100); onZoomChange?(zoom)
    }
    func overview(animated: Bool = true) { onMapInteraction?(); followsUser = false; zoom = 0.55; camera = CGPoint(x:500,y:700); cameraChanged() }
    func recenter() { onMapInteraction?(); followsUser = true; camera = simulation.agents[0].point; zoom = 2.4; cameraChanged() }
    func adjustZoom(_ factor: CGFloat) { onMapInteraction?(); zoomAt(factor,anchor:CGPoint(x:viewport.midX,y:viewport.midY)) }
    private func zoomAt(_ factor: CGFloat, anchor: CGPoint) {
        let origin = mapPoint(anchor); zoom = min(3.5,max(0.45,zoom*factor))
        camera = CGPoint(x:origin.x-(anchor.x-viewport.midX)/(fit*zoom),y:origin.y-(anchor.y-viewport.midY)/(fit*zoom)); cameraChanged()
    }
    func focus(on resident: WorldResident) { focus(agent:WorldResident.allCases.firstIndex(of:resident) ?? 0) }
    fileprivate func focus(agent id: Int) { followsUser = id==0; camera = simulation.agents[id].point; zoom = max(2.4,zoom); cameraChanged() }
    func snapshot(_ id: Int) -> AuraAgentSnapshot? { simulation.snapshot(id) }
    fileprivate func agentLabel(_ id: Int) -> String { id==0 ? strings[.yourLight] : strings[.light]+String(format:" %02d",id+1) }
    fileprivate func agentValue(_ id: Int) -> String {
        guard let a = snapshot(id) else { return "" }
        return strings[a.activity.titleKey]+" · "+strings[a.waitingForPartner ? .activityWaiting : a.travelling ? .activityTravelling : .activityDoing]
    }
    fileprivate func selectAgent(_ id: Int) { onAgentTap?(id) }
    func apply(state: WorldState, strings: WorldStrings) {
        self.strings = strings; movement = state.movement; mood = state.aura
        accessibilityLabel = strings[.world]; accessibilityValue = String(format:"%.0f%%",zoom*100)
        accessibilityCustomActions = [UIAccessibilityCustomAction(name:strings[.zoomIn],target:self,selector:#selector(accessibleZoomIn)),UIAccessibilityCustomAction(name:strings[.zoomOut],target:self,selector:#selector(accessibleZoomOut)),UIAccessibilityCustomAction(name:strings[.overview],target:self,selector:#selector(accessibleOverview)),UIAccessibilityCustomAction(name:strings[.returnToLight],target:self,selector:#selector(accessibleRecenter))]
        for element in elements { element.accessibilityCustomActions = accessibilityCustomActions }
        cameraChanged(); syncClock()
    }
    func setSceneActive(_ active: Bool) { sceneActive = active; if !active { recordMetrics() }; syncClock() }
    func setCovered(_ value: Bool) { covered = value; if value { recordMetrics() }; syncClock() }
    override func didMoveToWindow() { super.didMoveToWindow(); syncClock() }
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) { held = true; syncClock(); super.touchesBegan(touches,with:event) }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) { held = false; syncClock(); super.touchesEnded(touches,with:event) }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { held = false; syncClock(); super.touchesCancelled(touches,with:event) }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool { !(touch.view is UIControl) }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { gestureRecognizer is UIPinchGestureRecognizer || other is UIPinchGestureRecognizer }
    @objc private func accessibleZoomIn() -> Bool { adjustZoom(1.3); return true }
    @objc private func accessibleZoomOut() -> Bool { adjustZoom(1/1.3); return true }
    @objc private func accessibleOverview() -> Bool { overview(); return true }
    @objc private func accessibleRecenter() -> Bool { recenter(); return true }
    private func gestureState(_ gesture: UIGestureRecognizer,pinch: Bool) {
        let active = gesture.state == .began || gesture.state == .changed
        if pinch { pinching = active } else { panning = active }
        if gesture.state == .began { followsUser = false; onMapInteraction?() }
        syncClock(); if !active { recordMetrics() }
    }
    @objc private func panned(_ gesture: UIPanGestureRecognizer) {
        gestureState(gesture,pinch:false)
        let d = gesture.translation(in:self); camera.x -= d.x/(fit*zoom); camera.y -= d.y/(fit*zoom)
        camera.x = min(1200,max(-200,camera.x)); camera.y = min(1600,max(-200,camera.y))
        gesture.setTranslation(.zero,in:self); cameraChanged()
    }
    @objc private func pinched(_ gesture: UIPinchGestureRecognizer) { gestureState(gesture,pinch:true); zoomAt(gesture.scale,anchor:gesture.location(in:self)); gesture.scale = 1 }
    @objc private func doubleTapped(_ gesture: UITapGestureRecognizer) { recenter() }
    @objc private func tapped(_ gesture: UITapGestureRecognizer) {
        let p = gesture.location(in:self)
        guard let id = simulation.agents.indices.min(by:{ hypot(screenPoint($0).x-p.x,screenPoint($0).y-p.y)<hypot(screenPoint($1).x-p.x,screenPoint($1).y-p.y) }), hypot(screenPoint(id).x-p.x,screenPoint(id).y-p.y)<=max(22,18*zoom) else { return }
        selectAgent(id)
    }
}
