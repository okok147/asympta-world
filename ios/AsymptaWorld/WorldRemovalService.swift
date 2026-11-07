import Foundation

enum WorldRemovalError: Error {
    case unavailable, conflict, invalidRecord, network, singleWindow
}

struct WorldRemovalStatus: Codable, Equatable {
    enum State: String, Codable { case active, removing, removed }
    let status: State
    let remaining: Int
    let completed: Int
    let scope: String
    let legacyUnknownPossible: Bool

    func validate() throws {
        guard remaining >= 0, completed >= 0, remaining <= 1024, completed <= 1024 - remaining,
              status != .active || (remaining == 0 && completed == 0),
              status != .removing || remaining > 0,
              scope == "indexed_and_supplied_circles", legacyUnknownPossible,
              status != .removed || remaining == 0 else { throw WorldRemovalError.invalidRecord }
    }
}

// Refuse every redirect, including same-host redirects. Authorization is never
// forwarded to a redirect destination. URLSession retains this delegate.
final class WorldRemovalRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

@MainActor
enum WorldRemovalService {
    private static let maximumBytes = 32 * 1024

    static func status(capability: String) async throws -> WorldRemovalStatus {
        try await call(capability:capability, circleIDs:nil)
    }

    static func submit(_ intent: WorldRemovalIntent) async throws -> WorldRemovalStatus {
        try intent.validate()
        return try await call(capability:intent.capability, circleIDs:intent.circleIDs)
    }

    private static func call(capability: String, circleIDs: [String]?) async throws -> WorldRemovalStatus {
        guard WorldRecoveryCodec.validCapability(capability) else { throw WorldRemovalError.invalidRecord }
        try Task.checkCancellation()
        let url = WorldCloudSession.endpoint.appendingPathComponent("v1/removal")
        var request = URLRequest(url:url, cachePolicy:.reloadIgnoringLocalCacheData, timeoutInterval:35)
        request.setValue("Bearer " + capability, forHTTPHeaderField:"Authorization")
        request.setValue("application/json", forHTTPHeaderField:"Accept")
        if let circleIDs {
            guard circleIDs.count <= 512, Set(circleIDs).count == circleIDs.count,
                  circleIDs.allSatisfy(WorldRecoveryCodec.validID) else { throw WorldRemovalError.invalidRecord }
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField:"Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject:[
                "confirmation":"remove-my-world", "circleIDs":circleIDs
            ])
        } else {
            request.httpMethod = "GET"
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCredentialStorage = nil
        configuration.timeoutIntervalForRequest = 35
        configuration.timeoutIntervalForResource = 35
        let session = URLSession(configuration:configuration, delegate:WorldRemovalRedirectGuard(), delegateQueue:nil)
        defer { session.invalidateAndCancel() }
        do {
            let (bytes, response) = try await session.bytes(for:request)
            guard let http = response as? HTTPURLResponse, http.url == url,
                  http.expectedContentLength <= Int64(maximumBytes) else { throw WorldRemovalError.network }
            if circleIDs == nil {
                guard http.statusCode == 200 else { throw WorldRemovalError.network }
            } else {
                guard http.statusCode == 200 || http.statusCode == 202 else { throw WorldRemovalError.network }
            }
            var data = Data()
            data.reserveCapacity(2048)
            for try await byte in bytes {
                try Task.checkCancellation()
                guard data.count < maximumBytes else { throw WorldRemovalError.network }
                data.append(byte)
            }
            try Task.checkCancellation()
            let value = try JSONDecoder().decode(WorldRemovalStatus.self, from:data)
            try value.validate()
            if circleIDs != nil {
                guard (http.statusCode == 202 && value.status == .removing) ||
                      (http.statusCode == 200 && value.status == .removed) else { throw WorldRemovalError.network }
            }
            // Server warning/metadata copy is deliberately not decoded or displayed.
            return value
        } catch {
            if Task.isCancelled { throw CancellationError() }
            throw WorldRemovalError.network
        }
    }
}
