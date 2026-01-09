import SwiftUI

// MARK: - Manual Models

struct ManualChapter: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let icon: String
    let color: Color
    let description: String
    let type: ChapterType
    
    enum ChapterType {
        case welcome, library, reading, ai, faq, technical
    }
}

// MARK: - Main Help View

struct HelpView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedChapter: ManualChapter?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var showCredits = false

    // Font Scaler (approx +15% from standard 17pt -> ~20pt)
    private let bodyFont = Font.system(size: 20, weight: .regular)
    private let headerFont = Font.system(size: 24, weight: .bold)
    private let titleFont = Font.system(size: 32, weight: .bold)

    @ObservedObject var localization = LocalizationService.shared // Bind to localization
    
    private var chapters: [ManualChapter] {
        let isIT = localization.language == "IT"
        return [
            ManualChapter(
                title: isIT ? "Benvenuto in ACR" : "Welcome to ACR",
                icon: "star.fill",
                color: .yellow,
                description: isIT ? "La Filosofia dell'Hub Universale" : "The Universal Hub Philosophy",
                type: .welcome
            ),
            ManualChapter(
                title: isIT ? "Gestione Libreria" : "Library Management",
                icon: "books.vertical.fill",
                color: .cyan,
                description: isIT ? "Komga, Import e Roadmap" : "Komga, FTP, & Import Sources",
                type: .library
            ),
            ManualChapter(
                title: isIT ? "Esperienza di Lettura" : "Reading Experience",
                icon: "book.fill",
                color: .purple,
                description: isIT ? "Gesti & Modalità" : "Gestures & Modes",
                type: .reading
            ),
            ManualChapter(
                title: isIT ? "Intelligenza Artificiale" : "AI Intelligence",
                icon: "brain.head.profile",
                color: .pink,
                description: isIT ? "Traduzione & Riassunti" : "Translation & Recap",
                type: .ai
            ),
            ManualChapter(
                title: isIT ? "Specifiche Tecniche" : "Technical Specs",
                icon: "cpu",
                color: .blue,
                description: isIT ? "Pipeline & Sicurezza" : "Pipeline & Architecture",
                type: .technical
            ),
            ManualChapter(
                title: isIT ? "FAQ & Supporto" : "FAQ & Support",
                icon: "questionmark.circle.fill",
                color: .green,
                description: isIT ? "Risoluzione Problemi" : "Troubleshooting",
                type: .faq
            )
        ]
    }
    
    var body: some View {
        NavigationView {
            List(chapters) { chapter in
                NavigationLink(destination: destinationView(for: chapter)) {
                    ManualChapterRow(chapter: chapter)
                }
                .listRowBackground(Color.black.opacity(0.5))
                .listRowSeparatorTint(.white.opacity(0.2))
            }
            .navigationTitle("Manual")
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color(red: 0.1, green: 0.1, blue: 0.12).ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(localization.language == "IT" ? "Crediti" : "Credits") { 
                        showCredits = true 
                    }
                    .foregroundColor(.yellow)
                }
            }
        }
        .navigationViewStyle(.stack)
        .accentColor(.yellow)
        .padding(.top, 80) // Clear the Floating Main Menu
        .sheet(isPresented: $showCredits) {
            CreditsView()
        }
    }
    
    @ViewBuilder
    private func destinationView(for chapter: ManualChapter) -> some View {
        let isIT = localization.language == "IT"
        switch chapter.type {
        case .welcome: WelcomeChapterView(bodyFont: bodyFont, headerFont: headerFont, titleFont: titleFont, isIT: isIT)
        case .library: LibraryChapterView(bodyFont: bodyFont, headerFont: headerFont, titleFont: titleFont, isIT: isIT)
        case .reading: ReadingChapterView(bodyFont: bodyFont, headerFont: headerFont, titleFont: titleFont, isIT: isIT)
        case .ai: AIChapterView(bodyFont: bodyFont, headerFont: headerFont, titleFont: titleFont, isIT: isIT)
        case .technical: TechnicalChapterView(bodyFont: bodyFont, headerFont: headerFont, titleFont: titleFont, isIT: isIT)
        case .faq: FAQChapterView(bodyFont: bodyFont, headerFont: headerFont, titleFont: titleFont, isIT: isIT)
        }
    }
}

