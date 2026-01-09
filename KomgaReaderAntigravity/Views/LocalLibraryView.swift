import SwiftUI

struct LocalLibraryView: View {
    let refreshTrigger: Bool
    @EnvironmentObject var appState: AppState // Persisted State

    
    // Deletion
    @State private var bookToDelete: LocalBook?
    @State private var showDeleteBookConfirmation = false
    @State private var folderToDelete: LocalFolderNode?
    @State private var showDeleteFolderConfirmation = false
    
    @ObservedObject var localization = LocalizationService.shared
    @ObservedObject var readingProgress = ReadingProgressManager.shared // Force refresh on progress change
    
    // Grid
    var columns: [GridItem] {
        return Array(repeating: GridItem(.flexible(), spacing: appState.gridSpacing), count: appState.libraryColumns)
    }
    
    // Dashboard State
    @State private var selectedLibrary: String = LocalizationService.shared.all
    @State private var focusedBook: LocalBook? // For "Preview" detail
    @State private var isContinueReadingExpanded = true
    @State private var isPreviewExpanded = true
    
    // File Management State
    @State private var isSelectionMode: Bool = false
    @State private var selectedItems: Set<URL> = [] // IDs (Paths)
    @State private var showNewFolderAlert = false
    @State private var newFolderName: String = ""
    @State private var showDeleteSelectionConfirmation = false
    
    // Paste Confirmation
    @State private var showPasteConfirmation = false
    @State private var pasteConfirmationMessage = ""
    
