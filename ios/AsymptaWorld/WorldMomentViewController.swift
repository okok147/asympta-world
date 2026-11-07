import UIKit
import PhotosUI
import ImageIO
import UniformTypeIdentifiers

private enum MomentCopy {
    case compose, writing, composerHint, audience, area, areaHint, areaUnavailable, areaPrivate, areaShared, areaChanged, earlierSendAreaChanged
    case addPhoto, replacePhoto, removePhoto, photoLabel, photoDescription, photoDescriptionHint, photoLoading, photoFailed
    case share, sharing, retryShare, retryReply, retryHint, discard, discardPrompt, discardPending, draftRestored, draftUnreadable, draftSaveFailed, keepDraft, closeDraft
    case moment, loading, replySection, noReplies, replyHint, reply, replying, acknowledge, acknowledged
    case options, report, reportDetail, reported, block, blockDetail, blocked, remove, removeDetail, removed, photoUnavailable

    var translations: (String, String, String) {
        switch self {
        case .compose: return ("New moment", "分享一刻", "新しいひととき")
        case .writing: return ("Leave a moment", "留下一刻", "ひとときを残す")
        case .composerHint: return ("A small thing worth passing along.", "把想傳給朋友的小事留下來。", "誰かに届けたい、小さな出来事。")
        case .audience: return ("Only members of %@ can see this.", "只有「%@」的成員能看見這則貼文。", "「%@」のメンバーだけが見られます。")
        case .area: return ("Include this map area", "附上此地圖區域", "この地図エリアを添える")
        case .areaHint: return ("Adds the broad area currently on your map. Your exact position stays on this device.", "附上目前地圖的大致區域。你的精確位置保留在裝置上。", "現在の地図のおおよその範囲を添えます。正確な位置はこの端末に残ります。")
        case .areaChanged: return ("The map area changed. Turn on the switch again to include the new area.", "地圖區域已變更。若要附上新的區域，請重新開啟開關。", "地図エリアが変わりました。新しいエリアを添える場合は再度スイッチをオンにしてください。")
        case .earlierSendAreaChanged: return ("This draft’s earlier send is unconfirmed and the map area has changed. Check your circle before sharing another copy.", "這則草稿上次的傳送尚未確認，而地圖區域已變更。再次分享之前，請先到圈子確認。", "前回の送信結果が未確認のまま地図エリアが変わりました。再度投稿する前にサークルをご確認ください。")
        case .areaUnavailable: return ("No map area is available for this moment.", "這則貼文目前沒有可附上的地圖區域。", "この投稿に添えられる地図エリアはありません。")
        case .areaPrivate: return ("No map area shared", "未分享地圖區域", "地図エリアの共有なし")
        case .areaShared: return ("Approximate map area shared", "已分享大致地圖區域", "おおよその地図エリアを共有")
        case .addPhoto: return ("Add a photo", "加入照片", "写真を追加")
        case .replacePhoto: return ("Replace photo", "更換照片", "写真を差し替え")
        case .removePhoto: return ("Remove photo", "移除照片", "写真を外す")
        case .photoLabel: return ("Selected photo", "已選照片", "選択した写真")
        case .photoDescription: return ("Describe the photo", "描述這張照片", "写真の説明")
        case .photoDescriptionHint: return ("Give people who can’t see the photo a short description. Details in the picture itself may reveal a place.", "請簡述照片，讓看不見照片的人也能理解。照片本身的細節仍可能透露地點。", "写真が見えない人にも伝わるように短く説明します。写っているものから場所が分かることもあります。")
        case .photoLoading: return ("Preparing your photo…", "正在準備照片…", "写真を準備しています…")
        case .photoFailed: return ("This photo couldn’t be prepared. Choose another image or continue with text.", "無法準備這張照片。可以換一張，或只分享文字。", "この写真を準備できませんでした。別の写真を選ぶか、文章だけで続けられます。")
        case .share: return ("Share moment", "分享這一刻", "ひとときを共有")
        case .sharing: return ("Sharing…", "正在分享…", "共有しています…")
        case .retryShare: return ("Retry sharing", "重試分享", "共有を再試行")
        case .retryReply: return ("Retry reply", "重試回覆", "返信を再試行")
        case .retryHint: return ("The last attempt is unconfirmed. Retrying sends the same version.", "上次傳送的結果尚未確認。重試會送出同一版本。", "前回の送信結果を確認できていません。再試行では同じ内容を送ります。")
        case .keepDraft: return ("Keep draft", "保留草稿", "下書きを残す")
        case .closeDraft: return ("Close this draft?", "要關閉這份草稿嗎？", "この下書きを閉じますか？")
        case .draftRestored: return ("Your draft is here.", "草稿還在這裡。", "下書きが残っています。")
        case .draftUnreadable: return ("This draft could not be read. You can discard it to start again.", "無法讀取這份草稿。你可以捨棄它，再重新開始。", "下書きを読み込めませんでした。破棄して書き直すことができます。")
        case .draftSaveFailed: return ("Couldn’t save this draft on your device. Try again before sharing.", "無法在裝置上保存草稿。請在分享前再試一次。", "端末に下書きを保存できませんでした。共有する前に再度お試しください。")
        case .discard: return ("Discard draft", "捨棄草稿", "下書きを破棄")
        case .discardPrompt: return ("You can keep this draft on this device or discard it.", "可以保留草稿在這台裝置，或捨棄它。", "下書きはこの端末に残すか、破棄できます。")
        case .discardPending: return ("The last send may have reached your circle. Check the circle before sending another copy.", "上一則內容可能已送達圈子。再次送出之前，請先到圈子確認。", "前回の内容がサークルに届いている可能性があります。再送信する前にサークルを確認してください。")
        case .moment: return ("Moment", "一刻", "ひととき")
        case .loading: return ("Opening the moment…", "正在打開這一刻…", "ひとときを開いています…")
        case .replySection: return ("Replies", "回覆", "返信")
        case .noReplies: return ("Leave the first reply.", "留下一句，開啟對話。", "最初のひと言を残しましょう。")
        case .replyHint: return ("Write a reply", "寫下回覆", "返信を書く")
        case .reply: return ("Send reply", "送出回覆", "返信を送る")
        case .replying: return ("Sending…", "正在送出…", "送信しています…")
        case .acknowledge: return ("Send a little warmth", "送上一點暖意", "ぬくもりを届ける")
        case .acknowledged: return ("Remove your warmth", "收回你的暖意", "ぬくもりを取り消す")
        case .options: return ("More actions", "更多操作", "その他の操作")
        case .report: return ("Report content", "檢舉內容", "内容を報告")
        case .reportDetail: return ("The circle host can review this report. The content will be hidden from your view.", "圈主可以審閱這項檢舉。這則內容會從你的畫面隱藏。", "サークルの管理者が報告を確認できます。この内容は自分の画面から非表示になります。")
        case .reported: return ("Report sent", "已送出檢舉", "報告を送信しました")
        case .block: return ("Block author", "封鎖作者", "投稿者をブロック")
        case .blockDetail: return ("You and this person will no longer see each other’s contributions in this circle.", "你和對方將看不到彼此在這個圈子的內容。", "このサークル内で、お互いの投稿や返信が表示されなくなります。")
        case .blocked: return ("Author blocked", "已封鎖作者", "投稿者をブロックしました")
        case .remove: return ("Remove content", "移除內容", "内容を削除")
        case .removeDetail: return ("This content will be removed for everyone in the circle.", "這則內容會從圈內所有成員的畫面移除。", "この内容はサークル全員の画面から削除されます。")
        case .removed: return ("Content removed", "已移除內容", "内容を削除しました")
        case .photoUnavailable: return ("Photo unavailable", "無法顯示照片", "写真を表示できません")
        }
    }
}

