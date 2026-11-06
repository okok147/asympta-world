import UIKit

/// Cached identity textures: all world lights are prepared before the clock starts.
enum AuraInk {
    private static var cache: [UInt32: UIImage] = [:]
    private static var order: [UInt32] = []
    static var cachedCount: Int { cache.count }
    static func image(_ hex: UInt32) -> UIImage {
        if let image = cache[hex] { return image }
        let format = UIGraphicsImageRendererFormat(); format.scale = 2
        let image = UIGraphicsImageRenderer(size:CGSize(width:96,height:96),format:format).image { renderer in
            let ctx = renderer.cgContext, ink = UIColor(hex:hex)
            // A broad, matte, furry aura. No pinpoint center, face or character art.
            var seed: UInt64 = UInt64(hex) &+ 9173
            func random() -> CGFloat { seed = seed &* 6364136223846793005 &+ 1; return CGFloat((seed >> 32)%10000)/10000 }
            let center = CGPoint(x:48,y:48)
            WorldPigment.wash(in:ctx, ink:ink, center:center, radius:44, strength:0.65)
            ctx.setLineCap(.round)
            for _ in 0..<740 {
                let angle = random()*Double.pi*2, radius = sqrt(random())*30
                let x = center.x+cos(angle)*radius, y = center.y+sin(angle)*radius*0.94
                let length = 1.5+random()*7, curl = (random()-0.5)*4
                let fade = max(0,1-radius/37)
                let light = random()>0.72
                ctx.setStrokeColor((light ? UIColor.white : ink).withAlphaComponent((light ? 0.25:0.13)*fade).cgColor)
                ctx.setLineWidth(0.25+random()*0.45)
                ctx.move(to:CGPoint(x:x,y:y))
                ctx.addQuadCurve(to:CGPoint(x:x+cos(angle)*length,y:y+sin(angle)*length),control:CGPoint(x:x+cos(angle)*length/2-sin(angle)*curl,y:y+sin(angle)*length/2+cos(angle)*curl))
                ctx.strokePath()
            }

        }
        cache[hex] = image; order.append(hex)
        if order.count>160 { cache.removeValue(forKey:order.removeFirst()) }
        return image
    }
}

