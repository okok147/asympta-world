import Foundation
import UIKit
import Security
import CoreLocation

struct WorldCloudPeer: Codable {
    let id: String
    let point: [Double]
    let ink: UInt32
    let abilities: [Int]
    let activity: Int
    let seen: Double
    let radiusMeters: Double
}
private struct AuraGrowth: Codable {
    var schema = 1
    var abilities: [Int]
    var updatedAt: Double
}
private struct PresencePacket: Codable {
    let type: String
    let peers: [WorldCloudPeer]?
    let id: String?
    let serverTime: Double?
}

@MainActor
final class WorldCloudSession {
    static let endpoint = URL(string:"https://asympta-world-aura.asympta-invitation-service.workers.dev")!
    private let token: String?
    let identityInk: UInt32
    private(set) var growthSynced = false
    private(set) var abilities = [Int](repeating:0,count:5)
    private var readable = true
    private var active = false
    private var socket: URLSessionWebSocketTask?
    private var heartbeat: Timer?
    private var saveTask: Task<Void,Never>?
    private var mapTask: Task<Void,Never>?
    private var lastUpload = Date.distantPast
    private var accuracy = 200.0
    private var coordinate: CLLocationCoordinate2D?
    private var cell: WorldMapCell?
    private var serverOffset = 0.0
    private var latestPeers: [WorldCloudPeer] = []
    private var lastPresence = Date.distantPast
    private var cloudID: String?
    private let session = URLSession(configuration:.ephemeral)
    private let growthURL = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("AsymptaWorld/aura-growth-v1.json")
    var onAbilities: (([Int])->Void)?
    var onMap: ((WorldMapSheet)->Void)?
    var onPeers: (([WorldCloudPeer])->Void)?
    var onConnection: ((Bool)->Void)?
    var onMapFailure: (() -> Void)?
    var currentActivity: (() -> Int)?
    init() {
        let credential = Self.credential(); token = credential
        var hash: UInt64 = 1469598103934665603
        for b in (credential ?? "offline").utf8 { hash = (hash ^ UInt64(b)) &* 1099511628211 }
        let color = UIColor(hue:CGFloat(hash%10000)/10000,saturation:0.35,brightness:0.88,alpha:1)
        var r: CGFloat=0,g: CGFloat=0,b: CGFloat=0; color.getRed(&r,green:&g,blue:&b,alpha:nil)
        identityInk = UInt32(r*255)<<16 | UInt32(g*255)<<8 | UInt32(b*255)
        if FileManager.default.fileExists(atPath:growthURL.path) {
            do {
                let growth = try JSONDecoder().decode(AuraGrowth.self,from:Data(contentsOf:growthURL))
                guard growth.schema==1,Self.valid(growth.abilities) else { throw CocoaError(.fileReadCorruptFile) }
                abilities = growth.abilities
            } catch { readable = false }
        }
    }
    private static func credential() -> String? {
        let query: [String:Any] = [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"com.asympta.world.aura",kSecAttrAccount as String:"installation-v1"]
        var read = query; read[kSecReturnData as String] = true; read[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(read as CFDictionary,&result)
        if status==errSecSuccess,let data = result as? Data { return String(data:data,encoding:.utf8) }
        guard status==errSecItemNotFound else { return nil }
        var bytes = [UInt8](repeating:0,count:32)
        guard SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess else { return nil }
        let token = Data(bytes).base64EncodedString().replacingOccurrences(of:"+",with:"-").replacingOccurrences(of:"/",with:"_").replacingOccurrences(of:"=",with:"")
        var insert = query; insert[kSecValueData as String] = Data(token.utf8); insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(insert as CFDictionary,nil)==errSecSuccess ? token : nil
    }
    private static func valid(_ counts: [Int]) -> Bool { counts.count==5 && counts.allSatisfy { $0>=0 && $0<=10000000 } }
    private func request(_ path: String) -> URLRequest? {
        guard let token,let url = URL(string:path,relativeTo:Self.endpoint) else { return nil }
        var r = URLRequest(url:url); r.setValue("Bearer "+token,forHTTPHeaderField:"Authorization"); r.timeoutInterval = 35
        return r
    }
    func setActive(_ value: Bool) {
        guard value != active else { return }
        active = value
        if value {
            Task { await restoreGrowth() }
            if coordinate != nil { connect() }
        } else {
            disconnect(); saveTask?.cancel(); saveTask = nil
            Task { await uploadGrowth() }
        }
    }
    func updateLocation(_ location: CLLocationCoordinate2D,accuracy: Double) {
        self.accuracy = min(10000,max(200,ceil(accuracy/100)*100))
        let next = WorldMapCell(location),approximate = next.approximateCoordinate(location)
        let changed = cell != next
        cell = next; coordinate = approximate
        if changed {
            disconnect()
            requestMap(next)
            if active { connect() }
        } else { sendPresence() }
    }
    func retryMap() { if let cell { requestMap(cell) } }
    func clearLocation() {
        mapTask?.cancel()
        mapTask = nil
        cell = nil
        coordinate = nil
        disconnect()
    }
    private func requestMap(_ cell: WorldMapCell) {
        mapTask?.cancel()
        mapTask = Task { await loadMap(cell) }
    }
    func record(_ values: [Int]) {
        guard readable,Self.valid(values) else { return }
        let merged = zip(abilities,values).map { max($0.0,$0.1) }
        guard merged != abilities else { return }
        abilities = merged; growthSynced = false; persist()
        if saveTask == nil {
            saveTask = Task { [weak self] in
                try? await Task.sleep(for:.seconds(20))
                guard !Task.isCancelled,let self else { return }; self.saveTask = nil; await self.uploadGrowth()
            }
        }
    }
    private func persist() {
        guard readable else { return }
        do {
            try FileManager.default.createDirectory(at:growthURL.deletingLastPathComponent(),withIntermediateDirectories:true)
            let value = AuraGrowth(abilities:abilities,updatedAt:Date().timeIntervalSince1970*1000)
            try JSONEncoder().encode(value).write(to:growthURL,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
        } catch { /* Keep the last durable file; never replace it with defaults. */ }
    }
    private func restoreGrowth() async {
        guard readable,let r = request("/v1/profile") else { return }
        do {
            let (data,response) = try await session.data(for:r)
            guard (response as? HTTPURLResponse)?.statusCode==200,data.count<4096 else { return }
            let growth = try JSONDecoder().decode(AuraGrowth.self,from:data)
            guard Self.valid(growth.abilities) else { return }
            abilities = zip(abilities,growth.abilities).map { max($0.0,$0.1) }
            growthSynced = zip(growth.abilities,abilities).allSatisfy { $0.0 >= $0.1 }
            persist(); recordCloudResponse(method:r.httpMethod ?? "GET",growth:growth,response:response); onAbilities?(abilities)
        } catch {}
    }
    private func uploadGrowth() async {
        guard readable,let base = request("/v1/profile"),Date().timeIntervalSince(lastUpload)>3 else { return }
        lastUpload = Date(); var r = base; r.httpMethod = "PUT"; r.setValue("application/json",forHTTPHeaderField:"Content-Type")
        r.httpBody = try? JSONSerialization.data(withJSONObject:["abilities":abilities])
        do {
            let (data,response) = try await session.data(for:r)
            guard (response as? HTTPURLResponse)?.statusCode==200,data.count<4096 else { return }
            let growth = try JSONDecoder().decode(AuraGrowth.self,from:data)
            guard Self.valid(growth.abilities) else { return }
            abilities = zip(abilities,growth.abilities).map { max($0.0,$0.1) }
            growthSynced = zip(growth.abilities,abilities).allSatisfy { $0.0 >= $0.1 }
            persist(); recordCloudResponse(method:r.httpMethod ?? "GET",growth:growth,response:response); onAbilities?(abilities)
        } catch {}
    }
    private func recordCloudResponse(method: String,growth: AuraGrowth,response: URLResponse) {
        let value: [String:Any] = ["build":Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") as? String ?? "?","method":method,"status":(response as? HTTPURLResponse)?.statusCode ?? 0,"server_abilities":growth.abilities,"local_abilities":abilities,"server_updated_at":growth.updatedAt,"received_at":Date().timeIntervalSince1970*1000,"synchronized":growthSynced]
        let url = FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("AuraCloudResponse.json")
        if let data = try? JSONSerialization.data(withJSONObject:value,options:.sortedKeys) { try? data.write(to:url,options:.atomic) }
    }
    private func loadMap(_ target: WorldMapCell) async {
        guard cell == target, !Task.isCancelled else { return }
        let cache = FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("aura-map-\(target.x)-\(target.y).json")
        if let data = try? Data(contentsOf:cache),data.count<1024*1024,let sheet = try? JSONDecoder().decode(WorldMapSheet.self,from:data),cell==target { onMap?(sheet) }
        guard let r = request("/v1/map?x=\(target.x)&y=\(target.y)") else { onMapFailure?(); return }
        do {
            let (data,response) = try await session.data(for:r)
            guard (response as? HTTPURLResponse)?.statusCode==200,data.count<1024*1024 else { throw URLError(.badServerResponse) }
            let sheet = try JSONDecoder().decode(WorldMapSheet.self,from:data)
            guard sheet.schema==1,sheet.cellX==target.x,sheet.cellY==target.y,sheet.features.count<=249 else { throw URLError(.cannotParseResponse) }
            try? data.write(to:cache,options:.atomic)
            if cell==target, !Task.isCancelled { onMap?(sheet) }
        } catch { if cell==target, !Task.isCancelled { onMapFailure?() } }
    }
    private func connect() {
        guard active,socket==nil,let cell,coordinate != nil,var r = request("/v1/world?x=\(cell.x)&y=\(cell.y)") else { return }
        var parts = URLComponents(url:r.url!,resolvingAgainstBaseURL:true)!; parts.scheme = "wss"; r.url = parts.url
        let ws = session.webSocketTask(with:r); socket = ws; ws.resume(); receive(ws)
        heartbeat = Timer.scheduledTimer(withTimeInterval:15,repeats:true) { [weak self] _ in Task { @MainActor in self?.sendPresence(); self?.expirePeers() } }
    }
    private func disconnect() {
        heartbeat?.invalidate(); heartbeat = nil; socket?.cancel(with:.goingAway,reason:nil); socket = nil; cloudID = nil
        latestPeers = []; onConnection?(false); onPeers?([])
    }
    private func receive(_ ws: URLSessionWebSocketTask) {
        ws.receive { [weak self,weak ws] result in
            Task { @MainActor in
                guard let self,let ws,self.socket===ws else { return }
                switch result {
                case .success(let message):
                    if case .string(let text) = message,text.utf8.count<65536,let packet = try? JSONDecoder().decode(PresencePacket.self,from:Data(text.utf8)) {
                        if packet.type=="welcome" { self.cloudID = packet.id; self.onConnection?(true); self.sendPresence() }
                        if packet.type=="presence",let peers = packet.peers {
                            if let time = packet.serverTime { self.serverOffset = time/1000-Date().timeIntervalSince1970 }
                            self.latestPeers = Array(peers.filter { $0.id != self.cloudID && $0.point.count==2 && $0.point.allSatisfy(\.isFinite) && Self.valid($0.abilities) && $0.radiusMeters.isFinite && $0.radiusMeters>=200 && $0.radiusMeters<=10000 }.prefix(80))
                            self.expirePeers()
                        }
                    }
                    self.receive(ws)
                case .failure:
                    self.disconnect()
                    // One finite backoff, cancelled naturally by inactive state; no busy reconnect loop.
                    Task { [weak self] in try? await Task.sleep(for:.seconds(15)); guard let self,self.active else { return }; self.connect() }
                }
            }
        }
    }
    private func expirePeers() {
        let now = (Date().timeIntervalSince1970+serverOffset)*1000
        latestPeers = latestPeers.filter { now-$0.seen<45000 }
        onPeers?(latestPeers)
    }
    private func sendPresence() {
        guard active,cloudID != nil,let socket,let coordinate,Date().timeIntervalSince(lastPresence)>1.2 else { return }
        lastPresence = Date()
        let packet: [String:Any] = ["type":"presence","latitude":coordinate.latitude,"longitude":coordinate.longitude,"ink":identityInk,"abilities":abilities,"activity":currentActivity?() ?? 0,"radiusMeters":accuracy]
        guard let data = try? JSONSerialization.data(withJSONObject:packet),let text = String(data:data,encoding:.utf8) else { return }
        socket.send(.string(text)) { _ in }
    }
}
