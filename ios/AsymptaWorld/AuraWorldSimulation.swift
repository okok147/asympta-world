import Foundation
import CoreGraphics
import UIKit

enum AuraActivity: Int, CaseIterable {
    case explore, learn, create, connect, rest
    var titleKey: WorldStrings.Key {
        switch self { case .explore:return .activityExplore; case .learn:return .activityLearn; case .create:return .activityCreate; case .connect:return .activityConnect; case .rest:return .activityRest }
    }
    var ink: UInt32 {
        switch self { case .explore:return 0x7296aa; case .learn:return 0xb0a2cb; case .create:return 0xdca37b; case .connect:return 0x96bbaa; case .rest:return 0xe5bd79 }
    }
}

struct AuraAgentSnapshot {
    let id: Int
    let activity: AuraActivity
    let travelling: Bool
    let waitingForPartner: Bool
    let energy: Int
    let completed: Int
    let ideas: Int
    let progress: Int
    let abilities: [Int]
    let signature: Int
    let auraInk: UInt32
    var isConnectedPeer = false
    var dominant: AuraActivity { AuraActivity(rawValue:signature % AuraActivity.allCases.count) ?? activity }
    var dominantLevel: Int { AuraAbility.level(abilities[signature % abilities.count]) }
}

enum AuraAbility {
    static let maximumLevel = 10
    static func level(_ completions: Int) -> Int {
        min(maximumLevel, 1 + Int(sqrt(Double(max(0, completions)))))
    }
    static func progress(_ completions: Int) -> Float {
        min(1, Float(max(0, completions)) / Float((maximumLevel - 1) * (maximumLevel - 1)))
    }
}

/// Local, explicit simulation: no external work, messages, accounts or network effects.
final class AuraWorldSimulation {
    struct Agent {
        let id: Int
        let auraInk: UInt32
        var point: CGPoint
        var source: CGPoint
        var target: CGPoint
        var bend: CGPoint
        var activity: AuraActivity
        var travelling = true
        var elapsed: Double = 0
        var duration: Double = 1
        var energy: Double
        var completed = 0
        var abilities = [Int](repeating:0,count:AuraActivity.allCases.count)
        var ideas = 0
        var partner: Int?
    }
    private(set) var agents: [Agent] = []
    private(set) var completedActivities = 0
    private(set) var completedEncounters = 0
    private var seed: UInt64 = 7919731
    static let extent = CGSize(width:1000,height:1400)
    private static let learningHubs: [(CGPoint, WorldStrings.Key, UInt32)] = [
        (CGPoint(x:240,y:360), .glimmerField, 0xc87550),
        (CGPoint(x:740,y:660), .paperRiver, 0x4f90a5),
        (CGPoint(x:400,y:1060), .slowHill, 0x9c8bb6)
    ]
    private static let makingHubs: [(CGPoint, WorldStrings.Key, UInt32)] = [
        (CGPoint(x:650,y:390), .eveningWay, 0xdd9c48),
        (CGPoint(x:300,y:800), .inkBank, 0x6d8eaa),
        (CGPoint(x:730,y:1110), .littlePath, 0xc38265)
    ]

    static func localPlaces(_ strings: WorldStrings) -> [WorldPlace] {
        (learningHubs + makingHubs).map { point, key, ink in
            WorldPlace(name:strings[key], point:point, rank:0, ink:ink)
        }
    }