    var body: some View {
        NavigationView {
            ZStack(alignment: .topTrailing) { // TopTrailing for Lang Toggle
                // BACKGROUND Logic
                if let bg = appState.localLibraryBackground {
                    GeometryReader { geo in
                        Image(uiImage: bg)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: geo.size.width, height: geo.size.height)
                            .clipped()
                            .blur(radius: 20)
                            .opacity(0.3)
                    }.ignoresSafeArea()
                } else {
                     LinearGradient(gradient: Gradient(colors: [Color(red: 0.1, green: 0.1, blue: 0.2), .black]), startPoint: .top, endPoint: .bottom)
                        .ignoresSafeArea()
                }

                if appState.isScanningLocal {
                    ProgressView(localization.language == "IT" ? "Scansione libreria..." : "Scanning library...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let root = appState.localRootNode, root.isEmpty {
                    // Empty State
                    VStack {
                        Spacer() // CENTER CONTENT
                        Image(systemName: "books.vertical.circle")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)
                        Text(localization.noLibraries)
                            .font(.title3)
                            .foregroundColor(.gray)
                        Spacer()
                    }
                } else if let root = appState.localRootNode {
                    VStack(spacing: 0) {
                        // 1. Header with Filter Bar (Clean)
                        ZStack(alignment: .trailing) {
                            // Filter Bar (Full Width)
                            PillFilterBar(tabs: appState.localLibraryTabs, selectedTab: $selectedLibrary)
                                // Standard Padding for PillBar
                        }
                        .background(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color(red: 0.25, green: 0.22, blue: 0.20),
                                    Color(red: 0.15, green: 0.15, blue: 0.15)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .padding(.top, 60) // Compensation for Custom Header (ZStack)
                        .zIndex(10) // Ensure on top
                        
                        // Create GeometryReader to ensure minimum height for centering
                        // GeometryReader removed to prevent layout shift
                             // MAIN CONTENT SCROLLVIEW
                            ScrollView {
                                VStack(alignment: .leading, spacing: 24) {
                                    
                                    // 2. Header Section
                                    if !isSelectionMode {
                                    if selectedLibrary == LocalizationService.shared.all {
                                            // "Continue Reading" Logic
                                            let allBooks = getAllBooks(from: root)
                                            let recentBooks = allBooks.filter { ReadingProgressManager.shared.hasProgress(for: $0.id) }
                                                .sorted { 
                                                    let d1 = ReadingProgressManager.shared.getProgress(for: $0.id)?.lastReadDate ?? Date.distantPast
                                                    let d2 = ReadingProgressManager.shared.getProgress(for: $1.id)?.lastReadDate ?? Date.distantPast
                                                    return d1 > d2
                                                }
                                                .prefix(10).map { $0 }
                                            
                                            LibraryPreviewHeader(
                                                title: localization.language == "IT" ? "Continua a Leggere..." : "Continue Reading...",
                                                books: recentBooks,
                                                isExpanded: $isContinueReadingExpanded,
                                                showToggle: true
                                            ) {
                                                // INJECT MENU HERE (Right Aligned)
                                                 Menu {
                                                    Button(action: {
                                                        newFolderName = ""
                                                        showNewFolderAlert = true
                                                    }) {
                                                        Label("New Folder", systemImage: "folder.badge.plus")
                                                    }
                                                    
                                                    Button(action: {
                                                        withAnimation {
                                                            isSelectionMode.toggle()
                                                            selectedItems.removeAll()
                                                        }
                                                    }) {
                                                        Label(isSelectionMode ? "Cancel Select" : "Select", systemImage: "checkmark.circle")
                                                    }
                                                    
                                                    if !appState.clipboardURLs.isEmpty {
                                                        Button(action: {
                                                            pasteItems(to: getCurrentFolderURL())
                                                        }) {
                                                            Label("Paste (\(appState.clipboardURLs.count))", systemImage: "doc.on.clipboard")
                                                        }
                                                    }
                                                } label: {
                                                    Image(systemName: "ellipsis") 
                                                        .rotationEffect(.degrees(90)) // Vertical
                                                        .font(.system(size: 20))
                                                        .foregroundColor(.white)
                                                        .padding(8)
                                                        .contentShape(Rectangle())
                                                }
                                            }
                                        } else {
                                            // "Preview" Logic with Fallback for Layout Stability
                                            if let book = getPreviewBook(root: root) {
                                                LibraryPreviewHeader(
                                                    title: localization.language == "IT" ? "Anteprima" : "Preview",
                                                    books: [book],
                                                    isExpanded: $isPreviewExpanded,
                                                    showToggle: true
                                                ) {
                                                     Menu {
                                                        Button(action: {
                                                            newFolderName = ""
                                                            showNewFolderAlert = true
                                                        }) {
                                                            Label("New Folder", systemImage: "folder.badge.plus")
                                                        }
                                                        
                                                        Button(action: {
                                                            withAnimation {
                                                                isSelectionMode.toggle()
                                                                selectedItems.removeAll()
                                                            }
                                                        }) {
                                                            Label(isSelectionMode ? "Cancel Select" : "Select", systemImage: "checkmark.circle")
                                                        }
                                                        
                                                        if !appState.clipboardURLs.isEmpty {
                                                            Button(action: {
                                                                pasteItems(to: getCurrentFolderURL())
                                                            }) {
                                                                Label("Paste (\(appState.clipboardURLs.count))", systemImage: "doc.on.clipboard")
                                                            }
                                                        }
                                                    } label: {
                                                        Image(systemName: "ellipsis") 
                                                            .rotationEffect(.degrees(90))
                                                            .font(.system(size: 20))
                                                            .foregroundColor(.white)
                                                            .padding(8)
                                                            .contentShape(Rectangle())
                                                    }
                                                }
                                            } else {
                                                // Only show empty if TRULY no books found even after fallback
                                                EmptyView()
                                            }
                                        }
                                    }
                                    
                                    // 3. Content Grid
                                    let displayNode = getDisplayContent(root: root)
                                    
                                    if displayNode.children.isEmpty && displayNode.books.isEmpty {
                                        VStack(spacing: 16) {
                                            Spacer()
                                            Image(systemName: "folder.badge.questionmark")
                                                .font(.system(size: 48))
                                                .foregroundColor(.gray.opacity(0.5))
                                            Text(localization.language == "IT" ? "Cartella Vuota" : "Folder is empty")
                                                .font(.headline)
                                                .foregroundColor(.secondary)
                                            Text(localization.language == "IT" ? "Aggiungi fumetti o sottocartelle per iniziare." : "Add comics or subfolders to get started.")
                                                .font(.subheadline)
                                                .foregroundColor(.gray)
                                                .multilineTextAlignment(.center)
                                                .padding(.horizontal)
                                            Spacer()
                                        }
                                        .frame(maxWidth: .infinity)
                                        .frame(height: 300)
                                    } else {
                                        LocalFolderContentView(
                                            node: displayNode,
                                            isSelectionMode: isSelectionMode,
                                            selectedItems: $selectedItems,
                                            onDelete: { book in
                                                self.bookToDelete = book
                                                self.showDeleteBookConfirmation = true
                                            },
                                            onSelectFolder: { folder in
                                                if isSelectionMode {
                                                    toggleSelection(url: URL(fileURLWithPath: folder.id))
                                                }
                                                 // Navigation handled by Link otherwise
                                            },
                                            onDeleteFolder: { folder in
                                                self.folderToDelete = folder
                                                self.showDeleteFolderConfirmation = true
                                            },
                                            onSelect: { book in
                                                if isSelectionMode {
                                                    toggleSelection(url: book.originalURL)
                                                } else if selectedLibrary != LocalizationService.shared.all {
                                                    withAnimation {
                                                        self.focusedBook = book
                                                    }
                                                }
                                            }
                                        )
                                    }
                                    
                                    // Spacer for Overlay
                                    Color.clear.frame(height: 80) // Increased for Toolbar
                                }
                                .padding(.top, 0) // Fixed alignment: Remove gap between PillBar and Content
                                    // .frame(minHeight: scrollGeo.size.height)
                            }
                        .padding(.top, 0) // Fixed alignment
                    }
                }
                
                // SELECTION TOOLBAR (Overlay at Bottom)
                if isSelectionMode {
                    VStack {
                        Spacer()
                        HStack(spacing: 40) {
                            Button(action: { performClipboardAction(.cut) }) {
                                VStack {
                                    Image(systemName: "scissors")
                                    Text("Cut")
                                }
                            }
                            Button(action: { performClipboardAction(.copy) }) {
                                VStack {
                                    Image(systemName: "doc.on.doc")
                                    Text("Copy")
                                }
                            }
                            Button(role: .destructive, action: { showDeleteSelectionConfirmation = true }) {
                                VStack {
                                    Image(systemName: "trash")
                                    Text("Delete")
                                }
                                .foregroundColor(.red)
                            }
                            Spacer()
                            Button(action: {
                                withAnimation {
                                    isSelectionMode = false
                                    selectedItems.removeAll()
                                }
                            }) {
                                Text("Done").bold()
                            }
                        }
                        .padding()
                        .background(Material.regular)
                        .cornerRadius(16)
                        .padding()
                    }
                    .padding(.bottom, 40) // Spacing for Content
                    .transition(.move(edge: .bottom))
                }
            }
            .navigationBarHidden(true)
            .toolbar(.hidden, for: .navigationBar)
            .ignoresSafeArea(.keyboard)
            .onAppear {
                 if appState.localRootNode == nil || appState.shouldReloadLocalLibrary {
                     scanLocalLibrary()
                     appState.shouldReloadLocalLibrary = false
                 }
            }
            .onChange(of: localization.language) { _ in
                selectedLibrary = localization.all
                scanLocalLibrary() // Refresh Tabs
            }
            .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("LocalLibraryRefresh"))) { _ in
                scanLocalLibrary()
                // Update focus if needed (e.g. library switch)
                updateFocusedBook()
            }
            .onChange(of: refreshTrigger) { _, _ in
                scanLocalLibrary()
            }
            .onChange(of: selectedLibrary) { _, _ in
                updateFocusedBook()
            }
            // Alert 1: Delete Book
            .alert(localization.language == "IT" ? "Elimina Fumetto?" : "Delete Comic?", isPresented: $showDeleteBookConfirmation) {
                Button(localization.language == "IT" ? "Annulla" : "Cancel", role: .cancel) { }
                Button(localization.language == "IT" ? "Elimina" : "Delete", role: .destructive) {
                    if let book = bookToDelete {
                        deleteBook(book)
                    }
                }
            } message: {
                if let book = bookToDelete {
                    Text(localization.language == "IT" ? "Sei sicuro di voler eliminare \"\(book.title)\"?" : "Are you sure you want to delete \"\(book.title)\"?")
                }
            }
            // Alert 5: Delete Folder Confirmation
             .alert(localization.language == "IT" ? "Elimina Cartella?" : "Delete Folder?", isPresented: $showDeleteFolderConfirmation) {
                Button(localization.language == "IT" ? "Annulla" : "Cancel", role: .cancel) { }
                Button(localization.language == "IT" ? "Elimina" : "Delete", role: .destructive) {
                    if let folder = folderToDelete {
                        deleteFolder(folder)
                    }
                }
            } message: {
                 if let folder = folderToDelete {
                     Text(localization.language == "IT" ? "Vuoi eliminare la cartella \"\(folder.name)\"? Questa azione non può essere annullata." : "Do you want to delete the folder \"\(folder.name)\"? This action cannot be undone.")
                 }
            }
            // Alert 2: Delete Folder (Recursive)
            .alert("Delete Selection?", isPresented: $showDeleteSelectionConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Delete All", role: .destructive) {
                    deleteSelection()
                }
            } message: {
                Text("Are you sure you want to delete \(selectedItems.count) items? This cannot be undone.")
            }
            // Alert 3: New Folder
            .alert("New Folder", isPresented: $showNewFolderAlert) {
                TextField("Folder Name", text: $newFolderName)
                Button("Create") {
                    createNewFolder(name: newFolderName, in: getCurrentFolderURL())
                }
            }
            // Alert 4: Paste Confirmation
            .alert("Success", isPresented: $showPasteConfirmation) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(pasteConfirmationMessage)
            }
        }
        .navigationViewStyle(.stack)
    }
    
    // --- ACTIONS ---
    
    private func getPreviewBook(root: LocalFolderNode) -> LocalBook? {
        if let f = focusedBook { return f }
        if let libNode = root.children.first(where: { $0.name == selectedLibrary }) {
            return libNode.books.first ?? findFirstBook(in: libNode.children)
        }
        return nil
    }
    
    private func getCurrentFolderURL() -> URL {
        // Logic to determine current path based on 'selectedLibrary' or similar.
        // For 'Tutte', we default to Root.
        // For Specific Library, we find its URL.
        // NOTE: This assumes LocalLibraryView is at Root Level. Inside DetailView, logic is different.
        let libraryURL = KomgaService.shared.getLocalLibraryURL()
        if selectedLibrary == LocalizationService.shared.all {
            return libraryURL
        } else {
            return libraryURL.appendingPathComponent(selectedLibrary)
        }
    }
    
    // ... [Rest of Helper Functions Kept Same] ...
    private func toggleSelection(url: URL) {
        if selectedItems.contains(url) {
            selectedItems.remove(url)
        } else {
            selectedItems.insert(url)
        }
    }
    
    private func performClipboardAction(_ op: AppState.ClipboardOperation) {
        guard !selectedItems.isEmpty else { return }
        appState.clipboardURLs = Array(selectedItems)
        appState.clipboardOperation = op
        
        // Reset Selection
        withAnimation {
            isSelectionMode = false
            selectedItems.removeAll()
        }
    }
    
    private func deleteSelection() {
        var fileCount = 0
        var folderCount = 0
        
        for url in selectedItems {
            // Check if directory
            if (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true {
                folderCount += 1
            } else {
                fileCount += 1
            }
            try? FileManager.default.removeItem(at: url)
        }
        
        selectedItems.removeAll()
        scanLocalLibrary() // Refresh
        
        // Optional: Show success alert for delete if desired, or simpler "Done"
        // User requested detail on "confirm copy/paste", maybe not delete selection?
        // "alla fine del processo di cancellazione di quanti files e cartelle sono stati cancellati"
        // Yes, he wants it.
        pasteConfirmationMessage = "\(fileCount) File(s), \(folderCount) Folder(s) deleted"
        showPasteConfirmation = true // Reusing the "Success" alert
    }
    
    private func createNewFolder(name: String, in parentURL: URL) {
        guard !name.isEmpty else { return }
        let newPath = parentURL.appendingPathComponent(name)
        try? FileManager.default.createDirectory(at: newPath, withIntermediateDirectories: false)
        scanLocalLibrary()
    }
    
    private func pasteItems(to destination: URL) {
        let op = appState.clipboardOperation
        
        let stats = LocalFolderUtilities.pasteIsSafe(items: appState.clipboardURLs, to: destination, operation: op)
        
        let action = op == .cut ? "moved" : "copied"
        pasteConfirmationMessage = "\(stats.files) File(s), \(stats.folders) Folder(s) \(action)"
        
        if op == .cut {
            appState.clipboardURLs.removeAll()
        }
        
        showPasteConfirmation = true
        scanLocalLibrary()
    }
    
    private func updateFocusedBook() {
        if selectedLibrary == LocalizationService.shared.all {
            focusedBook = nil
            return
        }
        
        guard let root = appState.localRootNode else { return }
        
        if let libNode = root.children.first(where: { $0.name == selectedLibrary }) {
            if let first = libNode.books.first {
                focusedBook = first
                return
            }
            focusedBook = findFirstBook(in: libNode.children)
        } else {
            focusedBook = nil
        }
    }
    
    private func findFirstBook(in nodes: [LocalFolderNode]) -> LocalBook? {
        for node in nodes {
            if let book = node.books.first { return book }
            if let nested = findFirstBook(in: node.children) { return nested }
        }
        return nil
    }

    private func getDisplayContent(root: LocalFolderNode) -> LocalFolderNode {
        if selectedLibrary == LocalizationService.shared.all {
            // Merge content from all libraries
            var mergedChildren: [LocalFolderNode] = []
            var mergedBooks: [LocalBook] = []
            
            // 1. Root Books
            mergedBooks.append(contentsOf: root.books)
            
            // 2. Library Contents
            for library in root.children {
                if library.children.isEmpty && library.books.isEmpty {
                     // FIX: If a library is empty (like 'Mix'), show the library folder itself so it is visible/selectable.
                     mergedChildren.append(library)
                } else {
                    mergedChildren.append(contentsOf: library.children)
                    mergedBooks.append(contentsOf: library.books)
                }
            }
            
            return LocalFolderNode(id: "virtual_root", name: "Tutte", children: mergedChildren, books: mergedBooks)
        } else {
            // Specific Library
            if let libNode = root.children.first(where: { $0.name == selectedLibrary }) {
                return libNode
            }
            return LocalFolderNode(id: "empty", name: "", children: [], books: [])
        }
    }
    
    private func getAllBooks(from node: LocalFolderNode) -> [LocalBook] {
        var books = node.books
        for child in node.children {
            books.append(contentsOf: getAllBooks(from: child))
        }
        return books
    }
    
    private func scanLocalLibrary() {
        appState.isScanningLocal = true
        Task {
            let libraryURL = KomgaService.shared.getLocalLibraryURL()
            let root = await LocalFolderUtilities.buildTree(from: libraryURL)
            // Identify library roots
            let roots = LocalFolderUtilities.scanLibraryRoots(from: libraryURL)
            
            await MainActor.run {
                appState.localRootNode = root
                appState.localLibraryTabs = roots // Dynamic tabs
                
                // Pick a random background cover
                if let randomCover = root.getRandomCovers(count: 1).first {
                    appState.localLibraryBackground = randomCover
                }
                
                if appState.localLibraryTabs.isEmpty {
                     // If no subfolders in Library, maybe we just have one implicit "Default" or just "Tutte"
                }
                appState.isScanningLocal = false
                
                // Refresh Focus (Fixes Stale Preview on Delete)
                // We run this after scan to ensure focusedBook validity
                updateFocusedBook()
            }
        }
    }
    
    private func deleteBook(_ book: LocalBook) {
        let fileManager = FileManager.default
        try? fileManager.removeItem(at: book.originalURL)
        scanLocalLibrary()
    }
    
    private func deleteFolder(_ folder: LocalFolderNode) {
        let fileManager = FileManager.default
        // We can count items inside if we want super detail, but usually "1 Folder deleted" is enough for root action.
        // Or "Deleted folder X and its Y contents".
        // Let's keep it simple: "Folder Deleted".
        try? fileManager.removeItem(atPath: folder.id)
        pasteConfirmationMessage = "Folder \"\(folder.name)\" deleted"
        showPasteConfirmation = true
        scanLocalLibrary()
    }
}

