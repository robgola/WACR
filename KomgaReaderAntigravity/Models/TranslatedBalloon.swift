import Foundation
import SwiftUI

enum ComicBalloonShape: String, Codable {
    case oval = "OVAL"
    case rectangle = "RECTANGLE"
    case cloud = "CLOUD"
    case jagged = "JAGGED"
    
    // Fallback for unknown values
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try? container.decode(String.self)
        self = ComicBalloonShape(rawValue: rawValue?.uppercased() ?? "") ?? .oval
    }
}

struct TranslatedBalloon: Codable, Identifiable {
    let id = UUID()
    let originalText: String
    let translatedText: String
    let should_translate: Bool
    let shape: ComicBalloonShape
    
    // Coordinates (Legacy 1000x1000 grid from v3/v5)
    // Used for persistence and fallback
    let box2D: [Int] // [ymin, xmin, ymax, xmax]
    let centerPoint: [Int]? // [y, x]
    
    // Helper used by Views
    var boundingBox: CGRect {
        // Return 0-1 normalized rect
        guard box2D.count >= 4 else { return .zero }
        let ymin = CGFloat(box2D[0]) / 1000.0
        let xmin = CGFloat(box2D[1]) / 1000.0
        let ymax = CGFloat(box2D[2]) / 1000.0
        let xmax = CGFloat(box2D[3]) / 1000.0
        return CGRect(x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin)
    }
    
    // v3.2+: The organic path detected by BubbleDetector/OpenCV
    // Not decodable from JSON (runtime visual property)
    var localPath: Path? = nil
    var backgroundColor: Color? = nil
    
    // Computed Center (Helper)
    var center: CGPoint {
        if let cp = centerPoint, cp.count == 2 {
             return CGPoint(x: CGFloat(cp[1]), y: CGFloat(cp[0]))
        }
        // Fallback to Box Center
        if box2D.count == 4 {
             let cY = CGFloat(box2D[0] + box2D[2]) / 2.0
             let cX = CGFloat(box2D[1] + box2D[3]) / 2.0
             return CGPoint(x: cX, y: cY)
        }
        return .zero
    }
    
    // v6.3 Aesthetics
    let backgroundColorHex: String? // e.g. "#FFFFFF" or "WHITE"
    let textColorHex: String? // e.g. "#000000"
    let isUppercase: Bool?
    let fontType: String? // "handwritten", "bold", "computer"
    
    // v6.2: Persistence for GrabCut Shapes
    // Normalized points [ [x, y], [x, y] ... ]
    var codablePoints: [[CGFloat]]? = nil
    
    // Conform to Codable but ignore runtime properties
    enum CodingKeys: String, CodingKey {
        case originalText = "original_text"
        case translatedText = "italian_translation"
        case should_translate
        case shape
        case box2D = "box_2d"
        case centerPoint = "center_point"
        case codablePoints = "contour_points"
        case backgroundColorHex = "background_color"
        case textColorHex = "text_color"
        case isUppercase = "is_uppercase"
        case fontType = "font_type"
    }
    
    // Manual Memberwise Initializer
    init(originalText: String, translatedText: String, should_translate: Bool, shape: ComicBalloonShape, box2D: [Int], centerPoint: [Int]?, codablePoints: [[CGFloat]]? = nil, backgroundColorHex: String? = nil, textColorHex: String? = nil, isUppercase: Bool? = true, fontType: String? = "handwritten") {
        self.originalText = originalText
        self.translatedText = translatedText
        self.should_translate = should_translate
        self.shape = shape
        self.box2D = box2D
        self.centerPoint = centerPoint
        self.codablePoints = codablePoints
        self.backgroundColorHex = backgroundColorHex
        self.textColorHex = textColorHex
        self.isUppercase = isUppercase
        self.fontType = fontType
        
        // Reconstruct Path immediately if points exist
        if let points = codablePoints {
             self.localPath = Path { p in
                 let cgPoints = points.map { CGPoint(x: $0[0], y: $0[1]) }
                 p.addLines(cgPoints)
                 p.closeSubpath()
             }
        }
    }
    
    // Robust Decoding
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.originalText = try container.decode(String.self, forKey: .originalText)
        self.translatedText = try container.decode(String.self, forKey: .translatedText)
        self.should_translate = try container.decodeIfPresent(Bool.self, forKey: .should_translate) ?? true
        self.shape = try container.decodeIfPresent(ComicBalloonShape.self, forKey: .shape) ?? .oval
        self.box2D = try container.decode([Int].self, forKey: .box2D)
        self.centerPoint = try container.decodeIfPresent([Int].self, forKey: .centerPoint)
        self.codablePoints = try container.decodeIfPresent([[CGFloat]].self, forKey: .codablePoints)
        self.backgroundColorHex = try container.decodeIfPresent(String.self, forKey: .backgroundColorHex)
        self.textColorHex = try container.decodeIfPresent(String.self, forKey: .textColorHex)
        self.isUppercase = try container.decodeIfPresent(Bool.self, forKey: .isUppercase) ?? true
        self.fontType = try container.decodeIfPresent(String.self, forKey: .fontType)
        
        // Reconstruct Path if points found
        if let points = self.codablePoints {
             self.localPath = Path { p in
                 let cgPoints = points.map { CGPoint(x: $0[0], y: $0[1]) }
                 p.addLines(cgPoints)
                 p.closeSubpath()
             }
        }
    }
}
