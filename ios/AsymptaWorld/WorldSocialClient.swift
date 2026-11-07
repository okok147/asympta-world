import Foundation

extension Notification.Name {
    static let worldSocialRegionDidChange = Notification.Name("com.asympta.world.social-region.changed")
    static let worldSocialInboxDidChange = Notification.Name("com.asympta.world.social-inbox.changed")
}

struct WorldCircleMember: Codable {
    let id: String
    let name: String
    let style: String?
}

struct WorldCircle: Decodable {
    let id: String
    let title: String
    let me: WorldCircleMember
    let memberCount: Int
    let canInvite: Bool
}

struct WorldMoment: Decodable {
    let id: String
    let author: WorldCircleMember
    let text: String
    let createdAt: Double
    let region: String?
    let hasPhoto: Bool
    let photoDescription: String?
    let replyCount: Int
    let reactionCount: Int
    let reacted: Bool
    let owned: Bool
}

struct WorldCircleReply: Decodable {
    let id: String
    let author: WorldCircleMember
    let text: String
    let createdAt: Double
    let owned: Bool
}

struct WorldMomentDetail: Decodable {
    let moment: WorldMoment
    let photo: Data?
    let replies: [WorldCircleReply]
}

struct WorldCircleActivity: Decodable {
    let momentID: String
    let replyID: String
    let author: WorldCircleMember
    let text: String
    let createdAt: Double
}

struct WorldCircleSnapshot: Decodable {
    let circle: WorldCircle
    let moments: [WorldMoment]
    let activity: [WorldCircleActivity]
}

struct WorldCircleInbox: Decodable {
    struct Group: Decodable {
        let circle: WorldCircle
        let activity: [WorldCircleActivity]
        let hasMore: Bool
    }

    var groups: [Group]
    var partial: Bool

    var count: Int { groups.reduce(0) { $0 + $1.activity.count } }
    var hasMore: Bool { groups.contains { $0.hasMore } }
}

struct WorldCircleLink: Codable {
    let id: String
    let title: String
}

struct WorldLibraryCursor: Codable {
    let createdAt: Double
    let id: String
}

struct WorldLibraryPage: Decodable {
    let circle: WorldCircle
    let moments: [WorldMoment]
    let hasMore: Bool
    let nextBefore: WorldLibraryCursor?
}

struct WorldCollection: Decodable {
    let id: String
    let title: String
    let createdAt: Double
    let createdBy: String
    let itemCount: Int
    let owned: Bool
    let containsMoment: Bool?
}

struct WorldCollectionDetail: Decodable {
    let collection: WorldCollection
    let moments: [WorldMoment]
}

enum WorldCircleReportReason: String, CaseIterable {
    case harassment, spam, privacy, other

    var label: WorldStrings.Key {
        switch self {
        case .harassment: return .circleReportHarassment
        case .spam: return .circleReportSpam
        case .privacy: return .circleReportPrivacy
        case .other: return .circleReportOther
        }
    }
}

struct WorldCircleReport: Decodable {
    let kind: String
    let target: String
    let author: WorldCircleMember
    let text: String
    let createdAt: Double
    let reportCount: Int
    let reasons: [String:Int]?
}

struct WorldCircleReportDetail: Decodable {
    let report: WorldCircleReport
    let photo: Data?
    let photoDescription: String?
}

@MainActor
final class WorldSocialClient {
    private struct ResultID: Decodable { let id: String }
    private struct ResultOK: Decodable { let ok: Bool }
    private struct Invite: Decodable { let code: String }
    private struct Reports: Decodable { let reports: [WorldCircleReport] }
    private struct Members: Decodable { let members: [WorldCircleMember] }
    private struct Collections: Decodable { let collections: [WorldCollection] }
    private struct CollectionResult: Decodable { let collection: WorldCollection }
    private struct Failure: Decodable, Error { let error: String }

