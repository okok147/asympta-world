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
        if active && [.authorizedWhenInUse,.authorizedAlways].contains(manager.authorizationStatus) { manager.startUpdatingLocation() }
        else { manager.stopUpdatingLocation() }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        onStatus?(manager.authorizationStatus)
        if [.authorizedWhenInUse,.authorizedAlways].contains(manager.authorizationStatus) { manager.startUpdatingLocation() }
    }
    func locationManager(_ manager: CLLocationManager,didUpdateLocations locations: [CLLocation]) {
        guard let value = locations.last,value.horizontalAccuracy>=0,abs(value.timestamp.timeIntervalSinceNow)<120 else { return }
        onLocation?(value.coordinate,value.horizontalAccuracy)
    }
    func locationManager(_ manager: CLLocationManager,didFailWithError error: Error) { onFailure?() }
}

/// Sparse real geometry: pencil double strokes, important footprints, a few original place names.
/// No imaginary roads/buildings are inserted. All map paths share the light-world camera.
enum WorldSketchMap {
    static func layer(_ sheet: WorldMapSheet) -> CALayer {
        let group = CALayer(); group.bounds = CGRect(x:0,y:0,width:1000,height:1400); group.anchorPoint = .zero
        let roads = CGMutablePath(), majors = CGMutablePath(), echoes = CGMutablePath(), buildings = CGMutablePath(), hatching = CGMutablePath()
        var labels = Set<String>(), labelCount = 0
        for (index,feature) in sheet.features.enumerated() {
            let points = feature.points.compactMap { pair -> CGPoint? in guard pair.count==2,pair.allSatisfy(\.isFinite) else { return nil }; return CGPoint(x:pair[0],y:pair[1]) }
            guard let first = points.first else { continue }
            let path = CGMutablePath(); path.addLines(between:points)
            if feature.kind == "building" {
                path.closeSubpath(); buildings.addPath(path)
                let box = path.boundingBox
                // Confine the small pencil hatch marks to the actual footprint.
                if box.width>5 && box.height>5 {
                    for k in 0..<min(18,Int(box.width/8)+1) {
                        let p = CGPoint(x:box.minX+CGFloat(k)*8,y:box.midY)
                        if path.contains(p) { hatching.move(to:p); hatching.addLine(to:CGPoint(x:p.x+2,y:p.y-2)) }
                    }
                }
            } else if feature.kind == "majorRoad" || feature.kind == "road" {
                (feature.kind == "majorRoad" ? majors : roads).addPath(path)
                let echoed = points.enumerated().map { i,p in CGPoint(x:p.x+sin(CGFloat(index*17+i*7))*0.85,y:p.y+cos(CGFloat(index*11+i*3))*0.85) }
                echoes.addLines(between:echoed)
            }
            if !feature.name.isEmpty && !labels.contains(feature.name) && labelCount<11 && (feature.kind == "landmark" || feature.kind == "building" || feature.kind == "majorRoad") {
                let center = feature.kind == "landmark" ? first : points[points.count/2]
                guard center.x>50,center.x<850,center.y>50,center.y<1320 else { continue }
                let label = CATextLayer(); label.string = feature.name; label.fontSize = feature.kind == "majorRoad" ? 10:11
                label.font = UIFont(name:"AmericanTypewriter",size:11) ?? UIFont.systemFont(ofSize:11,weight:.light)
                label.foregroundColor = UIColor(hex:0x777166).withAlphaComponent(0.58).cgColor
                label.contentsScale = UIScreen.main.scale; label.frame = CGRect(x:center.x+5,y:center.y+5,width:140,height:32)
                label.isWrapped = true; group.addSublayer(label); labels.insert(feature.name); labelCount += 1
            }
        }
        func ink(_ path: CGPath,width: CGFloat,alpha: CGFloat,fill: Bool = false) {
            let line = CAShapeLayer(); line.path = path; line.strokeColor = UIColor(hex:0x82796b).withAlphaComponent(alpha).cgColor
            line.fillColor = fill ? UIColor(hex:0xb4a58c).withAlphaComponent(0.035).cgColor : UIColor.clear.cgColor
            line.lineWidth = width; line.lineCap = .round; line.lineJoin = .round; group.insertSublayer(line,at:0)
        }
        ink(buildings,width:0.85,alpha:0.44,fill:true); ink(hatching,width:0.55,alpha:0.20)
        ink(roads,width:0.8,alpha:0.28); ink(majors,width:1.45,alpha:0.44); ink(echoes,width:0.35,alpha:0.16)
        return group
    }
}
