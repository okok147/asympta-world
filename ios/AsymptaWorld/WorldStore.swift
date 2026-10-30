import UIKit

enum WorldResident: String, Codable, CaseIterable {
    case reader, fox, tea, cat, bear

    var nameKey: WorldStrings.Key {
        switch self {
        case .reader: return .readerName
        case .fox: return .foxName
        case .tea: return .teaName
        case .cat: return .catName
        case .bear: return .bearName
        }
    }
    var detailKey: WorldStrings.Key {
        switch self {
        case .reader: return .readerDetail
        case .fox: return .foxDetail
        case .tea: return .teaDetail
        case .cat: return .catDetail
        case .bear: return .bearDetail
        }
    }
}

enum AuraMood: String, Codable, CaseIterable {
    case gentle, curious, restful

    var nameKey: WorldStrings.Key {
        switch self { case .gentle: return .gentle; case .curious: return .curious; case .restful: return .restful }
    }
    var detailKey: WorldStrings.Key {
        switch self { case .gentle: return .gentleDetail; case .curious: return .curiousDetail; case .restful: return .restfulDetail }
    }
    var color: UIColor {
        switch self {
        case .gentle: return UIColor(red: 0.93, green: 0.76, blue: 0.44, alpha: 1)
        case .curious: return UIColor(red: 0.62, green: 0.76, blue: 0.70, alpha: 1)
        case .restful: return UIColor(red: 0.67, green: 0.68, blue: 0.78, alpha: 1)
        }
    }
    var light: UIColor {
        switch self {
        case .gentle: return UIColor(red: 1, green: 0.85, blue: 0.56, alpha: 0.025)
        case .curious: return UIColor(red: 0.71, green: 0.88, blue: 0.86, alpha: 0.035)
        case .restful: return UIColor(red: 0.55, green: 0.59, blue: 0.74, alpha: 0.055)
        }
    }
}

struct WorldJournalEntry: Codable, Identifiable, Equatable {
    let id: UUID
    let createdAt: Date
    var updatedAt: Date
    var text: String

    var preview: String {
        text.split(whereSeparator: \.isNewline).first.map(String.init) ?? text
    }
}

struct WorldState: Codable {
    var format = 1
    var nickname = ""
    var language = WorldLanguage.deviceDefault
    var aura = AuraMood.gentle
    var movement = true
    var favorites = Set<WorldResident>()
    var journal: [WorldJournalEntry] = []
}

extension Notification.Name {
    static let watercolorWorldDidChange = Notification.Name("com.asympta.world.native-state.changed")
}

@MainActor
final class WorldStore {
    private(set) var state: WorldState
    private(set) var loadFailed = false
    private(set) var saveFailed = false
    private let fileURL: URL

    var strings: WorldStrings { WorldStrings(language: state.language) }

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("AsymptaWorld", isDirectory: true)
            .appendingPathComponent("personal-world-v1.json")
        state = WorldState()
        guard FileManager.default.fileExists(atPath: self.fileURL.path) else { return }
        do {
            let data = try Data(contentsOf: self.fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let restored = try decoder.decode(WorldState.self, from: data)
            guard restored.format == 1 else { throw CocoaError(.fileReadCorruptFile) }
            state = restored
        } catch {
            // An unreadable or future-version file is never replaced with defaults.
            // Legacy WebKit data and the independent original app are not touched.
            loadFailed = true
        }
    }

    @discardableResult
    private func commit(_ candidate: WorldState) -> Bool {
        guard !loadFailed else {
            saveFailed = true
            notify()
            return false
        }
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(),
                                                    withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.sortedKeys]
            let data = try encoder.encode(candidate)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            state = candidate
            saveFailed = false
            notify()
            return true
        } catch {
            saveFailed = true
            notify()
            return false
        }
    }

    private func notify() {
        NotificationCenter.default.post(name: .watercolorWorldDidChange, object: self)
    }

    @discardableResult
    func setLanguage(_ value: WorldLanguage) -> Bool {
        guard state.language != value else { return true }
        var next = state
        next.language = value
        return commit(next)
    }

    @discardableResult
    func setNickname(_ value: String) -> Bool {
        let name = String(value.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40))
        guard state.nickname != name else { return true }
        var next = state
        next.nickname = name
        return commit(next)
    }

    @discardableResult
    func setAura(_ value: AuraMood) -> Bool {
        guard state.aura != value else { return true }
        var next = state
        next.aura = value
        return commit(next)
    }

    @discardableResult
    func setMovement(_ value: Bool) -> Bool {
        guard state.movement != value else { return true }
        var next = state
        next.movement = value
        return commit(next)
    }

    @discardableResult
    func toggleFavorite(_ resident: WorldResident) -> Bool {
        var next = state
        if next.favorites.contains(resident) { next.favorites.remove(resident) }
        else { next.favorites.insert(resident) }
        return commit(next)
    }

    @discardableResult
    func saveNote(_ text: String, editing entry: WorldJournalEntry? = nil) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        var next = state
        let now = Date()
        if let entry, let index = next.journal.firstIndex(where: { $0.id == entry.id }) {
            next.journal[index].text = trimmed
            next.journal[index].updatedAt = now
        } else {
            next.journal.append(WorldJournalEntry(id: UUID(), createdAt: now, updatedAt: now, text: trimmed))
        }
        next.journal.sort { $0.updatedAt > $1.updatedAt }
        return commit(next)
    }

    @discardableResult
    func deleteNote(_ id: UUID) -> Bool {
        var next = state
        next.journal.removeAll { $0.id == id }
        return commit(next)
    }
}
