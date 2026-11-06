import UIKit
import CoreLocation

struct WorldMapFeature: Codable {
    let id: String
    let kind: String
    let name: String
    let points: [[Double]]
}
struct WorldMapSheet: Codable {
    let schema: Int
    let room: String
    let cellX: Int
    let cellY: Int
    let features: [WorldMapFeature]
    let generatedAt: Double
    let attribution: String
    let attributionURL: String
    let stale: Bool
}
struct WorldMapCell: Equatable {
    let x: Int, y: Int
    static let radius = 6378137.0
    static func meters(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
        let latitude = min(85,max(-85,coordinate.latitude))
        return CGPoint(x:radius*coordinate.longitude*Double.pi/180,y:radius*log(tan(Double.pi/4+latitude*Double.pi/360)))
    }
    init(_ coordinate: CLLocationCoordinate2D) {
        let p = Self.meters(coordinate)
        x = Int((p.x/1600).rounded()); y = Int((p.y/2240).rounded())
    }
    /// The displayed and shared center is a 200m grid cell, never a doorstep fix.
    func approximatePoint(_ coordinate: CLLocationCoordinate2D) -> CGPoint {
        let raw = Self.meters(coordinate)
        let mx = (raw.x/200).rounded()*200, my = (raw.y/200).rounded()*200
        return CGPoint(x:(mx-(Double(x)*1600-800))/1600*1000,y:((Double(y)*2240+1120)-my)/2240*1400)
    }
    func approximateCoordinate(_ coordinate: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        let p = Self.meters(coordinate), mx = (p.x/200).rounded()*200, my = (p.y/200).rounded()*200
        return CLLocationCoordinate2D(latitude:(2*atan(exp(my/Self.radius))-Double.pi/2)*180/Double.pi,longitude:mx/Self.radius*180/Double.pi)
    }
}

@MainActor
final class WorldLocation: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var active = false
    var onLocation: ((CLLocationCoordinate2D,Double)->Void)?
    var onStatus: ((CLAuthorizationStatus)->Void)?
    var onFailure: (() -> Void)?
    override init() {
        super.init(); manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = 150
    }
    var authorization: CLAuthorizationStatus { manager.authorizationStatus }
    func request() {
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedAlways,.authorizedWhenInUse: manager.startUpdatingLocation()
        default: onStatus?(manager.authorizationStatus)
        }
    }
    func setActive(_ active: Bool) {
        self.active = active
        if active && [.authorizedWhenInUse,.authorizedAlways].contains(manager.authorizationStatus) { manager.startUpdatingLocation() }
        else { manager.stopUpdatingLocation() }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        onStatus?(manager.authorizationStatus)
        if [.authorizedWhenInUse,.authorizedAlways].contains(manager.authorizationStatus) { manager.startUpdatingLocation() }
    }
    func locationManager(_ manager: CLLocationManager,didUpdateLocations locations: [CLLocation]) {
        guard active, let value = locations.last,value.horizontalAccuracy>=0,abs(value.timestamp.timeIntervalSinceNow)<120 else { return }
        onLocation?(value.coordinate,value.horizontalAccuracy)
    }
    func locationManager(_ manager: CLLocationManager,didFailWithError error: Error) { if active { onFailure?() } }
}

/// An analog wash shared by the static place pigments and the fibrous aura textures.
enum WorldPigment {
    static func wash(in context: CGContext, ink: UIColor, center: CGPoint, radius: CGFloat, strength: CGFloat) {
        let colors = [1.0, 0.82, 0.27, 0.0].map { ink.withAlphaComponent(strength * $0).cgColor }
        guard let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB),
                                        colors: colors as CFArray, locations: [0, 0.30, 0.67, 1]) else { return }
        context.drawRadialGradient(gradient, startCenter:center, startRadius:0,
                                   endCenter:center, endRadius:radius, options:[])
    }

    static let placeColors: [UInt32] = [0xda7445, 0xe0aa44, 0x4d92ad, 0x9384b1, 0x77927d]
    private static var images: [UInt32: UIImage] = [:]

    static func placeImage(_ ink: UInt32) -> UIImage {
        if let image = images[ink] { return image }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 2
        let image = UIGraphicsImageRenderer(size:CGSize(width:128,height:128), format:format).image { renderer in
            let color = UIColor(hex:ink)
            wash(in:renderer.cgContext, ink:color, center:CGPoint(x:57,y:69), radius:56, strength:0.74)
            wash(in:renderer.cgContext, ink:color, center:CGPoint(x:77,y:51), radius:43, strength:0.42)
        }
        images[ink] = image
        return image
    }
}