private extension WorldStrings {
    func moment(_ key: MomentCopy) -> String {
        let (english, traditionalChinese, japanese) = key.translations
        switch language {
        case .english: return english
        case .traditionalChinese: return traditionalChinese
        case .japanese: return japanese
        }
    }

    func momentDate(_ milliseconds: Double) -> String {
        let formatter = DateFormatter()
        formatter.locale = language.locale
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: Date(timeIntervalSince1970:milliseconds / 1000))
    }
}

@MainActor
private enum MomentPage {
    static func panel(_ child: UIView, padding: CGFloat = 14) -> UIView {
        let panel = UIView()
        panel.backgroundColor = UIColor.white.withAlphaComponent(0.33)
        panel.layer.borderColor = WorldTheme.line.cgColor
        panel.layer.borderWidth = 0.7
        panel.layer.cornerRadius = 16
        panel.layer.cornerCurve = .continuous
        panel.insetsLayoutMarginsFromSafeArea = false
        panel.directionalLayoutMargins = NSDirectionalEdgeInsets(top:padding, leading:padding, bottom:padding, trailing:padding)
        child.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(child)
        let inset = panel.layoutMarginsGuide
        NSLayoutConstraint.activate([
            child.topAnchor.constraint(equalTo:inset.topAnchor), child.bottomAnchor.constraint(equalTo:inset.bottomAnchor),
            child.leadingAnchor.constraint(equalTo:inset.leadingAnchor), child.trailingAnchor.constraint(equalTo:inset.trailingAnchor)
        ])
        return panel
    }

    static func column(_ views: [UIView], spacing: CGFloat = 7) -> UIStackView {
        let stack = UIStackView(arrangedSubviews:views)
        stack.axis = .vertical
        stack.spacing = spacing
        return stack
    }

    static func heading(_ title: String, style: UIFont.TextStyle = .title2) -> UILabel {
        let label = WorldTheme.label(title, style:style)
        label.accessibilityTraits.insert(.header)
        return label
    }

    static func seal(for id: String, style: String? = nil, diameter: CGFloat) -> WorldCircleSeal {
        let colors = WorldPigment.placeColors
        let index = id.utf8.reduce(0) { ($0 * 7 + Int($1)) % colors.count }
        let seal = WorldCircleSeal(ink:colors[index],style:style.flatMap(WorldCircleInkStyle.init(rawValue:)))
        seal.widthAnchor.constraint(equalToConstant:diameter).isActive = true
        seal.heightAnchor.constraint(equalToConstant:diameter).isActive = true
        return seal
    }

    static func photoView() -> UIImageView {
        let view = UIImageView()
        view.contentMode = .scaleAspectFit
        view.clipsToBounds = true
        view.backgroundColor = WorldTheme.mapPaper
        view.layer.cornerRadius = 13
        view.layer.cornerCurve = .continuous
        view.isAccessibilityElement = true
        return view
    }

    static func setButtonTitle(_ title: String, on button: UIButton) {
        button.configuration?.title = title
        button.accessibilityLabel = title
    }

    static func announce(_ text: String) {
        UIAccessibility.post(notification:.announcement, argument:text)
    }

    static func pop(_ controller: UIViewController) {
        let animated = !UIAccessibility.isReduceMotionEnabled
        if let navigation = controller.navigationController, navigation.viewControllers.count > 1 {
            navigation.popViewController(animated:animated)
        } else {
            controller.dismiss(animated:animated)
        }
    }
}

@MainActor
private final class MomentTextInput: UIView {
    let editor = UITextView()
    private let placeholder: UILabel
    private let counter = WorldTheme.label("", style:.footnote, muted:true)
    private let limit: Int
    private let locale: Locale

    var text: String { (editor.text ?? "").trimmingCharacters(in:.whitespacesAndNewlines) }
    var isWithinLimit: Bool { text.unicodeScalars.count <= limit }
    var rawDraftExists: Bool { !((editor.text ?? "").isEmpty) }

