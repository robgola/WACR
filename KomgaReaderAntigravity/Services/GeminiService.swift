import Foundation
import Combine
import SwiftUI
import UIKit

enum GeminiError: Error {
    case invalidResponse
    case uploadFailed
}

class GeminiService: ObservableObject {
    static let shared = GeminiService()
    
    @Published var isApiKeyValid: Bool = false
    @Published var validationStatus: String = "Checking..."
    @Published var lastRawResponse: String = "" // Debug: Store raw JSON
    @Published var lastMarkedImage: UIImage? = nil // Debug: Store marked image
    
    // v6.1 Full Page System Prompt
    private let fullPageSystemPrompt = """
    You are a professional comic book translator (English to Italian).
    
    Task:
    1. Detect all speech bubbles in the image.
    2. OCR the original text exactly.
    3. Translate the text to Italian.
    4. Provide the bounding box for each bubble [ymin, xmin, ymax, xmax] (0-1000 scale).
    5. Determine if it's translatable (ignore pure noise/sounds).

    Output JSON Format:
    {
      "balloons": [
        {
          "original_text": "...",
          "italian_translation": "...",
           "box_2d": [ymin, xmin, ymax, xmax],
           "should_translate": true,
           "shape": "OVAL",
           "background_color": "#HEX" (EXACT dominant color. Do NOT say 'WHITE'. Use #F8F8FF, #FFFFF0 etc.),
           "text_color": "#HEX",
           "is_uppercase": true/false (Is original text all caps?),
           "font_type": "handwritten" or "bold" or "computer"
        }
      ]
    }
    """
    
    // Memory Cache: [PersistenceID_PageIndex : Balloons]
    private var translationCache: [String: [TranslatedBalloon]] = [:]
    
    // Helper: Resize Image
    private func resizeImage(_ image: UIImage, targetSize: CGSize = CGSize(width: 1560, height: 1560)) -> Data? {
        // Resize logic (Aspect Fit)
        let size = image.size
        let widthRatio  = targetSize.width  / size.width
        let heightRatio = targetSize.height / size.height
        
        // Determine what scale to use (min scale prevents stretching)
        let scaleFactor = min(widthRatio, heightRatio)
        
        // If already smaller, use original (but compress)
        let newSize: CGSize
        if scaleFactor >= 1.0 {
            newSize = size
        } else {
             newSize = CGSize(width: size.width * scaleFactor, height: size.height * scaleFactor)
        }
        
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resizedImage = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
        
        // Restore High Quality for Gemini Precision (Text positioning needs details)
        return resizedImage.jpegData(compressionQuality: 0.85)
    }

    private var apiKey: String {
        return UserDefaults.standard.string(forKey: "geminiApiKey") ?? ""
    }
    // Using gemini-2.5-flash (User requested and verified via screenshot)
    private let baseURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    public let currentModelName = "gemini-2.5-flash" // v5.28.0: Exposed for UI
    
    // ... rest of init ...


    
    private init() {
         checkDailyReset()
         Task {
            await verifyApiKey()
         }
    }
    