struct WorldPlace {
    let name: String
    let point: CGPoint
    let rank: Int
    let ink: UInt32?
}

/// Screen-sized captions are projected from real map features or existing local simulation hubs.
final class WorldPlaceOverlay {
    private struct Caption {
        let place: WorldPlace
        let text: NSAttributedString
        let size: CGSize
    }

    let pigments = CALayer()
    let labels: [UILabel]
    private let washes: [CALayer]
    private var places: [WorldPlace] = []
    private var captions: [Caption] = []
    private var selected: [Int] = []

    init() {
        labels = (0..<4).map { _ in
            let label = UILabel()
            label.textAlignment = .center
            label.numberOfLines = 2
            label.lineBreakMode = .byTruncatingTail
            label.isUserInteractionEnabled = false
            label.isAccessibilityElement = true
            label.accessibilityTraits = .staticText
            label.isHidden = true
            return label
        }
        washes = labels.map { _ in CALayer() }
        washes.forEach(pigments.addSublayer)
    }

    func setPlaces(_ places: [WorldPlace], traits: UITraitCollection) {
        self.places = places.sorted { $0.rank < $1.rank }
        updateTypography(traits:traits)
    }

    func updateTypography(traits: UITraitCollection) {
        captions = places.map { place in
            let isRoad = place.ink == nil
            let base = UIFont.monospacedSystemFont(ofSize:isRoad ? 11 : 14,weight:isRoad ? .regular : .semibold)
            let font = UIFontMetrics(forTextStyle:.footnote).scaledFont(for:base,compatibleWith:traits)
            let text = NSAttributedString(string:place.name, attributes:[
                .font:font, .kern:isRoad ? 0.2 : 0.8,
                .foregroundColor:isRoad ? WorldTheme.muted : WorldTheme.ink
            ])
            let measured = text.boundingRect(with:CGSize(width:190,height:CGFloat.greatestFiniteMagnitude),
                                             options:[.usesLineFragmentOrigin,.usesFontLeading], context:nil)
            return Caption(place:place, text:text, size:CGSize(width:min(194,ceil(measured.width)+4),
                                                                height:min(ceil(font.lineHeight*2)+4,ceil(measured.height)+4)))
        }
        // A localization or text-size change requires rebinding every selected caption.
        selected = Array(repeating:-1,count:labels.count)
    }

    @discardableResult
    func project(in area: CGRect, project: (CGPoint) -> CGPoint) -> Bool {
        var frames: [CGRect] = []
        var visible: [Int] = []
        var names = Set<String>()
        for (index, caption) in captions.enumerated() {
            let anchor = project(caption.place.point)
            let frame = CGRect(x:anchor.x-caption.size.width/2, y:anchor.y-caption.size.height/2,
                               width:caption.size.width,height:caption.size.height).integral
            let clearance = frame.insetBy(dx:-12,dy:caption.place.ink == nil ? -12 : -30)
            guard area.contains(frame), !names.contains(caption.place.name),
                  !frames.contains(where: { $0.intersects(clearance) }) else { continue }

            let slot = visible.count
            let label = labels[slot], wash = washes[slot]
            if !selected.indices.contains(slot) || selected[slot] != index {
                label.attributedText = caption.text
                label.accessibilityLabel = caption.place.name
                wash.contents = caption.place.ink.map { WorldPigment.placeImage($0).cgImage } ?? nil
            }
            label.isHidden = false
            label.frame = frame
            let edgeRoom = min(frame.minX-area.minX,area.maxX-frame.maxX,
                               frame.minY-area.minY,area.maxY-frame.maxY)
            let span = max(134,min(236,area.width*0.64))
            wash.opacity = Float(min(1,edgeRoom/24))
            wash.bounds = CGRect(x:0,y:0,width:span,height:span*0.95)
            wash.position = anchor
            frames.append(clearance)
            visible.append(index)
            names.insert(caption.place.name)
            if visible.count == labels.count { break }
        }
        for slot in visible.count..<labels.count {
            labels[slot].isHidden = true
            washes[slot].contents = nil
        }
        defer { selected = visible }
        return selected != visible
    }
}