    static func identityInk(_ id: Int) -> UInt32 {
        let hue = CGFloat((Double(id) * 0.61803398875).truncatingRemainder(dividingBy:1))
        let color = UIColor(hue:hue,saturation:0.35,brightness:0.88,alpha:1)
        var red: CGFloat=0,green: CGFloat=0,blue: CGFloat=0
        color.getRed(&red,green:&green,blue:&blue,alpha:nil)
        return (UInt32(red*255)<<16) | (UInt32(green*255)<<8) | UInt32(blue*255)
    }
    private var userAnchor: CGPoint?
    private var localUserPoint: CGPoint?
    private(set) var restoredUserAbilities = [Int](repeating:0,count:5)
    init(count: Int = 72,userInk: UInt32? = nil) {
        let anchors = [CGPoint(x:500,y:700),CGPoint(x:660,y:520),CGPoint(x:790,y:840),CGPoint(x:280,y:450),CGPoint(x:330,y:950)]
        for id in 0..<count {
            let p = id<anchors.count ? anchors[id] : CGPoint(x:80+random()*840,y:120+random()*1160)
            agents.append(Agent(id:id,auraInk:id == 0 ? userInk ?? Self.identityInk(0) : Self.identityInk(id),point:p,source:p,target:p,bend:p,activity:AuraActivity(rawValue:id%5)!,energy:0.35+random()*0.6))
        }
        for id in agents.indices { plan(id,activity:agents[id].activity) }
    }
    private func random() -> Double {
        seed = seed &* 6364136223846793005 &+ 1442695040888963407
        return Double((seed >> 32) % 10000)/10000
    }
    private func distance(_ a: CGPoint,_ b: CGPoint) -> CGFloat { hypot(a.x-b.x,a.y-b.y) }
    private func bounded(_ p: CGPoint) -> CGPoint { CGPoint(x:min(920,max(80,p.x)),y:min(1280,max(120,p.y))) }
    private func plan(_ id: Int, activity requested: AuraActivity? = nil) {
        guard agents.indices.contains(id) else { return }
        if id==0,let anchor = userAnchor {
            agents[0].point = anchor; agents[0].source = anchor; agents[0].target = anchor
            agents[0].travelling = false; agents[0].elapsed = 0; agents[0].duration = 8+random()*8
            agents[0].activity = requested ?? (agents[0].energy<0.24 ? .rest : AuraActivity(rawValue:Int(random()*3))!)
            return
        }
        var activity = requested ?? (agents[id].energy<0.24 ? .rest : AuraActivity(rawValue:Int(random()*5))!)
        var destination: CGPoint
        let p = agents[id].point
        switch activity {
        case .explore:
            destination = bounded(CGPoint(x:p.x+(random()-0.5)*650,y:p.y+(random()-0.5)*650))
        case .learn:
            let hub = Self.learningHubs[id % Self.learningHubs.count].0
            destination = bounded(CGPoint(x:hub.x+(random()-0.5)*140,y:hub.y+(random()-0.5)*140))
        case .create:
            let hub = Self.makingHubs[id % Self.makingHubs.count].0
            destination = bounded(CGPoint(x:hub.x+(random()-0.5)*160,y:hub.y+(random()-0.5)*160))
        case .rest:
            // Rest nearby, rather than crossing the entire paper when tired.
            destination = bounded(CGPoint(x:p.x+(random()-0.5)*130,y:p.y+(random()-0.5)*130))
        case .connect:
            let candidate = agents.filter { ($0.id != 0 || userAnchor == nil) && $0.id != id && $0.partner == nil && !$0.travelling && $0.activity == .rest }
                .min { distance($0.point,p)<distance($1.point,p) }
            if let peer = candidate {
                agents[id].partner = peer.id; agents[peer.id].partner = id
                destination = bounded(CGPoint(x:peer.point.x+32,y:peer.point.y+12))
            } else {
                activity = .explore
                destination = bounded(CGPoint(x:p.x+(random()-0.5)*550,y:p.y+(random()-0.5)*550))
            }
        }
        agents[id].source = p; agents[id].target = destination
        let dx = destination.x-p.x, dy = destination.y-p.y, curve = (random()-0.5)*0.4
        agents[id].bend = bounded(CGPoint(x:(p.x+destination.x)/2-dy*curve,y:(p.y+destination.y)/2+dx*curve))
        agents[id].activity = activity; agents[id].travelling = true; agents[id].elapsed = 0
        agents[id].duration = max(3,Double(distance(p,destination))/(activity == .rest ? 40 : 55))
    }
    func anchorUser(_ point: CGPoint) {
        guard userAnchor != point else { return }
        if userAnchor == nil { localUserPoint = agents[0].point }
        if let peer = agents[0].partner { agents[peer].partner = nil; agents[0].partner = nil; plan(peer) }
        userAnchor = point; agents[0].point = point; plan(0)
    }
    func releaseUserAnchor() {
        guard let localUserPoint else { return }
        userAnchor = nil
        self.localUserPoint = nil
        agents[0].point = localUserPoint
        plan(0)
    }

