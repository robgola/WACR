import SwiftUI

struct ComicBoxCard: View {
    @EnvironmentObject var appState: AppState // Style Settings
    
    // Content
    let coverImage: UIImage?
    // Theme Colors
    private let boxContainer = Color(red: 0.2, green: 0.3, blue: 0.45) // Gray-Blue Base
    private let boxLid = Color(white: 0.9) // White Lid
    private let handleColor = Color(red: 0.1, green: 0.1, blue: 0.2) // Dark Handle
    
    // Configuration
    var showBackground: Bool = true
    
    // Helper to process image (Crop Right Half if Landscape)
    private var processedImage: UIImage? {
        guard let original = coverImage else { return nil }
        
        // Check Aspect Ratio
        if original.size.width > original.size.height {
            // Landscape -> Crop Right Half (Standard Single Page View)
            let cropRect = CGRect(x: original.size.width / 2, y: 0, width: original.size.width / 2, height: original.size.height)
            if let cgImage = original.cgImage?.cropping(to: cropRect) {
                return UIImage(cgImage: cgImage, scale: original.scale, orientation: original.imageOrientation)
            }
        }
        return original
    }
    
    // Helper for Frame Calculation
    private func layoutMetrics(for containerSize: CGSize) -> (graphicSize: CGSize, position: CGPoint) {
        // 1. Calculate Available Space
        // 1. Calculate Available Space
        let baseRefWidth: CGFloat = 140.0
        let scale = containerSize.width / baseRefWidth
        
        let marginH = CGFloat(appState.boxMarginHorizontal) * scale
        let marginT = CGFloat(appState.boxMarginTop) * scale
        let marginB = CGFloat(appState.boxMarginBottom) * scale
        
        let availableWidth = containerSize.width - (marginH * 2)
        let availableHeight = containerSize.height - (marginT + marginB)
        
        // 2. Calculate Graphic Size
        // User Logic: Aspect Ratio applies to BODY, not Lid.
        // Lid = Body / 0.95 (approx) or Body = Lid * 0.95
        // Let's assume Lid (widest) fills margins -> graphicW
        // Body = graphicW * 0.95
        // Height = Body * Ratio
        
        let bodyRatio: CGFloat = 0.95
        
        var graphicW = availableWidth
        var graphicH = (graphicW * bodyRatio) * AppConstants.boxAspectRatio
        
        // Fit by Height if needed
        if graphicH > availableHeight {
            graphicH = availableHeight
            // Reverse: graphicW = graphicH / (Ratio * bodyRatio)
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
        GeometryReader { geo in
            let metrics = layoutMetrics(for: geo.size)
            let finalGraphicW = metrics.graphicSize.width
            let finalGraphicH = metrics.graphicSize.height
            let lidHeight = finalGraphicH * 0.22 
            
            ZStack(alignment: .topLeading) {
                // Background (Fills Container)
                if showBackground {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(boxContainer)
                        .frame(width: geo.size.width, height: geo.size.height)
                }
                
                // Graphic (Positioned)
                ZStack(alignment: .top) {
                     // Dimensions
                     let bodyWidth = finalGraphicW * 0.95
                     
                     if let img = processedImage {
                        Color.clear
                            .frame(width: bodyWidth, height: finalGraphicH)
                            .overlay(
                                GeometryReader { innerGeo in
                                    let containerRatio = bodyWidth / finalGraphicH
                                    let imageRatio = img.size.width / img.size.height
                                    
                                    // Smart Fit Height Logic:
                                    // If Mode is 1 (Fit Height):
                                    // - If Image is WIDER than Container (Ratio > Container) -> .fill (Crop Width, Fill Height)
                                    // - If Image is TALLER than Container (Ratio < Container) -> .fit (Match Height, Letterbox Width)
                                    // If Mode is 0 (Fill) -> Always .fill
                                    let mode: ContentMode = (appState.coverFitMode == 1) ? (imageRatio > containerRatio ? .fill : .fit) : .fill
                                    
                                    Image(uiImage: img)
                                        .resizable()
                                        .aspectRatio(contentMode: mode)
                                        .frame(width: bodyWidth, height: finalGraphicH)
                                        .clipped()
                                }
                                , alignment: .topTrailing // Align Top (Lid) + Right (Right edge of box)
                            )
                            .mask(
                                VStack(spacing: 0) {
                                    // Lid (Full Width)
                                    RoundedCorner(radius: 4, corners: [.topLeft, .topRight])
                                        .frame(width: finalGraphicW, height: lidHeight)
                                    // Body (Narrower)
                                    Rectangle()
                                        .frame(width: bodyWidth, height: finalGraphicH - lidHeight)
                                }
                            )
                     } else {
                         // Empty State (Box only)
                         VStack(spacing: 0) {
                             // Lid
                            RoundedCorner(radius: 4, corners: [.topLeft, .topRight])
                                .fill(boxLid) // Use Lid Color
                                .frame(width: finalGraphicW, height: lidHeight)
                             // Body
                            Rectangle()
                                .fill(Color.white) // Use Body Color
                                .frame(width: bodyWidth, height: finalGraphicH - lidHeight)
                         }
                     }
                    
                    // Stroke Overlay
                     VStack(spacing: 0) {
                         ZStack(alignment: .bottom) {
                             RoundedCorner(radius: 4, corners: [.topLeft, .topRight])
                                 .stroke(Color.black, lineWidth: 3)
                             Rectangle().fill(LinearGradient(colors: [.clear, .black.opacity(0.3)], startPoint: .top, endPoint: .bottom)).frame(height: 4)
                         }
                         .frame(width: finalGraphicW, height: lidHeight)
                         
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
                // .padding(.top, 6) // REMOVED: Strict bounding box.
                .frame(width: finalGraphicW, height: finalGraphicH)
                .position(metrics.position)
            }
            .contentShape(Rectangle()) // CRITICAL: Enforce strict limits
        }
    }
}
