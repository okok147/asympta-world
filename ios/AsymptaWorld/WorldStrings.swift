import UIKit

enum WorldLanguage: String, Codable, CaseIterable {
    case english = "en"
    case traditionalChinese = "zh-Hant"
    case japanese = "ja"

    static var deviceDefault: WorldLanguage {
        let value = Locale.preferredLanguages.first ?? "en"
        if value.hasPrefix("zh") { return .traditionalChinese }
        if value.hasPrefix("ja") { return .japanese }
        return .english
    }

    var displayName: String {
        switch self {
        case .english: return "English"
        case .traditionalChinese: return "繁體中文"
        case .japanese: return "日本語"
        }
    }

    var locale: Locale { Locale(identifier: rawValue) }
    fileprivate var index: Int {
        switch self { case .english: return 0; case .traditionalChinese: return 1; case .japanese: return 2 }
    }
}

struct WorldStrings {
    enum Key: String {
        case world, meet, aura, me, overview, close, openMenu, closeMenu, mapHint
        case meetTitle, meetSubtitle, readerName, readerDetail, foxName, foxDetail
        case teaName, teaDetail, catName, catDetail, bearName, bearDetail
        case favorite, favorited, visit, auraTitle, auraSubtitle, gentle, gentleDetail
        case curious, curiousDetail, restful, restfulDetail, meTitle, nickname
        case nicknamePlaceholder, language, motion, motionDetail, journal, journalEmpty
        case addNote, editNote, newNote, notePlaceholder, save, cancel, delete
        case deleteNoteTitle, deleteNoteMessage, localOnly, saved, saveErrorTitle
        case saveErrorDetail, loadErrorDetail, artMissingTitle, artMissingDetail
        case retry, favoriteCount, noteCount, notNow, localWorld
    }

    let language: WorldLanguage

    subscript(_ key: Key) -> String {
        Self.copy[key]?[language.index] ?? key.rawValue
    }

    func date(_ value: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = language.locale
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: value)
    }

    private static let copy: [Key: [String]] = [
        .world: ["World", "世界", "世界"],
        .meet: ["Meet", "相遇", "出会い"],
        .aura: ["Aura", "氛圍", "雰囲気"],
        .me: ["Me", "我", "わたし"],
        .overview: ["See the whole world", "看看整個世界", "世界を見渡す"],
        .close: ["Close", "關閉", "閉じる"],
        .openMenu: ["Open your paper menu", "打開紙片選單", "紙のメニューを開く"],
        .closeMenu: ["Fold the paper menu", "收起紙片選單", "紙のメニューを閉じる"],
        .mapHint: ["A little world, at your own pace.", "一個小世界，照自己的步調走。", "自分のペースで、小さな世界を。"],
        .meetTitle: ["Small encounters", "小小的相遇", "小さな出会い"],
        .meetSubtitle: ["A few quiet companions to find along the way.", "沿路走走，認識幾位安靜的旅伴。", "道の途中で、静かな仲間を見つけよう。"],
        .readerName: ["The little reader", "小小讀書人", "小さな読書家"],
        .readerDetail: ["One more page, then perhaps a wander. A quiet corner is a world of its own.", "再讀一頁，也許就去散步。一個安靜的角落，也是自己的小世界。", "あと一ページ読んだら、お散歩へ。静かな片隅にも、ひとつの世界がある。"],
        .foxName: ["The curious explorer", "好奇的探險家", "好奇心いっぱいの探検家"],
        .foxDetail: ["A small backpack, a winding path, and no need to hurry.", "背著小背包，沿著彎彎的小路，不必趕時間。", "小さなリュックと曲がり道。急がなくても大丈夫。"],
        .teaName: ["The tea-time friends", "茶桌旁的朋友", "お茶の時間の友だち"],
        .teaDetail: ["There is always room for a pause, a warm cup, and a friend.", "停一停，喝杯暖茶，留一點時間給朋友。", "ひと休みと温かい一杯。友だちと過ごす時間を少し。"],
        .catName: ["The cloud-soft cat", "睡得軟綿綿的貓", "雲みたいに眠るねこ"],
        .catDetail: ["Today, a patch of shade is quite enough. Rest is part of the journey.", "今天，有一小片樹蔭就很好。休息，也是旅程的一部分。", "今日は木陰が少しあれば十分。休むことも、旅の一部。"],
        .bearName: ["The gentle traveler", "慢慢走的旅人", "やさしい旅人"],
        .bearDetail: ["Collecting little moments, one unhurried step at a time.", "一步一步慢慢走，收集沿路的小片刻。", "ゆっくり一歩ずつ、小さなひとときを集めている。"],
        .favorite: ["Keep close", "放在心上", "お気に入りに"],
        .favorited: ["Kept close", "已放在心上", "お気に入り"],
        .visit: ["Find on the map", "到地圖上看看", "地図で会う"],
        .auraTitle: ["How does today feel?", "今天，想要甚麼感覺？", "今日は、どんな気分？"],
        .auraSubtitle: ["A small change in light, just for your world.", "換一點光，讓小世界陪你。", "光を少し変えて、自分だけの世界に。"],
        .gentle: ["Gentle", "柔和", "やさしく"],
        .gentleDetail: ["Warm paper, soft sunlight.", "暖暖的紙，柔柔的日光。", "温かい紙と、やわらかな日差し。"],
        .curious: ["Curious", "好奇", "好奇心"],
        .curiousDetail: ["A fresh morning for a little exploring.", "清新的早晨，適合四處走走。", "少し探検したくなる、さわやかな朝。"],
        .restful: ["Restful", "靜好", "おだやか"],
        .restfulDetail: ["A quieter light for slowing down.", "把光放輕，慢下來。", "静かな光で、少しゆっくり。"],
        .meTitle: ["Your little corner", "你的小角落", "あなたの小さな場所"],
        .nickname: ["What shall we call you?", "怎樣稱呼你？", "なんと呼びましょう？"],
        .nicknamePlaceholder: ["Your name", "你的名字", "あなたの名前"],
        .language: ["Language", "語言", "言語"],
        .motion: ["Gentle movement", "輕輕地動", "やさしい動き"],
        .motionDetail: ["The world rests when Reduce Motion is on.", "開啟系統「減少動態效果」時，世界會安靜下來。", "システムの「視差効果を減らす」がオンのときは、世界も静かになります。"],
        .journal: ["Little notes", "小小筆記", "小さなノート"],
        .journalEmpty: ["Something worth keeping from today?", "今天，有甚麼想留下來？", "今日、残しておきたいことは？"],
        .addNote: ["Write a little note", "寫一張小筆記", "小さなノートを書く"],
        .editNote: ["Edit note", "編輯筆記", "ノートを編集"],
        .newNote: ["A moment to keep", "留下一個片刻", "残しておきたいひととき"],
        .notePlaceholder: ["A thought, a small joy, a place you would like to go…", "一個念頭、一點小開心，或一個想去的地方……", "ふと思ったこと、小さな喜び、行ってみたい場所…"],
        .save: ["Keep this note", "留下這張筆記", "このノートを残す"],
        .cancel: ["Cancel", "取消", "キャンセル"],
        .delete: ["Delete", "刪除", "削除"],
        .deleteNoteTitle: ["Let this note go?", "要放下這張筆記嗎？", "このノートを手放しますか？"],
        .deleteNoteMessage: ["This removes it from this device.", "這會從此裝置刪除這張筆記。", "この端末からノートを削除します。"],
        .localOnly: ["Your notes and choices are saved on this device.", "你的筆記與選擇，儲存在此裝置。", "ノートと設定は、この端末に保存されます。"],
        .saved: ["Kept safely on this device.", "已留在此裝置。", "この端末に保存しました。"],
        .saveErrorTitle: ["Could not save yet", "暫時未能儲存", "まだ保存できませんでした"],
        .saveErrorDetail: ["Your changes are still here. Please try saving again.", "剛才的內容仍在這裏，請再試一次。", "変更内容はまだここにあります。もう一度保存してください。"],
        .loadErrorDetail: ["Saved data could not be opened. It has been kept unchanged.", "暫時未能開啟已儲存的資料，原有檔案已保留。", "保存済みデータを開けませんでした。元のファイルはそのまま残しています。"],
        .artMissingTitle: ["The world needs a moment", "小世界需要一點時間", "世界が開くまで、もう少し"],
        .artMissingDetail: ["The bundled artwork could not be opened. Please reopen the app.", "未能開啟 App 內的圖畫，請重新開啟 App。", "App の中の絵を開けませんでした。App を開き直してください。"],
        .retry: ["Try again", "再試一次", "もう一度"],
        .favoriteCount: ["Companions kept close", "放在心上的旅伴", "お気に入りの仲間"],
        .noteCount: ["Moments kept", "留下的片刻", "残したひととき"],
        .notNow: ["Not now", "暫時不用", "今はしない"],
        .localWorld: ["An illustrated world, here on your device.", "一個畫出來的小世界，就在你的裝置裏。", "この端末の中にある、絵でできた小さな世界。"],
    ]
}

