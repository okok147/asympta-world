import Foundation
import StoreKit
import UIKit

extension Notification.Name {
    static let worldKeepsakesDidChange = Notification.Name("com.asympta.world.keepsakes.changed")
}

@MainActor
final class WorldKeepsakesStore {
    static let shared = WorldKeepsakesStore()
    static let monthlyID = "com.asympta.world.keepsakes.monthly"
    static let yearlyID = "com.asympta.world.keepsakes.yearly"
    private static let identifiers = [monthlyID, yearlyID]

    enum PurchaseOutcome { case purchased, pending, cancelled }
    enum Failure: Error {
        case busy, unavailable, priceChanged, unverified, purchase, restore, manage

        var message: WorldKeepsakesCopy {
            switch self {
            case .busy: return .busy
            case .unavailable: return .unavailable
            case .priceChanged: return .priceChanged
            case .unverified: return .unverified
            case .purchase: return .purchaseFailed
            case .restore: return .restoreFailed
            case .manage: return .manageFailed
            }
        }
    }

    private(set) var products: [Product] = []
    private(set) var hasAccess = false
    private(set) var checking = true
    private(set) var loadingProducts = false
    private(set) var busy = false
    private(set) var message: WorldKeepsakesCopy?
    private var entitlementRevision = 0
    private var productsRevision = 0
    private var updates: Task<Void,Never>?
    private var storefrontUpdates: Task<Void,Never>?
    private var expiry: Task<Void,Never>?
    private var foregroundObserver: NSObjectProtocol?

    private init() {
        updates = Task { [weak self] in
            for await update in StoreKit.Transaction.updates {
                guard !Task.isCancelled else { return }
                guard case .verified(let transaction) = update,
                      Self.identifiers.contains(transaction.productID) else { continue }
                await self?.refresh()
                await transaction.finish()
            }
        }
        storefrontUpdates = Task { [weak self] in
            for await _ in Storefront.updates {
                guard !Task.isCancelled else { return }
                await self?.loadProducts()
            }
        }
        foregroundObserver = NotificationCenter.default.addObserver(
            forName:UIApplication.didBecomeActiveNotification, object:nil, queue:.main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in await self?.refresh() }
        }
    }

    deinit {
        updates?.cancel()
        storefrontUpdates?.cancel()
        expiry?.cancel()
        if let foregroundObserver { NotificationCenter.default.removeObserver(foregroundObserver) }
    }

    func refresh() async {
        entitlementRevision += 1
        let revision = entitlementRevision
        var entitled = false
        var nextCheck: Date?
        for await result in StoreKit.Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  Self.identifiers.contains(transaction.productID),
                  transaction.productType == .autoRenewable,
                  transaction.revocationDate == nil, !transaction.isUpgraded else { continue }
            // StoreKit includes subscribed and billing-grace transactions here.
            entitled = true
            if let date = transaction.expirationDate, date > Date() {
                nextCheck = min(nextCheck ?? date, date)
            }
        }
        if let subscription = products.first?.subscription,
           let statuses = try? await subscription.status {
            for status in statuses where status.state == .subscribed || status.state == .inGracePeriod {
                guard case .verified(let transaction) = status.transaction,
                      Self.identifiers.contains(transaction.productID),
                      transaction.revocationDate == nil, !transaction.isUpgraded,
                      case .verified(let renewal) = status.renewalInfo else { continue }
                entitled = true
                let date = renewal.gracePeriodExpirationDate ?? transaction.expirationDate
                if let date, date > Date() { nextCheck = min(nextCheck ?? date, date) }
            }
        }
        guard revision == entitlementRevision else { return }
        hasAccess = entitled
        checking = false
        expiry?.cancel()
        if let nextCheck {
            expiry = Task { [weak self] in
                let seconds = max(1, nextCheck.timeIntervalSinceNow + 1)
                try? await Task.sleep(for:.seconds(seconds))
                guard !Task.isCancelled else { return }
                await self?.refresh()
            }
        }
        changed()
    }

    func loadProducts() async {
        productsRevision += 1
        let revision = productsRevision
        loadingProducts = true
        changed()
        do {
            let offered = try await Product.products(for:Self.identifiers)
            guard revision == productsRevision else { return }
            products = Self.identifiers.compactMap { identifier in
                offered.first { $0.id == identifier && Self.supportedOffer($0) }
            }
            message = products.isEmpty ? .unavailable : nil
        } catch {
            guard revision == productsRevision else { return }
            products = []
            message = .unavailable
        }
        loadingProducts = false
        await refresh()
    }

    func purchase(product selected: Product) async throws -> PurchaseOutcome {
        guard !busy else { throw Failure.busy }
        guard Self.identifiers.contains(selected.id), selected.type == .autoRenewable else { throw Failure.unavailable }
        busy = true
        message = nil
        changed()
        defer { busy = false; changed() }
        await loadProducts()
        if hasAccess { return .purchased }
        guard let offered = products.first(where:{ $0.id == selected.id }) else { throw Failure.unavailable }
        guard offered.displayPrice == selected.displayPrice, offered.price == selected.price else { throw Failure.priceChanged }
        do {
            switch try await offered.purchase() {
            case .success(.verified(let transaction)):
                guard Self.identifiers.contains(transaction.productID), transaction.revocationDate == nil,
                      !transaction.isUpgraded else { throw Failure.unverified }
                await refresh()
                await transaction.finish()
                message = hasAccess ? .restored : .verifiedLater
                return .purchased
            case .success(.unverified): throw Failure.unverified
            case .pending:
                message = .pending
                return .pending
            case .userCancelled: return .cancelled
            @unknown default: throw Failure.purchase
            }
        } catch let failure as Failure {
            throw failure
        } catch {
            throw Failure.purchase
        }
    }

    @discardableResult
    func restore() async throws -> Bool {
        guard !busy else { throw Failure.busy }
        busy = true
        message = .restoring
        changed()
        defer { busy = false; changed() }
        do {
            // Only an explicit restore action requests account synchronization.
            try await AppStore.sync()
            await refresh()
            message = hasAccess ? .restored : .noPurchase
            return hasAccess
        } catch {
            await refresh()
            message = .restoreFailed
            throw Failure.restore
        }
    }

    func manage(windowScene: UIWindowScene) async throws {
        guard !busy else { throw Failure.busy }
        busy = true
        changed()
        defer { busy = false; changed() }
        do {
            try await AppStore.showManageSubscriptions(in:windowScene)
            await refresh()
        } catch { throw Failure.manage }
    }

    private static func supportedOffer(_ product: Product) -> Bool {
        guard product.type == .autoRenewable, let period = product.subscription?.subscriptionPeriod,
              period.value == 1 else { return false }
        return (product.id == monthlyID && period.unit == .month) ||
            (product.id == yearlyID && period.unit == .year)
    }

    private func changed() {
        NotificationCenter.default.post(name:.worldKeepsakesDidChange, object:self)
    }
}
