import Foundation

struct AppConstants {
    // API Configuration
    static let openAIBaseURL = "https://api.openai.com/v1/chat/completions"
    static let openAIModel = "gpt-3.5-turbo"
    
    // App Version (Reads from Info.plist)
    static var appVersion: String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }
    
    // UI Constants
    static let boxAspectRatio: CGFloat = 1.53 // Height / Width
}
