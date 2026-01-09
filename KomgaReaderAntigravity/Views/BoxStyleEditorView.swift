
import SwiftUI

struct BoxSnapshot {
    let boxMarginTop: Double
    let boxMarginBottom: Double
    let boxMarginHorizontal: Double
    let coverFitMode: Int
    let textYOffset: Double
    let gridSpacing: Double
    let boxHandleVerticalOffset: Double
    let libraryColumns: Int
    let importColumns: Int
}

struct BoxStyleEditorView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    // Snapshot for Revert
    @State private var initialSnapshot: BoxSnapshot?
    
    // Dummy Node for Preview
    let dummyNode = LocalFolderNode(
        id: "preview",
        name: "Preview Series Vol. 1999",
        children: [],
        books: [
            LocalBook(id: "1", title: "Book", originalURL: URL(string: "http://example.com")!, url: URL(string: "http://example.com")!, coverImage: UIImage(systemName: "photo"), metadata: nil)
        ]
    )
    
    var body: some View {
        ZStack {
            // 1. Global Dimming Layer
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .onTapGesture {
                    // Block taps
                }
            
            // 2. The Floating Window
            GeometryReader { geo in
                VStack(spacing: 0) {
                    // Header (Transparent, just text)
                    Text("Dashboard Layout")
                        .font(.system(size: 18, weight: .semibold, design: .default))
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.top, 20)
                        .padding(.bottom, 10)
                    
                    // Main Content (Split View)
                    HStack(spacing: 0) {
                        // Left: Preview (Transparent Context)
                        VStack {
                             Spacer()
                             
                             // We use a GeometryReader or similar to center, but VStack Spacer works.
                             // Simulate REAL Grid spacing
                             let minCellWidth = 140.0 + (appState.boxMarginHorizontal * 2)
                             
                             HStack(spacing: appState.gridSpacing) {
                                  UnifiedFolderIcon(node: dummyNode)
                                      .scaleEffect(1.0) // 1:1 Scale for realism
                                      .frame(width: minCellWidth) 
                                  
                                  UnifiedFolderIcon(node: dummyNode)
                                      .scaleEffect(1.0)
                                      .frame(width: minCellWidth)
                             }
                             .frame(height: 220)
                             .padding(.horizontal)
                             
                             Text("Live Preview")
                                 .font(.caption2)
                                 .textCase(.uppercase)
                                 .foregroundColor(.white.opacity(0.3))
                                 .padding(.top, 20)
                             
                             Spacer()
                        }
                        .frame(maxWidth: .infinity)
                        // No background color -> Shows Glass
                        
                        // Divider
                        Rectangle()
                            .fill(Color.white.opacity(0.1))
                            .frame(width: 1)
                            .padding(.vertical, 30)
                        
                        // Right: Controls (Compact)
                        VStack(alignment: .leading, spacing: 0) {
                            ScrollView {
                                VStack(alignment: .leading, spacing: 20) {
                                    // 1. Grid
                                    ControlSection(title: "GRID SYSTEM") {
                                        CompactSliderRow(label: "Spacing", value: $appState.gridSpacing, range: 10...40, step: 1)
                                        HStack(spacing: 12) {
                                            CompactStepper(label: "Library Cols", value: $appState.libraryColumns, range: 3...10)
                                            CompactStepper(label: "Import Cols", value: $appState.importColumns, range: 3...10)
                                        }
                                    }
                                    
                                    Divider().background(Color.white.opacity(0.1))
                                    
                                    // 2. Dimensions
                                    ControlSection(title: "DIMENSIONS") {
                                        CompactSliderRow(label: "Top Margin", value: $appState.boxMarginTop, range: 4...40, step: 1)
                                        CompactSliderRow(label: "Bottom Margin", value: $appState.boxMarginBottom, range: 4...40, step: 1)
                                        CompactSliderRow(label: "Side Margins", value: $appState.boxMarginHorizontal, range: -20...20, step: 1)
                                    }

                                    Divider().background(Color.white.opacity(0.1))
                                    
                                    // 3. Aesthetics
                                    ControlSection(title: "AESTHETICS") {
                                        CompactSliderRow(label: "Text Offset", value: $appState.textYOffset, range: -20...20, step: 1)
                                        CompactSliderRow(label: "Handle Offset", value: $appState.boxHandleVerticalOffset, range: -30...30, step: 1)
                                        
                                        HStack {
                                            Text("Cover Mode").font(.caption).foregroundColor(.gray)
                                            Spacer()
                                            Picker("Cover Mode", selection: $appState.coverFitMode) {
                                                Text("Crop").tag(0)
                                                Text("Fit").tag(1)
                                            }
                                            .pickerStyle(SegmentedPickerStyle())
                                            .frame(width: 120)
                                        }
                                    }
                                    
                                    // Reset
                                    Button(action: {
                                        withAnimation {
                                            appState.boxMarginTop = 14.0
                                            appState.boxMarginBottom = 14.0
                                            appState.boxMarginHorizontal = 0.0
                                            appState.coverFitMode = 1
                                            appState.textYOffset = 0.0
                                            appState.gridSpacing = 20.0
                                            appState.boxHandleVerticalOffset = 0.0
                                            appState.libraryColumns = 5
                                            appState.importColumns = 4
                                        }
                                    }) {
                                        HStack {
                                            Image(systemName: "arrow.counterclockwise")
                                            Text("Reset Defaults")
                                        }
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.4))
                                        .padding(.top, 5)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .trailing)
                                }
                                .padding(24)
                            }
                        }
                        .frame(width: 360) // Fixed width for controls sidebar
                    }
                    
                    // Footer Buttons (Right Aligned, Compact)
                    HStack(spacing: 12) {
                         Spacer()
                         
                         Button(action: {
                             restoreSnapshot()
                             dismiss()
                         }) {
                             Text("Cancel")
                                 .font(.callout)
                                 .foregroundColor(.white.opacity(0.8))
                                 .frame(width: 100, height: 36)
                                 .background(.ultraThinMaterial)
                                 .clipShape(RoundedRectangle(cornerRadius: 18))
                                 .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.white.opacity(0.1), lineWidth: 1))
                         }
                         
                         Button(action: {
                             dismiss()
                         }) {
                             Text("Save")
                                 .font(.callout.bold())
                                 .foregroundColor(.black)
                                 .frame(width: 100, height: 36)
                                 .background(Color.yellow)
                                 .clipShape(RoundedRectangle(cornerRadius: 18))
                                 .shadow(color: .yellow.opacity(0.2), radius: 4, x: 0, y: 2)
                         }
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 24)
                    .padding(.top, 10)
                }
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .overlay(
                    RoundedRectangle(cornerRadius: 24)
                        .strokeBorder(LinearGradient(colors: [.white.opacity(0.1), .white.opacity(0.02)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.5), radius: 60, x: 0, y: 15)
                .frame(width: geo.size.width * 0.65, height: geo.size.height * 0.70)
                .position(x: geo.size.width / 2, y: geo.size.height / 2)
            }
        }
        .presentationBackground(.clear)
        .onAppear {
            saveSnapshot()
        }
    }
    
    // MARK: - Snapshot Logic
    private func saveSnapshot() {
        initialSnapshot = BoxSnapshot(
            boxMarginTop: appState.boxMarginTop,
            boxMarginBottom: appState.boxMarginBottom,
            boxMarginHorizontal: appState.boxMarginHorizontal,
            coverFitMode: appState.coverFitMode,
            textYOffset: appState.textYOffset,
            gridSpacing: appState.gridSpacing,
            boxHandleVerticalOffset: appState.boxHandleVerticalOffset,
            libraryColumns: appState.libraryColumns,
            importColumns: appState.importColumns
        )
    }
    
    private func restoreSnapshot() {
        guard let s = initialSnapshot else { return }
        withAnimation {
            appState.boxMarginTop = s.boxMarginTop
            appState.boxMarginBottom = s.boxMarginBottom
            appState.boxMarginHorizontal = s.boxMarginHorizontal
            appState.coverFitMode = s.coverFitMode
            appState.textYOffset = s.textYOffset
            appState.gridSpacing = s.gridSpacing
            appState.boxHandleVerticalOffset = s.boxHandleVerticalOffset
            appState.libraryColumns = s.libraryColumns
            appState.importColumns = s.importColumns
        }
    }
}