    func verifyApiKey() async {
        // Validation: Ensure valid length (Gemini keys are usually ~39 chars)
        guard !apiKey.isEmpty && apiKey.count > 20 else {
            await MainActor.run {
                self.isApiKeyValid = false
                self.validationStatus = "Missing API Key"
            }
            return
        }
        
        // 1. Try to generate content
        let urlString = "\(baseURL)?key=\(apiKey)"
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "contents": [
                ["parts": [["text": "Hello"]]]
            ]
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await URLSession.shared.data(for: request)
            
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                await MainActor.run {
                    self.isApiKeyValid = true
                    self.validationStatus = "Valid"
                }
            } else {
                let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
                print("Gemini Verification Error: \(errorMsg)")
                
                // 2. If 404, try to list models to see what's available
                if (response as? HTTPURLResponse)?.statusCode == 404 {
                    await listAvailableModels()
                }
                
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                
                // Special handling for 429 (Rate Limit): Key is valid, just busy.
                if code == 429 {
                    await MainActor.run {
                        self.isApiKeyValid = true
                        self.validationStatus = "Rate Limited (Wait)"
                    }
                } else {
                    await MainActor.run {
                        self.isApiKeyValid = false
                        self.validationStatus = "Error: \(code)"
                    }
                }
            }
        } catch {
            await MainActor.run {
                self.isApiKeyValid = false
                self.validationStatus = "Connection: \(error.localizedDescription)"
            }
        }
    }
    
    // v5.27.0: Public API to list models
    func fetchAvailableModels() async throws -> [String] {
        let listURLString = "https://generativelanguage.googleapis.com/v1beta/models?key=\(apiKey)"
        guard let url = URL(string: listURLString) else { return [] }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw NSError(domain: "GeminiService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Failed to fetch models"])
        }
        
        struct ModelList: Decodable {
            struct Model: Decodable {
                let name: String
                let displayName: String?
                let description: String?
            }
            let models: [Model]?
        }
        
        let decoded = try JSONDecoder().decode(ModelList.self, from: data)
        // Return display names or raw names (filtered for Gemini)
        return decoded.models?.compactMap { $0.displayName ?? $0.name } ?? []
    }
    
    private func listAvailableModels() async {
        // Legacy internal debug method - consolidated above but kept if needed for internal debug, 
        // but let's just piggyback or remove. I'll keep it simple and just replace it with the new func wrapper if needed 
        // or just ignore it since we are replacing the function definition entirely in this block.
    }
    
    struct GeminiResponse: Codable {
        let candidates: [Candidate]?
        
        struct Candidate: Codable {
            let content: Content
        }
        
        struct Content: Codable {
            let parts: [Part]
        }
        
        struct Part: Codable {
            let text: String
        }
    }
    
    struct TranslationResult: Codable {
        let translatedText: String
        let fontStyle: String // "bold", "italic", "handwritten", "computer", "shout"
    }
    
    func translate(text: String, context: String = "", to targetLanguage: String = "Italian") async throws -> TranslationResult {
        // Removed strict guard to allow lazy validation
        // guard isApiKeyValid else { ... }
        
        let urlString = "\(baseURL)?key=\(apiKey)"
        guard let url = URL(string: urlString) else {
            await MainActor.run {
                self.isApiKeyValid = false
                self.validationStatus = "Invalid URL"
            }
            throw NSError(domain: "GeminiService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let systemPrompt = """
        You are an expert comic book translator specializing in localization from American English to Italian.
        Your goal is to translate the text FAITHFULLY and analyze the font style.
        
        Input: English text from a comic bubble.
        Output: JSON object with:
        - "translatedText": The Italian translation.
        - "fontStyle": One of ["bold", "italic", "handwritten", "computer", "shout", "normal"].
        
        Rules:
        1. Translate FAITHFULLY into Italian. No paraphrasing.
        2. Keep sound effects as is.
        3. Do NOT translate proper names.
        4. "fontStyle" analysis:
           - "shout": All caps with exclamation marks, aggressive.
           - "computer": Monospaced, square, robotic.
           - "bold": Heavy emphasis.
           - "handwritten": Standard comic speech.
           - "italic": Whispers or thoughts or emphasis.
        5. Output ONLY valid JSON. No markdown fencing.
        """
        
        let userPrompt = """
        Context so far:
        \(context)
        
        Text:
        "\(text)"
        """
        
        let fullPrompt = "\(systemPrompt)\n\n\(userPrompt)"
        
        let body: [String: Any] = [
            "contents": [
                ["parts": [["text": fullPrompt]]]
            ],
            "generationConfig": [
                "temperature": 0.4
                // Note: responseMimeType is not supported in v1 API
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            let code = (response as? HTTPURLResponse)?.statusCode ?? 500
            
            await MainActor.run {
                if code == 401 || code == 403 {
                    self.isApiKeyValid = false
                    self.validationStatus = "Auth Failed: \(code)"
                } else if code == 429 {
                    self.isApiKeyValid = true // Key is valid, just limited
                    self.validationStatus = "Rate Limited (Wait)"
                }
            }
            
            throw NSError(domain: "GeminiService", code: code, userInfo: [NSLocalizedDescriptionKey: errorMsg])
        }
        
        await MainActor.run {
            self.isApiKeyValid = true
            self.validationStatus = "Valid (Active)"
        }
        
        let completion = try JSONDecoder().decode(GeminiResponse.self, from: data)
        let jsonString = completion.candidates?.first?.content.parts.first?.text.trimmingCharacters(in: .whitespacesAndNewlines) ?? "{}"
        
        // Clean markdown fencing if present (Gemini sometimes adds it despite MimeType)
        let cleanJson = jsonString.replacingOccurrences(of: "```json", with: "").replacingOccurrences(of: "```", with: "")
        
        if let jsonData = cleanJson.data(using: .utf8) {
            return try JSONDecoder().decode(TranslationResult.self, from: jsonData)
        }
        
        return TranslationResult(translatedText: text, fontStyle: "normal")
    }
    // MARK: - AI Story Recap
    
    // MARK: - RPD (Requests Per Day) System
    
    @Published var dailyRequests: Int = 0
    @Published var peakDailyRequests: Int = 0
    
    private let kDailyRequests = "dailyRequests"
    private let kPeakDailyRequests = "peakDailyRequests"
    private let kLastRequestDate = "lastRequestDate"
    
    private func checkDailyReset() {
        let lastDate = UserDefaults.standard.object(forKey: kLastRequestDate) as? Date ?? Date.distantPast
        
        if !Calendar.current.isDateInToday(lastDate) {
            // New Day! Reset counter
            DispatchQueue.main.async {
                self.dailyRequests = 0
                UserDefaults.standard.set(0, forKey: self.kDailyRequests)
                // Peak is persistent, do not reset
                
                // Update Date
                UserDefaults.standard.set(Date(), forKey: self.kLastRequestDate)
            }
        } else {
            // Same Day, load from persistence if 0 (app restart)
            if self.dailyRequests == 0 {
                self.dailyRequests = UserDefaults.standard.integer(forKey: kDailyRequests)
            }
        }
        
        // Load Peak
        if self.peakDailyRequests == 0 {
            self.peakDailyRequests = UserDefaults.standard.integer(forKey: kPeakDailyRequests)
        }
    }
    
    private func incrementRequestCount() {
        checkDailyReset() // Ensure we are on the right day
        
        DispatchQueue.main.async {
            self.dailyRequests += 1
            UserDefaults.standard.set(self.dailyRequests, forKey: self.kDailyRequests)
            UserDefaults.standard.set(Date(), forKey: self.kLastRequestDate) // Mark activity
            
            // Check Peak
            if self.dailyRequests > self.peakDailyRequests {
                self.peakDailyRequests = self.dailyRequests
                UserDefaults.standard.set(self.peakDailyRequests, forKey: self.kPeakDailyRequests)
            }
        }
    }

    struct StoryRecapResult: Codable {
        let recap: String
    }
    
    // Legacy callCount kept for compatibility but RPD is the new standard
    @Published var callCount: Int = 0 
    
    func generateStoryRecap(series: String, number: String, volume: String, publisher: String) async throws -> String {
        incrementRequestCount()
        await MainActor.run { self.callCount += 1 }
        
        let urlString = "\(baseURL)?key=\(apiKey)"
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "GeminiService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Exact Prompt Request from User
        let userPrompt = "Sto iniziano a leggere \(series) #\(number) Vol.\(volume) Casa Editrice \(publisher) , cosa devo sapere per iniziare nel miglior modo"
        print("🤖 GEMINI REQUEST: \(userPrompt)")
        
        let body: [String: Any] = [
            "contents": [
                ["parts": [["text": userPrompt]]]
            ],
            // "generationConfig": ["temperature": 0.7] // Optional: Add strict config if needed
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
             throw NSError(domain: "GeminiService", code: 0, userInfo: [NSLocalizedDescriptionKey: "No Response"])
        }
        
        print("🤖 GEMINI STATUS: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown Error"
            print("🤖 GEMINI ERROR: \(errorMsg)")
            throw NSError(domain: "GeminiService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMsg])
        }
        
        let completion = try JSONDecoder().decode(GeminiResponse.self, from: data)
        let text = completion.candidates?.first?.content.parts.first?.text ?? "Non sono riuscito a generare un riassunto."
        
        // Update Valid Status
        await MainActor.run {
            self.isApiKeyValid = true
            self.validationStatus = "Valid (Active)"
        }
        
        return text
    }

    
    
    // MARK: - Vision OCR (Gemini 1.5/2.5 Flash)
    
    
    struct BoundingBox: Codable {
        let ymin: Int
        let xmin: Int
        let ymax: Int
        let xmax: Int
        
        // Helper to convert to CGRect for a given image size
        func toCGRect(imageSize: CGSize) -> CGRect {
            let x = CGFloat(xmin) / 1000.0 * imageSize.width
            let y = CGFloat(ymin) / 1000.0 * imageSize.height
            let w = (CGFloat(xmax) - CGFloat(xmin)) / 1000.0 * imageSize.width
            let h = (CGFloat(ymax) - CGFloat(ymin)) / 1000.0 * imageSize.height
            return CGRect(x: x, y: y, width: w, height: h)
        }
    }
    
    struct GeminiVisionResponse: Codable {
        let balloons: [TranslatedBalloon]
    }
    
    // MARK: - Helper: Request with Retry
    
    private func performRequestWithRetry(request: URLRequest, maxRetries: Int = 3) async throws -> Data {
        incrementRequestCount() // Track RPD
        for attempt in 1...maxRetries {
            do {
                // Extended Configuration for Large Images
                let config = URLSessionConfiguration.default
                config.timeoutIntervalForRequest = 120 // 2 minutes
                config.timeoutIntervalForResource = 300
                let session = URLSession(configuration: config)
                
                let (data, response) = try await session.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw NSError(domain: "GeminiService", code: 0, userInfo: [NSLocalizedDescriptionKey: "No Response"])
                }
                
                if httpResponse.statusCode == 200 {
                    return data
                } else if httpResponse.statusCode == 503 || httpResponse.statusCode == 504 || httpResponse.statusCode == 500 {
                    // Service Unavailable (Overloaded) -> Retry
                    let delay = Double(attempt) * 2.0 // 2s, 4s, 6s...
                    print("🤖 GEMINI OVERLOAD (\(httpResponse.statusCode)). Retrying in \(delay)s (Attempt \(attempt)/\(maxRetries))")
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    continue
                } else {
                    // Other errors (400, 401, 429, etc) -> Fail immediately
                    let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown Error"
                    print("🤖 GEMINI ERROR: \(errorMsg)")
                    throw NSError(domain: "GeminiService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMsg])
                }
                
            } catch {
                // Network errors -> Retry only if it's the last attempt, otherwise throw
                if attempt == maxRetries { throw error }
                print("🤖 GEMINI NETWORK ERROR. Retrying...")
                try await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
        throw NSError(domain: "GeminiService", code: 503, userInfo: [NSLocalizedDescriptionKey: "Service Unavailable after retries"])
    }

    // MARK: - v6.0 Single Balloon Translation
    
    struct TranslateResult: Decodable {
        let original_text: String
        let italian_translation: String
        let should_translate: Bool
    }
    
    /// Analyzes a single cropped balloon image and returns the translation.
    func translateBalloonCrop(image: UIImage) async throws -> TranslateResult {
        // Validation (Skip call count for micro-calls? Or aggregate? Let's count them for quota awareness)
        // await MainActor.run { self.callCount += 1 } 
        
        let urlString = "\(baseURL)?key=\(apiKey)"
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "GeminiService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        
        // 1. Process Crop (Small image, minimal compression needed)
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
             throw NSError(domain: "GeminiService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Image Processing Failed"])
        }
        let base64Image = imageData.base64EncodedString()
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 2. Focused Prompt (Context-Free)
        let systemPrompt = """
        You are a professional comic book translator.
        
        Task:
        1. Read the text in this image.
        2. Decide if it requires translation (Rules: NO Sound Effects, NO Proper Names, NO pure noise).
        3. Translate it to natural Italian.
        
        Output JSON:
        {
          "original_text": "...",
          "italian_translation": "...",
          "should_translate": true/false
        }
        """
        
        let body: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": systemPrompt],
                        [
                            "inline_data": [
                                "mime_type": "image/jpeg",
                                "data": base64Image
                            ]
                        ]
                    ]
                ]
            ],
            "generationConfig": [
                "temperature": 0.1, // Slight creativity for translation, but stable format
                "responseMimeType": "application/json"
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        // Perform Request
        let data = try await performRequestWithRetry(request: request)
        
        // Decode
        let completion = try JSONDecoder().decode(GeminiResponse.self, from: data)
        let jsonString = completion.candidates?.first?.content.parts.first?.text ?? "{}"
        
        guard let jsonData = jsonString.data(using: .utf8) else {
            throw NSError(domain: "GeminiService", code: 500, userInfo: [NSLocalizedDescriptionKey: "Empty JSON"])
        }
        
        return try JSONDecoder().decode(TranslateResult.self, from: jsonData)
    }

    // Legacy v5.0 method (kept for reference, can be removed later)
    func analyzeComicPage(image: UIImage) async throws -> [TranslatedBalloon] {
        await MainActor.run { self.callCount += 1 }
        
        let urlString = "\(baseURL)?key=\(apiKey)"
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "GeminiService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        
        // 1. Resize and Compress Image (Standard)
        let maxSize: CGFloat = 1024
        let scale = min(maxSize / image.size.width, maxSize / image.size.height, 1.0)
        let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        
        let resizedImage = UIGraphicsImageRenderer(size: newSize).image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
        
        guard let imageData = resizedImage.jpegData(compressionQuality: 0.7) else {
            throw NSError(domain: "GeminiService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Image Processing Failed"])
        }
        
        let base64Image = imageData.base64EncodedString()
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 2. Standard "Grid" Prompt (v3.x / v5.0)
        let systemPrompt = """
        Analyze this comic book page with extreme precision.
        Visualize a strict 1000x1000 coordinate grid overlaid on the image (0,0 is top-left, 1000,1000 is bottom-right).
        All spatial measurements must be exact coordinates on this grid.
        
        Detect all speech balloons, captions, and text effects. 
        For each detected item:
        1. Extract the original text.
        2. Determine if it should be translated. Set "should_translate" to FALSE if:
           - It is a Sound Effect (e.g., "THWAP", "BANG", "WHOOSH").
           - It creates the "Ransom Note" effect (single isolated non-words).
           - It is a Proper Name (e.g., "Donavin", "Abbey Chase").
           - It is a Location Name (e.g., "Costa Rica", "New York").
           - It is unintelligible noise.
        3. If "should_translate" is TRUE, provide a natural Italian translation.
        4. Identify the shape (OVAL, RECTANGLE, CLOUD, JAGGED).
        5. Provide the bounding box [ymin, xmin, ymax, xmax] using the 1000x1000 grid.
        6. Provide the precise center point [y, x] of the balloon content using the 1000x1000 grid.

        Output strictly valid JSON obeying this schema:
        {
          "balloons": [
            {
              "original_text": "...",
              "italian_translation": "...",
              "should_translate": true,
              "shape": "OVAL",
              "box_2d": [ymin, xmin, ymax, xmax],
              "center_point": [y, x]
            }
          ]
        }
        """
        
        let body: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": systemPrompt],
                        [
                            "inline_data": [
                                "mime_type": "image/jpeg",
                                "data": base64Image
                            ]
                        ]
                    ]
                ]
            ],
            "generationConfig": [
                "temperature": 0.0,
                "responseMimeType": "application/json"
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("🤖 GEMINI VISION: Sending Clean Image (v5.0 GrabCut Strategy)...")
        
        let data = try await performRequestWithRetry(request: request)
        
        // Update Valid Status
        await MainActor.run {
            self.isApiKeyValid = true
            self.validationStatus = "Valid (Active)"
        }
        
        let completion = try JSONDecoder().decode(GeminiResponse.self, from: data)
        let jsonString = completion.candidates?.first?.content.parts.first?.text ?? "{}"
        
        await MainActor.run {
            self.lastRawResponse = jsonString // Save for Debug View
            self.lastMarkedImage = nil // Reset marker image as we are sending clean one
        }
        
        if let jsonData = jsonString.data(using: .utf8) {
            let result = try JSONDecoder().decode(GeminiVisionResponse.self, from: jsonData)
            var finalBalloons: [TranslatedBalloon] = []
            
            // v5.0: Post-Process with GrabCut
            // For each valid balloon, use the Gemini Box to seed GrabCut
            
            print("👁️ OpenCV: Starting GrabCut refinement for \(result.balloons.count) items...")
            let processingStart = Date()
            
            for var balloon in result.balloons {
                guard balloon.should_translate else { continue }
                
                // Get Gemini Box (Normalized 0-1)
                // box2D is [ymin, xmin, ymax, xmax] in 1000 grid
                let b = balloon.box2D
                let rect = CGRect(
                    x: CGFloat(b[1]) / 1000.0,
                    y: CGFloat(b[0]) / 1000.0,
                    width: CGFloat(b[3] - b[1]) / 1000.0,
                    height: CGFloat(b[2] - b[0]) / 1000.0
                )
                
                // Call OpenCV GrabCut
                // We pass the ORIGINAl full-res image for best detail? 
                // Or the resized one? 
                // The `image` param passed to this func is likely the full one loaded from disk.
                // GrabCut is slow on huge images.
                // Let's use the `resizedImage` (max 1024) for speed?
                // The Rect is normalized, so it works on any size.
                // But we need the output path to be smooth.
                // Let's use `resizedImage` (already generated above).
                
                let contourPoints = OpenCVWrapper.refinedBalloonContour(resizedImage, textRect: rect)
                
                if !contourPoints.isEmpty {
                    // Implicitly unwrapped or safe because it's non-optional
                    let points = contourPoints
                    let cgPoints = points.map { $0.cgPointValue }
                    balloon.localPath = Path { p in
                        p.addLines(cgPoints)
                        p.closeSubpath()
                    }
                    print("   - GrabCut success for balloon: \(balloon.originalText.prefix(10))...")
                } else {
                    print("   - GrabCut failed (empty) for balloon: \(balloon.originalText.prefix(10))...")
                }
                
                // Default background
                balloon.backgroundColor = .white
                
                finalBalloons.append(balloon)
            }
            
            print("👁️ OpenCV: GrabCut finished in \(Date().timeIntervalSince(processingStart))s")
            
            return finalBalloons
        }
        
        return []
    }
    
    // MARK: - Single Crop Translation (v6.0)
    
    struct SingleTranslationResult: Codable {
        let original_text: String
        let italian_translation: String
        let should_translate: Bool
    }
    
    func translateBalloonCrop(image: UIImage) async throws -> SingleTranslationResult {
        // 1. Prepare Image (Max 1024px is plenty for a crop)
        guard let imageData = resizeImage(image, targetSize: CGSize(width: 1024, height: 1024)) else {
            throw GeminiError.uploadFailed
        }
        let base64Image = imageData.base64EncodedString()
        
        let prompt = """
        You are a generic comic translator.
        Analyze this image of a single speech bubble.
        1. OCR the text inside exactly.
        2. Translate it to Italian.
        3. Determine if it contains translatable text (ignore sound effects like 'BAM' or 'POW' unless they have meaning, ignore distinct symbols).
        
        Return pure JSON:
        {
            "original_text": "...",
            "italian_translation": "...",
            "should_translate": true
        }
        """
        
        let requestBody: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": prompt],
                        [
                            "inline_data": [
                                "mime_type": "image/jpeg",
                                "data": base64Image
                            ]
                        ]
                    ]
                ]
            ],
            "generationConfig": [
                "temperature": 0.0, // Strict formatting
                "responseMimeType": "application/json"
            ]
        ]
        
        // Use existing performRequest logic if possible, or replicate
        guard let url = URL(string: "\(baseURL)?key=\(apiKey)") else { throw GeminiError.invalidResponse }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let data = try await performRequestWithRetry(request: request)
        let completion = try JSONDecoder().decode(GeminiResponse.self, from: data)
        let jsonString = completion.candidates?.first?.content.parts.first?.text ?? "{}"
        
        if let jsonData = jsonString.data(using: .utf8) {
            return try JSONDecoder().decode(SingleTranslationResult.self, from: jsonData)
        }
        
        throw GeminiError.invalidResponse
    }
    
    // MARK: - Full Page Semantic Analysis (v6.1 Hybrid)
    
    /// Fetches raw semantic data (Text + Approx Locations) from Gemini for the full page.
    /// Does NOT run GrabCut or persistence. Pure API call.
    func fetchSemanticData(image: UIImage) async throws -> GeminiVisionResponse {
        // 1. Resize/Compress
        guard let imageData = resizeImage(image, targetSize: CGSize(width: 1560, height: 1560)) else {
            throw GeminiError.uploadFailed
        }
        
        let base64Image = imageData.base64EncodedString()
        
        // 2. Prepare Request (Reuse V5 Prompt or Optimized one)
        // We use the existing system prompt which asks for `box_2d` and `original_text`.
        // The prompt is "hardcoded" inside the logic, let's copy the V5 request construction or factor it out.
        // For simplicity, I'll replicate the construction here but focused on pure data return.
        
        let requestBody: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": fullPageSystemPrompt],
                        [
                            "inline_data": [
                                "mime_type": "image/jpeg",
                                "data": base64Image
                            ]
                        ]
                    ]
                ]
            ],
            "generationConfig": [
                "temperature": 0.0,
                "responseMimeType": "application/json"
            ]
        ]
        
        guard let url = URL(string: "\(baseURL)?key=\(apiKey)") else { throw GeminiError.invalidResponse }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        print("🤖 GEMINI VISION: Sending Full Page (v6.1 Hybrid Strategy)...")
        let data = try await performRequestWithRetry(request: request)
        
        let completion = try JSONDecoder().decode(GeminiResponse.self, from: data)
        let jsonString = completion.candidates?.first?.content.parts.first?.text ?? "{}"
        
        await MainActor.run {
            self.lastRawResponse = jsonString
        }
        
        if let jsonData = jsonString.data(using: .utf8) {
            let result = try JSONDecoder().decode(GeminiVisionResponse.self, from: jsonData)
            
            // DEBUG: Inspect Aesthetics
            if let first = result.balloons.first {
                print("🎨 AESTHETICS DEBUG:")
                print("   - BG: \(first.backgroundColorHex ?? "nil")")
                print("   - Text: \(first.textColorHex ?? "nil")")
                print("   - Uppercase: \(first.isUppercase ?? true)")
                print("   - Font: \(first.fontType ?? "nil")")
            }
            
            return result
        }
        
        throw GeminiError.invalidResponse
    }
    // MARK: - Persistence (v6.4 Sidecar)
    
    private var legacyTranslationsDirectory: URL {
        let urls = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let appSupport = urls[0]
        let translationsDir = appSupport.appendingPathComponent("Translations")
        if !FileManager.default.fileExists(atPath: translationsDir.path) {
            try? FileManager.default.createDirectory(at: translationsDir, withIntermediateDirectories: true)
        }
        return translationsDir
    }
    
    // Check if translation exists (for UI feedback)
    func isTranslationAvailable(forBook bookId: String, bookURL: URL? = nil, pageIndex: Int) -> Bool {
        // 1. Check Sidecar
        if let bookURL = bookURL {
            let directory = getDirectory(for: bookURL, bookId: bookId)
            let filename = "p\(pageIndex).json"
            let url = directory.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: url.path) { return true }
        }
        
        // 2. Check Legacy
        let filename = "\(bookId)_p\(pageIndex).json"
        let url = legacyTranslationsDirectory.appendingPathComponent(filename)
        return FileManager.default.fileExists(atPath: url.path)
    }
    
    /// Helper to determine the correct directory for a book
    private func getDirectory(for bookURL: URL?, bookId: String) -> URL {
        // Mode 1: Sidecar (If URL is provided and valid)
        if let bookURL = bookURL {
            // e.g. /Documents/Comics/Spiderman.cbz
            // Target: /Documents/Comics/Spiderman/
            let parentDir = bookURL.deletingLastPathComponent()
            let bookName = bookURL.deletingPathExtension().lastPathComponent
            // User Request: Directory name exact match with file (no suffix)
            let sidecarDir = parentDir.appendingPathComponent(bookName)
            
            // Create if needed
            if !FileManager.default.fileExists(atPath: sidecarDir.path) {
                try? FileManager.default.createDirectory(at: sidecarDir, withIntermediateDirectories: true)
            }
            return sidecarDir
        }
        
        // Mode 2: Legacy (App Support)
        return legacyTranslationsDirectory
    }
    
    // Delete ALL translations for a specific book (Trash Can feature)
    func deleteTranslations(forBook bookId: String, bookURL: URL? = nil) {
        // 1. Delete Sidecar Directory
        if let bookURL = bookURL {
            let directory = getDirectory(for: bookURL, bookId: bookId)
            // Safety check: Ensure we are deleting a directory that looks like a comic sidecar
            if directory.path.contains("Translations") || directory.lastPathComponent == bookURL.deletingPathExtension().lastPathComponent {
                do {
                    if FileManager.default.fileExists(atPath: directory.path) {
                        try FileManager.default.removeItem(at: directory)
                        print("🗑️ Deleted Sidecar Translations: \(directory.path)")
                    }
                } catch {
                    print("❌ Failed to delete sidecar directory: \(error)")
                }
            }
        }
        
        // 2. Delete Legacy Files (Prefix match)
        // This is less efficient but necessary for legacy support.
        do {
            let files = try FileManager.default.contentsOfDirectory(at: legacyTranslationsDirectory, includingPropertiesForKeys: nil)
            for file in files {
                if file.lastPathComponent.starts(with: bookId) {
                    try FileManager.default.removeItem(at: file)
                    print("🗑️ Deleted Legacy Translation File: \(file.lastPathComponent)")
                }
            }
        } catch {
            print("❌ Failed to clean legacy files: \(error)")
        }
        
        // Clear Memory Cache
        translationCache.removeAll()
    }
    
    func saveTranslations(_ balloons: [TranslatedBalloon], forBook bookId: String, bookURL: URL? = nil, pageIndex: Int) {
        // 1. Try Sidecar First (Preferred)
        if let bookURL = bookURL {
            let directory = getDirectory(for: bookURL, bookId: bookId)
            let filename = "p\(pageIndex).json"
            let url = directory.appendingPathComponent(filename)
            
            do {
                let data = try JSONEncoder().encode(balloons)
                try data.write(to: url)
                print("💾 Saved translations to Sidecar: \(url.path)")
                return // Success
            } catch {
                print("⚠️ Sidecar Save Failed (Permissions?): \(error). Falling back to AppSupport.")
                // Fallthrough to Legacy
            }
        }
        
        // Populate Memory Cache
        let cacheKey = "\(bookId)_\(pageIndex)"
        translationCache[cacheKey] = balloons
        
        // 2. Fallback to Legacy (App Support)
        let filename = "\(bookId)_p\(pageIndex).json"
        let url = legacyTranslationsDirectory.appendingPathComponent(filename)
        
        do {
            let data = try JSONEncoder().encode(balloons)
            try data.write(to: url)
            print("💾 Saved translations to AppSupport: \(url.path)")
        } catch {
            print("❌ Critical: Failed to save translations: \(error)")
        }
    }
    
    func loadTranslations(forBook bookId: String, bookURL: URL? = nil, pageIndex: Int) -> [TranslatedBalloon]? {
        // 0. Check Memory Cache
        let cacheKey = "\(bookId)_\(pageIndex)"
        if let cached = translationCache[cacheKey] {
            return cached
        }
        
        // 1. Check Disk
        let directory = getDirectory(for: bookURL, bookId: bookId)
        let filename = "p\(pageIndex).json"
        let url = directory.appendingPathComponent(filename)
        
        // Legacy Fallback check (if sidecar empty, check legacy)
        // Only if bookURL was provided (so we looked in sidecar) but failed
        if !FileManager.default.fileExists(atPath: url.path) {
            if bookURL != nil {
                // Try legacy path
                let legacyFilename = "\(bookId)_p\(pageIndex).json"
                let legacyUrl = legacyTranslationsDirectory.appendingPathComponent(legacyFilename)
                if FileManager.default.fileExists(atPath: legacyUrl.path) {
                    print("📦 Found Legacy Cache for p\(pageIndex), migrating...")
                    // Optional: Migrate to new format? For now just load.
                    return try? JSONDecoder().decode([TranslatedBalloon].self, from: Data(contentsOf: legacyUrl))
                }
            }
            return nil
        }
        
        do {
            let data = try Data(contentsOf: url)
            let balloons = try JSONDecoder().decode([TranslatedBalloon].self, from: data)
            print("📂 Loaded translations from \(url.path)")
            // Populate Cache
            translationCache[cacheKey] = balloons
            return balloons
        } catch {
            print("⚠️ Failed to JSON decode sidecar translations: \(error)")
            // If decode fails, maybe try legacy? Or just return nil.
            return nil
        }
    }
}