// LocalBook and LocalFolderNode moved to AppState.swift

struct LocalFolderUtilities {
    static func buildTree(from url: URL) async -> LocalFolderNode {
        let fileManager = FileManager.default
        let resourceKeys: [URLResourceKey] = [.isDirectoryKey, .nameKey]
        
        // Scan current directory
        var children: [LocalFolderNode] = []
        var books: [LocalBook] = []
        
        guard let contents = try? fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: resourceKeys, options: [.skipsHiddenFiles]) else {
            return LocalFolderNode(id: url.path, name: url.lastPathComponent, children: [], books: [])
        }
        
        for itemURL in contents {
            let isDirectory = (try? itemURL.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            
            if isDirectory {
                // Recursively build child node
                let childNode = await buildTree(from: itemURL)
                // FIX: Allow empty folders to be displayed (User Request: "Mix" folder invisible)
                children.append(childNode)
            } else {
                let ext = itemURL.pathExtension.lowercased()
                if ext == "cbz" || ext == "cbr" {
                    // It's a book
                    if let book = await loadBook(from: itemURL) {
                        books.append(book)
                    }
                }
            }
        }
        
        // Sort
        children.sort { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        // User Request: Sort by Filename (using id which is filename) instead of Title
        books.sort { $0.id.localizedStandardCompare($1.id) == .orderedAscending }
        
        return LocalFolderNode(id: url.path, name: url.lastPathComponent, children: children, books: books)
    }
    
    static func loadBook(from fileURL: URL) async -> LocalBook? {
        // This simulates the previous 'scanForBooks' logic but for a single file
        // Helper to unzip and get cover using KomgaService or FileManager
        // Re-implement simplified version
        let fileManager = FileManager.default
        let tempDir = fileManager.temporaryDirectory.appendingPathComponent("reading_\(fileURL.lastPathComponent)")
        
        // Check cache/unzip (Simplified for brevity)
        var needsUnzip = true
        var isDir: ObjCBool = false
        if fileManager.fileExists(atPath: tempDir.path, isDirectory: &isDir) && isDir.boolValue {
            if let c = try? fileManager.contentsOfDirectory(at: tempDir, includingPropertiesForKeys: nil), !c.isEmpty {
                needsUnzip = false
            }
        }
        
        if needsUnzip {
            try? fileManager.removeItem(at: tempDir)
            try? KomgaService.shared.unzipBook(at: fileURL, to: tempDir)
        }
        
        // Get Cover
        var cover: UIImage?
        if let pages = try? fileManager.contentsOfDirectory(at: tempDir, includingPropertiesForKeys: nil)
            .filter({ ["jpg", "jpeg", "png", "webp"].contains($0.pathExtension.lowercased()) })
            .sorted(by: { $0.lastPathComponent < $1.lastPathComponent }),
           let first = pages.first {
            cover = UIImage(contentsOfFile: first.path)
        }
        
        // Check for ComicInfo.xml
        var info: ComicInfo? = nil
        let comicInfoPath = tempDir.appendingPathComponent("ComicInfo.xml")
        
        // If we haven't unzipped yet (or if re-checking), extract just ComicInfo if possible?
        // For simple CBZ (Zip), we can just unzip everything.
        // Optimization: If file exists, parse it.
        if fileManager.fileExists(atPath: comicInfoPath.path) {
            if let data = try? Data(contentsOf: comicInfoPath) {
                info = ComicInfoParser.parse(data: data)
            }
        }
        
        return LocalBook(
            id: fileURL.deletingPathExtension().lastPathComponent,
            title: info?.title.isEmpty == false ? info!.title : fileURL.deletingPathExtension().lastPathComponent,
            originalURL: fileURL,
            url: tempDir,
            coverImage: cover,
            metadata: info
        )
    }
    // MARK: - Dashboard Helpers
    
    /// Scans the root ACR folder and returns top-level folder names (Libraries)
    static func scanLibraryRoots(from url: URL) -> [String] {
        let fileManager = FileManager.default
        guard let contents = try? fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles]) else {
            return []
        }
        
