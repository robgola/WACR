
import SwiftUI

struct UnifiedFolderIcon: View {
    let node: LocalFolderNode
    
    @EnvironmentObject var appState: AppState

    var body: some View {
        // Dynamic Sizing Logic to preserve Graphic Size
        // Base Graphic Size: Width 140, Height 160 (approx)
        let baseGraphicW: CGFloat = 140
        // let baseGraphicH: CGFloat = 160 // Unused
        
        let dynamicW = baseGraphicW + (appState.boxMarginHorizontal * 2)
        
        VStack(spacing: 0) {
            // 1. The Graphic Object (Box)
            LocalFolderCard(node: node)
                .aspectRatio(0.7, contentMode: .fit) // Lock Aspect Ratio (0.7 is approx comic box W/H)
                .frame(minWidth: dynamicW, maxWidth: .infinity) // Grow container to fill Grid Item
            
            // 2. The Title (Below Box)
            MarqueeText(text: Series.formatSeriesName(node.name), font: .caption.bold())
                .foregroundColor(.white)
                .frame(width: dynamicW - 20) // Constrain width inside margins
                .clipped()
                .padding(.top, 22) // Base distance
                .offset(y: CGFloat(appState.textYOffset))
            
            // 3. Item Count
            Text("\(node.books.count + node.children.count) items")
                .font(.caption2)
                .foregroundColor(.gray)
                .padding(.top, 0) 
                .offset(y: CGFloat(appState.textYOffset))
        }
        .frame(minWidth: dynamicW, maxWidth: .infinity) // Match container w
    }
}
