import SwiftUI
import UIKit // Required for UIFont

struct MarqueeText: View {
    let text: String
    let font: Font
    
    var body: some View {
        GeometryReader { geometry in
            // Add 10% Safety Buffer for Bold/Kerning
            let textWidth = text.widthOfString(usingFont: .preferredFont(forTextStyle: .caption1)) * 1.10
            let isOverflowing = textWidth > geometry.size.width
            
            ZStack(alignment: isOverflowing ? .leading : .center) {
                Text(text)
                    .font(font)
                    .fixedSize()
                    .modifier(ScrollingTextModifier(containerWidth: geometry.size.width, isOverflowing: isOverflowing, textWidth: textWidth))
                    .frame(width: geometry.size.width, alignment: isOverflowing ? .leading : .center)
            }
        }
        .frame(height: 20)
    }
}

struct ScrollingTextModifier: ViewModifier {
    let containerWidth: CGFloat
    let isOverflowing: Bool
    let textWidth: CGFloat
    @State private var offset: CGFloat = 0
    
    func body(content: Content) -> some View {
        content
            .offset(x: offset)
            .onAppear {
                if isOverflowing {
                    // Set initial state OFF SCREEN RIGHT
                    offset = containerWidth
                    
                    // Animate to OFF SCREEN LEFT
                    // Distance = container + text size
                    let totalDistance = containerWidth + textWidth
                    let duration = Double(totalDistance) / 20.0 // Adjusted speed constants
                    
                    withAnimation(Animation.linear(duration: duration).repeatForever(autoreverses: false)) {
                        offset = -textWidth
                    }
                }
            }
    }
}



// MARK: - String Extension for Width
extension String {
    func widthOfString(usingFont font: UIFont) -> CGFloat {
        let fontAttributes = [NSAttributedString.Key.font: font]
        let size = self.size(withAttributes: fontAttributes)
        return size.width
    }
}