        let folders = contents
            .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false }
            .map { $0.lastPathComponent }
            .sorted()
            
        return [LocalizationService.shared.all] + folders
    }
    
    // OPERATIONS
    static func pasteIsSafe(items: [URL], to destination: URL, operation: AppState.ClipboardOperation) -> (files: Int, folders: Int) {
         let fileManager = FileManager.default
         var fileCount = 0
         var folderCount = 0
         
         // Helper for recursion
         func countItems(in url: URL) -> (files: Int, folders: Int) {
             var f = 0
             var d = 0
             let resourceKeys: [URLResourceKey] = [.isDirectoryKey]
             if let enumerator = fileManager.enumerator(at: url, includingPropertiesForKeys: resourceKeys, options: [.skipsHiddenFiles]) {
                 for case let fileURL as URL in enumerator {
                     if let resourceValues = try? fileURL.resourceValues(forKeys: [.isDirectoryKey]), resourceValues.isDirectory == true {
                         d += 1
                     } else {
                         f += 1
                     }
                 }
             }
             return (f, d)
         }
         
         for item in items {
             let destURL = destination.appendingPathComponent(item.lastPathComponent)
             
             // Count Type & Recursion
             if (try? item.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true {
                 folderCount += 1
                 // Add recursive counts
                 let sub = countItems(in: item)
                 fileCount += sub.files
                 folderCount += sub.folders
             } else {
                 fileCount += 1
             }
             
             // Simple overwrite protection or fail?
             // let's try standard op, catching errors
             do {
                 if operation == .copy {
                     try fileManager.copyItem(at: item, to: destURL)
                 } else {
                     try fileManager.moveItem(at: item, to: destURL)
                 }
             } catch {
                 print("Paste Error: \(error)")
             }
         }
         return (fileCount, folderCount)
    }
}

