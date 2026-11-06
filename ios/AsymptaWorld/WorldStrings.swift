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
        case chooseAura, growthCloudSaved, nearbyAtlas, localAtlas, atlasMode, exploreLocalAtlas
        case nearbyAura, approximateAura, livePresenceDetail, locationMapTitle, locationMapDetail, useLocation, locationDenied, openSettings, mapLoading, mapUnavailable, mapAttribution, cloudConnected, cloudOffline, growthStored
        case yourLight, returnToLight, personalCorner, auraProfile, specialty, abilityLevel, developingAbility
        case light, activityExplore, activityLearn, activityCreate, activityConnect, activityRest
        case activityTravelling, activityDoing, activityWaiting, activitySnapshot, simulationDetail, energy, completedActivities, ideas, activityProgress
        case exploreDetail, learnDetail, createDetail, connectDetail, restDetail
        case home, explore, friends
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
        case zoomIn, zoomOut, recenter, glimmerField, inkBank, slowHill, seaEdge, eveningWay, paperRiver, littlePath, farAway
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
        .nearbyAtlas: ["Nearby map", "附近地圖", "近くの地図"],
        .localAtlas: ["Local world", "本機世界", "端末内の世界"],
        .atlasMode: ["Choose a world", "選擇世界", "世界を選ぶ"],
        .exploreLocalAtlas: ["Explore the local world", "探索本機世界", "端末内の世界を探索"],
        .chooseAura: ["Choose an aura", "選擇一個光暈", "オーラを選ぶ"],
        .growthCloudSaved: ["Your growth is synchronized.", "你的成長已同步。", "成長を同期しました。"],
        .nearbyAura: ["Nearby aura", "附近的光暈", "近くのオーラ"],
        .approximateAura: ["A broad approximate area, not an exact location.", "這是一片約略範圍，不是精確位置。", "正確な位置ではなく、おおよその広い範囲です。"],
        .livePresenceDetail: ["A connected device nearby. Abilities reflect its local world activities.", "附近已連線裝置的光暈；能力來自該裝置的世界活動。", "近くで接続中の端末のオーラ。力はその端末内の活動から育ちます。"],
        .locationMapTitle: ["A sketch of where you are", "把所在地，輕輕畫下來", "今いる場所を、スケッチに"],
        .locationMapDetail: ["Allow location to sketch real nearby roads and important buildings. Only a broad, fluffy aura area is shared with nearby devices.", "允許定位，描繪附近真實道路與重要建築。其他裝置只會看見一片寬鬆、毛絨絨的光暈範圍。", "位置情報を許可すると、近くの実際の道と主な建物を描きます。ほかの端末には、ふわふわした広い範囲だけが見えます。"],
        .useLocation: ["Sketch my surroundings", "畫出我的周圍", "周りを描く"],
        .locationDenied: ["Location is off. Your local light world is still here.", "定位尚未開啟；裝置上的光點世界仍可使用。", "位置情報はオフです。端末内のひかりの世界は使えます。"],
        .openSettings: ["Location settings", "定位設定", "位置情報の設定"],
        .mapLoading: ["Sketching nearby roads and buildings…", "正在描繪附近的道路與建築⋯", "近くの道と建物を描いています…"],
        .mapUnavailable: ["The nearby sketch is unavailable. Try again when connected.", "暫時未能載入附近地圖，連線後可再試一次。", "周辺の地図を読み込めません。接続後にもう一度お試しください。"],
        .mapAttribution: ["© OpenStreetMap contributors", "© OpenStreetMap 貢獻者", "© OpenStreetMap の貢献者"],
        .cloudConnected: ["Nearby connection active", "已連接附近的世界", "近くの世界に接続中"],
        .cloudOffline: ["Nearby connection unavailable", "附近連線尚未就緒", "近くの世界には未接続です"],
        .growthStored: ["Your growth is kept on this device and synchronized when connected.", "你的成長保留在裝置上，連線時同步。", "成長はこの端末に保存され、接続時に同期します。"],
        .yourLight: ["Your light", "你的光點", "あなたのひかり"],
        .returnToLight: ["Return to your light", "回到你的光點", "自分のひかりに戻る"],
        .personalCorner: ["Your space", "你的小角落", "自分の場所"],
        .auraProfile: ["Aura profile", "光暈能力", "オーラの力"],
        .specialty: ["Strongest ability", "最擅長", "得意な力"],
        .abilityLevel: ["Level", "等級", "レベル"],
        .developingAbility: ["Your abilities grow as activities unfold.", "能力隨著一次次活動慢慢成長。", "活動を重ねると、少しずつ力が育ちます。"],
        .light: ["Light", "光點", "ひかり"],
        .activityExplore: ["Exploring", "探索", "探索"],
        .activityLearn: ["Learning", "學習", "学び"],
        .activityCreate: ["Creating", "創作", "創作"],
        .activityConnect: ["Meeting", "相遇", "交流"],
        .activityRest: ["Resting", "休息", "休息"],
        .activityTravelling: ["On the way", "正在前往", "移動中"],
        .activityDoing: ["Here for a while", "正在停留", "滞在中"],
        .activityWaiting: ["Waiting for a friend", "等候另一個光點", "仲間を待っています"],
        .activitySnapshot: ["A moment, while you look", "打開時的這一刻", "開いた瞬間のようす"],
        .simulationDetail: ["Activities unfold in a local simulation on this device.", "這個世界的活動在裝置上模擬。", "この端末の中で活動をシミュレーションしています。"],
        .energy: ["Simulated energy", "模擬能量", "シミュレーションのエネルギー"],
        .completedActivities: ["Activities completed", "已完成的活動", "完了した活動"],
        .ideas: ["Ideas gathered", "收集的靈感", "集めたアイデア"],
        .activityProgress: ["Progress", "進度", "進み具合"],
        .exploreDetail: ["Wandering to a new place, then choosing what comes next.", "前往新的地方，停一停，再選擇下一項活動。", "新しい場所へ向かい、ひと休みして次の活動を選びます。"],
        .learnDetail: ["Joining a quiet learning circle and gathering an idea.", "走到學習聚落，停留並收集一點靈感。", "学びの集まりに向かい、アイデアをひとつ集めます。"],
        .createDetail: ["Gathering near other makers and shaping a new idea.", "靠近其他創作中的光點，停留並產生新靈感。", "創作する仲間の近くで、新しいアイデアを形にします。"],
        .connectDetail: ["Approaching a waiting friend, spending time together and sharing ideas.", "前往等候中的光點，相聚一會，交換靈感後再出發。", "待っている仲間のもとへ行き、アイデアを分かち合って再び出発します。"],
        .restDetail: ["Finding a nearby quiet spot and restoring energy before moving on.", "找附近安靜的位置休息，恢復能量後再出發。", "近くの静かな場所でエネルギーを回復し、再び出発します。"],
        .home: ["Home", "小屋", "ホーム"],
        .explore: ["Explore", "探索", "探索"],
        .friends: ["Friends", "朋友", "仲間"],
        .zoomIn: ["Zoom in", "放大地圖", "地図を拡大"],
        .zoomOut: ["Zoom out", "縮小地圖", "地図を縮小"],
        .recenter: ["Return to your world", "回到你的小世界", "自分の世界に戻る"],
        .glimmerField: ["Glimmer Field", "微光原", "ほの光の原"],
        .inkBank: ["Ink Bank", "墨岸", "墨の岸"],
        .slowHill: ["Slow Hill", "慢慢丘", "ゆっくり丘"],
        .seaEdge: ["By the Sea", "海的邊緣", "海のほとり"],
        .eveningWay: ["Evening Way", "晚風道", "夕風の道"],
        .paperRiver: ["Paper River", "紙河", "紙の川"],
        .littlePath: ["Little Path", "小路", "小道"],
        .farAway: ["Far Away", "遠方", "遠く"],
        .world: ["World", "世界", "世界"],
        .meet: ["Meet", "相遇", "出会い"],
        .aura: ["Aura", "氛圍", "雰囲気"],
        .me: ["Me", "我", "わたし"],
        .overview: ["See the whole world", "看看整個世界", "世界を見渡す"],
        .close: ["Close", "關閉", "閉じる"],
        .openMenu: ["Open your paper menu", "打開紙片選單", "紙のメニューを開く"],
        .closeMenu: ["Fold the paper menu", "收起紙片選單", "紙のメニューを閉じる"],
        .mapHint: ["A little world, at your own pace.", "一個小世界，照自己的步調走。", "自分のペースで、小さな世界を。"],
        .meetTitle: ["Familiar lights", "熟悉的光點", "なじみの光"],
        .meetSubtitle: ["Keep a few familiar lights close as the world unfolds.", "世界流動的時候，留幾個熟悉的光點在心上。", "流れる世界の中で、なじみの光をそばに。"],
        .readerName: ["Light 01", "光點 01", "ひかり 01"],
        .readerDetail: ["A familiar light in your simulated world. Find it on the paper to see its activity.", "小世界裏熟悉的光點，到紙面上看看它正在做甚麼。", "小さな世界のなじみの光。紙の上で、今の活動を見てみましょう。"],
        .foxName: ["Light 02", "光點 02", "ひかり 02"],
        .foxDetail: ["A familiar light in your simulated world. Find it on the paper to see its activity.", "小世界裏熟悉的光點，到紙面上看看它正在做甚麼。", "小さな世界のなじみの光。紙の上で、今の活動を見てみましょう。"],
        .teaName: ["Light 03", "光點 03", "ひかり 03"],
        .teaDetail: ["A familiar light in your simulated world. Find it on the paper to see its activity.", "小世界裏熟悉的光點，到紙面上看看它正在做甚麼。", "小さな世界のなじみの光。紙の上で、今の活動を見てみましょう。"],
        .catName: ["Light 04", "光點 04", "ひかり 04"],
        .catDetail: ["A familiar light in your simulated world. Find it on the paper to see its activity.", "小世界裏熟悉的光點，到紙面上看看它正在做甚麼。", "小さな世界のなじみの光。紙の上で、今の活動を見てみましょう。"],
        .bearName: ["Light 05", "光點 05", "ひかり 05"],
        .bearDetail: ["A familiar light in your simulated world. Find it on the paper to see its activity.", "小世界裏熟悉的光點，到紙面上看看它正在做甚麼。", "小さな世界のなじみの光。紙の上で、今の活動を見てみましょう。"],
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
    static let blue = UIColor(hex: 0x7296aa)
    static let coral = UIColor(hex: 0xdca37b)
    static let straw = UIColor(hex: 0xe5bd79)
    static let paper = UIColor(hex: 0xf7efdf)
    static let mapPaper = UIColor(hex: 0xefe2cb)
    static let ink = UIColor(hex: 0x312923)
    static let muted = UIColor(hex: 0x65574b)
    static let leaf = UIColor(hex: 0xb5a57c)
    static let line = UIColor(hex: 0xd9c9b1)

    static func font(_ style: UIFont.TextStyle = .body, handwritten: Bool = false) -> UIFont {
        let sizes: [UIFont.TextStyle: CGFloat] = [.largeTitle:30,.title1:27,.title2:23,.title3:20,.headline:14,.body:14,.callout:13,.subheadline:12,.footnote:11,.caption1:10,.caption2:9]
        let size = sizes[style] ?? 14
        let base = UIFont(name:"AmericanTypewriter",size:size) ?? UIFont.monospacedSystemFont(ofSize:size,weight:style == .headline ? .semibold : .regular)
        return UIFontMetrics(forTextStyle:style).scaledFont(for:base)
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

    static func closeItem(title: String, target: Any, action: Selector) -> UIBarButtonItem {
        // A custom native control avoids OS-specific prominent Done styling.
        let close = UIButton(type: .custom)
        close.frame = CGRect(x:0,y:0,width:44,height:44)
        close.setImage(UIImage(systemName:"xmark",withConfiguration:UIImage.SymbolConfiguration(pointSize:14,weight:.light)),for:.normal)
        close.tintColor = ink
        close.backgroundColor = paper
        close.layer.borderColor = line.cgColor
        close.layer.borderWidth = 0.7
        close.layer.cornerRadius = 22
        close.accessibilityLabel = title
        close.accessibilityIdentifier = "world.panel.close"
        close.addTarget(target,action:action,for:.touchUpInside)
        close.widthAnchor.constraint(equalToConstant:44).isActive = true
        close.heightAnchor.constraint(equalToConstant:44).isActive = true
        let item = UIBarButtonItem(customView:close)
        if #available(iOS 26.0, *) { item.hidesSharedBackground = true }
        return item
    }

    static func button(_ title: String, symbol: String? = nil, filled: Bool = false) -> UIButton {
        var configuration = filled ? UIButton.Configuration.filled() : .plain()
        configuration.title = title
        if let symbol { configuration.image = UIImage(systemName: symbol) }
        configuration.imagePadding = 9
        configuration.baseForegroundColor = filled ? paper : ink
        configuration.baseBackgroundColor = filled ? ink : .clear
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

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red:CGFloat((hex >> 16) & 255)/255,green:CGFloat((hex >> 8) & 255)/255,blue:CGFloat(hex & 255)/255,alpha:1)
    }
}
