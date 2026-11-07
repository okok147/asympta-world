import UIKit
import PDFKit

private enum KeepsakeWords {
    case title, detail, preview, share, archive, preparing, failed, changed, empty, clay, tide, dusk, complete

    func text(_ language: WorldLanguage) -> String {
        let words: (String,String,String)
        switch self {
        case .title: words = ("Make a keepsake","製作紀念冊","思い出の冊子を作る")
        case .detail: words = ("Turn a collection into a paper book with its photos, words and authors. Preview any palette, then share a PDF with World Keepsakes. The text archive is available to everyone.","把收藏集的照片、文字與作者，編成一本紙感紀念冊。先預覽配色，再透過 World Keepsakes 分享 PDF。文字封存檔開放給所有人。","コレクションの写真、言葉、作者を紙の冊子にまとめます。配色をプレビューして、World KeepsakesでPDFを共有できます。テキストアーカイブはどなたでも利用できます。")
        case .preview: words = ("Preview keepsake","預覽紀念冊","冊子をプレビュー")
        case .share: words = ("Share keepsake PDF","分享紀念冊 PDF","冊子のPDFを共有")
        case .archive: words = ("Export text archive","匯出文字封存檔","テキストアーカイブを書き出す")
        case .preparing: words = ("Preparing your collection…","正在整理收藏集⋯","コレクションを準備しています…")
        case .failed: words = ("The book could not be prepared. Try again when the circle can connect.","暫時無法製作紀念冊。圈子恢復連線後可以再試一次。","冊子を作成できませんでした。サークルに接続してからもう一度お試しください。")
        case .changed: words = ("The collection changed while the book was being prepared. Preview it again to include its current content.","製作期間收藏集有變動。請重新預覽，以收錄目前的內容。","準備中にコレクションが変更されました。もう一度プレビューして現在の内容を確認してください。")
        case .empty: words = ("Save a moment to this collection to begin your book.","先把時刻加入收藏集，就能開始製作紀念冊。","投稿をコレクションに保存すると冊子を作れます。")
        case .clay: words = ("Clay","陶土","陶土")
        case .tide: words = ("Tide","潮汐","潮")
        case .dusk: words = ("Dusk","暮色","夕暮れ")
        case .complete: words = ("Collection prepared","收藏集已整理完成","コレクションの準備ができました")
        }
        switch language {
        case .english: return words.0
        case .traditionalChinese: return words.1
        case .japanese: return words.2
        }
    }
}

@MainActor
final class WorldKeepsakeExportViewController: WorldCirclePaperViewController {
    private let circle: WorldCircle
    private let collectionID: String
    private let client: WorldSocialClient
    private let palettes = UISegmentedControl()
    private let status = WorldTheme.label("", style:.footnote, muted:true)
    private let progress = UIProgressView(progressViewStyle:.default)
    private let preview = PDFView()
    private let make = UIButton(type:.system)
    private let share = UIButton(type:.system)
    private let archive = UIButton(type:.system)
    private var task: Task<Void,Never>?
    private var preparing = false
    private var checkingAccess = false
    private var prepared: WorldCollectionDetail?
    private var pdf: Data?
    private var details: [WorldMomentDetail] = []

    init(circle: WorldCircle, collectionID: String, client: WorldSocialClient, strings: WorldStrings) {
        self.circle = circle
        self.collectionID = collectionID
        self.client = client
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = word(.title)
        titleBlock(word(.title), detail:word(.detail))
        for (index,key) in [KeepsakeWords.clay,.tide,.dusk].enumerated() {
            palettes.insertSegment(withTitle:word(key), at:index, animated:false)
        }
        palettes.selectedSegmentIndex = 0
        palettes.accessibilityIdentifier = "world.keepsake.palette"
        palettes.addAction(UIAction { [weak self] _ in self?.renderPrepared() }, for:.valueChanged)
        stack.addArrangedSubview(palettes)
        configure(make, .preview, "book", "world.keepsake.preview") { [weak self] in self?.prepare() }
        configure(share, .share, "square.and.arrow.up", "world.keepsake.share") { [weak self] in self?.sharePDF() }
        configure(archive, .archive, "square.and.arrow.down", "world.keepsake.archive") { [weak self] in self?.shareArchive() }
        stack.addArrangedSubview(status)
        stack.addArrangedSubview(progress)
        progress.isHidden = true
        preview.autoScales = true
        preview.displayMode = .singlePageContinuous
        preview.backgroundColor = WorldTheme.mapPaper
        preview.accessibilityIdentifier = "world.keepsake.document"
        preview.heightAnchor.constraint(equalToConstant:460).isActive = true
        preview.isHidden = true
        stack.addArrangedSubview(preview)
        updateButtons()
    }