// MARK: - Flattening Extensions/Helpers
extension LocalFolderNode {
    /// Recursively collects all series-level folders or promoted books
    /// For the "Tutte" (All) view, we likely want to show SERIES (Leaf Folders)
    /// A "Series" in file terms is a folder containing books (CBZ).
    /// EXCEPT if the structure is Library/Book.cbz (Single Book).
    
    func flattenToSeries() -> [LocalFolderNode] {
        var results: [LocalFolderNode] = []
        
        // If THIS node contains books, it is effectively a series (or a mixed folder).
        if !self.books.isEmpty {
            results.append(self)
        }
        
        // Also recurse
        for child in children {
            results.append(contentsOf: child.flattenToSeries())
        }
        
        // Deduplicate using ID (path) just in case
        // (Not strictly necessary if tree is clean, but safe)
        return results
    }
    
    /// Returns up to `count` random covers from this folder and subfolders
    func getRandomCovers(count: Int = 3) -> [UIImage] {
        var allCovers: [UIImage] = self.books.compactMap { $0.coverImage }
        
        // Simple recursion limit or breath-first to avoid infinite loop cost?
        // Just recursive for now.
        for child in children {
            allCovers.append(contentsOf: child.getRandomCovers(count: count)) // Recursion
            if allCovers.count > count * 3 { break } // Optimization: Stop if we have enough candidates
        }
        
        return Array(allCovers.shuffled().prefix(count))
    }
}

// MARK: - Views

// MARK: - Reusable Header Component
struct LibraryPreviewHeader<Trailing: View>: View {
    let title: String
    let books: [LocalBook]
    @Binding var isExpanded: Bool
    var showToggle: Bool = true
    @ViewBuilder let trailing: Trailing // Closure for Trailing Content (Menu)
    
