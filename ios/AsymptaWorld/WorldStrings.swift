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
        case circleReportDetail, circleReportHarassment, circleReportSpam, circleReportPrivacy, circleReportOther
        case circleEarlierMoments, circleResumeDraft
        case circleStyle, circleStyleDetail, circleInkClay, circleInkClayNote
        case circleInkSaffron, circleInkSaffronNote, circleInkTide, circleInkTideNote
        case circleInkDusk, circleInkDuskNote
        case circleManageMembers, circleRemoveMember, circleRemoveMemberDetail, circleNoOtherMembers
        case circleNewInvite, circleNewInviteDetail, circleDepartedMember
        case circles, circleHomeTitle, circleHomeDetail, circleCreate, circleJoin
        case circleTitle, circleNameHint, circleCode, circlePrivate, circleCreateDetail
        case circleJoinDetail, circleInvite, circleInviteDetail, circleShareCode, circleShareMoment
        case circleAllMoments, circleThisArea, circleActivity, circleActivityEmpty, circleEmptyTitle
        case circleInbox, circleInboxDetail, circleInboxLoading, circleInboxPartial, circleInboxEmpty, circleInboxRecent
        case circleInboxUnreadFormat, circleInboxUnreadMoreFormat
        case circleEmptyDetail, circleAreaEmpty, circlePhoto, circleArea, circleRefresh
        case circleLoading, circleOptions, circleLeave, circleLeaveDetail, circleReports
        case circleReportsEmpty, circleReportKeep, circleReportRemove, circleReportRemoveDetail, circleBlocked
        case circleBlockedEmpty, circleUnblock, circleInvalidCode, circleUnavailable, circleSlowDown
        case circleFull, circleFiltered, circlePhotoError, circleCheckFields, circleNetworkError
        case circleMembersFormat, circleRepliesFormat, circleReactionsFormat, circleReportCountFormat, circleAreaCountFormat
        case circleBeta
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
        .circleReportDetail: ["Review report", "審閱檢舉", "通報を確認"],
        .circleReportHarassment: ["Harassment", "騷擾", "嫌がらせ"],
        .circleReportSpam: ["Spam", "垃圾訊息", "スパム"],
        .circleReportPrivacy: ["Privacy", "隱私問題", "プライバシー"],
        .circleReportOther: ["Other reason", "其他原因", "その他の理由"],
        .circleResumeDraft: ["Resume draft", "繼續編寫草稿", "下書きを続ける"],
        .circleEarlierMoments: ["Show earlier moments", "顯示較早的時刻", "以前の投稿を表示"],
        .circleStyle: ["Your circle seal", "你的圈子印記", "あなたのサークル印"],
        .circleStyleDetail: ["Choose the ink that appears beside your moments and replies in this circle.", "選擇你在這個圈子的貼文與回應旁所用的印記。", "このサークルの投稿や返信の横に表示する印を選びます。"],
        .circleInkClay: ["Fired Clay", "燒陶", "焼き土"],
        .circleInkClayNote: ["Hand-cut lines in a warm earthen wash.", "暖土色暈染裡的手刻紋路。", "温かい土色に、手彫りの線。"],
        .circleInkSaffron: ["Saffron Sun", "藏紅日", "サフランの太陽"],
        .circleInkSaffronNote: ["Engraved sunlight on honey paper.", "蜜色紙上刻出的陽光。", "蜜色の紙に刻んだ陽の光。"],
        .circleInkTide: ["Blue Tide", "藍潮", "青い潮"],
        .circleInkTideNote: ["Blue ink gathering in quiet currents.", "藍墨聚成平靜的水流。", "青いインクが静かな流れを描きます。"],
        .circleInkDusk: ["Paper Moon", "紙月", "紙の月"],
        .circleInkDuskNote: ["Violet dusk, a crescent and two small stars.", "紫暮裡的一彎月與兩顆小星。", "紫の夕暮れ、三日月と二つの小さな星。"],
        .circleManageMembers: ["Manage members", "管理成員", "メンバー管理"],
        .circleRemoveMember: ["Remove member", "移除成員", "メンバーを削除"],
        .circleRemoveMemberDetail: ["Their moments and replies will be removed from this circle, and the previous invitation will stop working.", "對方在這個圈子的時刻與回應會被移除，舊邀請碼也會失效。", "このサークルでの投稿と返信が削除され、以前の招待コードは無効になります。"],
        .circleNoOtherMembers: ["Only you are in this circle right now.", "這個圈子目前只有你。", "現在このサークルにはあなたのみが参加しています。"],
        .circleNewInvite: ["Replace invitation", "更新邀請碼", "招待コードを更新"],
        .circleNewInviteDetail: ["People will need the new code to join. Existing members stay in the circle.", "新成員需要使用新的邀請碼加入。現有成員會留在圈子裡。", "新しい参加者には更新後のコードが必要です。現在のメンバーは引き続き参加できます。"],
        .circleDepartedMember: ["Former member", "已離開的成員", "退出したメンバー"],
        .circles: ["Circles", "圈子", "サークル"],
        .circleHomeTitle: ["A world you share", "你們共享的世界", "分かち合う世界"],
        .circleHomeDetail: ["Leave little moments for the people you invite. Each circle has its own quiet space.", "把生活裡的一刻留給你邀請的人。每個圈子都有自己的空間。", "招待した人に、小さなひとときを残しましょう。サークルごとに専用の場所があります。"],
        .circleCreate: ["Start a circle", "建立圈子", "サークルを作る"],
        .circleJoin: ["Join with a code", "用邀請碼加入", "コードで参加"],
        .circleTitle: ["Circle name", "圈子名稱", "サークル名"],
        .circleNameHint: ["Your name in this circle", "你在這個圈子的名字", "このサークルでの名前"],
        .circleCode: ["Invitation code", "邀請碼", "招待コード"],
        .circlePrivate: ["Invitation only", "僅限受邀者", "招待制"],
        .circleCreateDetail: ["Choose a name for the place and the name people will see on your posts.", "替這個地方取名，並選擇成員會在貼文上看到的名字。", "場所の名前と、投稿に表示するあなたの名前を決めましょう。"],
        .circleJoinDetail: ["Paste the code someone shared with you and choose your display name.", "貼上對方給你的邀請碼，並選擇你的顯示名稱。", "受け取った招待コードを貼り付け、表示名を決めましょう。"],
        .circleInvite: ["Invite someone", "邀請成員", "メンバーを招待"],
        .circleInviteDetail: ["Anyone with this code can join the circle. Share it with people you want to invite.", "持有此邀請碼的人可以加入圈子。請只分享給你想邀請的人。", "このコードを持つ人は参加できます。招待したい人にだけ共有してください。"],
        .circleShareCode: ["Share invitation", "分享邀請", "招待を共有"],
        .circleShareMoment: ["Share a moment", "分享一刻", "ひとときを共有"],
        .circleAllMoments: ["All moments", "全部時刻", "すべて"],
        .circleThisArea: ["This area", "這個區域", "このエリア"],
        .circleActivity: ["Replies to you", "給你的回應", "あなたへの返信"],
        .circleActivityEmpty: ["New replies to your moments will appear here.", "你分享的時刻收到新回應時，會在這裡出現。", "あなたの投稿への新しい返信はここに表示されます。"],
        .circleInbox: ["Reply inbox", "回應收件匣", "返信ボックス"],
        .circleInboxDetail: ["New replies to your moments, from all your circles. Tap one to open the conversation.", "各個圈子給你的新回應都在這裡。點一下就能回到原貼文。", "参加しているサークルからの新着返信です。タップすると元の投稿を開けます。"],
        .circleInboxLoading: ["Looking for new replies…", "正在查看新回應⋯", "新着返信を確認しています…"],
        .circleInboxPartial: ["Some circles could not be checked. Try again to see their latest replies.", "暫時無法查看部分圈子。再試一次即可重新載入。", "一部のサークルを確認できませんでした。もう一度お試しください。"],
        .circleInboxEmpty: ["You’re caught up. New replies will appear here.", "你已看完目前的回應。有新回應時，這裡會更新。", "未読の返信はありません。新しい返信はここに表示されます。"],
        .circleInboxRecent: ["Showing recent unread replies. Older replies appear as you read.", "目前顯示較新的未讀回應。讀過之後，較早的回應會接著出現。", "新しい未読返信を表示しています。読むと古い返信が順に表示されます。"],
        .circleInboxUnreadFormat: ["Unread replies: %d", "未讀回應 %d 則", "未読の返信 %d 件"],
        .circleInboxUnreadMoreFormat: ["Unread replies: %d or more", "未讀回應至少 %d 則", "未読の返信 %d 件以上"],
        .circleEmptyTitle: ["The first page is yours", "第一頁，由你開始", "最初のページはあなたから"],
        .circleEmptyDetail: ["A small thing you noticed today is enough. A few words or one photo can start a conversation.", "今天留意到的一件小事就夠了。一句話或一張照片，都可以開始一段對話。", "今日気づいた小さなことで十分です。短い言葉や写真一枚が会話のきっかけになります。"],
        .circleAreaEmpty: ["There are no moments from this map area yet.", "這個地圖區域還沒有分享的時刻。", "この地図エリアにはまだ投稿がありません。"],
        .circlePhoto: ["Photo", "照片", "写真"],
        .circleArea: ["Approximate map area", "約略地圖區域", "おおよその地図エリア"],
        .circleRefresh: ["Refresh", "重新整理", "更新"],
        .circleLoading: ["Opening the circle…", "正在打開圈子⋯", "サークルを開いています…"],
        .circleOptions: ["Circle options", "圈子選項", "サークルの設定"],
        .circleLeave: ["Leave circle", "離開圈子", "サークルから退出"],
        .circleLeaveDetail: ["Your moments and replies in this circle will be removed. You can return with a valid invitation.", "你在此圈子的時刻與回應會被移除。之後仍可用有效邀請加入。", "このサークルでの投稿と返信は削除されます。有効な招待があれば再参加できます。"],
        .circleReports: ["Reports", "檢舉", "通報"],
        .circleReportsEmpty: ["There are no open reports in this circle.", "這個圈子暫無待處理檢舉。", "このサークルに未対応の通報はありません。"],
        .circleReportKeep: ["Keep contribution", "保留這則內容", "内容を残す"],
        .circleReportRemove: ["Remove contribution", "移除這則內容", "内容を削除"],
        .circleReportRemoveDetail: ["This will remove the contribution from the circle for everyone.", "這則內容會從所有成員的圈子中移除。", "この内容はすべてのメンバーから見えなくなります。"],
        .circleBlocked: ["Blocked people", "已封鎖的人", "ブロックした人"],
        .circleBlockedEmpty: ["You have not blocked anyone in this circle.", "你尚未在這個圈子封鎖任何人。", "このサークルでブロックした人はいません。"],
        .circleUnblock: ["Unblock", "解除封鎖", "ブロックを解除"],
        .circleInvalidCode: ["This invitation code is invalid or no longer active.", "這個邀請碼無效或已失效。", "この招待コードは無効か、期限切れです。"],
        .circleUnavailable: ["This circle or moment is no longer available to you.", "你目前無法查看這個圈子或時刻。", "このサークルまたは投稿は表示できません。"],
        .circleSlowDown: ["Please wait a moment and try again.", "請稍等片刻再試。", "少し待ってからもう一度お試しください。"],
        .circleFull: ["This circle has reached its current limit.", "這個圈子已達目前上限。", "このサークルは現在の上限に達しています。"],
        .circleFiltered: ["This text cannot be shared. Please revise it and try again.", "這段文字無法分享。請修改後再試。", "この文章は共有できません。書き直してお試しください。"],
        .circlePhotoError: ["This photo could not be prepared. Please choose another.", "無法準備這張照片，請選擇另一張。", "この写真を準備できませんでした。別の写真を選んでください。"],
        .circleCheckFields: ["Check your text and try again.", "請檢查輸入的文字，再試一次。", "入力した内容を確認し、もう一度お試しください。"],
        .circleNetworkError: ["The circle could not connect. You can try again.", "暫時無法連接圈子，你可以再試一次。", "サークルに接続できませんでした。もう一度お試しください。"],
        .circleMembersFormat: ["%d members", "%d 位成員", "メンバー %d 人"],
        .circleRepliesFormat: ["%d replies", "%d 則回應", "返信 %d 件"],
        .circleReactionsFormat: ["%d acknowledgements", "%d 次致意", "リアクション %d 件"],
        .circleReportCountFormat: ["%d reports", "%d 則檢舉", "通報 %d 件"],
        .circleAreaCountFormat: ["%d moments in this area", "這個區域有 %d 則時刻", "このエリアに %d 件"],
        .circleBeta: ["Private beta", "私人測試版", "プライベートベータ"],
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
