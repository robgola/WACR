import UIKit
import Foundation

class ImageCacheService {
    static let shared = ImageCacheService()
    
    public let cacheDirectory: URL
    public let splashDirectory: URL
    private let fileManager = FileManager.default
    
    // In-memory cache for ultra-fast access (optional, limit size)
    private let memoryCache = NSCache<NSString, UIImage>()
    
    private init() {
        // Use Caches directory
        let urls = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)
        cacheDirectory = urls[0].appendingPathComponent("ImageCache")
        splashDirectory = urls[0].appendingPathComponent("SplashCache")
        
        // Ensure directory exists
        if !fileManager.fileExists(atPath: cacheDirectory.path) {
            try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true, attributes: nil)
        }
        if !fileManager.fileExists(atPath: splashDirectory.path) {
            try? fileManager.createDirectory(at: splashDirectory, withIntermediateDirectories: true, attributes: nil)
        }
        
        // Configure memory cache
        memoryCache.countLimit = 100 // Cache up to 100 images in memory
    }
    
    /// Generates a valid filename from a key (URL or ID)
    nonisolated private func filename(for key: String) -> String {
        // Simple hash or encoding to avoid invalid characters
        // We can just base64 encode the key to be safe
        guard let data = key.data(using: .utf8) else { return key }
        let base64 = data.base64EncodedString()
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-")
        return base64 + ".jpg"
    }
    
    func getImage(forKey key: String) -> UIImage? {
        // 1. Check Memory
        if let cachedImage = memoryCache.object(forKey: key as NSString) {
            return cachedImage
        }
        
        // 2. Check Disk
        let fileURL = cacheDirectory.appendingPathComponent(filename(for: key))
        if let data = try? Data(contentsOf: fileURL), let image = UIImage(data: data) {
            // Populate memory cache
            memoryCache.setObject(image, forKey: key as NSString)
            return image
        }
        
        return nil
    }
    
    func saveImage(_ image: UIImage, forKey key: String) {
        // 1. Save to Memory
        memoryCache.setObject(image, forKey: key as NSString)
        
        // 2. Save to Disk (Background)
        Task.detached(priority: .background) {
            let fileURL = self.cacheDirectory.appendingPathComponent(self.filename(for: key))
            if let data = image.jpegData(compressionQuality: 0.8) {
                try? data.write(to: fileURL)
            }
        }
    }
    
    func clearCache() {
        memoryCache.removeAllObjects()
        try? fileManager.removeItem(at: cacheDirectory)
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true, attributes: nil)
    }
    
    func getRandomCachedImageURL() -> URL? {
        guard let files = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) else { return nil }
        // Filter for images roughly
        let images = files.filter { $0.pathExtension == "jpg" }
        return images.randomElement()
    }
    
    // MARK: - Splash Helpers
    
    func getSplashCoverURL(slot: Int) -> URL {
        return splashDirectory.appendingPathComponent("Cover\(slot).jpg")
    }
    
    func hasSplashCover(slot: Int) -> Bool {
        return fileManager.fileExists(atPath: getSplashCoverURL(slot: slot).path)
    }
    
    func getRandomSplashCover() -> UIImage? {
        let validSlots = (1...5).filter { hasSplashCover(slot: $0) }
        guard let slot = validSlots.randomElement() else { return nil }
        // Load data to avoid caching issues with UIImage(contentsOfFile) if file changes
        guard let data = try? Data(contentsOf: getSplashCoverURL(slot: slot)) else { return nil }
        return UIImage(data: data)
    }
}