    // Initializer with Default Empty View
    init(title: String, books: [LocalBook], isExpanded: Binding<Bool>, showToggle: Bool = true, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.books = books
        self._isExpanded = isExpanded
        self.showToggle = showToggle
        self.trailing = trailing()
    }
    
    @State private var activeSheetBook: LocalBook? = nil
    
    var body: some View {
        if !books.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(title)
                        .font(.title2)
                        .bold()
                        .foregroundColor(.white)
                    
                    if showToggle {
                        Button(action: {
                            withAnimation {
                                isExpanded.toggle()
                            }
                        }) {
                            Text(isExpanded ? "less" : "more")
                                .font(.subheadline)
                                .foregroundColor(.blue)
                        }
                    }
                    
                    // "What's happened so far..." (Gemini) - Left Aligned
                    if let firstBook = books.first {
                        Button(action: {
                            activeSheetBook = firstBook
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: "sparkles")
                                Text("Recap") // Shortened for space
                            }
                            .font(.subheadline.bold())
                            .foregroundColor(.white)
                            .padding(.vertical, 4)
                            .padding(.horizontal, 10)
                            .background(
                                Capsule().fill(Color.blue.opacity(0.2))
                                    .overlay(Capsule().stroke(Color.blue.opacity(0.5), lineWidth: 1))
                            )
                        }
                    }
                    
                    Spacer()
                    
                    // TRAILING (Menu goes here)
                    trailing
                }
                .padding(.horizontal)
                // Removed dedicated block below
                
                if isExpanded {
                    ContinueReadingCarouselView(books: books)
                        .padding(.horizontal)
                }
            }
            .padding(.vertical, 20)
            .background(
                LinearGradient(gradient: Gradient(colors: [Color(white: 0.10), Color(white: 0.05)]), startPoint: .top, endPoint: .bottom)
            )
            .sheet(item: $activeSheetBook) { book in
                // Prepare Data for Recap
                // Priority: ComicInfo > Filename Parsing
                
                let seriesName = book.metadata?.series ?? book.title // Fallback need improvement?
                let number = book.metadata?.number ?? "1"
                let volume = book.metadata?.volume ?? ""
                let publisher = book.metadata?.publisher ?? ""
                
                StoryRecapView(
                    series: seriesName.isEmpty ? book.title : seriesName,
                    number: number,
                    volume: volume,
                    publisher: publisher,
                    coverImage: book.coverImage
                )
                .presentationDetents([.medium, .large])
            }
        }
    }
}

struct LocalFolderContentView: View {
    @EnvironmentObject var appState: AppState
    let node: LocalFolderNode
    
    // Selection Props
    var isSelectionMode: Bool = false
    @Binding var selectedItems: Set<URL> // Default empty binding provided in init logic if needed, but passing explicit is better
    
    let onDelete: (LocalBook) -> Void
    var onSelectFolder: ((LocalFolderNode) -> Void)? = nil
    var onDeleteFolder: ((LocalFolderNode) -> Void)? = nil // NEW Delete Handler
    var onSelect: ((LocalBook) -> Void)? = nil
    
    init(node: LocalFolderNode, 
         isSelectionMode: Bool = false, 
         selectedItems: Binding<Set<URL>> = .constant([]), 
         onDelete: @escaping (LocalBook) -> Void,
         onSelectFolder: ((LocalFolderNode) -> Void)? = nil,
         onDeleteFolder: ((LocalFolderNode) -> Void)? = nil, // NEW
         onSelect: ((LocalBook) -> Void)? = nil) {
        
        self.node = node
        self.isSelectionMode = isSelectionMode
        self._selectedItems = selectedItems
        self.onDelete = onDelete
        self.onSelectFolder = onSelectFolder
        self.onDeleteFolder = onDeleteFolder
        self.onSelect = onSelect
    }
    
    var columns: [GridItem] {
        return Array(repeating: GridItem(.flexible(), spacing: appState.gridSpacing), count: appState.libraryColumns)
    }
    
