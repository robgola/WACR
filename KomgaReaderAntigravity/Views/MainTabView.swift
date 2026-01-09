import SwiftUI
import UIKit

struct MainTabView: View {
    @State private var selectedTab = 0
    @EnvironmentObject var appState: AppState // Fullscreen control
    @ObservedObject var gemini = GeminiService.shared // New: Monitor
    
    @ObservedObject var localization = LocalizationService.shared // Localization
    
    init() {
        // Customize Segmented Control Appearance
        let font = UIFont.systemFont(ofSize: 21, weight: .medium)
        UISegmentedControl.appearance().selectedSegmentTintColor = UIColor.darkGray
        UISegmentedControl.appearance().setTitleTextAttributes([.foregroundColor: UIColor.white, .font: font], for: .selected)
        UISegmentedControl.appearance().setTitleTextAttributes([.foregroundColor: UIColor.gray, .font: font], for: .normal)
        UISegmentedControl.appearance().backgroundColor = UIColor.black.withAlphaComponent(0.5)
    }
    
    var body: some View {
        GeometryReader { geo in // SAFETY: Read global safe area
            ZStack(alignment: .top) {
            // LAYER 0: Background Context
            // This ensures strict black background preventing light bleeds
            Color.black.ignoresSafeArea()
            
            // LAYER 1: Dynamic Backgrounds (Settings/Library)
            if selectedTab == 2, let bg = appState.localLibraryBackground {
                Image(uiImage: bg)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .ignoresSafeArea()
                    .blur(radius: 15)
                    .overlay(Color.black.opacity(0.6).ignoresSafeArea())
            }
            
            // LAYER 2: Main Content
            Group {
                switch selectedTab {
                case 0:
                    LocalLibraryView(refreshTrigger: selectedTab == 0)
                case 1:
                    ContentView()
                case 2:
                    SettingsView()
                case 3:
                    HelpView()
                default:
                    EmptyView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // CRITICAL: Content must NOT affect the container's safe area adherence for the menu
            // We allow content to flow everywhere.
            
            // LAYER 3: The Immovable Main Menu (Native Safe Area Layout v5.30.2)
            // Relies on system-defined Safe Areas for positioning buttons, avoiding GeometryReader glitches.
            VStack(spacing: 0) {
                HStack {
                    // Leading Item: Back Button (Conditional) or Spacer
                    if appState.isInsideFolder {
                        Button(action: {
                            appState.navigateBack = true
                        }) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 22, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                                .background(.ultraThinMaterial)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white.opacity(0.15), lineWidth: 1))
                                .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)
                        }
                        .padding(.leading, 16)
                        
                        Spacer()
                    } else {
                        Spacer()
                    }
                    
                    // Custom Capsule Tab Bar
                    HStack(spacing: 0) {
                        ForEach([0, 1, 2, 3], id: \.self) { index in
                            let title: String = {
                                switch index {
                                case 0: return localization.library
                                case 1: return localization.importText
                                case 2: return localization.options
                                case 3: return localization.help
                                default: return ""
                                }
                            }()
                            
                            Button(action: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    selectedTab = index
                                }
                            }) {
                                Text(title)
                                    .font(.headline)
                                    .foregroundColor(selectedTab == index ? .black : .gray)
                                    .padding(.vertical, 8)
                                    .padding(.horizontal, 20)
                                    .background(
                                        ZStack {
                                            if selectedTab == index {
                                                Capsule()
                                                    .fill(Color.white)
                                                    .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
                                            }
                                        }
                                    )
                            }
                        }
                    }
                    .padding(4)
                    .background(
                        // Liquid Glass Effect
                        ZStack {
                            if #available(iOS 15.0, *) {
                                Rectangle()
                                    .fill(.ultraThinMaterial)
                            } else {
                                Color.black.opacity(0.8) // Fallback
                            }
                        }
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color.white.opacity(0.15), lineWidth: 0.5))
                        .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
                    )
                    
                    Spacer()
                }
                    .padding(.horizontal)
                    .padding(.bottom, 10) // Spacing below menu
                    // ROBUST PADDING FIX: If Safe Area collapses (0), force 24pt. Otherwise use 0 (system handles it).
                    .padding(.top, geo.safeAreaInsets.top < 20 ? 24 : 0)
                
                Spacer()
            }
            .background(
                // Gradient Background must ignore safe area to cover the Notch
                // Gradient Background must ignore safe area to cover the Notch
                LinearGradient(
                    gradient: Gradient(colors: [Color.black.opacity(0.8), Color.black.opacity(0.0)]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 150) // Fixed visual height
                .edgesIgnoringSafeArea(.top) // CRITICAL: This allows background to go up, while content stays down
                .allowsHitTesting(false) // FIX: Allow touches to pass through to buttons/headers below
            , alignment: .top)
            .zIndex(100)
            .opacity(appState.isFullScreen ? 0 : 1)
            .animation(.easeInOut(duration: 0.2), value: appState.isFullScreen)
            .allowsHitTesting(!appState.isFullScreen)

            // Global Overlay
            DownloadStatusOverlay()
            
            // Gemini Quota Overlay - REMOVED (Moved to SettingsView RPD)
            // VStack { Spacer(); HStack { Spacer(); QuotaOverlayView() } }
            // .allowsHitTesting(false)
            // .zIndex(200)
            }
        }
        .preferredColorScheme(.dark)
    }
}