    private static let defaultsKey = "world.social.circle-links-v1"
    private static let selectionKey = "world.social.selected-circle-v1"
    private let makeRequest: (String) -> URLRequest?
    private let session = URLSession(configuration:.ephemeral)
    private(set) var links: [WorldCircleLink]

    init(makeRequest: @escaping (String) -> URLRequest?) {
        self.makeRequest = makeRequest
        if let bytes = UserDefaults.standard.data(forKey:Self.defaultsKey),
           let existing = try? JSONDecoder().decode([WorldCircleLink].self, from:bytes) {
            links = existing.filter { Self.validID($0.id) }
        } else {
            links = []
        }
    }

    var selectedCircle: WorldCircleLink? {
        if let id = UserDefaults.standard.string(forKey:Self.selectionKey),
           let selected = links.first(where: { $0.id == id }) { return selected }
        return links.first
    }

    func select(_ link: WorldCircleLink) {
        if links.contains(where: { $0.id == link.id }) { UserDefaults.standard.set(link.id, forKey:Self.selectionKey) }
    }

    nonisolated static func identifier() -> String {
        UUID().uuidString.replacingOccurrences(of:"-", with:"").lowercased()
    }

    nonisolated static func validID(_ id: String) -> Bool {
        id.utf8.count == 32 && id.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }

    private func call<Result: Decodable>(_ circleID: String, _ path: String = "",
                                         body: [String:Any]? = nil) async throws -> Result {
        guard Self.validID(circleID) else { throw Failure(error:"authorization_required") }
        return try await request("/v1/circles/" + circleID + path, body:body)
    }