// MARK: - Components

struct ManualChapterRow: View {
    let chapter: ManualChapter
    
    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle().fill(chapter.color.opacity(0.2)).frame(width: 44, height: 44)
                Image(systemName: chapter.icon).foregroundColor(chapter.color).font(.system(size: 20))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(chapter.title).font(.headline).foregroundColor(.white)
                Text(chapter.description).font(.subheadline).foregroundColor(.gray)
            }
        }
        .padding(.vertical, 6)
    }
}

struct ManualContentContainer<Content: View>: View {
    let title: String
    let content: Content
    
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                content
            }
            .padding(24)
        }
        .background(Color(red: 0.08, green: 0.08, blue: 0.1).ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Enhanced Chapter Views

struct WelcomeChapterView: View {
    let bodyFont: Font; let headerFont: Font; let titleFont: Font; let isIT: Bool
    var body: some View {
        ManualContentContainer(title: isIT ? "Benvenuto" : "Welcome") {
            Text("Antigravity Comic Reader")
                .font(titleFont).foregroundColor(.yellow)
            
            Text(isIT ?
                 "Benvenuto nel futuro della lettura digitale. ACR è un progetto ambizioso progettato per ridefinire il modo in cui interagisci con la tua libreria su iPad." :
                 "Welcome to the future of digital comic consumption. ACR is an ambitious project designed to redefine how you interact with your library on iPad.")
                .font(bodyFont).foregroundColor(.white.opacity(0.9))
                .lineSpacing(8)
            
            Divider().background(Color.white.opacity(0.2))
            
            Text(isIT ? "La Filosofia dell'Hub Universale" : "The Universal Hub Philosophy")
                .font(headerFont).foregroundColor(.white)
            
            Text(isIT ?
                 "In un mondo frammentato dove i tuoi fumetti potrebbero essere su un server Komga, un'istanza Kavita, librerie locali o seedbox, ACR agisce come **Unificatore Universale**." :
                 "In a fragmented world where your comics might be stored on a Komga server, a Kavita instance, a YACReader library, an FTP seedbox, or just your PC's hard drive, ACR acts as the **Universal Unifier**.")
                .font(bodyFont).foregroundColor(.gray).lineSpacing(6)
            
            Text(isIT ?
                 "Invece di essere un semplice 'client' remoto, ACR è un **Gestore di Libreria Locale**. Scarica, indicizza e organizza i contenuti in un database coeso ad alte prestazioni. Una volta importato, il file è locale: caricamento istantaneo, latenza zero e piena interazione offline." :
                 "Instead of being a simple 'client' that views files remotely, ACR is a **Local Library Manager**. It intelligently downloads, indexes, and organizes content from all these disparate sources into a single, cohesive, high-performance database on your device. Once imported, a file from an FTP server behaves exactly like a file from Komga: instant loading, zero latency, and full offline interaction.")
                .font(bodyFont).foregroundColor(.gray).lineSpacing(6)
        }
    }
}

struct LibraryChapterView: View {
    let bodyFont: Font; let headerFont: Font; let titleFont: Font; let isIT: Bool
    var body: some View {
        ManualContentContainer(title: isIT ? "Gestione Libreria" : "Library Management") {
            Text(isIT ? "Fonti Dati" : "Data Sources")
                .font(headerFont).foregroundColor(.cyan)
            
            Text(isIT ? "ACR ti da la libertà di importare contenuti da ovunque. Ecco i metodi supportati:" : "ACR gives you complete freedom to import content from virtually anywhere. Here is a detailed breakdown of supported methods:")
                .font(bodyFont).foregroundColor(.white.opacity(0.9))
            
            ManualInstructionStep(
                icon: "server.rack", color: .cyan,
                title: "Self-Hosted (Komga)",
                text: isIT ?
                "Collega ACR al tuo server Komga tramite le Impostazioni. Sincronizza metadati e progressi. Tocca 'Scarica' per portare i volumi in locale." :
                "Connect ACR to your home server via the Settings menu. The app behaves as a native client, syncing metadata, reading progress, and collections. When you open a series, simply tap 'Download' to bring it into your local high-speed storage.",
                font: bodyFont
            )
            
            ManualInstructionStep(
                icon: "network", color: .blue,
                title: "Web Server Drop Zone",
                text: isIT ?
                "Il tuo iPad diventa una destinazione Wi-Fi. Apri l'IP fornito sul PC e trascina intere cartelle di file CBZ/CBR/PDF per trasferirli e indicizzarli istantaneamente." :
                "A unique feature of ACR is the embedded Web Server. When enabled in Settings, your iPad becomes a destination on your local Wi-Fi network. You can open the provided IP address on your PC or Mac browser visually and drag-and-drop entire folders of CBZ/CBR/PDF files. They are instantly transferred and indexed.",
                font: bodyFont
            )
            
            ManualInstructionStep(
                icon: "externaldrive.fill", color: .green,
                title: "iOS Files",
                text: isIT ?
                "Usa 'Apri In...' o salva i file nella cartella ACR tramite l'app File di iOS." :
                "Use standard iOS 'Files' integration to AirDrop or copy files directly into the app's document sandbox.",
                font: bodyFont
            )
            
            Divider()
            
            // ROADMAP SECTION
            ManualInstructionStep(
                icon: "signpost.right.and.left.fill", color: .orange,
                title: isIT ? "Roadmap Funzioni Future" : "Future Roadmap",
                text: isIT ?
                "Nelle prossime versioni arriverà il supporto nativo per **Kavita**, connessioni dirette **FTP/SFTP** e il trasferimento via cavo **iTunes/Finder**." :
                "Support for **Kavita** servers, direct **FTP/SFTP** browsing, and wired **iTunes/Finder** file sharing will be available in an upcoming version.",
                font: bodyFont
            )
        }
    }
}

struct ReadingChapterView: View {
    let bodyFont: Font; let headerFont: Font; let titleFont: Font; let isIT: Bool
    var body: some View {
        ManualContentContainer(title: isIT ? "Esperienza di Lettura" : "Reading Experience") {
            Text(isIT ? "Lettore Adattivo" : "Adaptive Reader")
                .font(headerFont).foregroundColor(.purple)
            
            Text(isIT ?
                 "Il motore di lettura usa Metal per garantire 60fps in ogni situazione." :
                 "The reading engine is built on Apple's Metal framework for 60fps performance combined with SwiftUI for a fluid interface. It supports comprehensive gestures designed for one-handed logic.")
                .font(bodyFont).foregroundColor(.white.opacity(0.9))
            
            ManualInstructionStep(
                icon: "hand.tap", color: .purple,
                title: isIT ? "Zone Navigazione" : "Navigation Zones",
                text: isIT ?
                "Tocca il 20% laterale per girare pagina. Tocca al centro per mostrare l'HUD con miniature e opzioni." :
                "The screen is divided into intuitive zones. Tapping the left or right 20% of the screen turns pages backward or forward. Use the Center zone to toggle the HUD (Head-Up Display) with thumbnails and settings.",
                font: bodyFont
            )
            
            ManualInstructionStep(
                icon: "arrow.up.left.and.arrow.down.right", color: .purple,
                title: isIT ? "Smart Zoom" : "Smart Zoom",
                text: isIT ?
                "Doppio tocco per zoomare sui dettagli o sulla vignetta. Pizzica per lo zoom libero." :
                "Double-tap any panel to perform a smart zoom. You can also pinch-to-zoom freely to inspect artistic details. The high-resolution rendering engine ensures crisp lines at any magnification level.",
                font: bodyFont
            )
            
            Text(isIT ? "Modalità Manga" : "Manga Mode Detection").font(headerFont).foregroundColor(.purple).padding(.top)
            Text(isIT ?
                 "ACR usa i metadati ComicInfo.xml per capire la direzione di lettura. Puoi forzare Destra-a-Sinistra nelle opzioni." :
                 "ACR automatically parses internal file metadata (ComicInfo.xml) to determine reading direction. Japanese Manga will default to Right-to-Left. You can forcibly override this per-book in the reader settings.")
                .font(bodyFont).foregroundColor(.gray)
        }
    }
}

struct AIChapterView: View {
    let bodyFont: Font; let headerFont: Font; let titleFont: Font; let isIT: Bool
    var body: some View {
        ManualContentContainer(title: isIT ? "Intelligenza Artificiale" : "AI Intelligence") {
            Text(isIT ? "Motore Gemini" : "The Gemini Engine")
                .font(headerFont).foregroundColor(.pink)
            
            Text(isIT ? "ACR integra Gemini 1.5 Flash per rimuovere le barriere linguistiche." : "ACR integrates Google's Gemini 1.5 Flash model directly into the reading workflow. This is not a gimmick, but a tool to remove language barriers and memory gaps.")
                .font(bodyFont).foregroundColor(.white.opacity(0.9))
            
            ManualInstructionStep(
                icon: "bubble.left.and.bubble.right.fill", color: .pink,
                title: isIT ? "Traduzione Live" : "Real-Time Translation",
                text: isIT ?
                "Abilita la traduzione per leggere fumetti stranieri. L'app rileva i balloon (OCR), traduce il testo con l'AI mantenendo il contesto, e ricostruisce la pagina in tempo reale." :
                "When reading a foreign language comic, enable Translation Mode. The app will detect speech balloons, extract the text using OCR, send it to the AI for a context-aware translation, and then re-draw the balloons with the translated text in English (or your system language).",
                font: bodyFont
            )
            
            ManualInstructionStep(
                icon: "quote.bubble.fill", color: .pink,
                title: isIT ? "Riassunti Intelligenti" : "Smart Summaries",
                text: isIT ?
                "Riprendi una serie dopo mesi? ACR analizza i volumi precedenti nella tua libreria e genera un recap 'Nelle puntate precedenti...' senza spoiler." :
                "Starting Volume 12 of a series you haven't read in a year? ACR scans the summaries and key plot points of Volumes 1-11 stored in your local library and asks the AI to generate a 'Previously On...' recap, catching you up instantly without spoilers for the current volume.",
                font: bodyFont
            )
        }
    }
}

struct TechnicalChapterView: View {
    let bodyFont: Font; let headerFont: Font; let titleFont: Font; let isIT: Bool
    var body: some View {
        ManualContentContainer(title: isIT ? "Specifiche Tecniche" : "Technical Specs") {
            Text(isIT ? "Pipeline Esecuzione Balloon" : "Balloon Execution Pipeline")
                .font(headerFont).foregroundColor(.blue)
            
            Text(isIT ? "La traduzione si basa su una pipeline a 4 stadi:" : "The translation feature relies on a sophisticated 4-stage pipeline running partially on-device and partially in the cloud:")
                .font(bodyFont).foregroundColor(.white.opacity(0.9))
            
            // Step 1
            VStack(alignment: .leading, spacing: 8) {
                Text("1. Detection (CoreML YOLOV8)").font(bodyFont.bold()).foregroundColor(.white)
                Text(isIT ? "Un modello neurale on-device identifica le coordinate dei balloon (15ms)." : "The current page is rasterized and passed to an on-device Neural Engine model (YOLOV8 optimized for CoreML). This model identifies the bounding box coordinates of 'Speech Bubbles' with high precision (approx 15ms inference time).")
                    .font(bodyFont).foregroundColor(.gray)
            }
            // Step 2
            VStack(alignment: .leading, spacing: 8) {
                Text(isIT ? "2. OCR & Sorting" : "2. OCR & Sorting").font(bodyFont.bold()).foregroundColor(.white)
                Text(isIT ? "Vision Framework estrae il testo, che viene ordinato spazialmente." : "Apple's Vision Framework extracts raw text from the identified regions. The text blocks are then spatially sorted (Top-Left to Bottom-Right, or Right-to-Left for Manga) to preserve reading order context.")
                    .font(bodyFont).foregroundColor(.gray)
            }
            // Step 3
            VStack(alignment: .leading, spacing: 8) {
                Text(isIT ? "3. AI Contextual Translation" : "3. AI Contextual Translation").font(bodyFont.bold()).foregroundColor(.white)
                Text(isIT ? "Il testo viene inviato a Gemini 1.5 Flash. L'AI mantiene slang e onomatopee." : "The raw text blocks are bundled into a structured prompt and sent to Google Gemini 1.5 Flash. The AI is instructed to translate while maintaining comic-book nuances (slang, onomatopoeia interpretations) and returning an array aligned with the input.")
                    .font(bodyFont).foregroundColor(.gray)
            }
            // Step 4
            VStack(alignment: .leading, spacing: 8) {
                Text(isIT ? "4. Reconstruction" : "4. Reconstruction (Inpainting)").font(bodyFont.bold()).foregroundColor(.white)
                Text(isIT ? "CoreText renderizza il testo tradotto adattandolo al balloon originale." : "A white fill is applied over the original text region (intelligent masking coming in v2.0). CoreText then renders the translated string, autosizing it to fit the original bubble polygon constraints.")
                    .font(bodyFont).foregroundColor(.gray)
            }
            
            Divider()
            
            // SECURITY SECTION
            Text(isIT ? "Sicurezza & Privacy" : "Security & Privacy")
                .font(headerFont).foregroundColor(.red)
            
            Text(isIT ?
                 "Le tue API Key (Gemini, OpenAI) e le password del server sono salvate localmente nella **Sandbox Applicativa** del dispositivo iOS. Questi dati rimangono strettamente privati all'interno dell'app e non vengono mai inviati a terze parti." :
                 "Your API Keys (Gemini, OpenAI) and server passwords are stored locally within the **Application Sandbox** on your iOS device. This data remains strictly private to the app and is never shared with third parties.")
                .font(bodyFont).foregroundColor(.gray).lineSpacing(6)
        }
    }
}

struct FAQChapterView: View {
    let bodyFont: Font; let headerFont: Font; let titleFont: Font; let isIT: Bool
    var body: some View {
        ManualContentContainer(title: "FAQ") {
            FAQItem(
                question: isIT ? "Privacy: Dove vanno i miei dati?" : "Privacy: Where does my data go?",
                answer: isIT ? "L'indice è locale. Le immagini vengono inviate all'AI API *solo* quando richiedi una traduzione." : "Your library index is strictly local. Images are sent to the AI API *only* strictly when you request a translation. No reading history is shared.",
                font: bodyFont
            )
            
            FAQItem(
                question: isIT ? "Uso memoria alto?" : "Storage usage is high?",
                answer: isIT ? "ACR scarica archivi di alta qualità. Puoi cancellare singoli libri nelle impostazioni." : "Since ACR downloads high-quality archives, storage usage reflects your library size. You can delete individual books or clear the cache in Settings.",
                font: bodyFont
            )
            
            FAQItem(
                question: isIT ? "Perché Gemini?" : "Why specifically Gemini?",
                answer: isIT ? "Per la sua finestra di contesto massiccia (riassunti interi volumi) e latenza bassissima." : "We chose Gemini 1.5 Flash for its massive context window (allowing it to summarize entire series) and its extremely low latency, which is critical for the live-translation experience.",
                font: bodyFont
            )
        }
    }
}

// MARK: - Reusable UI

struct ManualInstructionStep: View {
    let icon: String; let color: Color; let title: String; let text: String; let font: Font
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: icon).foregroundColor(color).font(.system(size: 28))
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.headline).foregroundColor(.white) // Keep headlines standard size but bold
                Text(text).font(font).foregroundColor(.gray).fixedSize(horizontal: false, vertical: true).lineSpacing(4)
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
    }
}

