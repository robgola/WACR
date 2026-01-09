import SwiftUI

// MARK: - ARCHITECTURE LOCK (v5.29.0)
// This view uses a "Solid Spacer" Strategy for robust layout stability:
// 1. NavigationStack + Double Hidden Bar (Standard).
// 2. SOLID SPACER: The first element in the VStack is a Color.clear frame of height 85.
//    This physically forces content down, preventing Main Menu overlap regardless of scroll/bounce.
// 3. Fonts: Unified to Size 17 (Regular/Bold).
// 4. Width: Max 700.

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("skipIntro") private var skipIntro: Bool = false
    @EnvironmentObject var appState: AppState
    @ObservedObject var localization = LocalizationService.shared
    @ObservedObject var gemini = GeminiService.shared
    @ObservedObject var webServer = WebServerService.shared // Observe WebServer direct state
    
    // Separate Editing States
    @State private var activeFieldId: String? = nil
    @State private var showKomgaPassword = false
    @State private var showWebServerPassword = false // Separate state
    @State private var showGeminiApiKey = false
    @State private var showBoxEditor = false
    @State private var webServerError: String? = nil // To show start failures
    
    // v5.27.0: AI Model List State
    @State private var showModelList = false
    @State private var availableModels: [String] = []
    @State private var isLoadingModels = false
    
    let serverTypes = ["Komga", "Kavita (Coming Soon)", "YacReader (Coming Soon)", "FTP (Coming Soon)"]
    
    // STANDARDIZED FONTS (v5.29.0)
    // Size 17 is standard iOS Body size.
    let standardFont = Font.system(size: 17, weight: .regular)
    let headerFont = Font.system(size: 17, weight: .bold) // Same size, just bold
    
    // Dense Spacing
    let sectionSpacing: CGFloat = 18
    let rowSpacing: CGFloat = 9
    let innerPadding: CGFloat = 12
    
    var body: some View {
        NavigationView {
            ZStack(alignment: .top) {
                // LAYER 1: Background
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
                
                
                // LAYER 2: Content
                ScrollView {
                    VStack(spacing: 0) {
                        
                        // SPACE FOR MENU (160pt) - Padding Strategy
                        // We simply push the first element down using an empty Spacer or Padding
                        // but since this is a VStack, we can just use a transparent spacer frame that definitely works, 
                        // OR just rely on the padding of the header.
                        
                        // Let's use a standard Spacer frame which is more robust than Color view in some contexts
                        Spacer().frame(height: 160)
                        
                        // CUSTOM HEADER
                        HStack {
                            Text(localization.options)
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 10)

                        // CONTENT
                        VStack(spacing: sectionSpacing) {
                            
                            // 1. COMICS SERVER
                            VStack(alignment: .leading, spacing: rowSpacing) {
                                Text(localization.comicsServer).font(headerFont).foregroundColor(.white).padding(.leading, 4)
                                
                                VStack(spacing: 6) {
                                    // Row 1: Server Type
                                    HStack {
                                        Text(localization.serverTypeKey)
                                            .font(standardFont)
                                            .foregroundColor(.white)
                                            .frame(width: 140, alignment: .leading)
                                        Spacer()
                                        Menu {
                                            ForEach(serverTypes, id: \.self) { type in
                                                Button(action: {
                                                    if type == "Komga" {
                                                        appState.serverType = "Komga"
                                                    }
                                                }) {
                                                    Text(type)
                                                }
                                            }
                                        } label: {
                                            HStack {
                                                Text(appState.serverType)
                                                    .font(standardFont)
                                                    .foregroundColor(.blue)
                                                Image(systemName: "chevron.up.chevron.down")
                                                    .font(.caption)
                                                    .foregroundColor(.gray)
                                            }
                                            .padding(6)
                                            .background(Color.white.opacity(0.1))
                                            .cornerRadius(6)
                                        }
                                    }
                                    .padding(4)
                                    
                                    Divider().background(Color.white.opacity(0.2))
                                    
                                    // Fields
                                    SettingsRow(id: "serverName", label: localization.serverName, text: $appState.serverName, activeId: $activeFieldId, font: standardFont)
                                    
                                    Divider().background(Color.white.opacity(0.2))
                                    
                                    SettingsRow(id: "serverAddress", label: localization.serverAddress, text: $appState.serverAddress, activeId: $activeFieldId, keyboardType: .URL, font: standardFont)

                                    Divider().background(Color.white.opacity(0.2))

                                    SettingsRow(id: "serverPort", label: localization.serverPort, text: $appState.serverPort, activeId: $activeFieldId, keyboardType: .numberPad, font: standardFont)
                                    
                                    Divider().background(Color.white.opacity(0.2))
                                    
                                    SettingsRow(id: "serverUser", label: localization.serverUser, text: $appState.serverUser, activeId: $activeFieldId, font: standardFont)
                                    
                                    Divider().background(Color.white.opacity(0.2))
                                    
                                    // Password
                                    HStack {
                                        Text(localization.serverPassword)
                                            .font(standardFont)
                                            .foregroundColor(.white)
                                            .frame(width: 140, alignment: .leading)
                                        Spacer(minLength: 20)
                                        
                                        HStack {
                                            if showKomgaPassword {
                                                TextField("Password", text: $appState.serverPassword)
                                                    .multilineTextAlignment(.trailing)
                                                    .font(standardFont)
                                                    .foregroundColor(activeFieldId == "serverPassword" ? .black : .gray)
                                                    .disabled(activeFieldId != "serverPassword")
                                            } else {
                                                SecureField("Password", text: $appState.serverPassword)
                                                    .multilineTextAlignment(.trailing)
                                                    .font(standardFont)
                                                    .foregroundColor(activeFieldId == "serverPassword" ? .black : .gray)
                                                    .disabled(activeFieldId != "serverPassword")
                                            }
                                            
                                            Button(action: { showKomgaPassword.toggle() }) {
                                                Image(systemName: showKomgaPassword ? "eye.slash" : "eye")
                                                    .foregroundColor(.gray)
                                            }
                                        }
                                        .padding(8)
                                        .background(activeFieldId == "serverPassword" ? Color.white : Color.clear)
                                        .cornerRadius(8)
                                    }
                                    .padding(4)
                                    .contentShape(Rectangle())
                                    .onTapGesture(count: 2) { activeFieldId = "serverPassword" }
                                    
                                    if ["serverType", "serverName", "serverAddress", "serverPort", "serverUser", "serverPassword"].contains(activeFieldId) {
                                        ActionButtons(activeId: $activeFieldId, taskToRun: nil)
                                    }
                                }
                                .padding(innerPadding)
                                .background(Color.black)
                                .cornerRadius(16)
                            }
                            

                            // 2. WEB SERVER
                            VStack(alignment: .leading, spacing: rowSpacing) {
                                HStack {
                                    Text(localization.webServer).font(headerFont).foregroundColor(.white)
                                    Spacer()
                                    if webServer.isRunning {
                                        Text("● On").font(.caption.bold()).foregroundColor(.green)
                                    } else {
                                        Text("● Off").font(.caption).foregroundColor(.gray)
                                    }
                                }
                                .padding(.leading, 4)
                                
                                VStack(spacing: 6) {
                                    // Toggle & Status
                                    Toggle(localization.enableServer, isOn: Binding(
                                        get: { webServer.isRunning },
                                        set: { newValue in
                                            if newValue {
                                                do {
                                                    try webServer.start(
                                                        port: UInt16(appState.webServerPort),
                                                        user: appState.webServerUser,
                                                        pass: appState.webServerPassword
                                                    )
                                                } catch {
                                                    print("Server Start Error: \(error)")
                                                }
                                            } else {
                                                webServer.stop()
                                            }
                                        }
                                    ))
                                    .font(standardFont)
                                    .foregroundColor(.white)
                                    .padding(4)
                                    .alert(localization.serverError, isPresented: Binding(get: { webServer.lastError != nil }, set: { _ in webServer.lastError = nil })) {
                                        Button("OK", role: .cancel) { }
                                    } message: {
                                        Text(webServer.lastError ?? localization.unknownError)
                                    }
                                    
                                    if webServer.isRunning {
                                        Divider().background(Color.white.opacity(0.2))
                                        HStack {
                                            if !webServer.serverURL.isEmpty {
                                                Text(webServer.serverURL)
                                                    .font(.system(size: 15, weight: .medium, design: .monospaced))
                                                    .foregroundColor(.blue)
                                                    .textSelection(.enabled)
                                            } else {
                                                Text(localization.waitingNetwork)
                                                    .font(.caption)
                                                    .foregroundColor(.orange)
                                            }
                                            Spacer()
                                        }
                                        .padding(4)
                                    }
                                    
                                    Divider().background(Color.white.opacity(0.2))
                                    
                                    // Configuration (Disable if running)
                                    Group {
                                        SettingsRow(id: "wsPort", label: localization.serverPort, text: Binding(get: { String(appState.webServerPort) }, set: { appState.webServerPort = Int($0) ?? 8080 }), activeId: $activeFieldId, keyboardType: .numberPad, font: standardFont)
                                        
                                        Divider().background(Color.white.opacity(0.2))
                                        
                                        SettingsRow(id: "wsUser", label: localization.serverUser, text: $appState.webServerUser, activeId: $activeFieldId, font: standardFont)
                                        
                                        Divider().background(Color.white.opacity(0.2))
                                        
                                        HStack {
                                            Text(localization.serverPassword).font(standardFont).foregroundColor(.white).frame(width: 140, alignment: .leading)
                                            Spacer(minLength: 20)
                                            Group {
                                                if showWebServerPassword {
                                                    TextField("Password", text: $appState.webServerPassword)
                                                } else {
                                                    SecureField("Password", text: $appState.webServerPassword)
                                                }
                                            }
                                            .multilineTextAlignment(.trailing)
                                            .font(standardFont)
                                            .foregroundColor(activeFieldId == "wsPass" ? .black : .gray)
                                            .disabled(activeFieldId != "wsPass")
                                            .padding(8)
                                            .background(activeFieldId == "wsPass" ? Color.white : Color.clear)
                                            .cornerRadius(8)
                                            
                                            // Press & Hold to Show
                                            Image(systemName: showWebServerPassword ? "eye" : "eye.slash")
                                                .foregroundColor(.gray)
                                                .padding(8)
                                                .contentShape(Rectangle())
                                                .gesture(
                                                    DragGesture(minimumDistance: 0)
                                                        .onChanged { _ in showWebServerPassword = true }
                                                        .onEnded { _ in showWebServerPassword = false }
                                                )
                                        }
                                        .contentShape(Rectangle())
                                        .onTapGesture(count: 2) { activeFieldId = "wsPass" }
                                    }
                                    .disabled(appState.isWebServerRunning)
                                    .opacity(appState.isWebServerRunning ? 0.5 : 1.0)
                                    
                                    if ["wsPort", "wsUser", "wsPass"].contains(activeFieldId) {
                                            ActionButtons(activeId: $activeFieldId, taskToRun: nil)
                                    }
                                }
                                .padding(innerPadding)
                                .background(Color.black)
                                .cornerRadius(16)
                            }

                            // 3. AI CONFIGURATION
                            VStack(alignment: .leading, spacing: rowSpacing) {
                                Text(localization.aiConfiguration).font(headerFont).foregroundColor(.white).padding(.leading, 4)
                                
                                VStack(spacing: 6) {
                                    // AI Type
                                    HStack {
                                        Text(localization.aiType)
                                            .font(standardFont)
                                            .foregroundColor(.white)
                                            .frame(width: 120, alignment: .leading)
                                        Spacer()
                                        Menu {
                                            Button("Gemini") { appState.aiServiceType = "Gemini" }
                                            Button("ChatGPT (\(localization.comingSoon))") { }.disabled(true)
                                            Button("Claude (\(localization.comingSoon))") { }.disabled(true)
                                            Button("Grok (\(localization.comingSoon))") { }.disabled(true)
                                        } label: {
                                            HStack {
                                                Text(appState.aiServiceType)
                                                    .font(standardFont)
                                                    .foregroundColor(.blue)
                                                Image(systemName: "chevron.up.chevron.down")
                                                    .font(.caption)
                                                    .foregroundColor(.gray)
                                            }
                                            .padding(6)
                                            .background(Color.white.opacity(0.1))
                                            .cornerRadius(6)
                                        }
                                        Spacer().frame(width: 8)
                                        Button(action: {
                                            isLoadingModels = true
                                            showModelList = true
                                            availableModels = []
                                            Task {
                                                do {
                                                    let models = try await GeminiService.shared.fetchAvailableModels()
                                                    await MainActor.run {
                                                        self.availableModels = models
                                                        self.isLoadingModels = false
                                                    }
                                                } catch {
                                                    await MainActor.run {
                                                        self.availableModels = [LocalizationService.shared.modelFetchError]
                                                        self.isLoadingModels = false
                                                    }
                                                }
                                            }
                                        }) {
                                            HStack(spacing: 4) {
                                                Image(systemName: "network")
                                                Text(localization.checkModel)
                                            }
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundColor(.white)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 6)
                                            .background(Color.blue.opacity(0.8))
                                            .clipShape(Capsule())
                                        }
                                    }
                                    .padding(4)
                                    .padding(.horizontal, 4)

                                    Divider().background(Color.white.opacity(0.2))

                                    // API Key
                                    HStack {
                                        Text(localization.apiKey)
                                            .font(standardFont)
                                            .foregroundColor(.white)
                                            .frame(width: 120, alignment: .leading)
                                        Spacer(minLength: 20)
                                        HStack {
                                            if showGeminiApiKey {
                                                TextField(localization.apiKey, text: $appState.geminiApiKey)
                                                    .multilineTextAlignment(.trailing)
                                                    .font(standardFont)
                                                    .foregroundColor(activeFieldId == "geminiKey" ? .black : .gray)
                                                    .disabled(activeFieldId != "geminiKey")
                                            } else {
                                                SecureField(localization.apiKey, text: $appState.geminiApiKey)
                                                    .multilineTextAlignment(.trailing)
                                                    .font(standardFont)
                                                    .foregroundColor(activeFieldId == "geminiKey" ? .black : .gray)
                                                    .disabled(activeFieldId != "geminiKey")
                                            }
                                            Button(action: { showGeminiApiKey.toggle() }) {
                                                Image(systemName: showGeminiApiKey ? "eye.slash" : "eye")
                                                    .foregroundColor(.gray)
                                            }
                                        }
                                        .padding(8)
                                        .background(activeFieldId == "geminiKey" ? Color.white : Color.clear)
                                        .cornerRadius(8)
                                    }
                                    .contentShape(Rectangle())
                                    .onTapGesture(count: 2) { activeFieldId = "geminiKey" }
                                    .padding(.horizontal, 4)
                                    
                                    Divider().background(Color.white.opacity(0.2))

                                    // Status
                                    HStack(spacing: 8) {
                                        Circle().fill(gemini.isApiKeyValid ? Color.green : Color.red).frame(width: 14, height: 14)
                                        if gemini.isApiKeyValid {
                                            Text("\(localization.validKeyModel) \(gemini.currentModelName)")
                                                .font(standardFont)
                                                .foregroundColor(.secondary)
                                                .lineLimit(1).minimumScaleFactor(0.8)
                                        } else {
                                            Text("\(localization.status): \(gemini.validationStatus)")
                                                .font(standardFont)
                                                .foregroundColor(.secondary).lineLimit(1)
                                        }
                                        Spacer()
                                        Button(action: { Task { await gemini.verifyApiKey() } }) {
                                            Text(localization.verify).font(.caption.bold()).foregroundColor(.blue)
                                        }
                                        .disabled(activeFieldId == "geminiKey")
                                    }
                                    .padding(.top, 4).padding(.horizontal, 4)
                                    
                                    Divider().background(Color.white.opacity(0.2))

                                    // RPD Stats (Updated Labels)
                                    HStack {
                                        Text(localization.dailyRPD) // NEW LABEL
                                            .font(standardFont)
                                            .foregroundColor(.white)
                                            Text("\(gemini.dailyRequests)")
                                            .font(standardFont.bold()) // Bold Value
                                            .foregroundColor(.yellow)
                                        
                                        Spacer()
                                        
                                        Text(localization.peakRPD) // NEW LABEL
                                            .font(standardFont)
                                            .foregroundColor(.gray)
                                        Text("\(gemini.peakDailyRequests)")
                                            .font(standardFont)
                                            .foregroundColor(.gray)
                                    }
                                    .padding(4).padding(.horizontal, 4)
                                    
                                    if activeFieldId == "geminiKey" {
                                        ActionButtons(activeId: $activeFieldId, taskToRun: { await gemini.verifyApiKey() })
                                    }
                                }
                                .padding(innerPadding).background(Color.black).cornerRadius(16)
                            }

                                // 3. APP SETTINGS
                                VStack(alignment: .leading, spacing: rowSpacing) {
                                    Text(localization.appSettings).font(headerFont).foregroundColor(.white).padding(.leading, 4)
                                    
                                    VStack(spacing: 12) {
                                        Toggle(localization.skipIntro, isOn: $skipIntro)
                                            .font(standardFont)
                                            .foregroundColor(.white)
                                        
                                        Divider().background(Color.white.opacity(0.2))
                                        
                                        HStack {
                                            Text(localization.appearance).font(standardFont).foregroundColor(.white)
                                            Spacer()
                                            Picker("", selection: $localization.language) {
                                                Text("🇮🇹").tag("IT")
                                                Text("🇬🇧").tag("EN")
                                            }
                                            .pickerStyle(SegmentedPickerStyle())
                                            .frame(width: 120)
                                        }
                                        
                                        Divider().background(Color.white.opacity(0.2))
                                        
                                        Button(localization.dashboardLayout) { showBoxEditor = true }
                                        .foregroundColor(.blue).font(standardFont)
                                    }
                                    .padding(innerPadding).background(Color.black).cornerRadius(16)
                                }
                                
                                // About
                                    VStack(spacing: 8) {
                                    HStack { Text(localization.version).font(standardFont).foregroundColor(.white); Spacer(); Text("1.0 RC").foregroundColor(.secondary).font(standardFont) }
                                    Divider().background(Color.white.opacity(0.1))
                                    HStack { Text(localization.devVersion).font(standardFont).foregroundColor(.white); Spacer(); Text("5.30.1-RC").foregroundColor(.secondary).font(standardFont) }
                                    }
                                    .padding(innerPadding).background(Color.black).cornerRadius(16)
                        }
                        // .frame(maxWidth: 700) -> Moved to Parent
                        // .frame(maxWidth: .infinity) -> Moved to Parent
                        .padding(.horizontal, 20)
                        .padding(.bottom, 40)
                    } // VStack (Internal)
                    .frame(maxWidth: 700)
                    .frame(maxWidth: .infinity)
                } // ScrollView
            } // ZStack
            .navigationBarHidden(true)
            .toolbar(.hidden, for: .navigationBar)
            .ignoresSafeArea(.keyboard)
            .overlay(
                ZStack {
                    if showModelList {
                        Color.black.opacity(0.6).ignoresSafeArea()
                            .onTapGesture { showModelList = false }
                        VStack(spacing: 16) {
                            Text(localization.availableModels).font(.headline).foregroundColor(.white).padding(.top)
                            if isLoadingModels { ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white)) }
                            else {
                                ScrollView {
                                    VStack(alignment: .leading, spacing: 12) {
                                        ForEach(availableModels, id: \.self) { model in
                                            Text(model).font(.system(size: 16)).foregroundColor(.white.opacity(0.9)).padding(.vertical, 4)
                                            Divider().background(Color.white.opacity(0.2))
                                        }
                                    }.padding()
                                }.frame(maxHeight: 300)
                            }
                            Button(localization.close) { showModelList = false }.foregroundColor(.yellow).padding(.bottom)
                        }
                        .frame(width: 320).background(Color(red: 0.15, green: 0.15, blue: 0.17)).cornerRadius(16).shadow(radius: 20)
                    }
                }.animation(.easeInOut(duration: 0.2), value: showModelList)
            )

            .fullScreenCover(isPresented: $showBoxEditor) {
                BoxStyleEditorView()
            }
        }
        .navigationViewStyle(.stack)
    }
}