    init(label: String, limit: Int, minimumHeight: CGFloat, locale: Locale, id: String) {
        self.limit = limit
        self.locale = locale
        placeholder = WorldTheme.label(label, style:.body, muted:true)
        super.init(frame:.zero)

        editor.font = WorldTheme.font(.body)
        editor.adjustsFontForContentSizeCategory = true
        editor.textColor = WorldTheme.ink
        editor.tintColor = WorldTheme.ink
        editor.backgroundColor = .clear
        editor.isScrollEnabled = false
        editor.textContainerInset = UIEdgeInsets(top:10, left:4, bottom:12, right:4)
        editor.accessibilityLabel = label
        editor.accessibilityIdentifier = id
        editor.translatesAutoresizingMaskIntoConstraints = false
        placeholder.isAccessibilityElement = false
        placeholder.isUserInteractionEnabled = false
        placeholder.translatesAutoresizingMaskIntoConstraints = false
        addSubview(editor)
        addSubview(placeholder)
        addSubview(counter)
        counter.textAlignment = .natural
        counter.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            editor.topAnchor.constraint(equalTo:topAnchor),
            editor.leadingAnchor.constraint(equalTo:leadingAnchor),
            editor.trailingAnchor.constraint(equalTo:trailingAnchor),
            editor.heightAnchor.constraint(greaterThanOrEqualToConstant:minimumHeight),
            placeholder.topAnchor.constraint(equalTo:editor.topAnchor, constant:10),
            placeholder.leadingAnchor.constraint(equalTo:editor.leadingAnchor, constant:9),
            placeholder.trailingAnchor.constraint(lessThanOrEqualTo:editor.trailingAnchor, constant:-9),
            counter.topAnchor.constraint(equalTo:editor.bottomAnchor),
            counter.leadingAnchor.constraint(equalTo:leadingAnchor, constant:9),
            counter.trailingAnchor.constraint(equalTo:trailingAnchor, constant:-9),
            counter.bottomAnchor.constraint(equalTo:bottomAnchor)
        ])
        update()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func update() {
        placeholder.isHidden = !((editor.text ?? "").isEmpty)
        let formatting = IntegerFormatStyle<Int>.number.locale(locale)
        counter.text = "\(text.unicodeScalars.count.formatted(formatting)) / \(limit.formatted(formatting))"
        counter.textColor = isWithinLimit ? WorldTheme.muted : .systemRed
        editor.invalidateIntrinsicContentSize()
    }

    func clear() {
        editor.text = ""
        update()
    }
}

final class WorldMomentComposerViewController: WorldCirclePaperViewController, UITextViewDelegate, PHPickerViewControllerDelegate {
    private struct Submission: Codable {
        let text: String
        let region: String?
        let photo: Data?
        let description: String?
    }
    private struct SavedDraft: Codable {
        let id: String
        let submission: Submission
        let mayHaveBeenSent: Bool
    }

    private let circle: WorldCircle
    private let currentRegion: () -> String?
    private let client: WorldSocialClient
    private let onPublished: (String) -> Void
    private var submissionID = WorldSocialClient.identifier()
    private var draftSaveTask: Task<Void,Never>?
    private var draftUnreadable = false
    private var discarded = false
    private lazy var writing = MomentTextInput(label:strings.moment(.writing), limit:480, minimumHeight:106, locale:strings.language.locale, id:"world.moment.text")
    private lazy var descriptionInput = MomentTextInput(label:strings.moment(.photoDescription), limit:140, minimumHeight:50, locale:strings.language.locale, id:"world.moment.photoDescription")
    private let locationSwitch = UISwitch()
    private var regionControls: UIStackView?
    private var regionUnavailable: UILabel?
    private var attachedRegion: String?
    private let photoPreview = MomentPage.photoView()
    private let status = WorldTheme.label("", style:.footnote)
    private lazy var photoButton = WorldTheme.button(strings.moment(.addPhoto), symbol:"photo")
    private lazy var removePhotoButton = WorldTheme.button(strings.moment(.removePhoto), symbol:"xmark.circle")
    private lazy var publishButton = WorldTheme.button(strings.moment(.share), symbol:"arrow.up.circle.fill", filled:true)
    private var photoSection: UIStackView?
    private var photo: Data?
    private var photoRequest: UUID?
    private var pending: Submission?
    private var sending = false
    private var committed = false