/// Historical resident IDs remain valid favorites, now represented entirely by light.
struct WorldArt {
    let paper: UIImage
    let portraits: [WorldResident: UIImage]
    init(bundle: Bundle = .main, userInk: UInt32? = nil) throws {
        portraits = Dictionary(uniqueKeysWithValues:WorldResident.allCases.enumerated().map { ($0.element,AuraInk.image(($0.offset == 0 ? userInk ?? AuraWorldSimulation.identityInk(0) : AuraWorldSimulation.identityInk($0.offset)))) })
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
        paper = UIGraphicsImageRenderer(size:CGSize(width:192,height:192),format:format).image { r in
            WorldTheme.mapPaper.setFill(); r.fill(CGRect(x:0,y:0,width:192,height:192))
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
    private let simulation: AuraWorldSimulation
    private var mapDrawing: CALayer?
    private let lightLayer = CALayer()
    private let places = WorldPlaceOverlay()
    private var accessiblePlaces: [UILabel] = []
    private var hasRealMap = false
    private var locationMode = false
    private var ownRadius: CGFloat = 200
    private var auraPhase = 0.0
    private var peerPositions: [String:CGPoint] = [:]
    private var peerLayers: [CALayer] = []
    private var peers: [WorldCloudPeer] = []
    private var peerElements: [AuraAccessibleElement] = []
    var onGrowth: (([Int])->Void)?
    var captionTopEdge: CGFloat = 0 {
        didSet { if captionTopEdge != oldValue { setNeedsLayout() } }
    }
    var captionBottomInset: CGFloat = 66 {
        didSet { if captionBottomInset != oldValue { setNeedsLayout() } }
    }
    private var dots: [CALayer] = []
    private var elements: [AuraAccessibleElement] = []
    private var camera = CGPoint(x:500,y:700)
    private var zoom: CGFloat = 2.4
    private var followsUser = true
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
    var onAuraGroupTap: (([AuraAgentSnapshot])->Void)?
    private var viewport: CGRect { bounds.inset(by:UIEdgeInsets(top:safeAreaInsets.top+20,left:14,bottom:safeAreaInsets.bottom+26,right:14)) }
    private var fit: CGFloat { max(0.01,min(viewport.width/1000,viewport.height/1400)) }
    init(art: WorldArt, userInk: UInt32? = nil) {
        simulation = AuraWorldSimulation(userInk:userInk)
        super.init(frame:.zero)
        isOpaque = true; backgroundColor = UIColor(patternImage:art.paper); clipsToBounds = true
        accessibilityIdentifier = "world.canvas"
        layer.addSublayer(places.pigments)
        layer.addSublayer(lightLayer)
        for label in places.labels { addSubview(label) }
        places.setPlaces(AuraWorldSimulation.localPlaces(strings), traits:traitCollection)
        for id in simulation.agents.indices {
            let dot = CALayer(); dot.bounds = CGRect(x:0,y:0,width:96,height:96)
            dot.contentsScale = 2
            dot.actions = ["position":NSNull(),"transform":NSNull(),"contents":NSNull(),"opacity":NSNull(),"hidden":NSNull()]
            let ink = simulation.agents[id].auraInk
            dot.contents = AuraInk.image(ink).cgImage
            lightLayer.addSublayer(dot); dots.append(dot)
            elements.append(AuraAccessibleElement(canvas:self,id:id))
        }
        updateAccessibility()
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
        let p: CGPoint
        if id>=1000 { guard peers.indices.contains(id-1000) else { return .zero }; p = peerPositions[peers[id-1000].id] ?? CGPoint(x:peers[id-1000].point[0],y:peers[id-1000].point[1]) }
        else { p = simulation.agents[id].point }
        return projected(p)
    }
    private func projected(_ p: CGPoint) -> CGPoint {
        let scale = fit*zoom
        return CGPoint(x:viewport.midX+(p.x-camera.x)*scale,y:viewport.midY+(p.y-camera.y)*scale)
    }
    private func mapPoint(_ p: CGPoint) -> CGPoint { CGPoint(x:camera.x+(p.x-viewport.midX)/(fit*zoom),y:camera.y+(p.y-viewport.midY)/(fit*zoom)) }
    private func project(geometry: Bool = false) {
        guard bounds.width>0 else { return }
        let previousCamera = camera
        if followsUser { camera = simulation.agents[0].point }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        if geometry || previousCamera != camera {
            let captionArea = bounds.inset(by:UIEdgeInsets(top:max(safeAreaInsets.top,captionTopEdge)+16,left:18,
                                                          bottom:safeAreaInsets.bottom+captionBottomInset,right:18))
            if places.project(in:captionArea, project:projected) {
                accessiblePlaces = places.labels.filter { !$0.isHidden }
                updateAccessibility()
            }
        }
        for id in dots.indices {
            let a = simulation.agents[id], dot = dots[id]
            dot.position = screenPoint(id)
            if geometry {
                let diameter: CGFloat = id == 0 && locationMode ? max(300,ownRadius*1.5) : 250+CGFloat(id%4)*8
                dot.setAffineTransform(CGAffineTransform(scaleX:diameter*fit*zoom/96,y:diameter*fit*zoom/96))
            }
            dot.isHidden = (locationMode && id != 0) || !bounds.insetBy(dx:-140,dy:-140).contains(dot.position)
            let moodAlpha: Float = mood == .restful ? 0.72 : mood == .gentle ? 0.86 : 1
            let emphasis: Float = id == 0 ? 1 : 0.48
            dot.opacity = emphasis*(a.activity == .rest ? 0.8 : 0.98)*moodAlpha*Float(0.94+0.06*sin(auraPhase*0.8+Double(id)*0.7))
        }
        if let mapDrawing {
            mapDrawing.position = projected(.zero)
            mapDrawing.setAffineTransform(CGAffineTransform(scaleX:fit*zoom,y:fit*zoom))
        }
        for (index,peerLayer) in peerLayers.enumerated() {
            peerLayer.position = screenPoint(1000+index)
            peerLayer.setAffineTransform(CGAffineTransform(scaleX:CGFloat(max(300,peers[index].radiusMeters*1.5))*fit*zoom/96,y:CGFloat(max(300,peers[index].radiusMeters*1.5))*fit*zoom/96))
            peerLayer.isHidden = !bounds.insetBy(dx:-140,dy:-140).contains(peerLayer.position)
        }
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
        auraPhase += min(interval,0.05)
        let blend = CGFloat(1-exp(-min(interval,0.05)/0.6))
        for peer in peers {
            let target = CGPoint(x:peer.point[0],y:peer.point[1]),old = peerPositions[peer.id] ?? target
            peerPositions[peer.id] = CGPoint(x:old.x+(target.x-old.x)*blend,y:old.y+(target.y-old.y)*blend)
        }
        let before = simulation.agents[0].completed
        simulation.advance(min(interval,0.05)); project()
        if simulation.agents[0].completed != before { onGrowth?(simulation.agents[0].abilities) }
        frameWork += CACurrentMediaTime()-start
    }
    private func recordMetrics() {
        // Do not erase a real scene sample with a fresh launch that has not drawn a frame.
        guard frameCount>0 else { return }
        let counts = Dictionary(uniqueKeysWithValues:AuraActivity.allCases.map { activity in (String(activity.rawValue),simulation.agents.filter { $0.activity == activity }.count) })
        let snapshot: [String:Any] = ["build":Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") as? String ?? "?","agents":simulation.agents.count,"activities":counts,"completed_activities":simulation.completedActivities,"completed_encounters":simulation.completedEncounters,"travelling":simulation.agents.filter(\.travelling).count,"motion_callbacks":frameCount,"active_seconds":elapsedIntervals,"mean_callback_interval_ms":frameCount>0 ? elapsedIntervals/Double(frameCount)*1000 : 0,"intervals_over_25ms":longIntervals,"worst_interval_ms":worstInterval*1000,"mean_motion_work_ms":frameCount>0 ? frameWork/Double(frameCount)*1000 : 0,"camera_updates":cameraUpdates,"mean_camera_work_ms":cameraUpdates>0 ? cameraWork/Double(cameraUpdates)*1000 : 0,"cached_ink_textures":AuraInk.cachedCount,"unique_aura_colors":Set(simulation.agents.map(\.auraInk)).count,"ability_totals":AuraActivity.allCases.map { activity in simulation.agents.reduce(0) { $0+$1.abilities[activity.rawValue] } },"real_map_loaded":hasRealMap,"connected_peers":peers.count,"restored_user_abilities":simulation.restoredUserAbilities,"ability_count_mismatches":simulation.agents.filter { $0.abilities.reduce(0,+) != $0.completed }.count,"scope":"actual simulation callback cadence and CPU work; not measured displayed FPS or matched baseline"]
        let url = FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("WorldSceneMetrics.json")
        metricWriter.async { if let data = try? JSONSerialization.data(withJSONObject:snapshot,options:.sortedKeys) { try? data.write(to:url,options:.atomic) } }
    }
    private func cameraChanged() {
        let start = CACurrentMediaTime(); project(geometry:true); cameraWork += CACurrentMediaTime()-start; cameraUpdates += 1
        accessibilityValue = String(format:"%.0f%%",zoom*100)
    }
    func overview() { followsUser = false; zoom = 1; camera = CGPoint(x:500,y:700); cameraChanged() }
    func recenter() { followsUser = true; camera = simulation.agents[0].point; zoom = 2.4; cameraChanged() }
    func adjustZoom(_ factor: CGFloat) { followsUser = false; zoomAt(factor,anchor:CGPoint(x:viewport.midX,y:viewport.midY)) }
    private func zoomAt(_ factor: CGFloat, anchor: CGPoint) {
        let origin = mapPoint(anchor); zoom = min(3.5,max(0.45,zoom*factor))
        camera = CGPoint(x:origin.x-(anchor.x-viewport.midX)/(fit*zoom),y:origin.y-(anchor.y-viewport.midY)/(fit*zoom)); cameraChanged()
    }
    func focus(on resident: WorldResident) { focus(agent:WorldResident.allCases.firstIndex(of:resident) ?? 0) }
    fileprivate func focus(agent id: Int) { followsUser = id==0; if id>=1000 { guard peers.indices.contains(id-1000) else { return }; camera = CGPoint(x:peers[id-1000].point[0],y:peers[id-1000].point[1]) } else { camera = simulation.agents[id].point }; zoom = max(2.4,zoom); cameraChanged() }
    func snapshot(_ id: Int) -> AuraAgentSnapshot? {
        if id<1000 { return simulation.snapshot(id) }
        guard peers.indices.contains(id-1000) else { return nil }
        let peer = peers[id-1000],signature = peer.abilities.enumerated().max { $0.element<$1.element }?.offset ?? 0
        var snapshot = AuraAgentSnapshot(id:id,activity:AuraActivity(rawValue:peer.activity) ?? .rest,travelling:false,waitingForPartner:false,energy:0,completed:peer.abilities.reduce(0,+),ideas:0,progress:0,abilities:peer.abilities,signature:signature,auraInk:peer.ink)
        snapshot.isConnectedPeer = true; return snapshot
    }
    func restoreAbilities(_ values: [Int]) { simulation.restoreUserAbilities(values) }
    func locateUser(_ point: CGPoint,radius: Double) {
        let entering = !locationMode
        locationMode = true
        ownRadius = CGFloat(radius)
        simulation.anchorUser(point)
        if entering {
            updateAccessibility()
            recenter()
        } else {
            cameraChanged()
        }
    }
    func showLocalWorld() {
        guard locationMode else { return }
        locationMode = false
        mapDrawing?.removeFromSuperlayer()
        mapDrawing = nil
        hasRealMap = false
        simulation.releaseUserAnchor()
        places.setPlaces(AuraWorldSimulation.localPlaces(strings), traits:traitCollection)
        setPeers([])
        recenter()
    }
    func setMap(_ sheet: WorldMapSheet) {
        mapDrawing?.removeFromSuperlayer()
        let map = WorldSketchMap.make(sheet)
        mapDrawing = map.drawing
        layer.insertSublayer(map.drawing,below:places.pigments)
        hasRealMap = true
        places.setPlaces(map.places, traits:traitCollection)
        cameraChanged()
    }
    private func updateAccessibility() {
        accessibilityElements = (locationMode ? [elements[0]] : elements) + peerElements + accessiblePlaces
    }
    func setPeers(_ values: [WorldCloudPeer]) {
        peers = values.sorted { $0.id<$1.id }
        let ids = Set(peers.map(\.id)); peerPositions = peerPositions.filter { ids.contains($0.key) }
        for peer in peers where peerPositions[peer.id] == nil || !mayMove { peerPositions[peer.id] = CGPoint(x:peer.point[0],y:peer.point[1]) }
        for layer in peerLayers { layer.removeFromSuperlayer() }; peerLayers = []; peerElements = []
        for (index,peer) in peers.enumerated() {
            let light = CALayer(); light.bounds = CGRect(x:0,y:0,width:96,height:96); light.contents = AuraInk.image(peer.ink).cgImage
            light.actions = ["position":NSNull(),"transform":NSNull(),"hidden":NSNull()]; lightLayer.addSublayer(light); peerLayers.append(light)
            peerElements.append(AuraAccessibleElement(canvas:self,id:1000+index))
        }
        for element in peerElements { element.accessibilityCustomActions = accessibilityCustomActions }
        updateAccessibility()
        cameraChanged()
    }
    fileprivate func agentLabel(_ id: Int) -> String { if id>=1000 { return strings[.nearbyAura] }; return id==0 ? strings[.yourLight] : strings[.light]+String(format:" %02d",id+1) }
    fileprivate func agentValue(_ id: Int) -> String {
        guard let a = snapshot(id) else { return "" }
        if a.isConnectedPeer { return strings[.approximateAura] }
        return strings[a.activity.titleKey]+" · "+strings[a.waitingForPartner ? .activityWaiting : a.travelling ? .activityTravelling : .activityDoing]
    }
    fileprivate func selectAgent(_ id: Int) { onAgentTap?(id) }
    func apply(state: WorldState, strings: WorldStrings) {
        self.strings = strings; movement = state.movement; mood = state.aura
        if locationMode { places.updateTypography(traits:traitCollection) }
        else { places.setPlaces(AuraWorldSimulation.localPlaces(strings), traits:traitCollection) }
        accessibilityLabel = strings[.world]; accessibilityValue = String(format:"%.0f%%",zoom*100)
        accessibilityCustomActions = [UIAccessibilityCustomAction(name:strings[.zoomIn],target:self,selector:#selector(accessibleZoomIn)),UIAccessibilityCustomAction(name:strings[.zoomOut],target:self,selector:#selector(accessibleZoomOut)),UIAccessibilityCustomAction(name:strings[.overview],target:self,selector:#selector(accessibleOverview)),UIAccessibilityCustomAction(name:strings[.returnToLight],target:self,selector:#selector(accessibleRecenter))]
        for element in elements + peerElements { element.accessibilityCustomActions = accessibilityCustomActions }
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
        if gesture.state == .began { followsUser = false }
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
        let ids = (locationMode ? [0] : Array(simulation.agents.indices)) + peers.indices.map { 1000+$0 }
        let targets = ids.map { id in (id,hypot(screenPoint(id).x-p.x,screenPoint(id).y-p.y)) }.filter { $0.1<=max(24,40*zoom) }.sorted { $0.1<$1.1 }
        guard let nearest = targets.first else { return }
        let overlapping = targets.filter { $0.1<=nearest.1+24 }.compactMap { snapshot($0.0) }
        if overlapping.count>1 { onAuraGroupTap?(overlapping) } else { selectAgent(nearest.0) }
    }
}
