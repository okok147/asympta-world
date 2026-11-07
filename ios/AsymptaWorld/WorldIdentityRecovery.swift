import Foundation
import CryptoKit
import CommonCrypto
import Security

// All identity-switch state is private. Neither a recovery capability nor its
// plaintext payload is written to logs, preferences, or exported unencrypted.
enum WorldRecoveryError: Error { case invalidFile, unavailable, existingCircles, network, multipleScenes }

struct WorldCircleDirectoryState: Codable {
    var links: [WorldCircleLink]
    var selected: String?
}

enum WorldCircleDirectory {
    static let linksKey = "world.social.circle-links-v1"
    static let selectionKey = "world.social.selected-circle-v1"
    static var root: URL { FileManager.default.urls(for:.applicationSupportDirectory, in:.userDomainMask)[0].appendingPathComponent("AsymptaWorld", isDirectory:true) }
    static var url: URL { root.appendingPathComponent("circle-directory-v2.json") }

    static func read() throws -> WorldCircleDirectoryState {
        let state: WorldCircleDirectoryState
        if FileManager.default.fileExists(atPath:url.path) {
            let data = try Data(contentsOf:url)
            guard data.count <= 200_000 else { throw WorldRecoveryError.unavailable }
            state = try JSONDecoder().decode(WorldCircleDirectoryState.self, from:data)
        } else {
            let defaults = UserDefaults.standard
            let links: [WorldCircleLink]
            if let object = defaults.object(forKey:linksKey) {
                guard let data = object as? Data, data.count <= 200_000 else { throw WorldRecoveryError.unavailable }
                links = try JSONDecoder().decode([WorldCircleLink].self, from:data)
            } else { links = [] }
            // A stale selection after leaving the last circle is harmless.
            let selected = defaults.string(forKey:selectionKey).flatMap { id in links.contains { $0.id == id } ? id : nil }
            state = WorldCircleDirectoryState(links:links, selected:selected)
        }
        try validate(state)
        return state
    }
    static func validate(_ state: WorldCircleDirectoryState) throws {
        guard state.links.count <= 512, Set(state.links.map(\.id)).count == state.links.count,
              state.links.allSatisfy({ WorldRecoveryCodec.validID($0.id) && !$0.title.isEmpty && $0.title.utf8.count <= 1024 }),
              state.selected == nil || state.links.contains(where: { $0.id == state.selected }) else { throw WorldRecoveryError.unavailable }
    }
    static func write(_ state: WorldCircleDirectoryState) throws {
        try validate(state)
        try FileManager.default.createDirectory(at:root, withIntermediateDirectories:true, attributes:[.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication])
        try JSONEncoder().encode(state).write(to:url, options:[.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
}

struct WorldRecoveryPayload: Codable, Sendable {
    struct Link: Codable, Sendable { let id: String; let title: String }
    let version: Int
    let capabilityValue: String
    let links: [Link]
    let selected: String?
    let abilities: [Int]
    let createdAt: Double
    var directory: WorldCircleDirectoryState { .init(links:links.map { .init(id:$0.id, title:$0.title) }, selected:selected) }
}

enum WorldRecoveryCodec {
    private struct Envelope: Codable {
        let version: Int
        let kdf: String
        let salt: Data
        let sealed: Data
    }
    static let maximumBytes = 256 * 1024
    private static let aad = Data("AsymptaWorld.recovery.v1.PBKDF2-SHA256.600000".utf8)
    static func validID(_ value: String) -> Bool {
        value.utf8.count == 32 && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }
    static func validCapability(_ value: String) -> Bool {
        guard value.utf8.count == 43, value.utf8.allSatisfy({ (48...57).contains($0) || (65...90).contains($0) || (97...122).contains($0) || $0 == 45 || $0 == 95 }),
              let bytes = Data(base64Encoded:value.replacingOccurrences(of:"-", with:"+").replacingOccurrences(of:"_", with:"/") + "="), bytes.count == 32 else { return false }
        return bytes.base64EncodedString().replacingOccurrences(of:"+", with:"-").replacingOccurrences(of:"/", with:"_").replacingOccurrences(of:"=", with:"") == value
    }
    static func validate(_ payload: WorldRecoveryPayload) throws {
        guard payload.version == 1, validCapability(payload.capabilityValue), payload.abilities.count == 5,
              payload.abilities.allSatisfy({ (0...10_000_000).contains($0) }), payload.createdAt.isFinite,
              payload.createdAt >= 0, payload.createdAt <= Date().timeIntervalSince1970 + 86400 else { throw WorldRecoveryError.invalidFile }
        do { try WorldCircleDirectory.validate(payload.directory) } catch { throw WorldRecoveryError.invalidFile }
    }
    static func validPhrase(_ phrase: String) -> Bool { phrase.count >= 12 && phrase.utf8.count <= 4096 }
    private static func key(_ phrase: String, salt: Data) throws -> SymmetricKey {
        guard validPhrase(phrase), salt.count == 16 else { throw WorldRecoveryError.invalidFile }
        let bytes = Array(phrase.utf8)
        var derived = [UInt8](repeating:0, count:32)
        let result = bytes.withUnsafeBytes { p in salt.withUnsafeBytes { s in derived.withUnsafeMutableBytes { k in
            CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), p.baseAddress!.assumingMemoryBound(to:Int8.self), p.count,
                                s.baseAddress!.assumingMemoryBound(to:UInt8.self), s.count,
                                CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), 600_000,
                                k.baseAddress!.assumingMemoryBound(to:UInt8.self), 32)
        } } }
        guard result == kCCSuccess else { throw WorldRecoveryError.unavailable }
        defer { _ = derived.withUnsafeMutableBytes { $0.initializeMemory(as:UInt8.self, repeating:0) } }
        return SymmetricKey(data:derived)
    }
    static func encode(_ payload: WorldRecoveryPayload, phrase: String) throws -> Data {
        try validate(payload)
        var salt = Data(count:16)
        let status = salt.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault,16,$0.baseAddress!) }
        guard status == errSecSuccess else { throw WorldRecoveryError.unavailable }
        let plain = try JSONEncoder().encode(payload)
        guard plain.count < maximumBytes else { throw WorldRecoveryError.invalidFile }
        let sealed = try AES.GCM.seal(plain, using:key(phrase, salt:salt), authenticating:aad)
        guard let combined = sealed.combined else { throw WorldRecoveryError.unavailable }
        let result = try JSONEncoder().encode(Envelope(version:1, kdf:"PBKDF2-HMAC-SHA256-600000", salt:salt, sealed:combined))
        guard result.count <= maximumBytes else { throw WorldRecoveryError.invalidFile }
        return result
    }
    static func decode(_ data: Data, phrase: String) throws -> WorldRecoveryPayload {
        do {
            guard data.count <= maximumBytes else { throw WorldRecoveryError.invalidFile }
            let envelope = try JSONDecoder().decode(Envelope.self, from:data)
            guard envelope.version == 1, envelope.kdf == "PBKDF2-HMAC-SHA256-600000", envelope.salt.count == 16,
                  envelope.sealed.count >= 28 else { throw WorldRecoveryError.invalidFile }
            let plain = try AES.GCM.open(AES.GCM.SealedBox(combined:envelope.sealed), using:key(phrase, salt:envelope.salt), authenticating:aad)
            let payload = try JSONDecoder().decode(WorldRecoveryPayload.self, from:plain)
            try validate(payload)
            return payload
        } catch { throw WorldRecoveryError.invalidFile }
    }
}