// Helpers

struct ControlSection<Content: View>: View {
    let title: String
    let content: Content
    
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.yellow.opacity(0.8))
                .tracking(1)
            content
        }
    }
}

struct CompactSliderRow: View {
    let label: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    
    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.caption)
                .foregroundColor(.gray)
                .frame(width: 80, alignment: .leading) // Fixed label width
            
            Slider(value: $value, in: range, step: step)
                .accentColor(.yellow)
            
            Text("\(Int(value))")
                .font(.caption.monospacedDigit())
                .foregroundColor(.white)
                .frame(width: 25, alignment: .trailing)
        }
        .frame(height: 24) // Compact height
    }
}

struct CompactStepper: View {
    let label: String
    @Binding var value: Int
    let range: ClosedRange<Int>
    
    var body: some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.caption)
                .foregroundColor(.gray)
            
            Spacer()
            
            HStack(spacing: 0) {
                Button("-") { if value > range.lowerBound { value -= 1 } }
                    .frame(width: 24, height: 24)
                    .background(Color.white.opacity(0.1))
                
                Text("\(value)")
                    .font(.caption.monospacedDigit())
                    .frame(width: 24)
                    .background(Color.black.opacity(0.2))
                
                Button("+") { if value < range.upperBound { value += 1 } }
                    .frame(width: 24, height: 24)
                    .background(Color.white.opacity(0.1))
            }
            .cornerRadius(4)
            .foregroundColor(.white)
        }
    }
}
