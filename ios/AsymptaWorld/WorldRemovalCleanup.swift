import Foundation

@MainActor
enum WorldRemovalCleanup {
    private static let fm = FileManager.default

    private static func type(at url: URL) throws -> FileAttributeType? {
        do {
            let attributes = try fm.attributesOfItem(atPath:url.path)
            guard let type = attributes[.type] as? FileAttributeType else { throw WorldRemovalError.unavailable }
            return type
        } catch {
            let error = error as NSError
            if error.domain == NSCocoaErrorDomain &&
                (error.code == CocoaError.Code.fileNoSuchFile.rawValue ||
                 error.code == CocoaError.Code.fileReadNoSuchFile.rawValue) { return nil }
            throw error
        }
    }

    // Only system-provided locations beneath this app's own home are accepted.
    // Resolve the container alias, but reject symlinks anywhere below that home.
    private static func safeBase(_ supplied: URL) throws -> URL {
        let logicalHome = URL(fileURLWithPath:NSHomeDirectory(), isDirectory:true).standardizedFileURL
        let logical = supplied.standardizedFileURL
        let realHome = logicalHome.resolvingSymlinksInPath()
        let prefixes = [logicalHome.path + "/", realHome.path + "/"]
        guard logical.isFileURL, let prefix = prefixes.first(where:{ logical.path.hasPrefix($0) }) else {
            throw WorldRemovalError.conflict
        }
        let relative = String(logical.path.dropFirst(prefix.count))
        var current = realHome
        guard try type(at:current) == .typeDirectory else { throw WorldRemovalError.unavailable }
        for part in relative.split(separator:"/") {
            guard part != ".", part != ".." else { throw WorldRemovalError.conflict }
            current.appendPathComponent(String(part), isDirectory:true)
            if let existing = try type(at:current) {
                guard existing == .typeDirectory else { throw WorldRemovalError.conflict }
            } else {
                try fm.createDirectory(at:current, withIntermediateDirectories:false,
                                       attributes:[.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication])
            }
        }
        return current
    }

    private static func validateTree(_ url: URL, expected: FileAttributeType) throws -> Bool {
        guard let existing = try type(at:url) else { return false }
        guard existing == expected else { throw WorldRemovalError.conflict }
        if expected == .typeDirectory {
            var pending = [url]
            while let directory = pending.popLast() {
                for child in try fm.contentsOfDirectory(at:directory, includingPropertiesForKeys:nil, options:[]) {
                    guard child.standardizedFileURL.deletingLastPathComponent() == directory.standardizedFileURL,
                          let childType = try type(at:child) else { throw WorldRemovalError.conflict }
                    switch childType {
                    case .typeDirectory: pending.append(child)
                    case .typeRegular: break
                    default: throw WorldRemovalError.conflict
                    }
                }
            }
        }
        return true
    }

    private static func temporaryExportName(_ name: String) -> Bool {
        for prefix in ["WorldKeepsake-", "WorldRecovery-"] where name.hasPrefix(prefix) {
            let suffix = String(name.dropFirst(prefix.count))
            if let id = UUID(uuidString:suffix), id.uuidString.caseInsensitiveCompare(suffix) == .orderedSame {
                return true
            }
        }
        return false
    }

    private static func clearSocialPreferences() throws {
        guard let bundleID = Bundle.main.bundleIdentifier else { throw WorldRemovalError.unavailable }
        let defaults = UserDefaults.standard
        let keys = (defaults.persistentDomain(forName:bundleID) ?? [:]).keys.filter { $0.hasPrefix("world.social.") }
        for key in keys { defaults.removeObject(forKey:key) }
        // Flush and verify only this app's persistent domain, not registered or
        // managed defaults, and never touch unrelated personal preferences.
        guard defaults.synchronize(),
              !(defaults.persistentDomain(forName:bundleID) ?? [:]).keys.contains(where:{ $0.hasPrefix("world.social.") }) else {
            throw WorldRemovalError.unavailable
        }
    }

    static func finalize(_ intent: WorldRemovalIntent) throws {
        guard let record = try WorldRemovalJournal.load(), record.intent == intent,
              record.phase == .remoteConfirmed else { throw WorldRemovalError.conflict }
        try WorldRemovalJournal.check(record)

        let support = try safeBase(fm.urls(for:.applicationSupportDirectory, in:.userDomainMask)[0])
        let root = support.appendingPathComponent("AsymptaWorld", isDirectory:true)
        if let existing = try type(at:root) {
            guard existing == .typeDirectory else { throw WorldRemovalError.conflict }
        } else {
            try fm.createDirectory(at:root, withIntermediateDirectories:false,
                                   attributes:[.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication])
        }
        let cache = try safeBase(fm.urls(for:.cachesDirectory, in:.userDomainMask)[0])
        let temporary = try safeBase(fm.temporaryDirectory)
        let canonical = root.appendingPathComponent("circle-directory-v2.json")
        if let existing = try type(at:canonical) {
            guard existing == .typeRegular else { throw WorldRemovalError.conflict }
        }
        var targets: [(URL, FileAttributeType)] = [
            (root.appendingPathComponent("CircleDrafts-v1", isDirectory:true), .typeDirectory),
            (root.appendingPathComponent("aura-growth-v1.json"), .typeRegular),
            (cache.appendingPathComponent("AuraCloudResponse.json"), .typeRegular)
        ]
        for child in try fm.contentsOfDirectory(at:temporary, includingPropertiesForKeys:nil, options:[]) {
            if temporaryExportName(child.lastPathComponent) { targets.append((child, .typeDirectory)) }
        }
        // Preflight every scoped tree. Never follow links or delete a parent/root.
        var existingTargets: [URL] = []
        for (url, expected) in targets {
            if try validateTree(url, expected:expected) { existingTargets.append(url) }
        }
        try WorldRemovalJournal.assertPinned(intent, allowAbsent:true)
        // The canonical directory is replaced atomically, not deleted or allowed
        // to fall back to stale legacy preferences after an interruption.
        try WorldCircleDirectory.write(.init(links:[], selected:nil))
        try clearSocialPreferences()
        for url in existingTargets { try fm.removeItem(at:url) }
        // Check the durable empty directory before retiring the current credential.
        let empty = try WorldCircleDirectory.read()
        guard empty.links.isEmpty, empty.selected == nil else { throw WorldRemovalError.unavailable }
        try WorldRemovalJournal.assertPinned(intent, allowAbsent:true)
        try WorldRemovalJournal.removeInstallation(for:intent)
        // If this write fails, the remoteConfirmed journal remains replayable,
        // including when the installation credential was already removed.
        try WorldRemovalJournal.markFinished(intent)
    }
}