    deinit { task?.cancel() }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isMovingFromParent || navigationController?.isBeingDismissed == true { task?.cancel() }
    }

    private func word(_ key: KeepsakeWords) -> String { key.text(strings.language) }

    private func configure(_ button: UIButton, _ key: KeepsakeWords, _ symbol: String,
                           _ id: String, action: @escaping () -> Void) {
        button.configuration = WorldTheme.button(word(key), symbol:symbol).configuration
        button.accessibilityIdentifier = id
        button.addAction(UIAction { _ in action() }, for:.touchUpInside)
        stack.addArrangedSubview(button)
    }

    private func updateButtons() {
        make.isEnabled = !preparing
        archive.isEnabled = !preparing
        share.isEnabled = !preparing && !checkingAccess && pdf != nil
        palettes.isEnabled = !preparing
        isModalInPresentation = preparing
    }

    private func prepare() {
        guard !preparing else { return }
        preparing = true
        status.text = word(.preparing)
        progress.progress = 0
        progress.isHidden = false
        updateButtons()
        task = Task { [weak self] in
            guard let self else { return }
            defer { preparing = false; progress.isHidden = true; updateButtons() }
            do {
                let source = try await client.collection(circleID:circle.id, id:collectionID)
                guard !source.moments.isEmpty else { status.text = word(.empty); return }
                var pages: [WorldMomentDetail] = []
                for (index,moment) in source.moments.enumerated() {
                    try Task.checkCancellation()
                    if moment.hasPhoto {
                        // Pace image-detail reads within the shared social request budget.
                        try await Task.sleep(for:.milliseconds(1400))
                        let detail = try await client.detail(circleID:circle.id, momentID:moment.id)
                        guard detail.photo != nil else { throw URLError(.cannotDecodeContentData) }
                        pages.append(detail)
                    } else {
                        pages.append(WorldMomentDetail(moment:moment, photo:nil, replies:[]))
                    }
                    progress.progress = Float(index + 1) / Float(source.moments.count)
                }
                try Task.checkCancellation()
                let current = try await client.collection(circleID:circle.id, id:collectionID)
                guard sameContent(source,current) else { status.text = word(.changed); return }
                prepared = current
                details = pages
                renderPrepared()
                status.text = word(.complete)
            } catch {
                guard !Task.isCancelled else { return }
                status.text = client.errorText(error,strings)
                prepared = nil
                pdf = nil
                preview.document = nil
                preview.isHidden = true
            }
        }
    }

    private func sameContent(_ lhs: WorldCollectionDetail, _ rhs: WorldCollectionDetail) -> Bool {
        lhs.collection.title == rhs.collection.title &&
            lhs.moments.map(\.id) == rhs.moments.map(\.id) &&
            lhs.moments.map { $0.author.name } == rhs.moments.map { $0.author.name }
    }

    private func renderPrepared() {
        guard let prepared else { return }
        pdf = WorldKeepsakePDF.render(title:prepared.collection.title, circle:circle.title,
                                     moments:details, palette:palettes.selectedSegmentIndex, strings:strings)
        preview.document = pdf.flatMap(PDFDocument.init(data:))
        preview.isHidden = pdf == nil
        updateButtons()
    }

    private func sharePDF() {
        guard !preparing, !checkingAccess, pdf != nil else { return }
        checkingAccess = true
        updateButtons()
        let store = WorldKeepsakesStore.shared
        task = Task { [weak self] in
            guard let self else { return }
            defer { checkingAccess = false; updateButtons() }
            await store.refresh()
            guard !Task.isCancelled else { return }
            guard store.hasAccess else {
                let page = WorldKeepsakesViewController(strings:strings) { [weak self] in
                    guard let self else { return }
                    navigationController?.popToViewController(self, animated:!UIAccessibility.isReduceMotionEnabled)
                    sharePDF()
                }
                navigationController?.pushViewController(page, animated:!UIAccessibility.isReduceMotionEnabled)
                return
            }
            await export(pretty:true)
        }
    }

    private func shareArchive() {
        guard !preparing else { return }
        task = Task { [weak self] in await self?.export(pretty:false) }
    }

    private func export(pretty: Bool) async {
        guard !preparing else { return }
        preparing = true
        updateButtons()
        defer { preparing = false; updateButtons() }
        do {
            let current = try await client.collection(circleID:circle.id, id:collectionID)
            try Task.checkCancellation()
            let data: Data
            if pretty {
                guard let prepared, sameContent(prepared,current), let pdf else {
                    status.text = word(.changed)
                    return
                }
                data = pdf
            } else {
                let entries: [[String:Any]] = current.moments.map { moment in
                    var entry: [String:Any] = [
                        "id":moment.id,"author":moment.author.name,"createdAt":moment.createdAt,
                        "text":moment.text,"hasPhoto":moment.hasPhoto
                    ]
                    entry["photoDescription"] = moment.photoDescription
                    entry["region"] = moment.region
                    return entry
                }
                data = try JSONSerialization.data(withJSONObject:[
                    "format":"asympta-world-text-archive-v1","circle":circle.title,
                    "collection":current.collection.title,"exportedAt":Date().timeIntervalSince1970,
                    "moments":entries
                ], options:[.prettyPrinted,.sortedKeys])
            }
            guard view.window != nil, navigationController?.topViewController === self else { return }
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("WorldKeepsake-" + UUID().uuidString, isDirectory:true)
            try FileManager.default.createDirectory(at:folder, withIntermediateDirectories:true,
                attributes:[.protectionKey:FileProtectionType.complete])
            let file = folder.appendingPathComponent(pretty ? "World-Keepsake.pdf" : "World-Text-Archive.json")
            try data.write(to:file, options:[.atomic,.completeFileProtection])
            let sheet = UIActivityViewController(activityItems:[file], applicationActivities:nil)
            sheet.popoverPresentationController?.sourceView = pretty ? share : archive
            sheet.popoverPresentationController?.sourceRect = (pretty ? share : archive).bounds
            sheet.completionWithItemsHandler = { _,_,_,_ in try? FileManager.default.removeItem(at:folder) }
            present(sheet, animated:!UIAccessibility.isReduceMotionEnabled)
        } catch {
            guard !Task.isCancelled else { return }
            status.text = client.errorText(error,strings)
        }
    }
}

