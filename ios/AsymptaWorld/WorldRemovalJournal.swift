import Foundation
import Security

struct WorldRemovalIntent: Codable, Equatable {
    let capability: String
    let circleIDs: [String]
    let language: WorldLanguage

    static func make(snapshot: WorldRecoveryPayload, language: WorldLanguage) throws -> WorldRemovalIntent {
        try WorldRecoveryCodec.validate(snapshot)
        let intent = WorldRemovalIntent(capability:snapshot.capabilityValue,
                                        circleIDs:snapshot.links.map(\.id).sorted(), language:language)
        try intent.validate()
        return intent
    }

    func validate() throws {
        guard WorldRecoveryCodec.validCapability(capability), circleIDs.count <= 512,
              Set(circleIDs).count == circleIDs.count, circleIDs == circleIDs.sorted(),
              circleIDs.allSatisfy(WorldRecoveryCodec.validID) else { throw WorldRemovalError.invalidRecord }
    }
}

struct WorldRemovalRecord: Codable, Equatable {
    enum Phase: String, Codable { case pending, remoteConfirmed, finished }
    let version: Int
    let intent: WorldRemovalIntent
    let phase: Phase
    let progress: WorldRemovalStatus?

    func validate() throws {
        try intent.validate()
        guard version == 1 else { throw WorldRemovalError.invalidRecord }
        if let progress { try progress.validate() }
        switch phase {
        case .pending:
            guard progress?.status != .removed else { throw WorldRemovalError.invalidRecord }
        case .remoteConfirmed, .finished:
            guard let progress, progress.status == .removed, progress.remaining == 0 else {
                throw WorldRemovalError.invalidRecord
            }
        }
    }
}

// Every operation is serialized with UI identity changes on the main actor.
// The capability exists only in memory and protected Keychain data.
@MainActor
enum WorldRemovalJournal {
    private static let account = "removal-commit-v1"
    private static let maximumBytes = 32 * 1024

    private static func query(_ account: String) -> [String:Any] {
        [kSecClass as String:kSecClassGenericPassword,
         kSecAttrService as String:"com.asympta.world.aura",
         kSecAttrAccount as String:account,
         kSecAttrSynchronizable as String:false]
    }

    private static func read(_ account: String, limit: Int) throws -> Data? {
        var q = query(account)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        q[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data,
              !data.isEmpty, data.count <= limit else { throw WorldRemovalError.unavailable }
        return data
    }

    private static func requireNoRecovery() throws {
        var q = query("recovery-commit-v1")
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        q[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
        let status = SecItemCopyMatching(q as CFDictionary, nil)
        guard status == errSecItemNotFound else { throw WorldRemovalError.conflict }
    }

    static func load() throws -> WorldRemovalRecord? {
        guard let data = try read(account, limit:maximumBytes) else { return nil }
        let record: WorldRemovalRecord
        do { record = try JSONDecoder().decode(WorldRemovalRecord.self, from:data) }
        catch { throw WorldRemovalError.invalidRecord }
        try record.validate()
        return record
    }

    static func requireAbsent() throws {
        guard try load() == nil else { throw WorldRemovalError.conflict }
    }

    static func assertPinned(_ intent: WorldRemovalIntent, allowAbsent: Bool) throws {
        try intent.validate()
        try requireNoRecovery()
        let current = try read("installation-v1", limit:43)
        if let current {
            guard current == Data(intent.capability.utf8) else { throw WorldRemovalError.conflict }
        } else {
            guard allowAbsent else { throw WorldRemovalError.conflict }
        }
    }

    static func check(_ record: WorldRemovalRecord) throws {
        try record.validate()
        try assertPinned(record.intent, allowAbsent:record.phase != .pending)
        if record.phase == .finished {
            guard try read("installation-v1", limit:43) == nil else { throw WorldRemovalError.conflict }
        }
    }

    private static func encoded(_ record: WorldRemovalRecord) throws -> Data {
        try record.validate()
        let data = try JSONEncoder().encode(record)
        guard data.count <= maximumBytes else { throw WorldRemovalError.invalidRecord }
        return data
    }

    private static func update(_ record: WorldRemovalRecord) throws {
        // Callers first load and validate the existing journal. Never upsert here.
        let attributes: [String:Any] = [
            kSecValueData as String:try encoded(record),
            kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        guard SecItemUpdate(query(account) as CFDictionary, attributes as CFDictionary) == errSecSuccess else {
            throw WorldRemovalError.unavailable
        }
    }

    static func stage(_ intent: WorldRemovalIntent) throws {
        try intent.validate()
        try assertPinned(intent, allowAbsent:false)
        let remembered = try WorldCircleDirectory.read().links.map(\.id).sorted()
        guard remembered == intent.circleIDs else { throw WorldRemovalError.conflict }
        if let existing = try load() {
            guard existing.intent == intent else { throw WorldRemovalError.conflict }
            return
        }
        let record = WorldRemovalRecord(version:1, intent:intent, phase:.pending, progress:nil)
        var q = query(account)
        q[kSecValueData as String] = try encoded(record)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(q as CFDictionary, nil)
        if status == errSecDuplicateItem {
            guard let existing = try load(), existing.intent == intent else { throw WorldRemovalError.conflict }
            return
        }
        guard status == errSecSuccess else { throw WorldRemovalError.unavailable }
    }

    @discardableResult
    static func record(_ status: WorldRemovalStatus, for intent: WorldRemovalIntent) throws -> WorldRemovalRecord {
        try status.validate()
        guard let existing = try load(), existing.intent == intent else { throw WorldRemovalError.conflict }
        try check(existing)
        guard existing.phase == .pending else { return existing }
        let next = WorldRemovalRecord(version:1, intent:intent,
                                      phase:status.status == .removed ? .remoteConfirmed : .pending,
                                      progress:status)
        // Authenticated removed/remaining=0 is durable before cleanup can begin.
        try update(next)
        return next
    }

    static func removeInstallation(for intent: WorldRemovalIntent) throws {
        guard let existing = try load(), existing.intent == intent,
              existing.phase == .remoteConfirmed else { throw WorldRemovalError.conflict }
        try check(existing)
        guard try read("installation-v1", limit:43) != nil else { return }
        let status = SecItemDelete(query("installation-v1") as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw WorldRemovalError.unavailable }
    }

    static func markFinished(_ intent: WorldRemovalIntent) throws {
        guard let existing = try load(), existing.intent == intent,
              existing.phase == .remoteConfirmed else { throw WorldRemovalError.conflict }
        try check(existing)
        guard try read("installation-v1", limit:43) == nil else { throw WorldRemovalError.conflict }
        try update(WorldRemovalRecord(version:1, intent:intent, phase:.finished, progress:existing.progress))
    }

    static func startNewWorld() throws {
        guard let existing = try load(), existing.phase == .finished else { throw WorldRemovalError.conflict }
        try check(existing)
        // This is called only by the explicit finished-page action. A crash after
        // this deletion may create a new identity on relaunch, as authorized.
        guard SecItemDelete(query(account) as CFDictionary) == errSecSuccess else {
            throw WorldRemovalError.unavailable
        }
    }
}
