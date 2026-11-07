import Foundation

enum WorldLibraryCopy {
    case library, libraryDetail, moments, collections, allTime, week, previousWeek, nextWeek
    case search, searchCollections, loading, empty, noResults, noWeekMoments, earlier, more, refresh
    case collectionsDetail, noCollections, collectionEmpty, newCollection, collectionTitle, collectionTitleHint, cachedResults, keepsake
    case create, creating, retryCreate, uncertainCreate, invalidTitle, itemCount, saveToCollection
    case save, saved, removeSaved, saving, collectionSaved, collectionRemoved, photoMoment
    case removeCollection, removeCollectionDetail, removeFromCollection, removeItemDetail
    case chooseDate, weekDetail, cancel, retry, close, remove, savedInCollection

    var translations: (String, String, String) {
        switch self {
        case .library: return ("Circle library", "圈子藏書室", "サークルのライブラリ")
        case .libraryDetail: return ("Find a moment, revisit a week, or keep something together.", "尋回一刻、重看某一週，或把喜歡的內容一起收藏。", "ひとときを探し、あの週を振り返り、大切なものを一緒に残します。")
        case .moments: return ("Moments", "時刻", "ひととき")
        case .collections: return ("Collections", "收藏集", "コレクション")
        case .allTime: return ("All time", "所有時間", "すべての期間")
        case .week: return ("By week", "按週回顧", "週ごと")
        case .previousWeek: return ("Previous week", "上一週", "前の週")
        case .nextWeek: return ("Next week", "下一週", "次の週")
        case .search: return ("Search moments or people", "搜尋時刻或作者", "ひとときや投稿者を検索")
        case .searchCollections: return ("Search collections", "搜尋收藏集", "コレクションを検索")
        case .loading: return ("Opening the library…", "正在打開藏書室…", "ライブラリを開いています…")
        case .empty: return ("Shared moments will live here. You can return to them whenever you like.", "分享過的時刻會留在這裡，隨時都能回來重看。", "共有したひとときがここに並びます。いつでも振り返れます。")
        case .noResults: return ("Nothing matched this search. Try another word or clear the search.", "找不到符合的內容。試試其他關鍵字，或清除搜尋。", "一致するものがありません。別の言葉で探すか、検索を消してください。")
        case .noWeekMoments: return ("No moments in this week yet. Try another week or All time.", "這一週還沒有時刻。可以看看其他週，或切換所有時間。", "この週のひとときはまだありません。別の週か、すべての期間をご覧ください。")
        case .earlier: return ("Earlier moments", "更早的時刻", "以前のひととき")
        case .more: return ("Show more", "顯示更多", "もっと見る")
        case .refresh: return ("Refresh library", "重新整理藏書室", "ライブラリを更新")
        case .keepsake: return ("Make a keepsake", "製作紀念冊", "思い出の冊子を作る")
        case .cachedResults: return ("Showing previously loaded content while the connection recovers.", "連線恢復前，先顯示上次載入的內容。", "接続が戻るまで、前回読み込んだ内容を表示しています。")
        case .noCollections: return ("Make your first collection, then open a moment to save it here.", "先建立第一個收藏集，再打開喜歡的時刻加入收藏。", "最初のコレクションを作り、ひとときを開いて保存しましょう。")
        case .collectionsDetail: return ("Shared shelves for the things your circle wants to keep.", "把圈子想珍藏的內容，放在共同的書架上。", "サークルで残しておきたいものを、共有の棚に。")
        case .collectionEmpty: return ("This collection is ready for its first moment. Open a moment and choose Save to collection.", "收藏集準備好迎接第一則時刻了。打開貼文，再選擇加入收藏集。", "最初のひとときを待っています。投稿を開き、コレクションに保存してください。")
        case .newCollection: return ("New collection", "建立收藏集", "新しいコレクション")
        case .collectionTitle: return ("Collection name", "收藏集名稱", "コレクション名")
        case .collectionTitleHint: return ("Up to 60 characters. Visible to circle members.", "最多 60 個字，圈子成員可以看見。", "60文字まで。サークルのメンバーに表示されます。")
        case .create: return ("Create collection", "建立收藏集", "コレクションを作成")
        case .creating: return ("Creating…", "正在建立…", "作成しています…")
        case .retryCreate: return ("Retry creating collection", "重試建立收藏集", "コレクションの作成を再試行")
        case .uncertainCreate: return ("The last creation is unconfirmed. Retry to finish that same collection.", "上次建立的結果尚未確認。重試會完成同一個收藏集。", "前回の作成結果を確認できていません。再試行すると同じコレクションを完成させます。")
        case .invalidTitle: return ("Choose a name between 1 and 60 characters.", "請輸入 1 至 60 個字的名稱。", "名前は1〜60文字で入力してください。")
        case .itemCount: return ("%d moments", "%d 則時刻", "%d件のひととき")
        case .saveToCollection: return ("Save to collection", "加入收藏集", "コレクションに保存")
        case .save: return ("Save", "收藏", "保存")
        case .saved: return ("Saved", "已收藏", "保存済み")
        case .removeSaved: return ("Remove from collection", "移出收藏集", "コレクションから外す")
        case .saving: return ("Saving…", "正在收藏…", "保存しています…")
        case .collectionSaved: return ("Saved to collection", "已加入收藏集", "コレクションに保存しました")
        case .collectionRemoved: return ("Removed from collection", "已移出收藏集", "コレクションから外しました")
        case .photoMoment: return ("Photo moment", "照片時刻", "写真のひととき")
        case .removeCollection: return ("Delete collection", "刪除收藏集", "コレクションを削除")
        case .removeCollectionDetail: return ("This removes the shared collection. The original moments remain in the circle.", "這會刪除共同收藏集，原貼文仍保留在圈子裡。", "共有コレクションを削除します。元の投稿はサークルに残ります。")
        case .removeFromCollection: return ("Remove moment from collection", "將時刻移出收藏集", "ひとときをコレクションから外す")
        case .removeItemDetail: return ("The moment will remain in your circle.", "這則時刻仍會保留在圈子裡。", "このひとときはサークルに残ります。")
        case .chooseDate: return ("Choose a week", "選擇一週", "週を選ぶ")
        case .weekDetail: return ("Weeks begin on Monday in your current time zone.", "每週以目前時區的星期一開始。", "週は現在のタイムゾーンの月曜日から始まります。")
        case .cancel: return ("Cancel", "取消", "キャンセル")
        case .retry: return ("Try again", "再試一次", "もう一度試す")
        case .close: return ("Done", "完成", "完了")
        case .remove: return ("Remove", "移除", "削除")
        case .savedInCollection: return ("Saved in this collection", "已在這個收藏集", "このコレクションに保存済み")
        }
    }
}

extension WorldStrings {
    func library(_ key: WorldLibraryCopy) -> String {
        let copy = key.translations
        switch language {
        case .english: return copy.0
        case .traditionalChinese: return copy.1
        case .japanese: return copy.2
        }
    }

    func libraryCount(_ count: Int) -> String {
        String(format:library(.itemCount), locale:language.locale, count)
    }

    func libraryWeek(_ start: Date, end: Date) -> String {
        let formatter = DateIntervalFormatter()
        formatter.locale = language.locale
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from:start, to:end.addingTimeInterval(-1))
    }
}
