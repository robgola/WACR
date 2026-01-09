
//
//  LibraryImportCard.swift
//  KomgaReaderAntigravity
//

import SwiftUI

struct LibraryImportCard: View {
    let libraryName: String
    let covers: [UIImage]
    
    // Theme Colors (Exact match to ComicBoxCard)
    @EnvironmentObject var appState: AppState // Style Settings
    
    // Theme Colors
    private let boxContainer = Color(red: 0.2, green: 0.3, blue: 0.45)
    private let boxLid = Color(white: 0.9)
    private let handleColor = Color(red: 0.1, green: 0.1, blue: 0.2)
    
    // Helper for Frame Calculation (Shared Logic with ComicBoxCard)
    private func layoutMetrics(for containerSize: CGSize) -> (graphicSize: CGSize, position: CGPoint) {
        // 1. Calculate Available Space (Proportional Margins)
        let baseRefWidth: CGFloat = 140.0
        let scale = containerSize.width / baseRefWidth
        
        let marginH = CGFloat(appState.boxMarginHorizontal) * scale
        let marginT = CGFloat(appState.boxMarginTop) * scale
        let marginB = CGFloat(appState.boxMarginBottom) * scale
        
        let availableWidth = containerSize.width - (marginH * 2)
        let availableHeight = containerSize.height - (marginT + marginB)
        
        // 2. Calculate Graphic Size
        let bodyRatio: CGFloat = 0.95
        
        var graphicW = availableWidth
        var graphicH = (graphicW * bodyRatio) * AppConstants.boxAspectRatio
        
        // Fit by Height if needed
        if graphicH > availableHeight {
            graphicH = availableHeight
            graphicW = graphicH / (AppConstants.boxAspectRatio * bodyRatio)
        }
        
        // Safety
        let finalGraphicW = max(graphicW, 10)
        let finalGraphicH = max(graphicH, 10)
        
        // 3. Positioning (Center Point)
        let originX = marginH + (availableWidth - finalGraphicW) / 2
        let originY = marginT // Top Align
        
        return (
            graphicSize: CGSize(width: finalGraphicW, height: finalGraphicH),
            position: CGPoint(x: originX + finalGraphicW/2, y: originY + finalGraphicH/2)
        )
    }
    
    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { geo in
                let metrics = layoutMetrics(for: geo.size)
                let finalGraphicW = metrics.graphicSize.width
                let finalGraphicH = metrics.graphicSize.height
                let lidHeight = finalGraphicH * 0.22
                
                ZStack(alignment: .topLeading) {
                    // Background
                    RoundedRectangle(cornerRadius: 6)
                        .fill(boxContainer)
                        .frame(width: geo.size.width, height: geo.size.height)
                    
                    // Graphic (Positioned)
                    ZStack(alignment: .top) {
                        // Dimensions
                        let bodyWidth = finalGraphicW * 0.95
                        
                        // A. Stack of Images
                        ZStack {
                            if !covers.isEmpty {
                                ForEach(Array(covers.prefix(3).enumerated()), id: \.offset) { index, img in
                                     // Crop Logic Inline
                                     let displayImage: UIImage = {
                                         if img.size.width > img.size.height {
                                             let cropRect = CGRect(x: img.size.width/2, y: 0, width: img.size.width/2, height: img.size.height)
                                             if let cg = img.cgImage?.cropping(to: cropRect) {
                                                 return UIImage(cgImage: cg, scale: img.scale, orientation: img.imageOrientation)
                                             }
                                         }
                                         return img
                                     }()
                                    
                                    Image(uiImage: displayImage)
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: bodyWidth, height: finalGraphicH)
                                        .clipped()
                                        // Randomness (Simple Fan)
                                        .rotationEffect(.degrees(Double((index * 5) - 5)))
                                        .offset(x: CGFloat((index * 5) - 5))
                                }
                            } else {
                                // Placeholder
                                VStack(spacing: 0) {
                                    Rectangle().fill(boxLid).frame(width: finalGraphicW, height: lidHeight)
                                    Rectangle().fill(Color.white).frame(width: bodyWidth, height: finalGraphicH - lidHeight)
                                }
                            }
                        }
                        .frame(width: bodyWidth, height: finalGraphicH)
                        .mask(
                            VStack(spacing: 0) {
                                RoundedCorner(radius: 4, corners: [.topLeft, .topRight])
                                    .frame(width: finalGraphicW, height: lidHeight)
                                Rectangle()
                                    .frame(width: bodyWidth, height: finalGraphicH - lidHeight)
                            }
                        )
                        
                        // B. Overlay (Lid & Strokes)
                        VStack(spacing: 0) {
                            // Lid
                            ZStack(alignment: .bottom) {
                                RoundedCorner(radius: 4, corners: [.topLeft, .topRight])
                                    .stroke(Color.black, lineWidth: 3)
                                Rectangle().fill(LinearGradient(colors: [.clear, .black.opacity(0.3)], startPoint: .top, endPoint: .bottom)).frame(height: 4)
                            }
                            .frame(width: finalGraphicW, height: lidHeight)
                            
                            // Body Frame & Handle
                            ZStack {
                                Rectangle().stroke(Color.black, lineWidth: 3)
                                Rectangle().strokeBorder(Color.gray.opacity(0.5), lineWidth: 1)
                                Capsule().fill(handleColor).frame(width: 50, height: 18)
                                    .padding(.bottom, 50)
                                    .offset(y: CGFloat(appState.boxHandleVerticalOffset))
                                    .shadow(radius: 1)
                            }
                            .frame(width: bodyWidth, height: finalGraphicH - lidHeight)
                        }
                    }
                    .frame(width: finalGraphicW, height: finalGraphicH)
                    .position(metrics.position)
                }
            }
            .aspectRatio(0.7, contentMode: .fit) // Lock Aspect Ratio (Same as UnifiedFolderIcon)
            .frame(maxWidth: .infinity) // Fill Grid Cell
            
            // Title (Below Box)
            ScrollingText(
                 text: libraryName,
                 font: .caption.bold(),
                 color: .white
            )
            .frame(height: 20)
            .padding(.top, 10) // Fixed padding
        }
    }
}