// Reusable Action Buttons
struct ActionButtons: View {
    @Binding var activeId: String?
    @ObservedObject var localization = LocalizationService.shared
    var taskToRun: (() async -> Void)? = nil
    
    var body: some View {
        HStack(spacing: 12) {
            Spacer()
            Button(action: {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                activeId = nil
            }) {
                Text(localization.cancel)
                    .font(.callout)
                    .foregroundColor(.white.opacity(0.8))
                    .frame(width: 100, height: 36)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Color.white.opacity(0.1), lineWidth: 1))
            }
            
            Button(action: {
                activeId = nil
                if let t = taskToRun { Task { await t() } }
            }) {
                Text(localization.save).font(.callout.bold()).foregroundColor(.black).frame(width: 100, height: 36).background(Color.yellow).clipShape(Capsule()).shadow(color: .yellow.opacity(0.2), radius: 4, x: 0, y: 2)
            }
        }
        .padding(.top, 12)
    }
}

// Helper Row
struct SettingsRow: View {
    let id: String
    let label: String
    @Binding var text: String
    @Binding var activeId: String?
    var keyboardType: UIKeyboardType = .default
    var font: Font
    
    var isEditing: Bool { activeId == id }
    
    var body: some View {
        HStack {
            Text(label).font(font).foregroundColor(.white).frame(width: 140, alignment: .leading)
            Spacer(minLength: 20)
            TextField("", text: $text).multilineTextAlignment(.trailing).font(font).foregroundColor(isEditing ? .black : .gray).disabled(!isEditing).keyboardType(keyboardType).padding(8).background(isEditing ? Color.white : Color.clear).cornerRadius(8)
        }
        .contentShape(Rectangle())
        .padding(4)
        .onTapGesture(count: 2) { activeId = id }
    }
}