    func restoreUserAbilities(_ values: [Int]) {
        guard values.count==5,values.allSatisfy({$0>=0}) else { return }
        for index in values.indices {
            let delta = max(0,values[index]-agents[0].abilities[index])
            agents[0].abilities[index] += delta; agents[0].completed += delta; completedActivities += delta; restoredUserAbilities[index] += delta
        }
    }
    func advance(_ delta: Double) {
        let dt = min(0.05,max(0,delta))
        for id in agents.indices {
            if userAnchor != nil && id != 0 { continue }
            // A resting recipient holds its position until its partner actually arrives.
            if let peer = agents[id].partner, !agents[id].travelling, agents[id].activity == .rest, agents[peer].travelling { continue }
            agents[id].elapsed += dt
            if agents[id].travelling {
                let t = CGFloat(min(1,agents[id].elapsed/agents[id].duration))
                let u = t*t*(3-2*t), v = 1-u
                let a = agents[id]
                agents[id].point = CGPoint(x:v*v*a.source.x+2*v*u*a.bend.x+u*u*a.target.x,y:v*v*a.source.y+2*v*u*a.bend.y+u*u*a.target.y)
                agents[id].energy = max(0,agents[id].energy-dt*0.003)
                if t>=1 {
                    agents[id].travelling = false; agents[id].elapsed = 0
                    switch agents[id].activity {
                    case .rest: agents[id].duration = 7+random()*5
                    case .learn: agents[id].duration = 5+random()*5
                    case .create: agents[id].duration = 5+random()*6
                    case .explore: agents[id].duration = 1+random()*2
                    case .connect:
                        agents[id].duration = 5
                        if let peer = agents[id].partner, distance(agents[id].point,agents[peer].point)<65 {
                            agents[peer].activity = .connect; agents[peer].elapsed = 0; agents[peer].duration = 5
                        }
                    }
                }
            } else {
                if agents[id].activity == .rest { agents[id].energy = min(1,agents[id].energy+dt*0.065) }
                if agents[id].elapsed>=agents[id].duration { complete(id) }
            }
        }
    }
    private func complete(_ id: Int) {
        let activity = agents[id].activity
        agents[id].abilities[activity.rawValue] += 1
        if activity == .create || activity == .learn { agents[id].ideas += 1 }
        if activity == .connect, let peer = agents[id].partner {
            // Exchange only after both dots reached the actual encounter, never at a distance.
            if distance(agents[id].point,agents[peer].point)<65 {
                if agents[id].ideas>agents[peer].ideas { agents[peer].ideas += 1 }
                else if agents[peer].ideas>agents[id].ideas { agents[id].ideas += 1 }
                completedEncounters += 1
            }
            agents[peer].partner = nil
            // Finish the reciprocal participant as one shared encounter, without double-counting.
            agents[peer].completed += 1; completedActivities += 1
            agents[peer].abilities[AuraActivity.connect.rawValue] += 1
            agents[peer].energy = max(0.1,agents[peer].energy-0.035)
            agents[id].partner = nil
            plan(peer)
        }
        agents[id].completed += 1; completedActivities += 1
        if activity != .rest { agents[id].energy = max(0,agents[id].energy-0.06) }
        plan(id)
    }
    func snapshot(_ id: Int) -> AuraAgentSnapshot? {
        guard agents.indices.contains(id) else { return nil }
        let a = agents[id]
        let signature = a.abilities.enumerated().max { lhs,rhs in lhs.element == rhs.element ? lhs.offset > rhs.offset : lhs.element < rhs.element }?.offset ?? a.activity.rawValue
        return AuraAgentSnapshot(id:id,activity:a.activity,travelling:a.travelling,waitingForPartner:a.activity == .rest && a.partner != nil,energy:Int(a.energy*100),completed:a.completed,ideas:a.ideas,progress:Int(min(1,a.elapsed/a.duration)*100),abilities:a.abilities,signature:signature,auraInk:a.auraInk)
    }
}