    private func request<Result: Decodable>(_ path: String, body: [String:Any]?) async throws -> Result {
        guard var request = makeRequest(path) else {
            throw Failure(error:"authorization_required")
        }
        request.timeoutInterval = 18
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField:"Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject:body)
        }
        let (data, response) = try await session.data(for:request)
        guard let status = (response as? HTTPURLResponse)?.statusCode else { throw URLError(.badServerResponse) }
        if !(200..<300).contains(status) {
            if let problem = try? JSONDecoder().decode(Failure.self, from:data) { throw problem }
            throw Failure(error:status == 429 ? "rate_limited" : "temporarily_unavailable")
        }
        let maximumBytes = path.contains("/collections/") ? 1_500_000 : 480_000
        guard data.count <= maximumBytes else { throw URLError(.dataLengthExceedsMaximum) }
        return try JSONDecoder().decode(Result.self, from:data)
    }

    static func draftFile(for circleID: String) -> URL? {
        guard validID(circleID) else { return nil }
        return FileManager.default.urls(for:.applicationSupportDirectory, in:.userDomainMask)[0]
            .appendingPathComponent("AsymptaWorld/CircleDrafts-v1", isDirectory:true)
            .appendingPathComponent(circleID + ".json")
    }

    static func hasDraft(for circleID: String) -> Bool {
        draftFile(for:circleID).map { FileManager.default.fileExists(atPath:$0.path) } ?? false
    }

    func create(circleID: String, title: String, name: String) async throws -> WorldCircle {
        let circle: WorldCircle = try await call(circleID, "/create", body:["title":title,"name":name])
        remember(circle)
        return circle
    }

    func join(code: String, name: String) async throws -> WorldCircle {
        let parts = code.trimmingCharacters(in:.whitespacesAndNewlines).lowercased().split(separator:".")
        guard parts.count == 2, parts.allSatisfy({ Self.validID(String($0)) }) else {
            throw Failure(error:"invalid_invite")
        }
        let circle: WorldCircle = try await call(String(parts[0]), "/join", body:["secret":String(parts[1]),"name":name])
        remember(circle)
        return circle
    }

    func snapshot(circleID: String) async throws -> WorldCircleSnapshot {
        try await call(circleID)
    }

    func browse(circleID: String, query: String = "", weekStart: Double? = nil,
                weekEnd: Double? = nil, before: WorldLibraryCursor? = nil) async throws -> WorldLibraryPage {
        var body: [String:Any] = ["query":query]
        body["weekStart"] = weekStart
        body["weekEnd"] = weekEnd
        if let before { body["before"] = ["createdAt":before.createdAt,"id":before.id] }
        return try await call(circleID, "/browse", body:body)
    }

    func collections(circleID: String, momentID: String? = nil) async throws -> [WorldCollection] {
        let result: Collections
        if let momentID {
            guard Self.validID(momentID) else { throw Failure(error:"not_found") }
            result = try await call(circleID, "/collections/status", body:["momentID":momentID])
        } else {
            result = try await call(circleID, "/collections")
        }
        return result.collections
    }

    func collection(circleID: String, id: String) async throws -> WorldCollectionDetail {
        guard Self.validID(id) else { throw Failure(error:"not_found") }
        return try await call(circleID, "/collections/" + id)
    }

    func createCollection(circleID: String, id: String, title: String) async throws -> WorldCollection {
        let result: CollectionResult = try await call(circleID, "/collections", body:["id":id,"title":title])
        return result.collection
    }

    func setCollected(circleID: String, collectionID: String, momentID: String, active: Bool) async throws {
        guard Self.validID(collectionID), Self.validID(momentID) else { throw Failure(error:"not_found") }
        let _: ResultOK = try await call(circleID, "/collections/" + collectionID + "/items",
                                        body:["momentID":momentID,"active":active])
    }

    func removeCollection(circleID: String, id: String) async throws {
        guard Self.validID(id) else { throw Failure(error:"not_found") }
        let _: ResultOK = try await call(circleID, "/collections/" + id + "/remove", body:[:])
    }

    func inbox() async throws -> WorldCircleInbox {
        let ids = links.map(\.id)
        var inbox = WorldCircleInbox(groups:[],partial:false)
        for start in stride(from:0,to:ids.count,by:8) {
            try Task.checkCancellation()
            do {
                let batch: WorldCircleInbox = try await request(
                    "/v1/circles/inbox", body:["circleIDs":Array(ids[start..<min(start + 8, ids.count)])]
                )
                inbox.groups += batch.groups
                inbox.partial = inbox.partial || batch.partial
            } catch {
                try Task.checkCancellation()
                inbox.partial = true
            }
        }
        try Task.checkCancellation()
        // A circle may have been left while a batch was in flight.
        let currentIDs = Set(links.map(\.id))
        inbox.groups.removeAll { !currentIDs.contains($0.circle.id) }
        return inbox
    }

    func invite(circleID: String) async throws -> String {
        let result: Invite = try await call(circleID, "/invite")
        return result.code
    }

    func setStyle(circleID: String, style: WorldCircleInkStyle) async throws {
        let _: ResultOK = try await call(circleID, "/appearance", body:["style":style.rawValue])
    }

    func rotateInvitation(circleID: String) async throws -> String {
        let result: Invite = try await call(circleID, "/invite/rotate", body:[:])
        return result.code
    }

    func members(circleID: String) async throws -> [WorldCircleMember] {
        let result: Members = try await call(circleID, "/members")
        return result.members
    }

    func removeMember(circleID: String, memberID: String) async throws {
        let _: ResultOK = try await call(circleID, "/members/remove", body:["id":memberID])
        inboxChanged()
    }

    func detail(circleID: String, momentID: String) async throws -> WorldMomentDetail {
        try await call(circleID, momentPath(momentID))
    }

    func post(circleID: String, id: String, text: String, region: String?, photo: Data?, photoDescription: String?) async throws {
        var body: [String:Any] = ["id":id,"text":text]
        body["region"] = region
        body["photo"] = photo?.base64EncodedString()
        body["photoDescription"] = photoDescription
        let _: ResultID = try await call(circleID, "/moments", body:body)
    }

    func reply(circleID: String, momentID: String, id: String, text: String) async throws {
        let _: ResultID = try await call(circleID, momentPath(momentID) + "/replies", body:["id":id,"text":text])
    }

    func react(circleID: String, momentID: String, active: Bool) async throws {
        let _: ResultOK = try await call(circleID, momentPath(momentID) + "/reaction", body:["active":active])
    }

    func markRead(circleID: String, momentID: String, through: Double) async throws {
        let _: ResultOK = try await call(circleID, "/read", body:["momentID":momentID,"through":through])
        inboxChanged()
    }

    func moderate(circleID: String, kind: String, target: String, action: String, reason: WorldCircleReportReason? = nil) async throws {
        var body = ["kind":kind,"target":target,"action":action]
        body["reason"] = reason?.rawValue
        let _: ResultOK = try await call(circleID, "/moderate", body:body)
        inboxChanged()
    }

    func reports(circleID: String) async throws -> [WorldCircleReport] {
        let result: Reports = try await call(circleID, "/reports")
        return result.reports
    }

    func reportDetail(circleID: String, kind: String, target: String) async throws -> WorldCircleReportDetail {
        guard Self.validID(target), ["moment","reply"].contains(kind) else { throw Failure(error:"not_found") }
        return try await call(circleID, "/reports/" + kind + "/" + target)
    }

    func resolve(circleID: String, kind: String, target: String) async throws {
        let _: ResultOK = try await call(circleID, "/resolve", body:["kind":kind,"target":target])
        inboxChanged()
    }

    func blocked(circleID: String) async throws -> [WorldCircleMember] {
        let result: Members = try await call(circleID, "/blocks")
        return result.members
    }

    func unblock(circleID: String, memberID: String) async throws {
        let _: ResultOK = try await call(circleID, "/unblock", body:["id":memberID])
        inboxChanged()
    }

    func leave(circleID: String) async throws {
        do {
            let _: ResultOK = try await call(circleID, "/leave", body:[:])
        } catch let failure as Failure where ["not_member","circle_not_found","not_found","forbidden"].contains(failure.error) {
            // A previous leave may have reached the service even if its reply was interrupted.
        }
        links.removeAll { $0.id == circleID }
        UserDefaults.standard.removeObject(forKey:"world.social.collection-create-v1." + circleID)
        saveLinks()
    }

    private func momentPath(_ momentID: String) throws -> String {
        guard Self.validID(momentID) else { throw Failure(error:"not_found") }
        return "/moments/" + momentID
    }

    private func remember(_ circle: WorldCircle) {
        links.removeAll { $0.id == circle.id }
        links.insert(WorldCircleLink(id:circle.id,title:circle.title), at:0)
        saveLinks()
    }

    private func saveLinks() {
        if let data = try? JSONEncoder().encode(links) {
            UserDefaults.standard.set(data, forKey:Self.defaultsKey)
        }
        inboxChanged()
    }

    private func inboxChanged() {
        NotificationCenter.default.post(name:.worldSocialInboxDidChange, object:self)
    }

    func isMissing(_ error: Error) -> Bool {
        (error as? Failure)?.error == "not_found"
    }

    func isDefinitiveFailure(_ error: Error) -> Bool {
        guard let failure = error as? Failure else { return false }
        return !["temporarily_unavailable","id_conflict"].contains(failure.error)
    }

    func errorText(_ error: Error, _ strings: WorldStrings) -> String {
        let code = (error as? Failure)?.error
        switch code {
        case "invalid_invite": return strings[.circleInvalidCode]
        case "not_member", "circle_not_found", "not_found", "forbidden", "hidden": return strings[.circleUnavailable]
        case "rate_limited", "write_limited", "too_fast": return strings[.circleSlowDown]
        case "circle_full", "limit_reached": return strings[.circleFull]
        case "filtered", "content_rejected", "unsafe_text": return strings[.circleFiltered]
        case "invalid_photo", "body_too_large": return strings[.circlePhotoError]
        case "invalid_input", "invalid_body", "invalid_title", "invalid_name", "invalid_text", "invalid_region", "id_conflict":
            return strings[.circleCheckFields]
        default: return strings[.circleNetworkError]
        }
    }
}