    var body: some View {
        LazyVGrid(columns: columns, spacing: appState.gridSpacing) {
            // Folders (Always Navigation)
            ForEach(node.children) { child in
                let childURL = URL(fileURLWithPath: child.id)
                let isSelected = selectedItems.contains(childURL)
                
                if isSelectionMode {
                     UnifiedFolderIcon(node: child)
                        .overlay(
                            ZStack {
                                if isSelected {
                                    Color.black.opacity(0.4)
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.largeTitle)
                                        .foregroundColor(.blue)
                                } else {
                                     // Tap Area for Selection
                                     Color.clear
                                }
                            }
                        )
                        .onTapGesture {
                             onSelectFolder?(child)
                        }
                } else {
                     NavigationLink(destination: LocalFolderDetailView(node: child, onDelete: onDelete)) {
                          UnifiedFolderIcon(node: child)
                     }
                     .buttonStyle(PlainButtonStyle())
                     .contextMenu {
                         Button(role: .destructive) {
                             onDeleteFolder?(child)
                         } label: {
                             Label("Delete Folder", systemImage: "trash")
                         }
                     }
                }
            }
            
            // Books
            ForEach(node.books) { book in
                let isSelected = selectedItems.contains(book.originalURL)
                
                LocalBookItemView(book: book, 
                                  isSelectionMode: isSelectionMode, 
                                  isSelected: isSelected, 
                                  onSelect: onSelect)
                    .contextMenu {
                        Button(role: .destructive) {
                            onDelete(book)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        }
        .padding(.horizontal)
    }
}

struct LocalFolderDetailView: View {
    let node: LocalFolderNode
    let onDelete: (LocalBook) -> Void
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var appState: AppState
    @ObservedObject var localization = LocalizationService.shared
    
    // Preview State for Series View
    @State private var focusedBook: LocalBook?
    @State private var isPreviewExpanded: Bool = true
    
    // Selection State For Detail View
    @State private var isSelectionMode: Bool = false
    @State private var selectedItems: Set<URL> = []
    @State private var showDeleteSelectionConfirmation = false
    
    // Paste Confirmation
    @State private var showPasteConfirmation = false
    @State private var pasteConfirmationMessage = ""
    
    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                // Header (Preview)
                    // Always show Preview if we have a focused book (which we should, defaulting to first)
                    // Hide in Selection Mode
                    if let book = focusedBook, !isSelectionMode {
                         LibraryPreviewHeader(
                            title: "Preview",
                            books: [book], // Single item
                            isExpanded: $isPreviewExpanded,
                            showToggle: true // User requested "less / more deve esserci sempre"
                         ) {
                             EmptyView()
                         }
                    }
                    
                    VStack(alignment: .leading) {
                        HStack {
                            Text(Series.formatSeriesName(node.name))
                                .font(.title2)
                                .bold()
                            Spacer()
                            // Context Menu for Folder
                            Menu {
                                Button(action: {
                                    withAnimation {
                                        isSelectionMode.toggle()
                                        selectedItems.removeAll()
                                    }
                                }) {
                                    Label(isSelectionMode ? "Cancel Select" : "Select", systemImage: "checkmark.circle")
                                }
                                
                                if !appState.clipboardURLs.isEmpty {
                                    Button(action: {
                                        // Paste To This Node URL
                                        let currentURL = URL(fileURLWithPath: node.id)
                                        let op = appState.clipboardOperation
                                        
                                        let stats = LocalFolderUtilities.pasteIsSafe(items: appState.clipboardURLs, to: currentURL, operation: op)
                                        
                                        let action = op == .cut ? "moved" : "copied"
                                        pasteConfirmationMessage = "\(stats.files) File(s), \(stats.folders) Folder(s) \(action)"
                                        
                                        showPasteConfirmation = true
                                        
                                        // TRIGGER REFRESH
                                        appState.localRootNode = nil // Force Parent to Re-scan on Back Navigation
                                        // Trigger Parent Refresh? 
                                        // We can't easily trigger parent refresh from here without a binding or callback chain.
                                        // Ideally appState or Global Refresh.
                                        // For now, let's assume global refresh trigger will work if we dirty something.
                                    }) {
                                        Label("Paste (\(appState.clipboardURLs.count))", systemImage: "doc.on.clipboard")
                                    }
                                }
                            } label: {
                                Image(systemName: "ellipsis.circle").font(.title2)
                            }
                        }
                        .padding(.horizontal)
                        
                        // Grid with Selection Logic
                        // Grid with Selection Logic
                        if node.children.isEmpty && node.books.isEmpty {
                            VStack(spacing: 16) {
                                Spacer()
                                Image(systemName: "folder.badge.questionmark")
                                    .font(.system(size: 48))
                                    .foregroundColor(.gray.opacity(0.5))
                                Text(localization.language == "IT" ? "Cartella Vuota" : "Folder is empty")
                                    .font(.headline)
                                    .foregroundColor(.secondary)
                                Text(localization.language == "IT" ? "Aggiungi fumetti o sottocartelle per iniziare." : "Add comics or subfolders to get started.")
                                    .font(.subheadline)
                                    .foregroundColor(.gray)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal)
                                Spacer()
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 300)
                        } else {
                            LocalFolderContentView(
                                node: node, 
                                isSelectionMode: isSelectionMode,
                                selectedItems: $selectedItems,
                                onDelete: onDelete,
                                onSelectFolder: { folder in 
                                    if isSelectionMode {
                                         let u = URL(fileURLWithPath: folder.id)
                                         if selectedItems.contains(u) { selectedItems.remove(u) } else { selectedItems.insert(u) }
                                    }
                                },
                                onSelect: { book in
                                    if isSelectionMode {
                                         let u = book.originalURL
                                         if selectedItems.contains(u) { selectedItems.remove(u) } else { selectedItems.insert(u) }
                                    } else {
                                        withAnimation {
                                            self.focusedBook = book
                                        }
                                    }
                                }
                            )
                        }
                    }
                    
                     // Spacer for Overlay
                    Color.clear.frame(height: 80)
                }
            