@MainActor
private enum WorldKeepsakePDF {
    static func render(title: String, circle: String, moments: [WorldMomentDetail],
                       palette: Int, strings: WorldStrings) -> Data {
        let bounds = CGRect(x:0,y:0,width:595,height:842)
        let pigment = [UIColor(red:0.72,green:0.37,blue:0.22,alpha:1),
                       UIColor(red:0.28,green:0.53,blue:0.63,alpha:1),
                       UIColor(red:0.49,green:0.40,blue:0.66,alpha:1)][max(0,min(2,palette))]
        let ink = UIColor(red:0.19,green:0.17,blue:0.15,alpha:1)
        func paragraph(_ text: String, at y: CGFloat, size: CGFloat, width: CGFloat = 487,
                       color: UIColor? = nil, draw: Bool = true) -> CGFloat {
            let font = UIFont.systemFont(ofSize:size, weight:.regular)
            let serif = UIFont(descriptor:font.fontDescriptor.withDesign(.serif) ?? font.fontDescriptor, size:size)
            let style = NSMutableParagraphStyle()
            style.lineSpacing = size * 0.24
            let attributes: [NSAttributedString.Key:Any] = [.font:serif,.foregroundColor:color ?? ink,.paragraphStyle:style]
            let height = ceil((text as NSString).boundingRect(with:CGSize(width:width,height:2000),
                options:[.usesLineFragmentOrigin,.usesFontLeading],attributes:attributes,context:nil).height)
            if draw { (text as NSString).draw(in:CGRect(x:54,y:y,width:width,height:height+2), withAttributes:attributes) }
            return y + height
        }
        return UIGraphicsPDFRenderer(bounds:bounds).pdfData { renderer in
            var pageNumber = 0
            func page() {
                pageNumber += 1
                renderer.beginPage()
                WorldTheme.paper.setFill()
                renderer.cgContext.fill(bounds)
                let footer = circle + "  ·  " + String(pageNumber)
                _ = paragraph(footer,at:797,size:10,color:ink.withAlphaComponent(0.65))
            }
            page()
            let context = renderer.cgContext
            let colors = [pigment.withAlphaComponent(0.4).cgColor,pigment.withAlphaComponent(0).cgColor] as CFArray
            if let gradient = CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:colors,locations:[0,1]) {
                context.drawRadialGradient(gradient,startCenter:CGPoint(x:390,y:230),startRadius:0,
                    endCenter:CGPoint(x:390,y:230),endRadius:220,options:[])
            }
            _ = paragraph("Asympta World",at:82,size:15)
            let end = paragraph(title,at:310,size:44)
            _ = paragraph(circle,at:end+28,size:19)
            _ = paragraph(strings.date(Date()),at:710,size:13,color:ink.withAlphaComponent(0.7))
            for detail in moments {
                page()
                let moment = detail.moment
                pigment.setStroke()
                context.setLineWidth(0.7)
                for radius in [CGFloat(14),CGFloat(19),CGFloat(25)] {
                    context.strokeEllipse(in:CGRect(x:78-radius,y:81-radius,width:radius*2,height:radius*2))
                }
                var y = paragraph(moment.author.name,at:125,size:24)
                y = paragraph(strings.momentDate(moment.createdAt),at:y+12,size:12,color:ink.withAlphaComponent(0.65))
                if !moment.text.isEmpty { y = paragraph(moment.text,at:y+28,size:18) }
                let descriptionHeight = moment.photoDescription.map { paragraph($0,at:0,size:12,draw:false) + 16 } ?? 0
                if let bytes = detail.photo, let picture = UIImage(data:bytes) {
                    if y + descriptionHeight + 200 > 746 {
                        page()
                        y = paragraph(moment.author.name,at:65,size:19)
                    }
                    let available = min(CGFloat(430),max(80,746-y-descriptionHeight-22))
                    let scale = min(487/picture.size.width,available/picture.size.height)
                    let size = CGSize(width:picture.size.width*scale,height:picture.size.height*scale)
                    let rect = CGRect(x:54,y:y+22,width:size.width,height:size.height)
                    picture.draw(in:rect)
                    y = rect.maxY
                }
                if let description = moment.photoDescription {
                    _ = paragraph(description,at:y+16,size:12,color:ink.withAlphaComponent(0.7))
                }
            }
        }
    }
}
