import UIKit
import WebKit
import SafariServices

final class WorldViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let localeKey = "AsymptaWorld.locale"
    private var webView: WKWebView!
    private var errorStack: UIStackView!
    private var errorTitle: UILabel!
    private var errorDetail: UILabel!
    private var retryButton: UIButton!
    private var exportedFiles: [URL] = []
    private var locale: String {
        let language = UserDefaults.standard.string(forKey: localeKey) ?? Locale.preferredLanguages.first ?? "en"
        if language.hasPrefix("zh") { return "zh-Hant" }
        if language.hasPrefix("ja") { return "ja" }
        return "en"
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.949, green: 0.937, blue: 0.906, alpha: 1)
        let controller = WKUserContentController()
        controller.add(WeakScriptMessageHandler(self), name: "asympta")
        let script = """
        window.__ASYMPTA_NATIVE__ = true;
        window.__ASYMPTA_NATIVE_LOCALE__ = '\(locale)';
        if (window.crypto && !window.crypto.randomUUID && window.crypto.getRandomValues) {
          window.crypto.randomUUID = function() {
            const bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0'));
            return hex.slice(0,4).join('') + '-' + hex.slice(4,6).join('') + '-' +
              hex.slice(6,8).join('') + '-' + hex.slice(8,10).join('') + '-' + hex.slice(10).join('');
          };
        }
        """
        controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        config.websiteDataStore = .default()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "asympta")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.accessibilityIdentifier = "asympta.world.webview"
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        makeErrorView()
        NotificationCenter.default.addObserver(self, selector: #selector(applicationBackgrounded),
                                               name: UIApplication.didEnterBackgroundNotification, object: nil)
        loadWorld()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        for file in exportedFiles { try? FileManager.default.removeItem(at: file) }
    }

    @objc private func applicationBackgrounded() {
        // WebKit owns suspension. Persist only normal page state; no background execution is promised.
        webView.evaluateJavaScript("window.dispatchEvent(new Event('asympta:native-background'))", completionHandler: nil)
    }

    @objc private func loadWorld() {
        errorStack.isHidden = true
        webView.isHidden = false
        let url = URL(string: "asympta://localhost/asympta-world/")!
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "asympta", url.host == "localhost" {
            decisionHandler(.allow)
        } else if navigationAction.targetFrame?.isMainFrame == false {
            // Remote frames cannot use our bridge, which checks main-frame origin below.
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated,
               ["https", "http", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, navigationAction.navigationType == .linkActivated,
           let url = navigationAction.request.url, ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame,
           let response = navigationResponse.response as? HTTPURLResponse,
           response.statusCode >= 400 {
            decisionHandler(.cancel)
            showError()
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError() }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError() }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showError() }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "asympta",
              message.frameInfo.securityOrigin.host == "localhost",
              let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if type == "locale", let language = body["locale"] as? String,
           ["en", "zh-Hant", "ja"].contains(language) {
            UserDefaults.standard.set(language, forKey: localeKey)
            return
        }
        if type == "connect", presentedViewController == nil {
            let browser = SFSafariViewController(url: URL(string: "https://okok147.github.io/asympta-world/")!)
            browser.preferredControlTintColor = UIColor(red: 0.294, green: 0.498, blue: 0.651, alpha: 1)
            present(browser, animated: true)
            return
        }
        guard presentedViewController == nil, let text = body["text"] as? String, !text.isEmpty else { return }
        if type == "share", text.utf8.count <= 200_000 {
            presentShare(items: [text])
        } else if type == "export", text.utf8.count <= 2_000_000 {
            guard let data = text.data(using: .utf8),
                  (try? JSONSerialization.jsonObject(with: data)) != nil else { return }
            let file = FileManager.default.temporaryDirectory
                .appendingPathComponent("Asympta-World-\(UUID().uuidString).json")
            do {
                try data.write(to: file, options: [.atomic, .completeFileProtection])
                exportedFiles.append(file)
                presentShare(items: [file])
            } catch { showExportError() }
        }
    }

    private func presentShare(items: [Any]) {
        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
        activity.popoverPresentationController?.sourceView = view
        activity.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        activity.popoverPresentationController?.permittedArrowDirections = []
        present(activity, animated: true)
    }

    private func makeErrorView() {
        errorTitle = UILabel()
        errorTitle.font = .preferredFont(forTextStyle: .title2)
        errorTitle.adjustsFontForContentSizeCategory = true
        errorTitle.textAlignment = .center
        errorDetail = UILabel()
        errorDetail.font = .preferredFont(forTextStyle: .body)
        errorDetail.adjustsFontForContentSizeCategory = true
        errorDetail.numberOfLines = 0
        errorDetail.textAlignment = .center
        retryButton = UIButton(type: .system)
        retryButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        retryButton.addTarget(self, action: #selector(loadWorld), for: .touchUpInside)
        retryButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        errorStack = UIStackView(arrangedSubviews: [errorTitle, errorDetail, retryButton])
        errorStack.axis = .vertical
        errorStack.spacing = 18
        errorStack.translatesAutoresizingMaskIntoConstraints = false
        errorStack.isHidden = true
        view.addSubview(errorStack)
        NSLayoutConstraint.activate([
            errorStack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
            errorStack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            errorStack.leadingAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 28),
            errorStack.trailingAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -28),
            errorStack.widthAnchor.constraint(lessThanOrEqualToConstant: 420)
        ])
    }

    private func showError() {
        let copy: (String, String, String)
        switch locale {
        case "zh-Hant": copy = ("重新開啟你的世界", "你的世界未能載入。已儲存的資料會保留，請再試一次。", "再試一次")
        case "ja": copy = ("世界をもう一度開く", "世界を読み込めませんでした。保存済みのデータは保持されます。もう一度お試しください。", "もう一度試す")
        default: copy = ("Open your world again", "Your world could not be loaded. Saved data is preserved. Please try again.", "Try again")
        }
        errorTitle.text = copy.0
        errorDetail.text = copy.1
        retryButton.setTitle(copy.2, for: .normal)
        webView.isHidden = true
        errorStack.isHidden = false
    }

    private func showExportError() {
        let title = locale == "zh-Hant" ? "未能匯出" : locale == "ja" ? "書き出せませんでした" : "Could not export"
        let button = locale == "zh-Hant" ? "好" : locale == "ja" ? "閉じる" : "OK"
        let alert = UIAlertController(title: title, message: nil, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: button, style: .default))
        present(alert, animated: true)
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?
    init(_ delegate: WKScriptMessageHandler) { self.delegate = delegate }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
