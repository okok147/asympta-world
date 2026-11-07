import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    static func installWorld(in window: UIWindow) {
        // Removal takes precedence even when its protected journal cannot be read.
        // Do not construct a cloud session, replay recovery, or generate an identity.
        do {
            if try WorldRemovalJournal.load() != nil {
                window.rootViewController = WorldRemovalProgressViewController()
                return
            }
        } catch {
            window.rootViewController = WorldRemovalProgressViewController(recheckStartupIfAbsent:true)
            return
        }
        do {
            try WorldRecoveryCommit.replay()
            window.rootViewController = NativeWorldViewController()
        } catch {
            let recovery = WorldRecoveryStartupViewController()
            recovery.retry = { [weak window] in guard let window else { return }; Self.installWorld(in:window) }
            window.rootViewController = recovery
        }
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.tintColor = WorldTheme.ink
        Self.installWorld(in:window)
        window.makeKeyAndVisible()
        self.window = window
    }
}