/// Pencil double strokes and footprints follow the same camera as the lights.
enum WorldSketchMap {
    static func make(_ sheet: WorldMapSheet) -> (drawing: CALayer, places: [WorldPlace]) {
        let group = CALayer()
        group.bounds = CGRect(origin:.zero,size:AuraWorldSimulation.extent)
        group.anchorPoint = .zero
        let roads = CGMutablePath(), majors = CGMutablePath(), echoes = CGMutablePath(), buildings = CGMutablePath(), hatching = CGMutablePath()
        var places: [WorldPlace] = []
        for (index,feature) in sheet.features.enumerated() {
            let points = feature.points.compactMap { pair -> CGPoint? in guard pair.count==2,pair.allSatisfy(\.isFinite) else { return nil }; return CGPoint(x:pair[0],y:pair[1]) }
            guard let first = points.first else { continue }
            let path = CGMutablePath(); path.addLines(between:points)
            let footprint = path.boundingBox
            if feature.kind == "building" {
                path.closeSubpath(); buildings.addPath(path)
                // Confine the small pencil hatch marks to the actual footprint.
                if footprint.width>5 && footprint.height>5 {
                    for k in 0..<min(18,Int(footprint.width/8)+1) {
                        let p = CGPoint(x:footprint.minX+CGFloat(k)*8,y:footprint.midY)
                        if path.contains(p) { hatching.move(to:p); hatching.addLine(to:CGPoint(x:p.x+2,y:p.y-2)) }
                    }
                }
            } else if feature.kind == "majorRoad" || feature.kind == "road" {
                (feature.kind == "majorRoad" ? majors : roads).addPath(path)
                let echoed = points.enumerated().map { i,p in CGPoint(x:p.x+sin(CGFloat(index*17+i*7))*0.85,y:p.y+cos(CGFloat(index*11+i*3))*0.85) }
                echoes.addLines(between:echoed)
            }

            let name = feature.name.trimmingCharacters(in:.whitespacesAndNewlines)
            guard !name.isEmpty else { continue }
            let point: CGPoint
            let rank: Int
            switch feature.kind {
            case "landmark": point = first; rank = 0
            case "building": point = CGPoint(x:footprint.midX,y:footprint.midY); rank = 1
            case "majorRoad", "road":
                let mid = (points.count-1)/2
                let a = points[mid], b = points[min(mid+1,points.count-1)]
                point = CGPoint(x:(a.x+b.x)/2,y:(a.y+b.y)/2)
                rank = feature.kind == "majorRoad" ? 2 : 3
            default: continue
            }
            guard group.bounds.contains(point) else { continue }
            let colors = WorldPigment.placeColors
            let hash = name.utf8.reduce(UInt32(2166136261)) { ($0 ^ UInt32($1)) &* 16777619 }
            let ink = rank < 2 ? colors[Int(hash % UInt32(colors.count))] : nil
            places.append(WorldPlace(name:name,point:point,rank:rank,ink:ink))
        }
        func ink(_ path: CGPath,width: CGFloat,alpha: CGFloat,fill: Bool = false) {
            let line = CAShapeLayer(); line.path = path; line.strokeColor = UIColor(hex:0x82705a).withAlphaComponent(alpha).cgColor
            line.fillColor = fill ? UIColor(hex:0xbba27c).withAlphaComponent(0.055).cgColor : UIColor.clear.cgColor
            line.lineWidth = width; line.lineCap = .round; line.lineJoin = .round; group.insertSublayer(line,at:0)
        }
        ink(buildings,width:0.85,alpha:0.34,fill:true); ink(hatching,width:0.55,alpha:0.16)
        ink(roads,width:0.8,alpha:0.22); ink(majors,width:1.45,alpha:0.40); ink(echoes,width:0.35,alpha:0.12)
        return (group, places)
    }
}