            // SELECTION TOOLBAR (Overlay at Bottom) - same code as parent, duplicated for scope
            if isSelectionMode {
                VStack {
                    Spacer()
                    HStack(spacing: 40) {
                        Button(action: { 
                             // Perform Clipboard Action Cut
                             guard !selectedItems.isEmpty else { return }
                             appState.clipboardURLs = Array(selectedItems)
                             appState.clipboardOperation = .cut
                             withAnimation { isSelectionMode = false; selectedItems.removeAll() }
                        }) {
                            VStack {
                                Image(systemName: "scissors")
                                Text("Cut")
                            }
                        }
                        Button(action: { 
                             // Perform Clipboard Action Copy
                             guard !selectedItems.isEmpty else { return }
                             appState.clipboardURLs = Array(selectedItems)
                             appState.clipboardOperation = .copy
                             withAnimation { isSelectionMode = false; selectedItems.removeAll() }
                        }) {
                            VStack {
                                Image(systemName: "doc.on.doc")
                                Text("Copy")
                            }
                        }
                        Button(role: .destructive, action: { showDeleteSelectionConfirmation = true }) {
                            VStack {
                                Image(systemName: "trash")
                                Text("Delete")
                            }
                            .foregroundColor(.red)
                        }
                        Spacer()
                        Button(action: {
                            withAnimation {
                                isSelectionMode = false
                                selectedItems.removeAll()
                            }
                        }) {
                            Text("Done").bold()
                        }
                    }
                    .padding()
                    .background(Material.regular)
                    .cornerRadius(16)
                    .padding()
                }
                .transition(.move(edge: .bottom))
            }
        }
        .padding(.top, 60) // Compensation for Custom Header
        .navigationBarHidden(true) // Ensure system bar doesn't cause layout shift
        .navigationTitle("")
        .onAppear {
            // Default Selection: First Book
            if focusedBook == nil {
                focusedBook = node.books.first
            }
            appState.isInsideFolder = true
        }
        .onDisappear {
            appState.isInsideFolder = false
        }
        .onChange(of: appState.navigateBack) { oldValue, newValue in
            if newValue && appState.isInsideFolder {
                appState.navigateBack = false
                dismiss()
            }
        }
        .alert("Delete Selection?", isPresented: $showDeleteSelectionConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete All", role: .destructive) {
                // Delete Logic
                for url in selectedItems {
                    try? FileManager.default.removeItem(at: url)
                }
                selectedItems.removeAll()
                // Force Refresh needs a mechanism.
            }
        } message: {
            Text("Are you sure you want to delete \(selectedItems.count) items? This cannot be undone.")
        }
        // Paste Alert
        .alert("Success", isPresented: $showPasteConfirmation) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(pasteConfirmationMessage)
        }
    }
}

// ... LocalFolderCard removed (unused or kept? It was present in file but unused in main flow)
struct LocalFolderCard: View {
    let node: LocalFolderNode
    var showBackground: Bool = true
    
    var body: some View {
        // Resolve Image
        let cover: UIImage? = {
            if let firstBook = node.books.first, let c = firstBook.coverImage, node.children.isEmpty {
                return c
            } else if let random = node.getRandomCovers(count: 1).first {
                return random
            }
            return nil
        }()
        
        // Use Reusable Component
        ComicBoxCard(coverImage: cover, showBackground: showBackground)
    }
}

// Helpers
struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct LocalBookItemView: View {
    let book: LocalBook
    var isSelectionMode: Bool = false
    var isSelected: Bool = false
    var onSelect: ((LocalBook) -> Void)? = nil
    
    var body: some View {
        // CONTENT
        let content = VStack(alignment: .center, spacing: 8) {
            // Processing Logic (Right Half Crop for Landscape)
            let processedCover: UIImage? = {
                guard let original = book.coverImage else { return nil }
                if original.size.width > original.size.height {
                     // Crop Right Half
                     let cropRect = CGRect(x: original.size.width / 2, y: 0, width: original.size.width / 2, height: original.size.height)
                     if let cgImage = original.cgImage?.cropping(to: cropRect) {
                         return UIImage(cgImage: cgImage, scale: original.scale, orientation: original.imageOrientation)
                     }
                }
                return original
            }()
            
            if let cover = processedCover {
                // Robust Cropping: 2:3 Container
                Color.clear
                    .aspectRatio(0.66, contentMode: .fit)
                    .overlay(
                        Image(uiImage: cover)
                            .resizable()
                            .aspectRatio(contentMode: .fill), // Fill frame (it's already cropped)
                        alignment: .center
                    )
                    .overlay(
                        // Reading Progress Indicator (Triangle)
                        GeometryReader { geo in
                            if let progress = ReadingProgressManager.shared.getProgress(for: book.id), progress.totalPages > 0 {
                                let isComplete = progress.currentPage >= progress.totalPages - 1
                                let isStarted = progress.currentPage > 0
                                
                                if isComplete || isStarted {
                                    Path { path in
                                        // Top Right Triangle
                                        path.move(to: CGPoint(x: geo.size.width, y: 0)) // Top Right
                                        path.addLine(to: CGPoint(x: geo.size.width, y: 40)) // Down
                                        path.addLine(to: CGPoint(x: geo.size.width - 40, y: 0)) // Left
                                        path.closeSubpath()
                                    }
                                    .fill(isComplete ? Color.green : Color.yellow)
                                }
                            }
                        }
                        , alignment: .topTrailing
                    )
                    .clipped()
                    .clipped()
                    .contentShape(Rectangle()) // CRITICAL: Strict Hit Testing
                    .overlay(
                        ZStack {
                            if isSelectionMode {
                                if isSelected {
                                    Color.black.opacity(0.4)
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.largeTitle)
                                        .foregroundColor(.blue)
                                } else {
                                    Color.white.opacity(0.001) // Invisible Hit Target
                                }
                            }
                        }
                    )
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.3))
                    .aspectRatio(0.66, contentMode: .fit)
            }
            
            Text(book.title)
                .font(.caption)
                .bold()
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .foregroundColor(.primary)
                .frame(maxWidth: .infinity)
            
            if let issue = book.metadata?.number {
                Text("#\(issue)")
                    .font(.caption2).bold()
                    .foregroundColor(.white)
            }
        }
        
        // INTERACTION WRAPPER
        if let onSelect = onSelect {
            // Selection Mode
            Button(action: {
                onSelect(book)
            }) {
                content
            }
            .buttonStyle(PlainButtonStyle())
        } else {
            // Navigation Mode (Classic)
            NavigationLink(destination: 
                ComicReaderView(bookURL: book.url, bookId: book.id, sourceURL: book.originalURL)
                    .toolbar(.hidden, for: .tabBar)
            ) {
                content
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
}


