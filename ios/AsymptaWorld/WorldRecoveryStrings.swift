import Foundation

enum WorldRecoveryCopy {
    case title, introduction, export, restore, phrase, confirmPhrase, phraseHint, encrypt, decrypt, working, cancel, done
    case invalid, unavailable, occupied, network, multiwindow, review, reviewDetail, confirm, verifying, startup, retry
    case skipped, snapshot, archiveNotice
    var translations: (String,String,String) {
        switch self {
        case .title: return ("Your World, safely kept", "妥善保存你的 World", "あなたのWorldを大切に")
        case .introduction: return ("Keep an encrypted recovery file for your circles and aura growth. Save it somewhere safe and keep its passphrase separately. Anyone with both can use your identity.", "為圈子身分與光暈成長保存加密恢復檔。請把檔案妥善保存，密語分開保管；同時持有兩者的人可以使用你的身分。", "サークルのIDとオーラの成長を、暗号化した復元ファイルに残します。ファイルと合言葉は別々に保管してください。両方を持つ人は、あなたのIDを利用できます。")
        case .archiveNotice: return ("This restores access to existing circles, subject to current membership. Posts stay on the service. Drafts, your private journal, preferences and Apple subscriptions are not included or replaced.", "恢復檔可重取現有圈子的使用權，仍須符合目前成員資格。貼文留在服務上。草稿、私人日記、偏好與 Apple 訂閱不包含在內，也不會被取代。", "現在のメンバー資格に従って、既存のサークルへのアクセスを復元します。投稿はサービスに残ります。下書き、個人の日記、設定、Appleの登録は含まれず、置き換えられません。")
        case .export: return ("Save a recovery file", "儲存恢復檔", "復元ファイルを保存")
        case .restore: return ("Restore from a file", "從檔案恢復", "ファイルから復元")
        case .phrase: return ("Passphrase", "密語", "合言葉")
        case .confirmPhrase: return ("Repeat passphrase", "再次輸入密語", "合言葉を再入力")
        case .phraseHint: return ("Use at least 12 characters. Keep the exact spelling; we cannot recover a forgotten passphrase.", "請使用至少 12 個字元，並記下完全相同的寫法。我們無法找回遺失的密語。", "12文字以上にしてください。同じ表記で保管してください。忘れた合言葉は復元できません。")
        case .encrypt: return ("Encrypt and save", "加密並儲存", "暗号化して保存")
        case .decrypt: return ("Unlock recovery file", "解鎖恢復檔", "復元ファイルを開く")
        case .working: return ("Preparing…", "正在準備…", "準備しています…")
        case .verifying: return ("Checking current circle access…", "正在確認目前圈子權限…", "現在のサークルへのアクセスを確認しています…")
        case .cancel: return ("Cancel", "取消", "キャンセル")
        case .done: return ("Done", "完成", "完了")
        case .invalid: return ("The file could not be unlocked. Check the file and its exact passphrase.", "無法解鎖此檔案。請核對檔案及完全相同的密語。", "ファイルを開けませんでした。ファイルと合言葉の表記を確認してください。")
        case .unavailable: return ("Your saved identity or files could not be read or written. Your originals are preserved. Try again when this device is unlocked.", "目前無法讀寫已儲存的身分或檔案。原始資料已保留。請在裝置解鎖時重試。", "保存済みのIDやファイルを読み書きできませんでした。元のデータは保持されています。端末のロックを解除して再試行してください。")
        case .occupied: return ("This installation has circles or drafts. Save a recovery file first, then leave those circles and finish or remove their drafts before restoring another identity.", "此裝置已有圈子或草稿。請先儲存恢復檔，再離開這些圈子並完成或移除草稿，然後恢復另一個身分。", "この端末にはサークルか下書きがあります。先に復元ファイルを保存し、サークルを退出して下書きを完成または削除してから、別のIDを復元してください。")
        case .network: return ("Circle access could not be verified. Nothing has been switched. Check your connection and try again.", "無法確認圈子權限，身分尚未切換。請檢查連線後重試。", "サークルへのアクセスを確認できませんでした。IDは変更されていません。接続を確認して再試行してください。")
        case .multiwindow: return ("Close other World windows before restoring this identity.", "請先關閉其他 World 視窗，再恢復此身分。", "ほかのWorldウインドウを閉じてから復元してください。")
        case .review: return ("Restore this World?", "恢復這個 World？", "このWorldを復元しますか？")
        case .reviewDetail: return ("%@\n\nThis replaces the current empty circle identity and its aura growth. Your private journal and settings stay on this device. Keep your current recovery file before continuing.", "%@\n\n這會取代目前沒有圈子的身分與光暈成長。私人日記及設定保留在此裝置。繼續前請保留目前的恢復檔。", "%@\n\n現在のサークルがないIDとオーラの成長を置き換えます。個人の日記と設定はこの端末に残ります。続ける前に現在の復元ファイルを保管してください。")
        case .confirm: return ("Restore identity", "恢復身分", "IDを復元")
        case .skipped: return ("%d circles are no longer accessible and will not be restored.", "%d 個圈子已無法存取，將不會恢復。", "%d件のサークルにはアクセスできないため復元されません。")
        case .snapshot: return ("%d accessible circles", "%d 個可存取的圈子", "アクセスできるサークル %d件")
        case .startup: return ("World is keeping your recovery safe. Unlock this device and retry to finish the interrupted restore. Your private journal remains on this device.", "World 正在保護你的恢復資料。請解鎖裝置並重試，以完成中斷的恢復。私人日記仍留在此裝置。", "Worldは復元データを安全に保持しています。端末を解除して再試行し、中断された復元を完了してください。個人の日記はこの端末に残っています。")
        case .retry: return ("Retry recovery", "重試恢復", "復元を再試行")
        }
    }
}
extension WorldStrings {
    func recovery(_ key: WorldRecoveryCopy) -> String {
        let copy = key.translations
        switch language { case .english:return copy.0; case .traditionalChinese:return copy.1; case .japanese:return copy.2 }
    }
    func recoveryCount(_ key: WorldRecoveryCopy, _ count: Int) -> String { String(format:recovery(key),locale:language.locale,count) }
}
