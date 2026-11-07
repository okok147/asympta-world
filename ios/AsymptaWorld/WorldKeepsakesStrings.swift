import Foundation

enum WorldKeepsakesCopy {
    case title, introduction, paperTitle, paperDetail, attributionTitle, attributionDetail
    case sharingTitle, sharingDetail, monthly, yearly, monthPrice, yearPrice, subscribe
    case checking, loading, unavailable, retry, restore, restoring, restored, noPurchase
    case active, activeDetail, manage, terms, privacy, renewal, pending, verifiedLater
    case priceChanged, purchaseFailed, unverified, restoreFailed, manageFailed, busy

    var translations: (String, String, String) {
        switch self {
        case .title: return ("World Keepsakes", "World 珍藏", "World キープセイク")
        case .introduction: return ("Give your shared moments a place on paper.", "讓共同的時刻，在紙上留下來。", "分かち合ったひとときを、紙に残しましょう。")
        case .paperTitle: return ("A collection to keep", "值得保存的收藏", "大切に残すコレクション")
        case .paperDetail: return ("Compose photos and words into a PDF keepsake in an original paper palette.", "把照片與文字整理成 PDF 珍藏，搭配原創紙面配色。", "写真と言葉を、オリジナルの紙の配色を使ったPDFにまとめます。")
        case .attributionTitle: return ("The words, and who wrote them", "文字與留下文字的人", "言葉と、それを書いた人")
        case .attributionDetail: return ("Keep the original captions and authors together in your keepsake.", "在珍藏裡保留原文與作者的連結。", "元の文章と作者の名前を、一緒に残します。")
        case .sharingTitle: return ("Made to share", "把回憶帶走", "思い出を持ち出す")
        case .sharingDetail: return ("Save or share the finished PDF with the native share sheet.", "透過系統分享選單儲存或分享完成的 PDF。", "完成したPDFを、システムの共有シートから保存・共有できます。")
        case .monthly: return ("Monthly", "月訂閱", "月額プラン")
        case .yearly: return ("Yearly", "年訂閱", "年額プラン")
        case .monthPrice: return ("%@ per month", "每月 %@", "1か月 %@")
        case .yearPrice: return ("%@ per year, billed yearly", "每年 %@，按年收費", "1年 %@、年ごとに請求")
        case .subscribe: return ("Subscribe", "訂閱", "登録する")
        case .checking: return ("Checking your subscription…", "正在確認訂閱…", "登録状況を確認しています…")
        case .loading: return ("Loading plans from the App Store…", "正在從 App Store 載入方案…", "App Storeからプランを読み込んでいます…")
        case .unavailable: return ("Plans are unavailable right now. Try again in a moment.", "目前無法載入方案，請稍後再試。", "現在プランを読み込めません。しばらくしてからお試しください。")
        case .retry: return ("Reload plans", "重新載入方案", "プランを再読み込み")
        case .restore: return ("Restore purchases", "恢復購買", "購入を復元")
        case .restoring: return ("Restoring your purchase…", "正在恢復購買…", "購入を復元しています…")
        case .restored: return ("Your verified subscription is ready.", "已驗證的訂閱已可使用。", "確認済みの登録を利用できます。")
        case .noPurchase: return ("No active World Keepsakes subscription was found for this Apple Account.", "此 Apple 帳號沒有有效的 World 珍藏訂閱。", "このApple Accountに有効なWorld キープセイクの登録が見つかりませんでした。")
        case .active: return ("Your keepsakes are ready", "你的珍藏已可使用", "キープセイクを利用できます")
        case .activeDetail: return ("Open a collection to create its PDF keepsake.", "打開收藏集，就能製作 PDF 珍藏。", "コレクションを開いて、PDFを作成できます。")
        case .manage: return ("Manage subscription", "管理訂閱", "登録を管理")
        case .terms: return ("Terms of Use", "使用條款", "利用規約")
        case .privacy: return ("Privacy policy", "私隱政策", "プライバシーポリシー")
        case .renewal: return ("Payment is charged to your Apple Account. Your subscription renews automatically unless cancelled at least 24 hours before the current period ends. Manage or cancel in your App Store account settings.", "費用由你的 Apple 帳號收取。除非在當期結束至少 24 小時前取消，訂閱會自動續訂。你可在 App Store 帳號設定中管理或取消。", "料金はApple Accountに請求されます。現在の期間が終了する24時間前までに解約しない限り、自動更新されます。App Storeのアカウント設定から管理・解約できます。")
        case .pending: return ("Your purchase is awaiting approval. Access will appear after Apple confirms it.", "購買正在等待核准。Apple 確認後即可使用。", "購入の承認を待っています。Appleの確認後に利用できます。")
        case .verifiedLater: return ("Apple recorded the purchase. Your access is still being confirmed. You can restore purchases to check again.", "Apple 已記錄購買，使用權仍在確認中。你可點選恢復購買再次確認。", "Appleが購入を記録しました。利用権を確認しています。「購入を復元」から再確認できます。")
        case .priceChanged: return ("The App Store updated this plan. Review the current price and choose again.", "App Store 已更新此方案。請核對目前價格後再次選擇。", "App Storeがプランを更新しました。現在の価格を確認して、もう一度選んでください。")
        case .purchaseFailed: return ("The purchase did not complete. Please try again.", "購買尚未完成，請再試一次。", "購入が完了しませんでした。もう一度お試しください。")
        case .unverified: return ("This purchase could not be verified. Try restoring purchases.", "目前無法驗證此購買，請嘗試恢復購買。", "この購入を確認できませんでした。購入の復元をお試しください。")
        case .restoreFailed: return ("Restore did not complete. Check your connection and use the Apple Account that made the purchase.", "恢復購買尚未完成。請檢查連線，並使用原本購買時的 Apple 帳號。", "復元が完了しませんでした。接続と、購入時のApple Accountを確認してください。")
        case .manageFailed: return ("Subscription settings could not open. Try again from your App Store account.", "目前無法打開訂閱設定。你可從 App Store 帳號再次嘗試。", "登録設定を開けませんでした。App Storeのアカウントからお試しください。")
        case .busy: return ("Another App Store action is in progress.", "另一項 App Store 操作正在進行。", "別のApp Storeの操作が進行中です。")
        }
    }
}

extension WorldStrings {
    func keepsakes(_ key: WorldKeepsakesCopy) -> String {
        let text = key.translations
        switch language {
        case .english: return text.0
        case .traditionalChinese: return text.1
        case .japanese: return text.2
        }
    }

    func keepsakesPrice(_ price: String, yearly: Bool) -> String {
        String(format:keepsakes(yearly ? .yearPrice : .monthPrice), locale:language.locale, price)
    }
}