struct FAQItem: View {
    let question: String; let answer: String; let font: Font
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(question).font(font.bold()).foregroundColor(.white)
            Text(answer).font(font).foregroundColor(.gray).lineSpacing(4)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
    }
}
// MARK: - Credits View

struct CreditsView: View {
    @Environment(\.dismiss) private var dismiss
    
    // Helper to get App Version
    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (Build \(build))"
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    
                    // HEADER: Icon & App Name
                    HStack(spacing: 20) {
                        if let icon = Bundle.main.icon {
                            Image(uiImage: icon)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 80, height: 80)
                                .cornerRadius(18)
                                .shadow(radius: 5)
                        } else {
                            Image(systemName: "app.fill")
                                .font(.system(size: 80))
                                .foregroundColor(.yellow)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("General Information")
                                .font(.title2).bold()
                                .foregroundColor(.white)
                            
                            Text("ACR - Antigravity Comics Reader")
                                .font(.headline)
                                .foregroundColor(.gray)
                            
                            Text("Version \(appVersion)")
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                    }
                    .padding(.bottom, 10)
                    
                    Divider().background(Color.white.opacity(0.2))
                    
                    // CONTACT
                    VStack(alignment: .leading, spacing: 15) {
                        Text("Contact")
                            .font(.title2).bold()
                            .foregroundColor(.white)
                        
                        ContactRow(label: "support", email: "antigravitycomicsreader+support@gmail.com")
                        ContactRow(label: "suggestions", email: "antigravitycomicsreader+info@gmail.com")
                        ContactRow(label: "developer", email: "antigravitycomicsreader+dev@gmail.com")
                    }
                    
