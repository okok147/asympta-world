import UIKit

final class WorldPanelsViewController: UIViewController, UITextFieldDelegate {
    enum Content { case meet, aura, me, resident(WorldResident) }

    let content: Content
    private let store: WorldStore
    private let art: WorldArt
    private let onVisit: (WorldResident) -> Void
    private let stack = UIStackView()
    private let scroll = UIScrollView()
    private var observer: NSObjectProtocol?
    var onClose: (() -> Void)?

    init(content: Content, store: WorldStore, art: WorldArt, onVisit: @escaping (WorldResident) -> Void) {
        self.content = content
        self.store = store
        self.art = art
        self.onVisit = onVisit
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = WorldTheme.paper
        let texture = UIImageView(image: art.paper)
        texture.contentMode = .scaleToFill
        texture.alpha = 0.55
        texture.translatesAutoresizingMaskIntoConstraints = false
        texture.isAccessibilityElement = false
        view.addSubview(texture)
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.keyboardDismissMode = .interactive
        scroll.alwaysBounceVertical = true
        view.addSubview(scroll)
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            texture.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            texture.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            texture.topAnchor.constraint(equalTo: view.topAnchor),
            texture.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 20),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -32),
            stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -48)
        ])
        observer = NotificationCenter.default.addObserver(forName: .watercolorWorldDidChange, object: store, queue: .main) { [weak self] _ in
            Task { @MainActor [weak self] in self?.rebuild() }
        }
        rebuild()
    }

    deinit { if let observer { NotificationCenter.default.removeObserver(observer) } }

    private func rebuild() {
        let s = store.strings
        let oldOffset = scroll.contentOffset
        for arranged in stack.arrangedSubviews { stack.removeArrangedSubview(arranged); arranged.removeFromSuperview() }
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: s[.close], style: .done, target: self, action: #selector(close))
        navigationItem.rightBarButtonItem?.accessibilityIdentifier = "world.panel.close"
        navigationItem.backButtonTitle = s[.me]
        switch content {
        case .meet:
            title = s[.meet]
            heading(s[.meetTitle], detail: s[.meetSubtitle])
            for resident in WorldResident.allCases { residentCard(resident) }
        case .aura:
            title = s[.aura]
            heading(s[.auraTitle], detail: s[.auraSubtitle])
            for mood in AuraMood.allCases { moodButton(mood) }
            stack.addArrangedSubview(WorldTheme.label(s[.localWorld], style: .footnote, muted: true))
        case .me:
            title = s[.me]
            profile()
        case .resident(let resident):
            title = s[resident.nameKey]
            residentDetail(resident)
        }
        if store.loadFailed {
            let error = WorldTheme.label(s[.loadErrorDetail], style: .footnote)
            error.textColor = .systemBrown
            error.accessibilityIdentifier = "world.storage.error"
            stack.addArrangedSubview(error)
        }
        view.layoutIfNeeded()
        let maximum = max(-scroll.adjustedContentInset.top, scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom)
        scroll.contentOffset = CGPoint(x: 0, y: min(max(oldOffset.y, -scroll.adjustedContentInset.top), maximum))
    }

    private func heading(_ title: String, detail: String) {
        stack.addArrangedSubview(WorldTheme.label(title, style: .title1))
        stack.addArrangedSubview(WorldTheme.label(detail, muted: true))
        stack.setCustomSpacing(28, after: stack.arrangedSubviews.last!)
    }

    private func residentCard(_ resident: WorldResident) {
        let s = store.strings
        let container = card()
        let body = UIStackView()
        body.axis = .vertical
        body.spacing = 10
        inset(body, in: container, padding: 16)
        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 14
        row.alignment = .center
        let image = UIImageView(image: art.portraits[resident])
        image.contentMode = .scaleAspectFit
        image.isAccessibilityElement = false
        image.widthAnchor.constraint(equalToConstant: 82).isActive = true
        image.heightAnchor.constraint(equalToConstant: 82).isActive = true
        row.addArrangedSubview(image)
        let labels = UIStackView()
        labels.axis = .vertical
        labels.spacing = 6
        labels.addArrangedSubview(WorldTheme.label(s[resident.nameKey], style: .headline))
        labels.addArrangedSubview(WorldTheme.label(s[resident.detailKey], style: .subheadline, muted: true))
        row.addArrangedSubview(labels)
        body.addArrangedSubview(row)
        let actions = UIStackView()
        actions.axis = traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? .vertical : .horizontal
        actions.spacing = 8
        let favorite = favoriteButton(resident)
        let visit = WorldTheme.button(s[.visit], symbol: "location")
        visit.accessibilityIdentifier = "world.visit.\(resident.rawValue)"
        visit.addAction(UIAction { [weak self] _ in self?.onVisit(resident) }, for: .touchUpInside)
        actions.addArrangedSubview(favorite)
        actions.addArrangedSubview(visit)
        body.addArrangedSubview(actions)
        stack.addArrangedSubview(container)
    }

    private func residentDetail(_ resident: WorldResident) {
        let s = store.strings
        let image = UIImageView(image: art.portraits[resident])
        image.contentMode = .scaleAspectFit
        image.heightAnchor.constraint(equalToConstant: 156).isActive = true
        image.isAccessibilityElement = false
        stack.addArrangedSubview(image)
        heading(s[resident.nameKey], detail: s[resident.detailKey])
        stack.addArrangedSubview(favoriteButton(resident))
        let visit = WorldTheme.button(s[.visit], symbol: "location", filled: true)
        visit.accessibilityIdentifier = "world.visit.\(resident.rawValue)"
        visit.addAction(UIAction { [weak self] _ in self?.onVisit(resident) }, for: .touchUpInside)
        stack.addArrangedSubview(visit)
    }

    private func favoriteButton(_ resident: WorldResident) -> UIButton {
        let s = store.strings
        let selected = store.state.favorites.contains(resident)
        let button = WorldTheme.button(s[selected ? .favorited : .favorite], symbol: selected ? "heart.fill" : "heart")
        button.accessibilityIdentifier = "world.favorite.\(resident.rawValue)"
        if selected { button.accessibilityTraits.insert(.selected) }
        button.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            if !self.store.toggleFavorite(resident) { self.showSaveError() }
        }, for: .touchUpInside)
        return button
    }

    private func moodButton(_ mood: AuraMood) {
        let s = store.strings
        let selected = store.state.aura == mood
        let button = UIButton(type: .custom)
        button.backgroundColor = UIColor.white.withAlphaComponent(selected ? 0.56 : 0.24)
        button.layer.cornerRadius = 16
        button.layer.borderWidth = selected ? 1.4 : 0.6
        button.layer.borderColor = (selected ? WorldTheme.leaf.withAlphaComponent(0.7) : WorldTheme.line).cgColor
        button.accessibilityLabel = s[mood.nameKey] + ". " + s[mood.detailKey]
        button.accessibilityIdentifier = "world.aura.\(mood.rawValue)"
        button.accessibilityTraits = selected ? [.button, .selected] : .button
        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 16
        row.alignment = .center
        row.isUserInteractionEnabled = false
        inset(row, in: button, padding: 18)
        let swatch = UIView()
        swatch.backgroundColor = mood.color.withAlphaComponent(0.65)
        swatch.layer.cornerRadius = 18
        swatch.widthAnchor.constraint(equalToConstant: 36).isActive = true
        swatch.heightAnchor.constraint(equalToConstant: 36).isActive = true
        row.addArrangedSubview(swatch)
        let labels = UIStackView()
        labels.axis = .vertical
        labels.spacing = 5
        labels.addArrangedSubview(WorldTheme.label(s[mood.nameKey], style: .headline))
        labels.addArrangedSubview(WorldTheme.label(s[mood.detailKey], style: .subheadline, muted: true))
        row.addArrangedSubview(labels)
        let check = UIImageView(image: UIImage(systemName: selected ? "checkmark.circle.fill" : "circle"))
        check.tintColor = selected ? WorldTheme.leaf : WorldTheme.line
        check.widthAnchor.constraint(equalToConstant: 22).isActive = true
        check.heightAnchor.constraint(equalToConstant: 22).isActive = true
        row.addArrangedSubview(check)
        button.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            if !self.store.setAura(mood) { self.showSaveError() }
        }, for: .touchUpInside)
        stack.addArrangedSubview(button)
    }

    private func profile() {
        let s = store.strings
        stack.addArrangedSubview(WorldTheme.label(store.state.nickname.isEmpty ? s[.meTitle] : store.state.nickname, style: .title1))
        stack.addArrangedSubview(WorldTheme.label(s[.localOnly], style: .footnote, muted: true))
        stack.addArrangedSubview(WorldTheme.label(s[.nickname], style: .headline))
        let input = UITextField()
        input.font = WorldTheme.font()
        input.adjustsFontForContentSizeCategory = true
        input.textColor = WorldTheme.ink
        input.text = store.state.nickname
        input.placeholder = s[.nicknamePlaceholder]
        input.accessibilityLabel = s[.nickname]
        input.accessibilityIdentifier = "world.profile.nickname"
        input.autocapitalizationType = .words
        input.autocorrectionType = .no
        input.returnKeyType = .done
        input.delegate = self
        input.backgroundColor = .white.withAlphaComponent(0.4)
        input.layer.cornerRadius = 10
        input.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 1))
        input.leftViewMode = .always
        input.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        input.addAction(UIAction { [weak self, weak input] _ in
            guard let self, let input else { return }
            if !self.store.setNickname(input.text ?? "") { self.showSaveError() }
        }, for: .editingDidEnd)
        stack.addArrangedSubview(input)
        let language = WorldTheme.button(s[.language] + " · " + store.state.language.displayName, symbol: "globe")
        language.accessibilityIdentifier = "world.profile.language"
        language.accessibilityLabel = s[.language]
        language.accessibilityValue = store.state.language.displayName
        language.showsMenuAsPrimaryAction = true
        language.menu = UIMenu(children: WorldLanguage.allCases.map { value in
            UIAction(title: value.displayName, state: value == store.state.language ? .on : .off) { [weak self] _ in
                guard let self else { return }
                if !self.store.setLanguage(value) { self.showSaveError() }
            }
        })
        stack.addArrangedSubview(language)
        let motionRow = UIStackView()
        motionRow.axis = .horizontal
        motionRow.spacing = 20
        motionRow.alignment = .center
        let labels = UIStackView()
        labels.axis = .vertical
        labels.spacing = 5
        labels.addArrangedSubview(WorldTheme.label(s[.motion], style: .headline))
        labels.addArrangedSubview(WorldTheme.label(s[.motionDetail], style: .footnote, muted: true))
        motionRow.addArrangedSubview(labels)
        let motion = UISwitch()
        motion.onTintColor = WorldTheme.leaf
        motion.isOn = store.state.movement
        motion.accessibilityLabel = s[.motion]
        motion.accessibilityIdentifier = "world.profile.movement"
        motion.setContentHuggingPriority(.required, for: .horizontal)
        motion.addAction(UIAction { [weak self, weak motion] _ in
            guard let self, let motion else { return }
            if !self.store.setMovement(motion.isOn) { self.showSaveError() }
        }, for: .valueChanged)
        motionRow.addArrangedSubview(motion)
        stack.addArrangedSubview(motionRow)
        let counts = "\(s[.favoriteCount]): \(store.state.favorites.count)  ·  \(s[.noteCount]): \(store.state.journal.count)"
        stack.addArrangedSubview(WorldTheme.label(counts, style: .footnote, muted: true))
        let line = UIView()
        line.backgroundColor = WorldTheme.line
        line.heightAnchor.constraint(equalToConstant: 0.7).isActive = true
        stack.addArrangedSubview(line)
        stack.addArrangedSubview(WorldTheme.label(s[.journal], style: .title2))
        let add = WorldTheme.button(s[.addNote], symbol: "square.and.pencil", filled: true)
        add.accessibilityIdentifier = "world.journal.add"
        add.addAction(UIAction { [weak self] _ in self?.openEditor(nil) }, for: .touchUpInside)
        stack.addArrangedSubview(add)
        if store.state.journal.isEmpty {
            stack.addArrangedSubview(WorldTheme.label(s[.journalEmpty], muted: true))
        }
        for entry in store.state.journal {
            let button = UIButton(type: .custom)
            button.backgroundColor = .white.withAlphaComponent(0.3)
            button.layer.cornerRadius = 12
            button.accessibilityLabel = s.date(entry.createdAt) + ". " + entry.text
            button.accessibilityHint = s[.editNote]
            button.accessibilityIdentifier = "world.journal.\(entry.id.uuidString)"
            let body = UIStackView()
            body.axis = .vertical
            body.spacing = 8
            body.isUserInteractionEnabled = false
            inset(body, in: button, padding: 16)
            body.addArrangedSubview(WorldTheme.label(s.date(entry.createdAt), style: .caption1, muted: true))
            let preview = WorldTheme.label(entry.preview)
            preview.numberOfLines = 3
            body.addArrangedSubview(preview)
            button.addAction(UIAction { [weak self] _ in self?.openEditor(entry) }, for: .touchUpInside)
            stack.addArrangedSubview(button)
        }
    }

    private func openEditor(_ entry: WorldJournalEntry?) {
        let editor = WorldJournalEditorViewController(store: store, entry: entry, paper: art.paper)
        navigationController?.pushViewController(editor, animated: !UIAccessibility.isReduceMotionEnabled)
    }

    private func card() -> UIView {
        let view = UIView()
        view.backgroundColor = .white.withAlphaComponent(0.27)
        view.layer.cornerRadius = 16
        view.layer.borderColor = WorldTheme.line.cgColor
        view.layer.borderWidth = 0.6
        return view
    }

    private func inset(_ child: UIView, in parent: UIView, padding: CGFloat) {
        child.translatesAutoresizingMaskIntoConstraints = false
        parent.addSubview(child)
        NSLayoutConstraint.activate([
            child.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: padding),
            child.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -padding),
            child.topAnchor.constraint(equalTo: parent.topAnchor, constant: padding),
            child.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -padding)
        ])
        parent.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
    }

    private func showSaveError() {
        let s = store.strings
        let alert = UIAlertController(title: s[.saveErrorTitle],
                                      message: s[store.loadFailed ? .loadErrorDetail : .saveErrorDetail], preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: s[.close], style: .default))
        present(alert, animated: true)
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }

    @objc private func close() {
        view.endEditing(true)
        dismiss(animated: !UIAccessibility.isReduceMotionEnabled) { [weak self] in self?.onClose?() }
    }
}