    init(circle: WorldCircle, region: @escaping () -> String?, client: WorldSocialClient, strings: WorldStrings, onPublished: @escaping (String) -> Void) {
        self.circle = circle
        currentRegion = region
        self.client = client
        self.onPublished = onPublished
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        navigationItem.title = strings.moment(.compose)
        navigationItem.hidesBackButton = true
        navigationItem.leftBarButtonItem = UIBarButtonItem(title:strings[.cancel], style:.plain, target:self, action:#selector(cancel))
        navigationItem.leftBarButtonItem?.accessibilityIdentifier = "world.moment.cancel"

        let heroText = MomentPage.column([
            MomentPage.heading(strings.moment(.writing), style:.title1),
            WorldTheme.label(strings.moment(.composerHint), style:.body, muted:true)
        ])
        let hero = UIStackView(arrangedSubviews:[MomentPage.seal(for:circle.id, diameter:64),heroText])
        hero.spacing = 9
        hero.alignment = .center
        stack.addArrangedSubview(hero)
        writing.editor.delegate = self
        stack.addArrangedSubview(MomentPage.panel(writing, padding:9))

        photoButton.accessibilityIdentifier = "world.moment.photo"
        photoButton.addTarget(self, action:#selector(choosePhoto), for:.touchUpInside)
        removePhotoButton.accessibilityIdentifier = "world.moment.removePhoto"
        removePhotoButton.addTarget(self, action:#selector(removePhoto), for:.touchUpInside)
        descriptionInput.editor.delegate = self
        photoPreview.heightAnchor.constraint(equalToConstant:216).isActive = true
        let picked = MomentPage.column([
            photoPreview, WorldTheme.label(strings.moment(.photoDescriptionHint), style:.footnote, muted:true),
            descriptionInput, removePhotoButton
        ], spacing:10)
        photoSection = picked
        stack.addArrangedSubview(MomentPage.panel(MomentPage.column([photoButton,picked], spacing:8), padding:10))

        let audience = String(format:strings.moment(.audience), locale:strings.language.locale, circle.title)
        let audienceLabel = WorldTheme.label(audience, style:.headline)
        audienceLabel.accessibilityIdentifier = "world.moment.audience"
        let visibility = MomentPage.column([audienceLabel], spacing:10)
        let areaLabel = WorldTheme.label(strings.moment(.area), style:.body)
        areaLabel.isAccessibilityElement = false
        let toggle = UIStackView(arrangedSubviews:[areaLabel,locationSwitch])
        toggle.alignment = .center
        toggle.spacing = 8
        locationSwitch.onTintColor = WorldTheme.ink
        locationSwitch.setContentHuggingPriority(.required, for:.horizontal)
        locationSwitch.setContentCompressionResistancePriority(.required, for:.horizontal)
        locationSwitch.accessibilityLabel = strings.moment(.area)
        locationSwitch.accessibilityHint = strings.moment(.areaHint)
        locationSwitch.accessibilityIdentifier = "world.moment.area"
        locationSwitch.addTarget(self, action:#selector(locationChanged), for:.valueChanged)
        let regionStack = MomentPage.column([toggle,WorldTheme.label(strings.moment(.areaHint), style:.footnote, muted:true)])
        regionControls = regionStack
        visibility.addArrangedSubview(regionStack)
        let unavailable = WorldTheme.label(strings.moment(.areaUnavailable), style:.footnote, muted:true)
        regionUnavailable = unavailable
        visibility.addArrangedSubview(unavailable)
        NotificationCenter.default.addObserver(self, selector:#selector(regionChanged), name:.worldSocialRegionDidChange, object:nil)
        stack.addArrangedSubview(MomentPage.panel(visibility))
        status.accessibilityIdentifier = "world.moment.status"
        stack.addArrangedSubview(status)
        publishButton.accessibilityIdentifier = "world.moment.publish"
        publishButton.addTarget(self, action:#selector(publish), for:.touchUpInside)
        stack.addArrangedSubview(publishButton)
        restoreDraft()
        regionChanged()
        NotificationCenter.default.addObserver(self, selector:#selector(flushDraft), name:UIScene.willDeactivateNotification, object:nil)
    }

    deinit {
        draftSaveTask?.cancel()
        NotificationCenter.default.removeObserver(self)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        regionChanged()
    }

    func textViewDidChange(_ textView: UITextView) {
        writing.update()
        descriptionInput.update()
        scheduleDraftSave()
        updateControls()
    }

    @objc private func locationChanged() {
        attachedRegion = locationSwitch.isOn ? currentRegion() : nil
        locationSwitch.setOn(attachedRegion != nil, animated:false)
        updateControls()
    }

    @objc private func regionChanged() {
        let available = currentRegion()
        regionControls?.isHidden = available == nil
        regionUnavailable?.isHidden = available != nil
        if !sending && pending == nil, let attachedRegion, attachedRegion != available {
            self.attachedRegion = nil
            locationSwitch.setOn(false, animated:false)
            setStatus(strings.moment(.areaChanged))
        } else { updateControls() }
    }

    private var hasDraft: Bool { writing.rawDraftExists || photo != nil || locationSwitch.isOn || pending != nil || draftUnreadable }

    private func updateControls() {
        let photoInProgress = photoRequest != nil
        let editable = !sending && !committed && pending == nil && !draftUnreadable
        let hasPhotoDescription = !descriptionInput.text.isEmpty && descriptionInput.isWithinLimit
        let valid = writing.isWithinLimit && (photo == nil ? !writing.text.isEmpty : hasPhotoDescription)
        photoSection?.isHidden = photo == nil
        writing.editor.isEditable = editable
        descriptionInput.editor.isEditable = editable
        photoButton.isEnabled = editable && !photoInProgress
        removePhotoButton.isEnabled = editable && !photoInProgress
        locationSwitch.isEnabled = editable
        publishButton.isEnabled = !sending && !committed && !draftUnreadable && !photoInProgress && (valid || pending != nil)
        navigationItem.leftBarButtonItem?.isEnabled = !sending && !committed
        isModalInPresentation = !committed && (sending || hasDraft || photoInProgress)
        navigationController?.isModalInPresentation = isModalInPresentation
        status.isHidden = status.text?.isEmpty != false
        photoPreview.accessibilityLabel = descriptionInput.text.isEmpty ? strings.moment(.photoLabel) : descriptionInput.text
        MomentPage.setButtonTitle(strings.moment(photo == nil ? .addPhoto : .replacePhoto), on:photoButton)
        MomentPage.setButtonTitle(strings.moment(sending ? .sharing : pending == nil ? .share : .retryShare), on:publishButton)
    }

    @objc private func choosePhoto() {
        view.endEditing(true)
        var configuration = PHPickerConfiguration()
        configuration.filter = .images
        configuration.selectionLimit = 1
        configuration.preferredAssetRepresentationMode = .current
        let picker = PHPickerViewController(configuration:configuration)
        picker.delegate = self
        present(picker, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated:!UIAccessibility.isReduceMotionEnabled)
        guard let provider = results.first?.itemProvider else { return }
        guard let type = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to:.image) == true }) else {
            setStatus(strings.moment(.photoFailed))
            return
        }
        let request = UUID()
        photoRequest = request
        setStatus(strings.moment(.photoLoading))
        provider.loadFileRepresentation(forTypeIdentifier:type) { [weak self] url, _ in
            // The provider's temporary file is valid only for this callback.
            let prepared = url.flatMap(MomentPhoto.prepare)
            Task { @MainActor [weak self] in self?.finishPhoto(prepared, request:request) }
        }
    }

    private func finishPhoto(_ data: Data?, request: UUID) {
        guard request == photoRequest else { return }
        photoRequest = nil
        if let data, let image = UIImage(data:data) {
            photo = data
            photoPreview.image = image
            descriptionInput.clear()
            scheduleDraftSave()
            setStatus(nil)
        } else {
            setStatus(strings.moment(.photoFailed))
        }
    }

    @objc private func removePhoto() {
        photo = nil
        photoPreview.image = nil
        descriptionInput.clear()
        scheduleDraftSave()
        setStatus(nil)
    }

    @objc private func publish() {
        guard publishButton.isEnabled else { return }
        view.endEditing(true)
        let prior = pending
        let available = currentRegion()
        if prior == nil, let attachedRegion, attachedRegion != available {
            regionChanged()
            return
        }
        let submission = prior ?? Submission(
            text:writing.text, region:attachedRegion, photo:photo,
            description:photo == nil ? nil : descriptionInput.text
        )
        draftSaveTask?.cancel()
        do { try storeDraft(submission, mayHaveBeenSent:true) }
        catch {
            setStatus(strings.moment(.draftSaveFailed))
            return
        }
        sending = true
        setStatus(nil)
        Task { [weak self] in
            guard let self else { return }
            do {
                if let priorRegion = prior?.region, priorRegion != available {
                    do { _ = try await client.detail(circleID:circle.id,momentID:submissionID) }
                    catch {
                        sending = false
                        setStatus(strings.moment(.earlierSendAreaChanged))
                        return
                    }
                } else {
                    try await client.post(circleID:circle.id, id:submissionID, text:submission.text,
                                          region:submission.region, photo:submission.photo, photoDescription:submission.description)
                }
                sending = false
                committed = true
                try? removeDraft()
                updateControls()
                onPublished(submissionID)
            } catch {
                sending = false
                // If an earlier attempt is unconfirmed, every retry must carry its exact payload.
                if prior != nil || !client.isDefinitiveFailure(error) { pending = submission }
                else { flushDraft() }
                let message = client.errorText(error, strings)
                setStatus(pending == nil ? message : message + "\n" + strings.moment(.retryHint))
            }
        }
    }

    @objc private func cancel() {
        guard !sending, !committed else { return }
        if !hasDraft { closeComposer(); return }
        let detail = strings.moment(pending == nil ? .discardPrompt : .discardPending)
        let alert = UIAlertController(title:strings.moment(.closeDraft), message:detail, preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:strings[.cancel], style:.cancel))
        if !draftUnreadable {
            alert.addAction(UIAlertAction(title:strings.moment(.keepDraft), style:.default) { [weak self] _ in self?.closeComposer(keep:true) })
        }
        alert.addAction(UIAlertAction(title:strings.moment(.discard), style:.destructive) { [weak self] _ in self?.closeComposer() })
        present(alert, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func closeComposer(keep: Bool = false) {
        draftSaveTask?.cancel()
        do {
            if keep {
                if pending == nil { try saveEditableDraft() }
            } else { try removeDraft() }
        } catch {
            setStatus(strings.moment(.draftSaveFailed))
            return
        }
        discarded = true
        photoRequest = nil
        isModalInPresentation = false
        navigationController?.isModalInPresentation = false
        MomentPage.pop(self)
    }

    private var draftURL: URL? { WorldSocialClient.draftFile(for:circle.id) }

    private func restoreDraft() {
        guard let file = draftURL, FileManager.default.fileExists(atPath:file.path) else { return }
        do {
            let size = try file.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0
            guard size <= 400_000 else { throw CocoaError(.fileReadCorruptFile) }
            let draft = try JSONDecoder().decode(SavedDraft.self, from:Data(contentsOf:file))
            guard WorldSocialClient.validID(draft.id),
                  (draft.submission.photo?.count ?? 0) <= 156_000 else { throw CocoaError(.fileReadCorruptFile) }
            submissionID = draft.id
            writing.editor.text = draft.submission.text
            descriptionInput.editor.text = draft.submission.description ?? ""
            writing.update()
            descriptionInput.update()
            photo = draft.submission.photo
            if let photo { photoPreview.image = UIImage(data:photo) }
            if draft.mayHaveBeenSent {
                pending = draft.submission
                let area = draft.submission.region == nil ? "" : "\n" + strings.moment(.areaShared)
                setStatus(strings.moment(.retryHint) + area)
            } else {
                setStatus(strings.moment(.draftRestored))
            }
        } catch {
            draftUnreadable = true
            setStatus(strings.moment(.draftUnreadable))
        }
    }

    private func scheduleDraftSave() {
        draftSaveTask?.cancel()
        draftSaveTask = Task { [weak self] in
            try? await Task.sleep(for:.milliseconds(500))
            if !Task.isCancelled { self?.flushDraft() }
        }
    }

    @objc private func flushDraft() {
        guard !discarded, !committed, !sending, !draftUnreadable, pending == nil, isViewLoaded else { return }
        do { try saveEditableDraft() }
        catch { setStatus(strings.moment(.draftSaveFailed)) }
    }

    private func saveEditableDraft() throws {
        if writing.rawDraftExists || photo != nil {
            let local = Submission(text:writing.editor.text ?? "", region:nil, photo:photo,
                                   description:descriptionInput.editor.text)
            try storeDraft(local, mayHaveBeenSent:false)
        } else { try removeDraft() }
    }

    private func storeDraft(_ submission: Submission, mayHaveBeenSent: Bool) throws {
        guard let file = draftURL else { throw CocoaError(.fileWriteInvalidFileName) }
        let data = try JSONEncoder().encode(SavedDraft(id:submissionID,submission:submission,mayHaveBeenSent:mayHaveBeenSent))
        guard data.count <= 400_000 else { throw CocoaError(.fileWriteOutOfSpace) }
        try FileManager.default.createDirectory(at:file.deletingLastPathComponent(), withIntermediateDirectories:true)
        try data.write(to:file, options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
    }

    private func removeDraft() throws {
        if let file = draftURL, FileManager.default.fileExists(atPath:file.path) { try FileManager.default.removeItem(at:file) }
    }

    private func setStatus(_ text: String?) {
        status.text = text
        updateControls()
        if let text { MomentPage.announce(text) }
    }
}

private enum MomentPhoto {
    static func prepare(_ url: URL) -> Data? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache:false] as CFDictionary) else { return nil }
        for size in [960,760] {
            let options: [CFString:Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways:true,
                kCGImageSourceCreateThumbnailWithTransform:true,
                kCGImageSourceShouldCacheImmediately:true,
                kCGImageSourceThumbnailMaxPixelSize:size
            ]
            guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
                  let context = CGContext(data:nil, width:image.width, height:image.height, bitsPerComponent:8,
                                          bytesPerRow:0, space:CGColorSpace(name:CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB(),
                                          bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue) else { continue }
            let rect = CGRect(x:0, y:0, width:image.width, height:image.height)
            context.setFillColor(red:0.97, green:0.94, blue:0.89, alpha:1)
            context.fill(rect)
            context.draw(image, in:rect)
            guard let pixels = context.makeImage() else { continue }
            // A fresh raster has no source EXIF, original filename, GPS, thumbnails or XMP.
            for quality in [0.82,0.68,0.54,0.42] {
                let buffer = NSMutableData()
                guard let destination = CGImageDestinationCreateWithData(buffer as CFMutableData, UTType.jpeg.identifier as CFString, 1, nil) else { continue }
                let encoding: [CFString:Any] = [
                    kCGImageDestinationLossyCompressionQuality:quality,
                    kCGImagePropertyJFIFDictionary:[kCGImagePropertyJFIFIsProgressive:false]
                ]
                CGImageDestinationAddImage(destination, pixels, encoding as CFDictionary)
                if CGImageDestinationFinalize(destination), buffer.length <= 156_000 { return buffer as Data }
            }
        }
        return nil
    }
}

final class WorldMomentViewController: WorldCirclePaperViewController, UITextViewDelegate {
    private struct ReplyAttempt {
        let id: String
        let text: String
    }

    private enum Moderation: String {
        case report, block, remove

        var title: MomentCopy {
            switch self {
            case .report: return .report
            case .block: return .block
            case .remove: return .remove
            }
        }
        var detail: MomentCopy {
            switch self {
            case .report: return .reportDetail
            case .block: return .blockDetail
            case .remove: return .removeDetail
            }
        }
        var receipt: MomentCopy {
            switch self {
            case .report: return .reported
            case .block: return .blocked
            case .remove: return .removed
            }
        }
        var icon: String {
            switch self {
            case .report: return "flag"
            case .block: return "hand.raised"
            case .remove: return "trash"
            }
        }
    }

    private let circle: WorldCircle
    private let momentID: String
    private let client: WorldSocialClient
    private let onChanged: () -> Void
    private let refreshControl = UIRefreshControl()
    private let spinner = UIActivityIndicatorView(style:.medium)
    private let loadStatus = WorldTheme.label("", style:.body, muted:true)
    private let actionStatus = WorldTheme.label("", style:.footnote)
    private let momentStack = MomentPage.column([], spacing:14)
    private let repliesStack = MomentPage.column([], spacing:10)
    private lazy var retryButton = WorldTheme.button(strings[.retry], symbol:"arrow.clockwise")
    private lazy var reactionButton = WorldTheme.button(strings.moment(.acknowledge), symbol:"heart")
    private lazy var replyInput = MomentTextInput(label:strings.moment(.replyHint), limit:240, minimumHeight:76, locale:strings.language.locale, id:"world.moment.replyText")
    private lazy var replyButton = WorldTheme.button(strings.moment(.reply), symbol:"arrow.up.circle.fill", filled:true)
    private var replyStack: UIStackView?
    private var snapshot: WorldMomentDetail?
    private var pendingReply: ReplyAttempt?
    private var busy = false
    private var submittingReply = false
    private var loadTask: Task<Void,Never>?
    private var readTask: Task<Void,Never>?
    private var readThrough: Double = 0

    init(circle: WorldCircle, momentID: String, client: WorldSocialClient, strings: WorldStrings, onChanged: @escaping () -> Void) {
        self.circle = circle
        self.momentID = momentID
        self.client = client
        self.onChanged = onChanged
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        navigationItem.title = strings.moment(.moment)
        scroll.refreshControl = refreshControl
        refreshControl.addTarget(self, action:#selector(refresh), for:.valueChanged)
        spinner.color = WorldTheme.muted
        spinner.hidesWhenStopped = true
        spinner.isAccessibilityElement = false
        loadStatus.accessibilityIdentifier = "world.moment.loadStatus"
        retryButton.addTarget(self, action:#selector(refresh), for:.touchUpInside)
        retryButton.accessibilityIdentifier = "world.moment.retry"
        stack.addArrangedSubview(spinner)
        stack.addArrangedSubview(loadStatus)
        stack.addArrangedSubview(retryButton)
        stack.addArrangedSubview(momentStack)

        let responseHeading = MomentPage.heading(strings.moment(.replySection))
        responseHeading.accessibilityIdentifier = "world.moment.replies"
        reactionButton.accessibilityIdentifier = "world.moment.reaction"
        reactionButton.addTarget(self, action:#selector(react), for:.touchUpInside)
        replyInput.editor.delegate = self
        replyButton.accessibilityIdentifier = "world.moment.sendReply"
        replyButton.addTarget(self, action:#selector(reply), for:.touchUpInside)
        actionStatus.accessibilityIdentifier = "world.moment.actionStatus"
        let responses = MomentPage.column([
            reactionButton, responseHeading, repliesStack, MomentPage.panel(replyInput, padding:9), actionStatus, replyButton
        ], spacing:12)
        replyStack = responses
        stack.addArrangedSubview(responses)
        reload()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        markVisibleReplies()
    }

    deinit {
        loadTask?.cancel()
        readTask?.cancel()
    }

    func textViewDidChange(_ textView: UITextView) {
        replyInput.update()
        updateControls()
    }

    @objc private func refresh() {
        if busy { refreshControl.endRefreshing(); return }
        reload()
    }

    private func reload() {
        loadTask?.cancel()
        retryButton.isHidden = true
        loadStatus.text = snapshot == nil ? strings.moment(.loading) : nil
        loadStatus.isHidden = loadStatus.text == nil
        if snapshot == nil { spinner.startAnimating() }
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let detail = try await client.detail(circleID:circle.id, momentID:momentID)
                guard !Task.isCancelled else { return }
                snapshot = detail
                finishReload()
                render(detail)
                markVisibleReplies()
            } catch {
                guard !Task.isCancelled else { return }
                if client.isDefinitiveFailure(error) {
                    snapshot = nil
                    reset(momentStack)
                    navigationItem.rightBarButtonItem = nil
                    onChanged()
                }
                finishReload()
                loadStatus.text = client.errorText(error, strings)
                loadStatus.isHidden = false
                retryButton.isHidden = false
                MomentPage.announce(loadStatus.text ?? "")
            }
        }
        updateControls()
    }

    private func finishReload() {
        loadTask = nil
        spinner.stopAnimating()
        refreshControl.endRefreshing()
        loadStatus.isHidden = true
        retryButton.isHidden = true
        updateControls()
    }

    private func render(_ detail: WorldMomentDetail) {
        reset(momentStack)
        let moment = detail.moment
        let seal = MomentPage.seal(for:moment.author.id, style:moment.author.style, diameter:56)
        let author = MomentPage.heading(moment.author.name, style:.headline)
        author.accessibilityIdentifier = "world.moment.author"
        let time = WorldTheme.label(strings.momentDate(moment.createdAt), style:.footnote, muted:true)
        let provenance = MomentPage.column([author,time], spacing:4)
        let row = UIStackView(arrangedSubviews:[seal,provenance])
        row.spacing = 8
        row.alignment = .center
        let paper = MomentPage.column([row], spacing:14)
        if !moment.text.isEmpty {
            let words = WorldTheme.label(moment.text, style:.title3)
            words.accessibilityIdentifier = "world.moment.body"
            paper.addArrangedSubview(words)
        }
        if moment.hasPhoto {
            if let data = detail.photo, let image = UIImage(data:data) {
                let picture = MomentPage.photoView()
                picture.image = image
                picture.accessibilityLabel = moment.photoDescription ?? strings.moment(.photoLabel)
                picture.accessibilityIdentifier = "world.moment.sharedPhoto"
                picture.heightAnchor.constraint(equalToConstant: image.size.height > image.size.width ? 334 : 244).isActive = true
                paper.addArrangedSubview(picture)
            } else {
                paper.addArrangedSubview(WorldTheme.label(strings.moment(.photoUnavailable), style:.footnote, muted:true))
            }
        }
        let area = WorldTheme.label(strings.moment(moment.region == nil ? .areaPrivate : .areaShared), style:.footnote, muted:true)
        area.accessibilityIdentifier = "world.moment.areaStatus"
        paper.addArrangedSubview(area)
        momentStack.addArrangedSubview(MomentPage.panel(paper, padding:15))

        navigationItem.rightBarButtonItem = UIBarButtonItem(
            image:UIImage(systemName:"ellipsis.circle"),
            menu:menu(kind:"moment", target:moment.id, owned:moment.owned, authorID:moment.author.id)
        )
        navigationItem.rightBarButtonItem?.accessibilityLabel = strings.moment(.options)
        navigationItem.rightBarButtonItem?.accessibilityIdentifier = "world.moment.actions"
        setReaction(moment)
        renderReplies(detail.replies)
        updateControls()
    }

    private func renderReplies(_ replies: [WorldCircleReply]) {
        reset(repliesStack)
        if replies.isEmpty {
            repliesStack.addArrangedSubview(WorldTheme.label(strings.moment(.noReplies), style:.body, muted:true))
            return
        }
        for reply in replies {
            let author = WorldTheme.label(reply.author.name, style:.headline)
            let time = WorldTheme.label(strings.momentDate(reply.createdAt), style:.footnote, muted:true)
            let metadata = MomentPage.column([author,time], spacing:4)
            let options = UIButton(type:.system)
            options.setImage(UIImage(systemName:"ellipsis"), for:.normal)
            options.tintColor = WorldTheme.ink
            options.showsMenuAsPrimaryAction = true
            options.menu = menu(kind:"reply", target:reply.id, owned:reply.owned, authorID:reply.author.id)
            options.accessibilityLabel = strings.moment(.options)
            options.accessibilityIdentifier = "world.moment.replyActions.\(reply.id)"
            options.widthAnchor.constraint(equalToConstant:44).isActive = true
            options.heightAnchor.constraint(equalToConstant:44).isActive = true
            let stamp = MomentPage.seal(for:reply.author.id, style:reply.author.style, diameter:37)
            let row = UIStackView(arrangedSubviews:[stamp,metadata,options])
            row.spacing = 7
            row.alignment = .center
            let words = WorldTheme.label(reply.text)
            words.accessibilityIdentifier = "world.moment.reply.\(reply.id)"
            let card = MomentPage.panel(MomentPage.column([row,words], spacing:5))
            repliesStack.addArrangedSubview(card)
        }
    }

    private func setReaction(_ moment: WorldMoment) {
        let title = strings.moment(moment.reacted ? .acknowledged : .acknowledge)
        let count = moment.reactionCount.formatted(.number.locale(strings.language.locale))
        reactionButton.configuration?.image = UIImage(systemName:moment.reacted ? "heart.fill" : "heart")
        reactionButton.configuration?.title = title + " · " + count
        reactionButton.accessibilityLabel = title
        reactionButton.accessibilityValue = count
        if moment.reacted { reactionButton.accessibilityTraits.insert(.selected) }
        else { reactionButton.accessibilityTraits.remove(.selected) }
    }

    private func updateControls() {
        let visible = snapshot != nil
        let canChange = visible && !busy && loadTask == nil
        replyStack?.isHidden = !visible
        reactionButton.isEnabled = canChange
        navigationItem.rightBarButtonItem?.isEnabled = canChange
        replyInput.editor.isEditable = visible && !busy && pendingReply == nil
        replyButton.isEnabled = canChange && (pendingReply != nil || (!replyInput.text.isEmpty && replyInput.isWithinLimit))
        MomentPage.setButtonTitle(strings.moment(submittingReply ? .replying : pendingReply == nil ? .reply : .retryReply), on:replyButton)
        actionStatus.isHidden = actionStatus.text?.isEmpty != false
        let protectsDraft = replyInput.rawDraftExists || pendingReply != nil || busy
        isModalInPresentation = protectsDraft
        navigationController?.isModalInPresentation = protectsDraft
        navigationItem.hidesBackButton = protectsDraft
        if protectsDraft {
            if navigationItem.leftBarButtonItem == nil {
                navigationItem.leftBarButtonItem = UIBarButtonItem(
                    title:strings[.close], style:.plain, target:self, action:#selector(closeDetail)
                )
                navigationItem.leftBarButtonItem?.accessibilityIdentifier = "world.moment.detailClose"
            }
            navigationItem.leftBarButtonItem?.isEnabled = !busy
        } else {
            navigationItem.leftBarButtonItem = nil
        }
    }

    @objc private func react() {
        guard !busy, let snapshot else { return }
        let active = !snapshot.moment.reacted
        runMutation { [self] in
            try await client.react(circleID:circle.id, momentID:momentID, active:active)
        }
    }

    @objc private func reply() {
        guard replyButton.isEnabled else { return }
        view.endEditing(true)
        let prior = pendingReply
        let attempt = prior ?? ReplyAttempt(id:WorldSocialClient.identifier(), text:replyInput.text)
        submittingReply = true
        runMutation { [self] in
            try await client.reply(circleID:circle.id, momentID:momentID, id:attempt.id, text:attempt.text)
        } onSuccess: { [self] in
            submittingReply = false
            pendingReply = nil
            replyInput.clear()
        } onFailure: { [self] error in
            submittingReply = false
            if prior != nil || !client.isDefinitiveFailure(error) { pendingReply = attempt }
        }
    }

    private func markVisibleReplies() {
        guard readTask == nil, viewIfLoaded?.window?.windowScene?.activationState == .foregroundActive,
              navigationController?.topViewController === self, let snapshot, snapshot.moment.owned,
              let latest = snapshot.replies.map(\.createdAt).max(), latest > readThrough else { return }
        readTask = Task { [weak self] in
            guard let self else { return }
            do {
                try await client.markRead(circleID:circle.id, momentID:momentID, through:latest)
                readThrough = max(readThrough,latest)
                readTask = nil
                onChanged()
                markVisibleReplies()
            } catch {
                // Preserve the unread marker; another explicit refresh can retry.
                readTask = nil
            }
        }
    }

    private func menu(kind: String, target: String, owned: Bool, authorID: String) -> UIMenu {
        let permissions: [Moderation] = owned ? [.remove] : circle.canInvite ? [.report,.block,.remove] : [.report,.block]
        var actions: [UIMenuElement] = permissions.map { action in
            UIAction(title:strings.moment(action.title), image:UIImage(systemName:action.icon),
                     attributes:action == .report ? [] : [.destructive]) { [weak self] _ in
                self?.confirm(action, kind:kind, target:target, authorID:authorID)
            }
        }
        if kind == "moment" {
            actions.insert(UIAction(title:strings.library(.saveToCollection), image:UIImage(systemName:"bookmark")) { [weak self] _ in
                guard let self, !busy else { return }
                let picker = WorldCollectionPickerViewController(circle:circle, momentID:target, client:client, strings:strings)
                navigationController?.pushViewController(picker, animated:!UIAccessibility.isReduceMotionEnabled)
            }, at:0)
        }
        return UIMenu(children:actions)
    }

    private func confirm(_ action: Moderation, kind: String, target: String, authorID: String) {
        guard !busy, loadTask == nil, let snapshot else { return }
        let exits = kind == "moment" || (action == .block && authorID == snapshot.moment.author.id)
        var prompt = strings.moment(action.detail)
        if exits && (replyInput.rawDraftExists || pendingReply != nil) {
            prompt += "\n\n" + strings.moment(pendingReply == nil ? .discardPrompt : .discardPending)
        }
        let alert = UIAlertController(title:strings.moment(action.title), message:prompt, preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:strings[.cancel], style:.cancel))
        if action == .report {
            for reason in WorldCircleReportReason.allCases {
                alert.addAction(UIAlertAction(title:strings[reason.label], style:.default) { [weak self] _ in
                    self?.applyModeration(action,kind:kind,target:target,reason:reason,exits:exits)
                })
            }
        } else {
            alert.addAction(UIAlertAction(title:strings.moment(action.title), style:.destructive) { [weak self] _ in
                self?.applyModeration(action,kind:kind,target:target,reason:nil,exits:exits)
            })
        }
        present(alert, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func applyModeration(_ action: Moderation, kind: String, target: String, reason: WorldCircleReportReason?, exits: Bool) {
        runMutation(exits:exits) {
            try await self.client.moderate(circleID:self.circle.id, kind:kind, target:target, action:action.rawValue, reason:reason)
        } onSuccess: {
            MomentPage.announce(self.strings.moment(action.receipt))
            if !exits {
                // Remove stale reply content from the screen while refreshing access.
                self.reset(self.repliesStack)
            }
        }
    }

    private func runMutation(
        exits: Bool = false,
        _ perform: @escaping () async throws -> Void,
        onSuccess: @escaping () -> Void = {},
        onFailure: @escaping (Error) -> Void = { _ in }
    ) {
        guard !busy else { return }
        busy = true
        actionStatus.text = nil
        updateControls()
        Task { [weak self] in
            guard let self else { return }
            do {
                try await perform()
                busy = false
                onSuccess()
                onChanged()
                if exits {
                    isModalInPresentation = false
                    navigationController?.isModalInPresentation = false
                    MomentPage.pop(self)
                } else {
                    reload()
                }
            } catch {
                busy = false
                onFailure(error)
                let message = client.errorText(error, strings)
                actionStatus.text = pendingReply == nil ? message : message + "\n" + strings.moment(.retryHint)
                updateControls()
                MomentPage.announce(actionStatus.text ?? message)
            }
        }
    }

    @objc private func closeDetail() {
        guard !busy else { return }
        let alert = UIAlertController(
            title:strings.moment(.discard),
            message:strings.moment(pendingReply == nil ? .discardPrompt : .discardPending),
            preferredStyle:.alert
        )
        alert.addAction(UIAlertAction(title:strings[.cancel], style:.cancel))
        alert.addAction(UIAlertAction(title:strings.moment(.discard), style:.destructive) { [weak self] _ in
            guard let self else { return }
            isModalInPresentation = false
            navigationController?.isModalInPresentation = false
            MomentPage.pop(self)
        })
        present(alert, animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func reset(_ stack: UIStackView) {
        for child in stack.arrangedSubviews {
            stack.removeArrangedSubview(child)
            child.removeFromSuperview()
        }
    }
}
