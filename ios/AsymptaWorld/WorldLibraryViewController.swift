import UIKit

@MainActor
private final class WorldCollectionCreation {
    private let client: WorldSocialClient
    private let circleID: String
    private let strings: WorldStrings
    private struct Attempt: Codable {
        let id: String
        let title: String
    }
    private var pendingKey: String { "world.social.collection-create-v1." + circleID }
    private var attempt: Attempt? {
        get {
            guard let data = UserDefaults.standard.data(forKey:pendingKey),
                  let value = try? JSONDecoder().decode(Attempt.self,from:data),
                  WorldSocialClient.validID(value.id) else { return nil }
            return value
        }
        set {
            if let newValue, let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data,forKey:pendingKey)
            } else {
                UserDefaults.standard.removeObject(forKey:pendingKey)
            }
        }
    }
    private(set) var busy = false
    var hasPending: Bool { attempt != nil }

    init(client: WorldSocialClient, circleID: String, strings: WorldStrings) {
        self.client = client
        self.circleID = circleID
        self.strings = strings
    }

    func begin(on page: WorldCirclePaperViewController, changed: @escaping () -> Void,
               completed: @escaping (WorldCollection) -> Void) {
        guard !busy else { return }
        if let attempt {
            send(attempt, on:page, changed:changed, completed:completed)
            return
        }
        let prompt = UIAlertController(title:strings.library(.newCollection),
                                       message:strings.library(.collectionTitleHint), preferredStyle:.alert)
        prompt.addAction(UIAlertAction(title:strings.library(.cancel), style:.cancel))
        let submit = UIAlertAction(title:strings.library(.create), style:.default) { [weak self, weak page, weak prompt] _ in
            guard let self, let page else { return }
            let title = (prompt?.textFields?.first?.text ?? "").trimmingCharacters(in:.whitespacesAndNewlines)
            guard !title.isEmpty, title.unicodeScalars.count <= 60 else {
                return
            }
            let attempt = Attempt(id:WorldSocialClient.identifier(),title:title)
            self.attempt = attempt
            self.send(attempt,on:page,changed:changed,completed:completed)
        }
        submit.isEnabled = false
        prompt.addTextField { field in
            field.placeholder = self.strings.library(.collectionTitle)
            field.accessibilityIdentifier = "world.library.collection.title"
            field.autocapitalizationType = .sentences
            field.returnKeyType = .done
            field.addAction(UIAction { [weak field, weak submit] _ in
                let value = (field?.text ?? "").trimmingCharacters(in:.whitespacesAndNewlines)
                submit?.isEnabled = !value.isEmpty && value.unicodeScalars.count <= 60
            },for:.editingChanged)
        }
        prompt.addAction(submit)
        page.present(prompt,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func send(_ attempt: Attempt, on page: WorldCirclePaperViewController,
                      changed: @escaping () -> Void, completed: @escaping (WorldCollection) -> Void) {
        busy = true
        changed()
        page.navigationItem.hidesBackButton = true
        page.isModalInPresentation = true
        Task { [self, page] in
            do {
                let collection = try await client.createCollection(circleID:circleID,id:attempt.id,title:attempt.title)
                self.attempt = nil
                busy = false
                page.navigationItem.hidesBackButton = false
                page.isModalInPresentation = false
                changed()
                completed(collection)
            } catch {
                if client.isDefinitiveFailure(error) { self.attempt = nil }
                busy = false
                page.navigationItem.hidesBackButton = false
                page.isModalInPresentation = false
                changed()
                page.notify(client.errorText(error,strings))
            }
        }
    }
}

@MainActor
private extension WorldCirclePaperViewController {
    func libraryAction(_ key: WorldLibraryCopy, _ symbol: String, id: String,
                       filled: Bool = false, run: @escaping () -> Void) -> UIButton {
        let button = WorldTheme.button(strings.library(key),symbol:symbol,filled:filled)
        button.accessibilityIdentifier = id
        button.addAction(UIAction { _ in run() },for:.touchUpInside)
        return button
    }

    func libraryMoment(_ moment: WorldMoment, id: String, onOpen: @escaping () -> Void) -> UIButton {
        let description = moment.text.isEmpty ? (moment.photoDescription ?? strings.library(.photoMoment)) : moment.text
        let footer = [date(moment.createdAt), count(moment.replyCount,.circleRepliesFormat)].joined(separator:" · ")
        return WorldCircleSlip(title:moment.author.name,detail:description,footer:footer,ink:0x718e9f,
                               style:moment.author.style.flatMap(WorldCircleInkStyle.init(rawValue:)),id:id,onOpen:onOpen)
    }

    func libraryLoading() {
        let indicator = UIActivityIndicatorView(style:.medium)
        indicator.startAnimating()
        stack.addArrangedSubview(indicator)
        message(strings.library(.loading))
    }
}

final class WorldLibraryViewController: WorldCirclePaperViewController, UISearchResultsUpdating {
    private let circle: WorldCircle
    private let client: WorldSocialClient
    private let search = UISearchController(searchResultsController:nil)
    private let tabs = UISegmentedControl(items:[])
    private let timeScope = UISegmentedControl(items:[])
    private let refresh = UIRefreshControl()
    private let content = UIStackView()
    private let weekRow = UIStackView()
    private let weekLabel = UIButton(type:.system)
    private var nextWeekButton: UIButton!
    private var calendar: Calendar {
        var calendar = Calendar(identifier:.gregorian)
        calendar.timeZone = .current
        calendar.firstWeekday = 2
        calendar.minimumDaysInFirstWeek = 4
        return calendar
    }
    private var selectedWeek = Date()
    private var weekEnd: Date { calendar.date(byAdding:.day,value:7,to:selectedWeek)! }
    private var query = ""
    private var moments: [WorldMoment] = []
    private var collections: [WorldCollection] = []
    private var nextBefore: WorldLibraryCursor?
    private var hasMore = false
    private var loaded = false
    private var loading = false
    private var failure: Error?
    private var loadTask: Task<Void,Never>?
    private let creator: WorldCollectionCreation

    init(circle: WorldCircle, client: WorldSocialClient, strings: WorldStrings) {
        self.circle = circle
        self.client = client
        creator = WorldCollectionCreation(client:client,circleID:circle.id,strings:strings)
        super.init(strings:strings)
        selectedWeek = startOfWeek(Date())
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings.library(.library)
        titleBlock(circle.title,detail:strings.library(.libraryDetail))
        tabs.insertSegment(withTitle:strings.library(.moments),at:0,animated:false)
        tabs.insertSegment(withTitle:strings.library(.collections),at:1,animated:false)
        tabs.selectedSegmentIndex = 0
        tabs.accessibilityIdentifier = "world.library.tabs"
        tabs.addTarget(self,action:#selector(tabChanged),for:.valueChanged)
        stack.addArrangedSubview(tabs)
        timeScope.insertSegment(withTitle:strings.library(.allTime),at:0,animated:false)
        timeScope.insertSegment(withTitle:strings.library(.week),at:1,animated:false)
        timeScope.selectedSegmentIndex = 0
        timeScope.accessibilityIdentifier = "world.library.time"
        timeScope.addTarget(self,action:#selector(scopeChanged),for:.valueChanged)
        stack.addArrangedSubview(timeScope)
        configureWeek()
        stack.addArrangedSubview(weekRow)
        content.axis = .vertical
        content.spacing = 14
        stack.addArrangedSubview(content)
        search.obscuresBackgroundDuringPresentation = false
        search.searchResultsUpdater = self
        search.searchBar.placeholder = strings.library(.search)
        search.searchBar.accessibilityIdentifier = "world.library.search"
        navigationItem.searchController = search
        navigationItem.hidesSearchBarWhenScrolling = false
        definesPresentationContext = true
        let item = UIBarButtonItem(image:UIImage(systemName:"arrow.clockwise"),style:.plain,
                                   target:self,action:#selector(refreshNow))
        item.accessibilityLabel = strings.library(.refresh)
        item.accessibilityIdentifier = "world.library.refresh"
        navigationItem.rightBarButtonItem = item
        refresh.addAction(UIAction { [weak self] _ in self?.load() },for:.valueChanged)
        scroll.refreshControl = refresh
        NotificationCenter.default.addObserver(self,selector:#selector(activated(_:)),
                                                name:UIScene.didActivateNotification,object:nil)
        render()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        load()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        loadTask?.cancel()
        loading = false
        refresh.endRefreshing()
    }

    deinit { loadTask?.cancel() }

    func updateSearchResults(for searchController: UISearchController) {
        let raw = searchController.searchBar.text ?? ""
        let bounded = String(String.UnicodeScalarView(raw.unicodeScalars.prefix(100)))
        if raw != bounded { searchController.searchBar.text = bounded }
        let text = bounded.trimmingCharacters(in:.whitespacesAndNewlines)
        guard text != query else { return }
        query = text
        if tabs.selectedSegmentIndex == 1 {
            render()
        } else {
            load(reset:true,debounce:true)
        }
    }

    private func configureWeek() {
        weekRow.axis = .horizontal
        weekRow.alignment = .center
        weekRow.spacing = 8
        let previous = libraryAction(.previousWeek,"chevron.left",id:"world.library.week.previous") { [weak self] in self?.moveWeek(-1) }
        previous.configuration?.title = nil
        previous.accessibilityLabel = strings.library(.previousWeek)
        nextWeekButton = libraryAction(.nextWeek,"chevron.right",id:"world.library.week.next") { [weak self] in self?.moveWeek(1) }
        nextWeekButton.configuration?.title = nil
        nextWeekButton.accessibilityLabel = strings.library(.nextWeek)
        weekLabel.titleLabel?.font = WorldTheme.font(.subheadline)
        weekLabel.titleLabel?.numberOfLines = 0
        weekLabel.titleLabel?.textAlignment = .center
        weekLabel.setTitleColor(WorldTheme.ink,for:.normal)
        weekLabel.accessibilityIdentifier = "world.library.week.range"
        weekLabel.accessibilityHint = strings.library(.chooseDate)
        weekLabel.addAction(UIAction { [weak self] _ in self?.chooseWeek() },for:.touchUpInside)
        weekRow.addArrangedSubview(previous)
        weekRow.addArrangedSubview(weekLabel)
        weekRow.addArrangedSubview(nextWeekButton)
        previous.widthAnchor.constraint(equalToConstant:44).isActive = true
        nextWeekButton.widthAnchor.constraint(equalToConstant:44).isActive = true
        weekLabel.heightAnchor.constraint(greaterThanOrEqualToConstant:44).isActive = true
    }

    private func startOfWeek(_ date: Date) -> Date {
        calendar.dateInterval(of:.weekOfYear,for:date)!.start
    }

    private func moveWeek(_ amount: Int) {
        selectedWeek = calendar.date(byAdding:.day,value:amount * 7,to:selectedWeek)!
        load()
    }

    private func chooseWeek() {
        let picker = WorldWeekPickerViewController(strings:strings,date:selectedWeek) { [weak self] date in
            guard let self else { return }
            selectedWeek = startOfWeek(date)
            load()
        }
        navigationController?.pushViewController(picker,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    @objc private func tabChanged() {
        search.searchBar.resignFirstResponder()
        search.searchBar.placeholder = strings.library(tabs.selectedSegmentIndex == 1 ? .searchCollections : .search)
        load()
    }

    @objc private func scopeChanged() { load() }
    @objc private func refreshNow() { load() }

    @objc private func activated(_ note: Notification) {
        guard navigationController?.topViewController === self,
              let scene = viewIfLoaded?.window?.windowScene,
              (note.object as? UIScene) === scene else { return }
        selectedWeek = startOfWeek(selectedWeek)
        load()
    }

    private func load(reset: Bool = true, debounce: Bool = false) {
        loadTask?.cancel()
        if reset {
            moments = []
            nextBefore = nil
            hasMore = false
            loaded = false
        }
        failure = nil
        loading = true
        render()
        let showingCollections = tabs.selectedSegmentIndex == 1
        let filter = query
        let start = timeScope.selectedSegmentIndex == 1 ? selectedWeek.timeIntervalSince1970 * 1000 : nil
        let end = timeScope.selectedSegmentIndex == 1 ? weekEnd.timeIntervalSince1970 * 1000 : nil
        let cursor = reset ? nil : nextBefore
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                if debounce { try await Task.sleep(for:.milliseconds(300)) }
                if showingCollections {
                    let values = try await client.collections(circleID:circle.id)
                    try Task.checkCancellation()
                    collections = values
                } else {
                    let page = try await client.browse(circleID:circle.id,query:filter,weekStart:start,weekEnd:end,before:cursor)
                    try Task.checkCancellation()
                    let existingIDs = Set(moments.map(\.id))
                    moments += page.moments.filter { !existingIDs.contains($0.id) }
                    nextBefore = page.nextBefore
                    hasMore = page.hasMore
                }
                loaded = true
            } catch {
                guard !Task.isCancelled else { return }
                failure = error
                if client.isDefinitiveFailure(error) {
                    collections = []
                    moments = []
                }
            }
            loading = false
            refresh.endRefreshing()
            render()
        }
    }

    private func render() {
        guard isViewLoaded else { return }
        let showingCollections = tabs.selectedSegmentIndex == 1
        tabs.isEnabled = !creator.busy
        timeScope.isHidden = showingCollections
        weekRow.isHidden = showingCollections || timeScope.selectedSegmentIndex == 0
        weekLabel.setTitle(strings.libraryWeek(selectedWeek,end:weekEnd),for:.normal)
        nextWeekButton.isEnabled = selectedWeek < startOfWeek(Date())
        content.arrangedSubviews.forEach { content.removeArrangedSubview($0); $0.removeFromSuperview() }
        if showingCollections {
            let create = libraryAction(creator.hasPending ? .retryCreate : .newCollection,"plus",id:"world.library.collection.create",filled:true) { [weak self] in self?.createCollection() }
            create.isEnabled = !creator.busy
            content.addArrangedSubview(create)
            if creator.hasPending { content.addArrangedSubview(WorldTheme.label(strings.library(.uncertainCreate),style:.footnote,muted:true)) }
            content.addArrangedSubview(WorldTheme.label(strings.library(.collectionsDetail),style:.subheadline,muted:true))
            let values = collections.filter { query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) }
            for collection in values {
                content.addArrangedSubview(WorldCircleSlip(title:collection.title,detail:strings.libraryCount(collection.itemCount),
                                                           footer:date(collection.createdAt),ink:0xc9944c,id:"world.library.collection.\(collection.id)") { [weak self] in
                    self?.openCollection(collection)
                })
            }
            if loaded && values.isEmpty { empty(query.isEmpty ? .noCollections : .noResults) }
        } else {
            var currentDay: Date?
            for moment in moments {
                let day = calendar.startOfDay(for:Date(timeIntervalSince1970:moment.createdAt / 1000))
                if day != currentDay {
                    let heading = WorldTheme.label(strings.date(day),style:.headline,muted:true)
                    heading.accessibilityTraits.insert(.header)
                    content.addArrangedSubview(heading)
                    currentDay = day
                }
                content.addArrangedSubview(libraryMoment(moment,id:"world.library.moment.\(moment.id)") { [weak self] in self?.openMoment(moment) })
            }
            if loaded && moments.isEmpty { empty(!query.isEmpty ? .noResults : timeScope.selectedSegmentIndex == 1 ? .noWeekMoments : .empty) }
            if hasMore && !loading {
                content.addArrangedSubview(libraryAction(.earlier,"arrow.down",id:"world.library.earlier") { [weak self] in self?.load(reset:false) })
            }
        }
        if loading {
            let indicator = UIActivityIndicatorView(style:.medium)
            indicator.startAnimating()
            content.addArrangedSubview(indicator)
        }
        if let failure {
            if !moments.isEmpty || (showingCollections && !collections.isEmpty) {
                content.addArrangedSubview(WorldTheme.label(strings.library(.cachedResults),style:.footnote,muted:true))
            }
            let label = WorldTheme.label(client.errorText(failure,strings),style:.footnote,muted:true)
            label.accessibilityIdentifier = "world.library.error"
            content.addArrangedSubview(label)
            content.addArrangedSubview(libraryAction(.retry,"arrow.clockwise",id:"world.library.retry") { [weak self] in self?.load() })
        }
    }

    private func empty(_ key: WorldLibraryCopy) {
        let label = WorldTheme.label(strings.library(key),style:.subheadline,muted:true)
        label.accessibilityIdentifier = "world.library.empty"
        content.addArrangedSubview(label)
    }

    private func createCollection() {
        creator.begin(on:self,changed:{ [weak self] in self?.render() }) { [weak self] collection in
            self?.openCollection(collection)
        }
    }

    private func openCollection(_ collection: WorldCollection) {
        search.searchBar.resignFirstResponder()
        let page = WorldCollectionDetailViewController(circle:circle,collection:collection,client:client,strings:strings)
        navigationController?.pushViewController(page,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func openMoment(_ moment: WorldMoment) {
        search.searchBar.resignFirstResponder()
        let page = WorldMomentViewController(circle:circle,momentID:moment.id,client:client,strings:strings,onChanged:{})
        navigationController?.pushViewController(page,animated:!UIAccessibility.isReduceMotionEnabled)
    }
}

private final class WorldWeekPickerViewController: WorldCirclePaperViewController {
    private let picker = UIDatePicker()
    private let chosen: (Date) -> Void

    init(strings: WorldStrings, date: Date, chosen: @escaping (Date) -> Void) {
        self.chosen = chosen
        super.init(strings:strings)
        picker.date = date
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings.library(.chooseDate)
        titleBlock(strings.library(.chooseDate),detail:strings.library(.weekDetail))
        picker.datePickerMode = .date
        picker.preferredDatePickerStyle = .compact
        picker.locale = strings.language.locale
        picker.maximumDate = Date()
        picker.accessibilityIdentifier = "world.library.week.picker"
        stack.addArrangedSubview(picker)
        stack.addArrangedSubview(libraryAction(.close,"checkmark",id:"world.library.week.done",filled:true) { [weak self] in
            guard let self else { return }
            chosen(picker.date)
            navigationController?.popViewController(animated:!UIAccessibility.isReduceMotionEnabled)
        })
    }
}

private final class WorldCollectionDetailViewController: WorldCirclePaperViewController {
    private let circle: WorldCircle
    private let collection: WorldCollection
    private let client: WorldSocialClient
    private let refresh = UIRefreshControl()
    private var detail: WorldCollectionDetail?
    private var failure: Error?
    private var loading = false
    private var mutating = false
    private var visibleLimit = 24
    private var loadTask: Task<Void,Never>?

    init(circle: WorldCircle, collection: WorldCollection, client: WorldSocialClient, strings: WorldStrings) {
        self.circle = circle
        self.collection = collection
        self.client = client
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = collection.title
        refresh.addAction(UIAction { [weak self] _ in self?.load() },for:.valueChanged)
        scroll.refreshControl = refresh
        NotificationCenter.default.addObserver(self,selector:#selector(activated(_:)),
                                                name:UIScene.didActivateNotification,object:nil)
        render()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        load()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        loadTask?.cancel()
        loading = false
        refresh.endRefreshing()
    }

    deinit { loadTask?.cancel() }

    @objc private func activated(_ note: Notification) {
        guard navigationController?.topViewController === self,
              let scene = viewIfLoaded?.window?.windowScene,
              (note.object as? UIScene) === scene else { return }
        load()
    }

    private func load() {
        guard !mutating else { return }
        loadTask?.cancel()
        loading = true
        failure = nil
        render()
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let value = try await client.collection(circleID:circle.id,id:collection.id)
                try Task.checkCancellation()
                detail = value
            } catch {
                guard !Task.isCancelled else { return }
                failure = error
                if client.isDefinitiveFailure(error) { detail = nil }
            }
            loading = false
            refresh.endRefreshing()
            render()
        }
    }

    private func render() {
        guard isViewLoaded else { return }
        clearPage()
        titleBlock(detail?.collection.title ?? collection.title,detail:circle.title)
        if let detail {
            message(strings.libraryCount(detail.moments.count))
            if detail.moments.isEmpty { message(strings.library(.collectionEmpty)) }
            for moment in detail.moments.prefix(visibleLimit) {
                let card = libraryMoment(moment,id:"world.library.saved.\(moment.id)") { [weak self] in
                    guard let self, !mutating else { return }
                    let page = WorldMomentViewController(circle:circle,momentID:moment.id,client:client,strings:strings,onChanged:{})
                    navigationController?.pushViewController(page,animated:!UIAccessibility.isReduceMotionEnabled)
                }
                card.isEnabled = !mutating
                let remove = libraryAction(.removeSaved,"minus.circle",id:"world.library.saved.remove.\(moment.id)") { [weak self] in
                    self?.confirmRemove(moment)
                }
                remove.configuration?.title = nil
                remove.accessibilityLabel = strings.library(.removeFromCollection)
                remove.accessibilityValue = moment.text.isEmpty ? moment.photoDescription : moment.text
                remove.isEnabled = !mutating
                remove.widthAnchor.constraint(equalToConstant:44).isActive = true
                let row = UIStackView(arrangedSubviews:[card,remove])
                row.axis = .horizontal
                row.alignment = .center
                row.spacing = 4
                stack.addArrangedSubview(row)
            }
            if detail.moments.count > visibleLimit {
                stack.addArrangedSubview(libraryAction(.more,"arrow.down",id:"world.library.saved.more") { [weak self] in
                    guard let self else { return }
                    visibleLimit += 24
                    render()
                })
            }
        }
        let keepsake = UIBarButtonItem(image:UIImage(systemName:"book.closed"),style:.plain,
                                       target:self,action:#selector(makeKeepsake))
        keepsake.accessibilityLabel = strings.library(.keepsake)
        keepsake.accessibilityIdentifier = "world.collection.keepsake"
        keepsake.isEnabled = detail != nil && !mutating && !loading
        var actions = [keepsake]
        let current = detail?.collection ?? collection
        if current.owned || circle.canInvite {
            let remove = UIBarButtonItem(image:UIImage(systemName:"trash"),style:.plain,target:self,action:#selector(confirmDelete))
            remove.accessibilityLabel = strings.library(.removeCollection)
            remove.accessibilityIdentifier = "world.library.collection.delete"
            remove.isEnabled = !mutating
            actions.append(remove)
        }
        navigationItem.rightBarButtonItems = actions
        if loading { libraryLoading() }
        if let failure {
            if detail != nil { message(strings.library(.cachedResults)) }
            message(client.errorText(failure,strings))
            stack.addArrangedSubview(libraryAction(.retry,"arrow.clockwise",id:"world.library.collection.retry") { [weak self] in self?.load() })
        }
    }

    @objc private func makeKeepsake() {
        guard detail != nil, !mutating, !loading else { return }
        let page = WorldKeepsakeExportViewController(circle:circle,collectionID:collection.id,client:client,strings:strings)
        navigationController?.pushViewController(page,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func confirmRemove(_ moment: WorldMoment) {
        guard !mutating else { return }
        let prompt = UIAlertController(title:strings.library(.removeFromCollection),
                                       message:strings.library(.removeItemDetail),preferredStyle:.alert)
        prompt.addAction(UIAlertAction(title:strings.library(.cancel),style:.cancel))
        prompt.addAction(UIAlertAction(title:strings.library(.remove),style:.destructive) { [weak self] _ in
            self?.remove(moment)
        })
        present(prompt,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func remove(_ moment: WorldMoment) {
        guard !mutating else { return }
        mutating = true
        render()
        Task { [self] in
            do {
                try await client.setCollected(circleID:circle.id,collectionID:collection.id,momentID:moment.id,active:false)
                mutating = false
                load()
            } catch {
                mutating = false
                render()
                notify(client.errorText(error,strings))
            }
        }
    }

    @objc private func confirmDelete() {
        guard !mutating else { return }
        let prompt = UIAlertController(title:strings.library(.removeCollection),
                                       message:strings.library(.removeCollectionDetail),preferredStyle:.alert)
        prompt.addAction(UIAlertAction(title:strings.library(.cancel),style:.cancel))
        prompt.addAction(UIAlertAction(title:strings.library(.removeCollection),style:.destructive) { [weak self] _ in
            self?.deleteCollection()
        })
        present(prompt,animated:!UIAccessibility.isReduceMotionEnabled)
    }

    private func deleteCollection() {
        guard !mutating else { return }
        mutating = true
        render()
        Task { [self] in
            do {
                try await client.removeCollection(circleID:circle.id,id:collection.id)
                mutating = false
                navigationController?.popViewController(animated:!UIAccessibility.isReduceMotionEnabled)
            } catch {
                mutating = false
                render()
                notify(client.errorText(error,strings))
            }
        }
    }
}

final class WorldCollectionPickerViewController: WorldCirclePaperViewController {
    private let circle: WorldCircle
    private let momentID: String
    private let client: WorldSocialClient
    private let onSaved: (() -> Void)?
    private let creator: WorldCollectionCreation
    private let refresh = UIRefreshControl()
    private var collections: [WorldCollection] = []
    private var failure: Error?
    private var loading = false
    private var loaded = false
    private var mutating = false
    private var loadTask: Task<Void,Never>?

    init(circle: WorldCircle, momentID: String, client: WorldSocialClient, strings: WorldStrings,
         onSaved: (() -> Void)? = nil) {
        self.circle = circle
        self.momentID = momentID
        self.client = client
        self.onSaved = onSaved
        creator = WorldCollectionCreation(client:client,circleID:circle.id,strings:strings)
        super.init(strings:strings)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = strings.library(.saveToCollection)
        refresh.addAction(UIAction { [weak self] _ in self?.load() },for:.valueChanged)
        scroll.refreshControl = refresh
        render()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        load()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        loadTask?.cancel()
        loading = false
        refresh.endRefreshing()
    }

    deinit { loadTask?.cancel() }

    private func load() {
        guard !mutating else { return }
        loadTask?.cancel()
        failure = nil
        loading = true
        render()
        loadTask = Task { [weak self] in
            guard let self else { return }
            do {
                let values = try await client.collections(circleID:circle.id,momentID:momentID)
                try Task.checkCancellation()
                collections = values
                loaded = true
            } catch {
                guard !Task.isCancelled else { return }
                failure = error
                if client.isDefinitiveFailure(error) { collections = [] }
            }
            loading = false
            refresh.endRefreshing()
            render()
        }
    }

    private func render() {
        guard isViewLoaded else { return }
        clearPage()
        titleBlock(strings.library(.saveToCollection),detail:circle.title)
        let create = libraryAction(creator.hasPending ? .retryCreate : .newCollection,"plus",
                                   id:"world.library.picker.create",filled:true) { [weak self] in self?.create() }
        create.isEnabled = !mutating && !creator.busy
        stack.addArrangedSubview(create)
        if creator.hasPending { message(strings.library(.uncertainCreate)) }
        for collection in collections {
            let saved = collection.containsMoment == true
            let state = strings.library(saved ? .savedInCollection : .save)
            let card = WorldCircleSlip(title:collection.title,detail:strings.libraryCount(collection.itemCount),
                                       footer:state,ink:saved ? 0x718e9f : 0xc9944c,
                                       id:"world.library.picker.\(collection.id)") { [weak self] in
                self?.setSaved(collection,active:!saved)
            }
            card.accessibilityValue = state
            card.accessibilityHint = strings.library(saved ? .removeSaved : .saveToCollection)
            card.isEnabled = !mutating && !creator.busy && !loading
            stack.addArrangedSubview(card)
        }
        if loaded && collections.isEmpty { message(strings.library(.collectionsDetail)) }
        if loading || mutating { libraryLoading() }
        if let failure {
            message(client.errorText(failure,strings))
            stack.addArrangedSubview(libraryAction(.retry,"arrow.clockwise",id:"world.library.picker.retry") { [weak self] in self?.load() })
        }
    }

    private func create() {
        creator.begin(on:self,changed:{ [weak self] in self?.render() }) { [weak self] collection in
            self?.setSaved(collection,active:true)
        }
    }

    private func setSaved(_ collection: WorldCollection, active: Bool) {
        guard !mutating else { return }
        mutating = true
        render()
        Task { [self] in
            do {
                try await client.setCollected(circleID:circle.id,collectionID:collection.id,momentID:momentID,active:active)
                mutating = false
                onSaved?()
                load()
                UIAccessibility.post(notification:.announcement,
                                     argument:strings.library(active ? .collectionSaved : .collectionRemoved))
            } catch {
                mutating = false
                render()
                notify(client.errorText(error,strings))
                load()
            }
        }
    }
}