private final class WorldJournalEditorViewController: UIViewController, UITextViewDelegate {
    private let store: WorldStore
    private let entry: WorldJournalEntry?
    private let paper: UIImage
    private let textView = UITextView()
    private let placeholder = UILabel()
    private var saveItem: UIBarButtonItem!

    init(store: WorldStore, entry: WorldJournalEntry?, paper: UIImage) {
        self.store = store
        self.entry = entry
        self.paper = paper
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        let s = store.strings
        view.backgroundColor = WorldTheme.paper
        let texture = UIImageView(image: paper)
        texture.alpha = 0.5
        texture.contentMode = .scaleToFill
        texture.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(texture)
        title = s[entry == nil ? .newNote : .editNote]
        saveItem = UIBarButtonItem(title: s[.save], style: .done, target: self, action: #selector(save))
        saveItem.accessibilityIdentifier = "world.journal.save"
        navigationItem.rightBarButtonItem = saveItem
        textView.text = entry?.text ?? ""
        textView.font = WorldTheme.font()
        textView.adjustsFontForContentSizeCategory = true
        textView.textColor = WorldTheme.ink
        textView.backgroundColor = .clear
        textView.textContainerInset = UIEdgeInsets(top: 22, left: 18, bottom: 28, right: 18)
        textView.alwaysBounceVertical = true
        textView.keyboardDismissMode = .interactive
        textView.delegate = self
        textView.accessibilityLabel = s[.journal]
        textView.accessibilityIdentifier = "world.journal.editor"
        textView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textView)
        placeholder.text = s[.notePlaceholder]
        placeholder.font = WorldTheme.font()
        placeholder.textColor = WorldTheme.muted.withAlphaComponent(0.7)
        placeholder.numberOfLines = 0
        placeholder.isUserInteractionEnabled = false
        placeholder.isAccessibilityElement = false
        placeholder.translatesAutoresizingMaskIntoConstraints = false
        textView.addSubview(placeholder)
        let date = WorldTheme.label(s.date(entry?.createdAt ?? Date()), style: .caption1, muted: true)
        date.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(date)
        NSLayoutConstraint.activate([
            texture.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            texture.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            texture.topAnchor.constraint(equalTo: view.topAnchor),
            texture.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            date.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            date.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            date.trailingAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            textView.topAnchor.constraint(equalTo: date.bottomAnchor, constant: 8),
            textView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            textView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            textView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            placeholder.leadingAnchor.constraint(equalTo: textView.frameLayoutGuide.leadingAnchor, constant: 23),
            placeholder.trailingAnchor.constraint(equalTo: textView.frameLayoutGuide.trailingAnchor, constant: -23),
            placeholder.topAnchor.constraint(equalTo: textView.contentLayoutGuide.topAnchor, constant: 22)
        ])
        if entry != nil {
            navigationItem.leftItemsSupplementBackButton = true
            let remove = UIBarButtonItem(image: UIImage(systemName: "trash"), style: .plain, target: self, action: #selector(deleteNote))
            remove.accessibilityLabel = s[.delete]
            remove.accessibilityIdentifier = "world.journal.delete"
            navigationItem.rightBarButtonItems = [saveItem, remove]
        }
        updateState()
    }

    func textViewDidChange(_ textView: UITextView) { updateState() }

    private func updateState() {
        let empty = textView.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        placeholder.isHidden = !empty
        saveItem?.isEnabled = !empty
        isModalInPresentation = textView.text != (entry?.text ?? "")
        navigationController?.isModalInPresentation = isModalInPresentation
    }

    @objc private func save() {
        if store.saveNote(textView.text, editing: entry) {
            navigationController?.isModalInPresentation = false
            navigationController?.popViewController(animated: !UIAccessibility.isReduceMotionEnabled)
        } else {
            let s = store.strings
            let alert = UIAlertController(title: s[.saveErrorTitle],
                                          message: s[store.loadFailed ? .loadErrorDetail : .saveErrorDetail], preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: s[.close], style: .default))
            present(alert, animated: true)
        }
    }

    @objc private func deleteNote() {
        guard let entry else { return }
        let s = store.strings
        let alert = UIAlertController(title: s[.deleteNoteTitle], message: s[.deleteNoteMessage], preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: s[.cancel], style: .cancel))
        alert.addAction(UIAlertAction(title: s[.delete], style: .destructive) { [weak self] _ in
            guard let self else { return }
            if self.store.deleteNote(entry.id) {
                self.navigationController?.isModalInPresentation = false
                self.navigationController?.popViewController(animated: !UIAccessibility.isReduceMotionEnabled)
            } else {
                let failure = UIAlertController(title: s[.saveErrorTitle], message: s[.saveErrorDetail], preferredStyle: .alert)
                failure.addAction(UIAlertAction(title: s[.close], style: .default))
                self.present(failure, animated: true)
            }
        })
        present(alert, animated: true)
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isMovingFromParent { navigationController?.isModalInPresentation = false }
    }
}
