import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves immutable app resources. No remote document can acquire this origin.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL?

    init(bundle: Bundle = .main) {
        root = bundle.url(forResource: "Web", withExtension: nil)?.resolvingSymlinksInPath()
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              url.scheme == "asympta", url.host == "localhost",
              let root else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        guard urlSchemeTask.request.httpMethod == "GET" || urlSchemeTask.request.httpMethod == "HEAD" else {
            respond(urlSchemeTask, status: 405, data: Data(), mime: "text/plain")
            return
        }
        let prefix = "/asympta-world"
        var relative = url.path
        if relative == prefix || relative == prefix + "/" { relative = "/index.html" }
        else if relative.hasPrefix(prefix + "/") { relative.removeFirst(prefix.count) }
        if relative == "/" { relative = "/index.html" }
        let file = root.appendingPathComponent(String(relative.drop(while: { $0 == "/" })))
            .standardizedFileURL.resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.path + "/"),
              !relative.split(separator: "/").contains("..") else {
            respond(urlSchemeTask, status: 403, data: Data(), mime: "text/plain")
            return
        }
        do {
            let data = try Data(contentsOf: file, options: .mappedIfSafe)
            let mime: String
            switch file.pathExtension.lowercased() {
            case "js", "mjs": mime = "text/javascript"
            case "css": mime = "text/css"
            case "json", "map": mime = "application/json"
            case "wasm": mime = "application/wasm"
            case "svg": mime = "image/svg+xml"
            case "woff": mime = "font/woff"
            case "woff2": mime = "font/woff2"
            default: mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            }
            respond(urlSchemeTask, status: 200,
                    data: urlSchemeTask.request.httpMethod == "HEAD" ? Data() : data,
                    mime: mime)
        } catch {
            respond(urlSchemeTask, status: 404, data: Data(), mime: "text/plain")
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Reads are synchronous; there are no outstanding callbacks to cancel.
    }

    private func respond(_ task: WKURLSchemeTask, status: Int, data: Data, mime: String) {
        guard let url = task.request.url,
              let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mime + ((mime.hasPrefix("text/") || mime == "application/json") ? "; charset=utf-8" : ""),
                    "Content-Length": String(data.count),
                    "Access-Control-Allow-Origin": "asympta://localhost",
                    "Cache-Control": "no-cache",
                    "X-Content-Type-Options": "nosniff"
                ]) else { return }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }
}