                    Divider().background(Color.white.opacity(0.2))
                    
                    // WEBSITE
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Web site")
                            .font(.title2).bold()
                            .foregroundColor(.white)
                        
                        Text("TBA")
                            .font(.body)
                            .foregroundColor(.yellow)
                            .underline()
                    }
                    
                    Divider().background(Color.white.opacity(0.2))
                    
                    // DONATIONS
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Donations")
                            .font(.title2).bold()
                            .foregroundColor(.white)
                        
                        Text("ACR is free and open source. If you find it useful, please consider a donation to support development.")
                            .font(.body)
                            .foregroundColor(.gray)
                        
                        HStack {
                            Text("PayPal:").foregroundColor(.white).bold()
                            Text("TBA")
                                .foregroundColor(.yellow)
                                .underline()
                        }
                    }
                    
                    Spacer()
                }
                .padding(24)
            }
            .background(Color(red: 0.1, green: 0.1, blue: 0.12).ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                        .foregroundColor(.yellow)
                }
            }
        }
    }
}

struct ContactRow: View {
    let label: String
    let email: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text("•").foregroundColor(.gray)
                Text(label + ":").foregroundColor(.white).bold()
            }
            Text(email)
                .foregroundColor(.yellow)
                .padding(.leading, 14)
                .textSelection(.enabled) // Allow copying
        }
    }
}

// MARK: - Bundle Extension
extension Bundle {
    var icon: UIImage? {
        if let icons = infoDictionary?["CFBundleIcons"] as? [String: Any],
           let primaryIcon = icons["CFBundlePrimaryIcon"] as? [String: Any],
           let iconFiles = primaryIcon["CFBundleIconFiles"] as? [String],
           let lastIcon = iconFiles.last {
            return UIImage(named: lastIcon)
        }
        return nil
    }
}
