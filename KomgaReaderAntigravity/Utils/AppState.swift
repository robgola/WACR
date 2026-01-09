
import SwiftUI
import Combine

class AppState: ObservableObject {
    @Published var isFullScreen: Bool = false
    @Published var selectedTab: Int = 0
    
    // Navigation Control
    @Published var isInsideFolder: Bool = false
    @Published var navigateBack: Bool = false
    
    // Global Data
    // Clipboard State
    enum ClipboardOperation: String {
        case copy
        case cut
    }
    @Published var clipboardURLs: [URL] = []
    @Published var clipboardOperation: ClipboardOperation = .copy
    
    @AppStorage("customServerName") var serverName: String = ""
    @AppStorage("serverAddress") var serverAddress: String = ""
    @AppStorage("serverPort") var serverPort: String = ""
    @AppStorage("serverUser") var serverUser: String = ""
    @AppStorage("serverPassword") var serverPassword: String = ""
    @AppStorage("serverType") var serverType: String = "Komga"
    @AppStorage("geminiApiKey") var geminiApiKey: String = ""
    @AppStorage("aiServiceType") var aiServiceType: String = "Gemini" // v5.27.0
    @AppStorage("openAiApiKey") var openAiApiKey: String = ""
    
    // Web Server Settings
    @AppStorage("webServerPort") var webServerPort: Int = 59333
    @AppStorage("webServerUser") var webServerUser: String = "admin"
    @AppStorage("webServerPassword") var webServerPassword: String = "komga"
    @Published var isWebServerRunning: Bool = false
    
    // Box Style Settings (Persisted)
    @AppStorage("boxMarginTop") var boxMarginTop: Double = 14.0
    @AppStorage("boxMarginBottom") var boxMarginBottom: Double = 14.0
    @AppStorage("boxMarginHorizontal") var boxMarginHorizontal: Double = 0.0
    @AppStorage("coverFitMode") var coverFitMode: Int = 1 
    @AppStorage("textYOffset") var textYOffset: Double = 0.0
    @AppStorage("boxHandleVerticalOffset") var boxHandleVerticalOffset: Double = 0.0 // New
    
    // Grid Settings
    @AppStorage("gridSpacing") var gridSpacing: Double = 20.0
    
    // Column Settings
    @AppStorage("libraryColumns") var libraryColumns: Int = 5
    @AppStorage("importColumns") var importColumns: Int = 4
    
    var komgaBaseURL: URL {
        URL(string: "https://\(serverAddress):\(serverPort)/api/v1")!
    }
    
    // Persistent Data
    @Published var libraries: [Library] = []
    @Published var libraryCovers: [String: UIImage] = [:] // Kept for legacy or single cover
    @Published var libraryStackCovers: [String: [UIImage]] = [:] // New: 3 Covers for box overlay
    @Published var isLoadingLibraries = false
    @Published var libraryError: String?
    
    // Local Library State (Persisted in Memory)
    @Published var localRootNode: LocalFolderNode?
    @Published var localLibraryTabs: [String] = []
    @Published var localLibraryBackground: UIImage?
    @Published var isScanningLocal: Bool = false
    @Published var shouldReloadLocalLibrary: Bool = false // Refresh trigger
    
    init() {}
    
    func fetchLibraries() {
        guard libraries.isEmpty else { return } // Don't reload if we have data
        
        isLoadingLibraries = true
        libraryError = nil
        
        Task {
            do {
                let libs = try await KomgaService.shared.fetchLibraries()
                await MainActor.run {
                    self.libraries = libs
                }
                
                for lib in libs {
                    // Fetch 3 Random Covers from DISTINCT Series for the Stack
                    if libraryStackCovers[lib.id] == nil {
                        // 1. Fetch Series for this Library
                        if let allSeries = try? await KomgaService.shared.fetchSeries(for: lib.id) {
                            // 2. Shuffle and Pick 3
                            let randomSeries = Array(allSeries.shuffled().prefix(3))
                            
                            var covers: [UIImage] = []
                            for series in randomSeries {
                                if let img = await KomgaService.shared.fetchRandomBookThumbnail(forSeries: series.id) {
                                    covers.append(img)
                                }
                            }
                            
                            // 3. Save
                            if !covers.isEmpty {
                                await MainActor.run {
                                    self.libraryStackCovers[lib.id] = covers
                                }
                            }
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    self.libraryError = error.localizedDescription
                }
            }
            await MainActor.run {
                self.isLoadingLibraries = false
            }
        }
    }
}

// Global Models (Moved from LocalLibraryView to be accessible by AppState)
struct LocalBook: Identifiable {
    let id: String
    let title: String
    let originalURL: URL
    let url: URL
    let coverImage: UIImage?
    var metadata: ComicInfo? = nil
}

struct LocalFolderNode: Identifiable {
    let id: String
    let name: String
    var children: [LocalFolderNode]
    var books: [LocalBook]
    
    var isEmpty: Bool { children.isEmpty && books.isEmpty }
}
