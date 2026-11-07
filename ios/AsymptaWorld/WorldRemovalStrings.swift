import Foundation

enum WorldRemovalCopy {
    case title, scope, effects, localCleanup, independent, knownCount, retained, privacy
    case continueRemoval, confirmTitle, confirmDetail, prepareError
    case progressTitle, progressDetail, counts, working, finishing
    case paused, networkError, localError, singleWindow, finishedTitle
    case finishedDetail, startNew, revoked
}

extension WorldStrings {
    func removal(_ key: WorldRemovalCopy) -> String {
        let values: [String]
        switch key {
        case .title:
            values = ["Remove social identity", "移除社交身分", "ソーシャル識別情報を削除"]
        case .scope:
            values = ["This removes this social identity from circles known to World and those remembered on this device. Older circles that are no longer known may be missed. This does not delete all World data.", "這會從 World 目前可確認，以及此裝置記住的圈子移除此社交身分。已遺失、無法確認的舊圈子可能不在範圍內。這並非刪除所有 World 資料。", "World が把握しているサークルと、この端末が記憶しているサークルから、このソーシャル識別情報を削除します。見失った古いサークルは対象外の可能性があります。World の全データ削除ではありません。"]
        case .effects:
            values = ["Your posts, replies and membership in those circles are removed. Another member takes over a circle you host; an empty circle closes. Other members’ independent posts stay. Removal cannot be undone or stopped after sending, and an old recovery file cannot restore this identity.", "你在這些圈子的貼文、回應與成員資格會被移除。你主持的圈子會交接給其他成員；沒有成員時才會關閉。其他成員獨立分享的內容會保留。送出後無法取消或復原，舊恢復檔也不能還原此身分。", "対象サークルの自分の投稿、返信、メンバー資格を削除します。ホスト権限は別のメンバーに引き継ぎ、空のサークルは閉じます。他のメンバーの独立した投稿は保持されます。送信後は中止も復元もできず、古い復元ファイルでも元には戻せません。"]
        case .localCleanup:
            values = ["After World confirms removal, this device clears the current identity, social drafts, saved circle links and ability progress. You can close the app and reopen it to finish.", "World 確認移除後，此裝置才會清除目前身分、社交草稿、圈子連結與能力進度。你可以關閉 App，之後重新開啟繼續完成。", "World の削除確認後に、この端末の現在の識別情報、ソーシャル下書き、サークルへのリンク、能力の進捗を消去します。アプリを閉じても、開き直して完了できます。"]
        case .independent:
            values = ["Your private journal, nickname, personal favorites, settings and earlier recovery-protection records stay. Apple subscriptions and exported files are separate: this does not cancel a subscription or delete external copies.", "私人日記、暱稱、個人收藏、設定及先前身分的復原保護資料會保留。Apple 訂閱與匯出檔案另行管理；此操作不會取消訂閱或刪除外部副本。", "非公開の日記、ニックネーム、個人のお気に入り、設定、以前の復元保護記録は保持します。Apple のサブスクリプションや書き出したファイルは別扱いで、解約や外部コピーの削除は行いません。"]
        case .retained:
            values = ["World keeps limited records to prevent the removed identity from being reactivated.", "World 會保留少量紀錄，防止已移除的身分重新啟用。", "削除した識別情報の再有効化を防ぐため、World は必要最小限の記録を保持します。"]
        case .privacy:
            values = ["Privacy and retained records", "隱私與保留紀錄", "プライバシーと保持する記録"]
        case .knownCount:
            values = ["Remembered circles supplied by this app: %ld", "本 App 將提供的已記住圈子：%ld 個", "このアプリが記憶して送信するサークル：%ld 件"]
        case .continueRemoval:
            values = ["Continue to removal confirmation", "繼續確認移除", "削除の確認に進む"]
        case .confirmTitle:
            values = ["Permanently remove this social identity?", "永久移除此社交身分？", "このソーシャル識別情報を完全に削除しますか？"]
        case .confirmDetail:
            values = [
                "This app will supply exactly %ld remembered circles. The service also processes circles it has indexed. Unknown historical circles may remain outside this scope. Your own social content, memberships and host ownership in that scope will be removed. This cannot be undone or cancelled after sending. Your private journal and independent data are not part of this removal.",
                "本 App 將提供確切 %ld 個已記住的圈子。服務也會處理已建立索引的圈子。未知的歷史圈子可能不在此範圍內。此範圍內你自己的社交內容、成員資格及主持人所有權將被移除。送出後無法復原或取消。私人日記及獨立資料不包含在此次移除中。",
                "このアプリは記憶しているサークルを正確に %ld 件送信します。サービスが把握しているサークルも処理されます。不明な過去のサークルは対象外の可能性があります。この範囲内の自分のソーシャルコンテンツ、メンバー資格、ホストとしての所有権が削除されます。送信後は元に戻せず、取り消せません。非公開の日記や独立したデータは対象外です。"
            ]
        case .prepareError:
            values = ["Removal could not be prepared. No removal request was sent. Unlock this device, keep only one World window open, then retry to review the current circle count.", "無法準備移除，尚未送出移除要求。請解鎖裝置，僅保留一個 World 視窗，再重試以檢視目前的圈子數量。", "削除の準備ができませんでした。削除リクエストは送信していません。端末をロック解除し、World のウインドウを一つだけ開いた状態で、再試行して現在のサークル数を確認してください。"]
        case .progressTitle:
            values = ["Removing social identity", "正在移除社交身分", "ソーシャル識別情報を削除中"]
        case .progressDetail:
            values = ["The service performs removal independently. This page reads its progress while visible and active. Leaving or closing the app pauses these updates, not a request already received by the service. Reopen the app to resume. The old identity cannot be reopened here.", "服務會獨立執行移除。此頁面僅在顯示且啟用時讀取進度。離開或關閉 App 會暫停進度更新，但不會取消服務已收到的要求。重新開啟 App 即可繼續。此處無法重新開啟舊身分。", "削除はサービスが独立して実行します。このページは表示中かつアクティブな間だけ進捗を読み取ります。アプリを閉じると更新は止まりますが、サービスが受信済みのリクエストは取り消されません。開き直すと再開します。ここから元の識別情報に戻ることはできません。"]
        case .counts:
            values = ["Completed circles: %ld\nRemaining circles: %ld", "已完成圈子：%ld 個\n剩餘圈子：%ld 個", "処理済みのサークル：%ld 件\n残りのサークル：%ld 件"]
        case .working:
            values = ["Waiting for authenticated service confirmation. No local social data has been cleared yet.", "正在等候服務確認，尚未清除本機社交資料。", "サービスによる確認を待っています。端末のソーシャルデータはまだ消去していません。"]
        case .finishing:
            values = ["The service confirmed removal with no circles remaining in this scope. Finishing the protected local cleanup.", "服務已確認此範圍內的移除，沒有剩餘圈子。正在完成受保護的本機清理。", "この範囲内で残りのサークルがないことをサービスが確認しました。端末内の整理を完了しています。"]
        case .paused:
            values = ["Progress updates are paused. Reopen this page in the foreground to resume. Your removal record is retained.", "進度更新已暫停。讓此頁面回到前景即可繼續，移除紀錄仍會保留。", "進捗の更新を一時停止しています。このページを前面に戻すと再開します。削除の記録は保持されています。"]
        case .networkError:
            values = ["The latest service status could not be confirmed. A request may already have reached the service. Nothing is treated as complete without confirmation. Your record and last confirmed counts are retained; retry when connected.", "無法確認服務的最新狀態，要求可能已送達服務。未取得確認前不會視為完成。紀錄與上次確認的數量均會保留；連線後請重試。", "サービスの最新状態を確認できませんでした。リクエストは既に届いている可能性があります。確認なしに完了とは扱いません。記録と最後に確認した件数は保持しています。接続後に再試行してください。"]
        case .localError:
            values = ["Removal is paused because its protected record or local cleanup could not be safely completed. Unlock the device and retry. The record is retained; no replacement identity will be created. A recorded service confirmation does not need another network request.", "無法安全完成受保護紀錄的處理或本機清理，因此移除已暫停。請解鎖裝置後重試。紀錄會保留，也不會建立替代身分。已記錄的服務確認不需要再次連線。", "保護された記録の処理、または端末内の整理を安全に完了できないため、一時停止しています。端末をロック解除して再試行してください。記録を保持し、代わりの識別情報は作成しません。サービスの確認が記録済みなら、再度の通信は不要です。"]
        case .singleWindow:
            values = ["Keep only one World window open and active, then retry. Removal will not run alongside another World window.", "請僅保留一個啟用中的 World 視窗，再重試。移除不會與其他 World 視窗同時執行。", "World のウインドウを一つだけ開いてアクティブにし、再試行してください。他の World ウインドウと並行して削除は実行しません。"]
        case .finishedTitle:
            values = ["Social identity removed", "社交身分已移除", "ソーシャル識別情報を削除しました"]
        case .finishedDetail:
            values = ["The service confirmed removal from indexed and supplied circles, and the current social drafts, circle references and ability progress on this device have been cleared. Unknown historical circles may still be outside that scope. This is not deletion of all World data. Your private journal and independent data remain. A new social identity is created only if you choose “Start a new World”.", "服務已確認從已建立索引及本 App 提供的圈子中移除，本機目前的社交草稿、圈子參照及能力進度也已清除。未知歷史圈子仍可能不在此範圍內。這並非刪除所有 World 資料。私人日記與獨立資料仍會保留。只有選擇「開始新的 World」才會建立新的社交身分。", "把握済みおよび送信済みのサークルからの削除をサービスが確認し、この端末の現在のソーシャル下書き、サークルの参照、能力の進捗を消去しました。不明な過去のサークルは対象外の可能性があります。World の全データ削除ではありません。非公開の日記と独立したデータは保持されます。「新しい World を始める」を選んだ場合に限り、新しいソーシャル識別情報を作成します。"]
        case .startNew:
            values = ["Start a new World", "開始新的 World", "新しい World を始める"]
        case .revoked:
            values = ["This archive belongs to a social identity whose removal has begun or completed. It can no longer be restored. Your current identity has not been changed.", "此封存檔屬於已開始或已完成移除的社交身分，無法再還原。目前的身分未被變更。", "このアーカイブのソーシャル識別情報は削除が開始済み、または完了済みのため復元できません。現在の識別情報は変更していません。"]
        }
        switch language {
        case .english: return values[0]
        case .traditionalChinese: return values[1]
        case .japanese: return values[2]
        }
    }

    func removalKnownCount(_ count: Int) -> String {
        String(format:removal(.knownCount), locale:language.locale, count)
    }

    func removalConfirmation(_ count: Int) -> String {
        String(format:removal(.confirmDetail), locale:language.locale, count)
    }

    func removalCounts(completed: Int, remaining: Int) -> String {
        String(format:removal(.counts), locale:language.locale, completed, remaining)
    }
}