// A Keychain journal is authoritative until both protected files are committed.
// Replay precedes construction of every cloud session, so interrupted switches
// never create a random credential or mix the old session with the new state.
@MainActor
enum WorldRecoveryCommit {
    private static let service = "com.asympta.world.aura"
    private static func query(_ account: String) -> [String:Any] {
        [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:service, kSecAttrAccount as String:account]
    }
    private static func read(_ account: String) throws -> Data? {
        var q = query(account); q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw WorldRecoveryError.unavailable }
        return data
    }
    private static func put(_ data: Data, account: String) throws {
        let q = query(account)
        let attributes: [String:Any] = [kSecValueData as String:data, kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(q as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insert = q; attributes.forEach { insert[$0.key] = $0.value }
            status = SecItemAdd(insert as CFDictionary,nil)
        }
        guard status == errSecSuccess else { throw WorldRecoveryError.unavailable }
    }
    static func canReplace() throws {
        guard try WorldCircleDirectory.read().links.isEmpty else { throw WorldRecoveryError.existingCircles }
        let directory = WorldCircleDirectory.root.appendingPathComponent("CircleDrafts-v1", isDirectory:true)
        if FileManager.default.fileExists(atPath:directory.path) {
            guard try FileManager.default.contentsOfDirectory(at:directory, includingPropertiesForKeys:nil).isEmpty else { throw WorldRecoveryError.existingCircles }
        }
    }
    static func stage(_ payload: WorldRecoveryPayload) throws {
        try canReplace()
        try WorldRecoveryCodec.validate(payload)
        guard try read("recovery-commit-v1") == nil else { throw WorldRecoveryError.unavailable }
        // Preserve the old anonymous identity and growth in the Keychain before
        // replacing them. Personal journal, settings and Apple purchases stay put.
        struct Previous: Codable { let capability: Data?; let growth: Data? }
        let growthURL = WorldCircleDirectory.root.appendingPathComponent("aura-growth-v1.json")
        let growth = FileManager.default.fileExists(atPath:growthURL.path) ? try Data(contentsOf:growthURL) : nil
        let previous = Previous(capability:try read("installation-v1"), growth:growth)
        try put(try JSONEncoder().encode(previous), account:"pre-recovery-" + UUID().uuidString.lowercased())
        try put(try JSONEncoder().encode(payload), account:"recovery-commit-v1")
    }
    static func replay() throws {
        guard let data = try read("recovery-commit-v1") else { return }
        guard data.count <= WorldRecoveryCodec.maximumBytes else { throw WorldRecoveryError.unavailable }
        let payload = try JSONDecoder().decode(WorldRecoveryPayload.self, from:data)
        try WorldRecoveryCodec.validate(payload)
        try put(Data(payload.capabilityValue.utf8), account:"installation-v1")
        try FileManager.default.createDirectory(at:WorldCircleDirectory.root, withIntermediateDirectories:true,
                                               attributes:[.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication])
        let growth: [String:Any] = ["schema":1, "abilities":payload.abilities, "updatedAt":Date().timeIntervalSince1970 * 1000]
        try JSONSerialization.data(withJSONObject:growth).write(to:WorldCircleDirectory.root.appendingPathComponent("aura-growth-v1.json"), options:[.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        try WorldCircleDirectory.write(payload.directory)
        let status = SecItemDelete(query("recovery-commit-v1") as CFDictionary)
        guard status == errSecSuccess else { throw WorldRecoveryError.unavailable }
    }
}