enum WorldTheme {
    static let paper = UIColor(red: 0.978, green: 0.961, blue: 0.925, alpha: 1)
    static let ink = UIColor(red: 0.39, green: 0.32, blue: 0.27, alpha: 1)
    static let muted = UIColor(red: 0.48, green: 0.43, blue: 0.36, alpha: 1)
    static let leaf = UIColor(red: 0.45, green: 0.53, blue: 0.37, alpha: 1)
    static let line = UIColor(red: 0.70, green: 0.62, blue: 0.51, alpha: 0.25)

    static func font(_ style: UIFont.TextStyle = .body, handwritten: Bool = false) -> UIFont {
        let base = UIFont.preferredFont(forTextStyle: style)
        if handwritten {
            let unscaled = UIFont.preferredFont(forTextStyle: style,
                                                compatibleWith: UITraitCollection(preferredContentSizeCategory: .large))
            if let note = UIFont(name: "Noteworthy-Light", size: unscaled.pointSize) {
                return UIFontMetrics(forTextStyle: style).scaledFont(for: note)
            }
        }
        if let serif = base.fontDescriptor.withDesign(.serif) { return UIFont(descriptor: serif, size: 0) }
        return base
    }

    static func label(_ text: String, style: UIFont.TextStyle = .body, muted: Bool = false) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = font(style)
        label.textColor = muted ? self.muted : ink
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }

    static func button(_ title: String, symbol: String? = nil, filled: Bool = false) -> UIButton {
        var configuration = filled ? UIButton.Configuration.filled() : .plain()
        configuration.title = title
        if let symbol { configuration.image = UIImage(systemName: symbol) }
        configuration.imagePadding = 9
        configuration.baseForegroundColor = filled ? paper : ink
        configuration.baseBackgroundColor = filled ? leaf : .clear
        configuration.cornerStyle = .medium
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)
        let button = UIButton(configuration: configuration)
        button.titleLabel?.font = font(.body)
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        button.accessibilityTraits.insert(.button)
        return button
    }
}
