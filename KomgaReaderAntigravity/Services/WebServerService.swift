import Foundation
import Network
import Combine

class WebServerService: ObservableObject {
    static let shared = WebServerService()
    
    // Server State
    @Published var isRunning: Bool = false
    @Published var serverURL: String = ""
    @Published var activeConnections: Int = 0
    @Published var lastError: String? = nil
    
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.antigravity.webserver")
    
    // Configuration (Injected from Settings/AppState)
    var port: UInt16 = 8080
    var username: String = "admin"
    var password: String = "komga"
    
    // Session Token (Regenerated on server start)
    private var currentSessionToken: String = UUID().uuidString
    
    // MARK: - Lifecycle
    
    func start(port: UInt16, user: String, pass: String) throws {
        // Prevent Double Start if already running/starting on same port
        if listener != nil && self.port == port {
             print("WebServer: Already active on port \(port). Updating credentials.")
             self.username = user
             self.password = pass
             return
        }
        
        // Stop if running on DIFFERENT port or just to be safe
        stop()
        
        self.port = port
        self.username = user
        self.password = pass
        self.currentSessionToken = UUID().uuidString // New Session
        
        // Setup Listener
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        let newListener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)
        
        newListener.stateUpdateHandler = { [weak self] state in
            DispatchQueue.main.async {
                switch state {
                case .ready:
                    self?.isRunning = true
                    self?.serverURL = "http://\(self?.getIPAddress() ?? "localhost"):\(port)"
                    print("WebServer: Ready on port \(port)")
                case .failed(let error):
                    self?.isRunning = false
                    self?.lastError = error.localizedDescription
                    print("WebServer: Failed with error \(error)")
                    self?.stop()
                case .cancelled:
                    self?.isRunning = false
                    print("WebServer: Cancelled")
                default:
                    break
                }
            }
        }
        
        newListener.newConnectionHandler = { [weak self] newConnection in
            self?.handleConnection(newConnection)
        }
        
        newListener.start(queue: queue)
        self.listener = newListener
    }
    
    func stop() {
        listener?.cancel()
        listener = nil
        DispatchQueue.main.async {
            self.isRunning = false
            self.activeConnections = 0
        }
    }
    
    // MARK: - IP Address Helper
    private func getIPAddress() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        
        if getifaddrs(&ifaddr) == 0 {
            var ptr = ifaddr
            while ptr != nil {
                defer { ptr = ptr?.pointee.ifa_next }
                
                let interface = ptr?.pointee
                let addrFamily = interface?.ifa_addr.pointee.sa_family
                
                // Check for IPv4 only for simplicity (IPv6 addresses are long/complex for users)
                if addrFamily == UInt8(AF_INET) {
                    if let name = String(validatingUTF8: interface!.ifa_name) {
                        // Ignore loopback
                        if name == "lo0" { continue }
                        
                        // Get IP String
                        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                        getnameinfo(interface?.ifa_addr, socklen_t(interface!.ifa_addr.pointee.sa_len), &hostname, socklen_t(hostname.count), nil, socklen_t(0), NI_NUMERICHOST)
                        
                        let ip = String(cString: hostname)
                        
                        // Heuristic: Prefer en0 (WiFi) if found, otherwise keep looking or take the first one
                        if name == "en0" {
                            address = ip
                            break // Found the best one
                        }
                        
                        // If we haven't found a preferred one yet, store this as a fallback
                        if address == nil {
                            address = ip
                        }
                    }
                }
            }
            freeifaddrs(ifaddr)
        }
        return address
    }
    
    // MARK: - Connection Handling
    
    // We need to keep state for each connection to support buffering
    // For simplicity in this singleton, we'll just use a closure-based reader that builds data.
    private func handleConnection(_ connection: NWConnection) {
        DispatchQueue.main.async { self.activeConnections += 1 }
        connection.start(queue: queue)
        readLoop(connection, accumulated: Data())
    }
    
    private func readLoop(_ connection: NWConnection, accumulated: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] (data, context, isComplete, error) in
            guard let self = self else { return }
            
            if let error = error {
                print("WebServer: Read Error: \(error)")
                self.close(connection)
                return
            }
            
            var currentData = accumulated
            if let data = data {
                currentData.append(data)
            }
            
            if isComplete {
                // Connection closed by client, try to process what we have
                if !currentData.isEmpty {
                   self.tryProcess(data: currentData, connection: connection)
                }
                self.close(connection)
                return
            }
            
            if data == nil && !isComplete {
                // No data?
                return
            }
            
            // CHECK: Do we have a full request?
            // 1. Check for Double CRLF (Headers End)
            if let separatorRange = currentData.range(of: Data("\r\n\r\n".utf8)) {
                let headerData = currentData.subdata(in: 0..<separatorRange.lowerBound)
                // Parse Headers to find Content-Length
                if let headerString = String(data: headerData, encoding: .utf8) {
                     let contentLength = self.extractContentLength(from: headerString)
                     
                     let bodyStartIndex = separatorRange.upperBound
                     let bodySize = currentData.count - bodyStartIndex
                     
                     if bodySize >= contentLength {
                         // WE HAVE EVERYTHING!
                         self.processFullRequest(headerString: headerString, 
                                                 bodyData: currentData.subdata(in: bodyStartIndex..<currentData.endIndex), 
                                                 connection: connection)
                         return 
                     }
                }
            }
            
            // Not enough data, read more
            self.readLoop(connection, accumulated: currentData)
        }
    }
    
    private func close(_ connection: NWConnection) {
        connection.cancel()
        DispatchQueue.main.async { self.activeConnections = max(0, self.activeConnections - 1) }
    }
    
    private func extractContentLength(from headers: String) -> Int {
        let lines = headers.components(separatedBy: "\r\n")
        for line in lines {
            if line.lowercased().hasPrefix("content-length:") {
                let parts = line.components(separatedBy: ":")
                if parts.count > 1 {
                    return Int(parts[1].trimmingCharacters(in: .whitespaces)) ?? 0
                }
            }
        }
        return 0
    }
    
    // MARK: - Router
    
    private func tryProcess(data: Data, connection: NWConnection) {
        // Fallback if we just got data without waiting for content-length (e.g. GET without body)
         if let str = String(data: data, encoding: .utf8) {
             self.processFullRequest(headerString: str, bodyData: Data(), connection: connection)
         }
    }

    private func processFullRequest(headerString: String, bodyData: Data, connection: NWConnection) {
        let lines = headerString.components(separatedBy: "\r\n")
        guard let requestLine = lines.first else {
             sendResponse(connection, status: "400 Bad Request", body: "Empty")
             return
        }
        
        print("WebServer: REQ \(requestLine) (Body: \(bodyData.count) bytes)")
        
        let parts = requestLine.components(separatedBy: " ")
        guard parts.count >= 2 else {
             sendResponse(connection, status: "400 Bad Request", body: "Malformed")
             return
        }
        
        let method = parts[0]
        let pathAndQuery = parts[1]
        
        // Split Path & Query
        let urlComponents = URLComponents(string: pathAndQuery)
        let path = urlComponents?.path ?? pathAndQuery
        
        // --- LOGIN ENDPOINT (Public) ---
        if method == "POST" && path == "/api/login" {
            handleLogin(bodyData: bodyData, connection: connection)
            return
        }
        
        // --- RANDOM COVER (Public, for Login BG) ---
        if method == "GET" && path == "/api/random_cover" {
             handleRandomCover(connection: connection)
             return
        }
        
        // --- AUTH CHECK ---
        if !isAuthenticated(headerString) {
            // ... (Same logic)
            // For API calls, send 401
            if path.hasPrefix("/api/") {
                 sendResponse(connection, status: "401 Unauthorized", contentType: "application/json", body: "{\"error\":\"Unauthorized\"}")
            } else {
                // For Browser: Serve Login Page directly (200 OK) so URL stays cleaner
                sendResponse(connection, status: "200 OK", contentType: "text/html", body: WebServerResources.loginHTML)
            }
            return
        }
        
        // --- PROTECTED ROUTES ---
        if method == "GET" {
            // ... (existing GETs)
            if path == "/" || path == "/index.html" {
                sendResponse(connection, status: "200 OK", contentType: "text/html", body: WebServerResources.dashboardHTML)
            } else if path.hasPrefix("/api/list") {
                let pathParam = urlComponents?.queryItems?.first(where: { $0.name == "path" })?.value ?? "/"
                handleListFiles(path: pathParam, connection: connection)
            } else if path.hasPrefix("/api/download") {
                // ...
                let filePath = urlComponents?.queryItems?.first(where: { $0.name == "path" })?.value ?? ""
                handleDownload(path: filePath, connection: connection)
            } else if path == "/api/splash_status" {
                 handleSplashStatus(connection: connection)
            } else {
                 sendResponse(connection, status: "404 Not Found", body: "Page not found")
            }
        } else if method == "POST" {
            if path.hasPrefix("/api/upload_splash") {
                 let slot = Int(urlComponents?.queryItems?.first(where: { $0.name == "slot" })?.value ?? "1") ?? 1
                 handleSplashUpload(slot: slot, data: bodyData, connection: connection)
            } else if path.hasPrefix("/api/upload") {
                let filename = urlComponents?.queryItems?.first(where: { $0.name == "filename" })?.value ?? "unknown_upload.cbz"
                let targetPath = urlComponents?.queryItems?.first(where: { $0.name == "path" })?.value ?? "/"
                handleUpload(filename: filename, targetPath: targetPath, data: bodyData, connection: connection)
            } else if path.hasPrefix("/api/logout") {
                handleLogout(connection: connection)
            } else {
                sendResponse(connection, status: "405 Method Not Allowed", body: "Available: POST /api/upload")
            }
        } else {
             sendResponse(connection, status: "501 Not Implemented", body: "Method not supported")
        }
    }
    
    // ... (isAuthenticated remains same)
    
    // MARK: - Handlers
    
    private func handleLogout(connection: NWConnection) {
        // Invalidate current token? Or just clear cookie?
        // Ideally we rotate token.
        self.currentSessionToken = UUID().uuidString
        let headers = ["Set-Cookie": "auth=deleted; Path=/; Max-Age=0"]
        sendResponse(connection, status: "200 OK", contentType: "application/json", headers: headers, body: "{\"success\":true}")
    }
    
    private func handleRandomCover(connection: NWConnection) {
        if let url = ImageCacheService.shared.getRandomCachedImageURL(),
           let data = try? Data(contentsOf: url) {
            
            // Send Image
            var response = "HTTP/1.1 200 OK\r\n"
            response += "Content-Type: image/jpeg\r\n"
            response += "Content-Length: \(data.count)\r\n"
            response += "Cache-Control: no-cache\r\n" // Force fresh random image
            response += "Connection: close\r\n\r\n"
            
            connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in })
            connection.send(content: data, completion: .contentProcessed({ _ in
                connection.cancel()
                DispatchQueue.main.async { [weak self] in self?.activeConnections -= 1 }
            }))
        } else {
            // No image found? Send 404 or a transparent pixel
             sendResponse(connection, status: "404 Not Found", body: "No Cover Found")
        }
    }
    
    private func handleDownload(path: String, connection: NWConnection) {
        // Validate Path (Security: prevent ../../ traversal)
        if path.contains("..") {
             sendResponse(connection, status: "403 Forbidden", body: "Invalid Path")
             return
        }
        
        let root = KomgaService.shared.getLocalLibraryURL()
        // Path is typically /File.cbz or /Folder/File.cbz. Remove leading /
        let cleanPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fileURL = root.appendingPathComponent(cleanPath)
        
        // Check existence
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
             sendResponse(connection, status: "404 Not Found", body: "File not found")
             return
        }
        
        // Stream File
        // For large files, loading into Data(contentsOf:) might crash memory.
        // But for this MVP, we risk it or map it. Better: use Data(contentsOf:options: .mappedIfSafe)
        
        do {
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            
            // Headers
            var response = "HTTP/1.1 200 OK\r\n"
            response += "Content-Type: application/octet-stream\r\n"
            response += "Content-Disposition: attachment; filename=\"\(fileURL.lastPathComponent)\"\r\n"
            response += "Content-Length: \(data.count)\r\n"
            response += "Connection: close\r\n\r\n"
            
            connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in })
            connection.send(content: data, completion: .contentProcessed({ _ in
                connection.cancel()
                DispatchQueue.main.async { [weak self] in self?.activeConnections -= 1 }
            }))
            
        } catch {
             sendResponse(connection, status: "500 Read Error", body: error.localizedDescription)
        }
    }

    // ... (handleListFiles, handleUpload, sendResponse remain same)
    
    // MARK: - Auth Logic
    
    private func isAuthenticated(_ headerBlock: String) -> Bool {
        // 1. Check COOKIE (Session Token) - Priority for Browsers
        let cookieHeader = "Cookie: auth=\(currentSessionToken)"
        if headerBlock.contains(cookieHeader) {
            return true
        }
    
        // 2. Check Standard Basic Auth (Legacy/API clients)
        let expected = "\(username):\(password)".data(using: .utf8)?.base64EncodedString() ?? ""
        let authHeader = "Authorization: Basic \(expected)"
        if headerBlock.localizedCaseInsensitiveContains(authHeader) {
             return true
        }
        
        // 3. Fallback URL Params
        if headerBlock.contains("luci_username=\(username)") && headerBlock.contains("luci_password=\(password)") {
            print("WebServer: Client authenticated via Query Parameters (Fallback)")
            return true
        }
        
        print("WebServer: Auth Failed. No valid Cookie or Basic Auth.")
        return false
    }
    
    private func handleLogin(bodyData: Data, connection: NWConnection) {
        // Parse JSON Body: {"username":"...", "password":"..."}
        guard let json = try? JSONSerialization.jsonObject(with: bodyData) as? [String: String],
              let u = json["username"], let p = json["password"] else {
            sendResponse(connection, status: "400 Bad Request", body: "Invalid JSON")
            return
        }
        
        if u == username && p == password {
            print("WebServer: Login Successful. Setting Cookie.")
            // Set Cookie!
            // HttpOnly = JS can't read it (good practice, though we are local)
            // Path=/ = Valid for all routes
            // Max-Age = 1 day (86400)
            let headers = [
                "Set-Cookie": "auth=\(currentSessionToken); Path=/; HttpOnly; SameSite=Lax; Max-Age=86400"
            ]
            sendResponse(connection, status: "200 OK", contentType: "application/json", headers: headers, body: "{\"success\":true}")
        } else {
             print("WebServer: Login Failed. Bad Credentials.")
             sendResponse(connection, status: "401 Unauthorized", contentType: "application/json", body: "{\"error\":\"Invalid Credentials\"}")
        }
    }
    
    // MARK: - Handlers
    
    private func handleListFiles(path: String, connection: NWConnection) {
        // Use passed path param
        let pathParam = path
        
        // Security: Prevent traversal
        if pathParam.contains("..") {
             sendResponse(connection, status: "403 Forbidden", body: "Invalid Path")
             return
        }
        
        let root = KomgaService.shared.getLocalLibraryURL()
        // Clean path
        let cleanPath = pathParam.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let targetURL = cleanPath.isEmpty ? root : root.appendingPathComponent(cleanPath)
        
        let fileManager = FileManager.default
        
        // Ensure directory exists
        var isDir: ObjCBool = false
        guard fileManager.fileExists(atPath: targetURL.path, isDirectory: &isDir), isDir.boolValue else {
            sendResponse(connection, status: "404 Not Found", body: "Directory not found")
            return
        }
        
        struct FileItem: Codable {
            let name: String
            let type: String
            let size: Int64?
        }
        
        var items: [FileItem] = []
        
        do {
            let contents = try fileManager.contentsOfDirectory(at: targetURL, includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey], options: [.skipsHiddenFiles])
            
            for url in contents {
                let res = try url.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey])
                let isDir = res.isDirectory ?? false
                let size = Int64(res.fileSize ?? 0)
                
                items.append(FileItem(name: url.lastPathComponent, type: isDir ? "folder" : "file", size: size))
            }
            
            // Sort: Folders first, then A-Z
            items.sort {
                if $0.type != $1.type { return $0.type == "folder" }
                return $0.name.localizedStandardCompare($1.name) == .orderedAscending
            }
            
            let jsonData = try JSONEncoder().encode(items)
            sendResponse(connection, status: "200 OK", contentType: "application/json", body: String(data: jsonData, encoding: .utf8) ?? "[]")
            
        } catch {
             sendResponse(connection, status: "500 Internal Error", body: error.localizedDescription)
        }
    }
    
    private func handleUpload(filename: String, targetPath: String, data: Data, connection: NWConnection) {
        // Filename might contain relative path if client sends it.
        // targetPath overrides where we start.
        
        let root = KomgaService.shared.getLocalLibraryURL()
        
        // 1. Determine Base Directory
        let cleanTargetPath = targetPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let baseURL = cleanTargetPath.isEmpty ? root : root.appendingPathComponent(cleanTargetPath)
        
        // 2. Append Filename (which might have subfolders like "Series/Vol1.cbz")
        let cleanName = filename.replacingOccurrences(of: "..", with: "") 
        let fileURL = baseURL.appendingPathComponent(cleanName)
        
        // Create directory if needed
        let folderURL = fileURL.deletingLastPathComponent()
        if !FileManager.default.fileExists(atPath: folderURL.path) {
            try? FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)
        }
        
        do {
            try data.write(to: fileURL)
            sendResponse(connection, status: "200 OK", body: "Saved")
            // Notify UI?
            DispatchQueue.main.async {
                NotificationCenter.default.post(name: NSNotification.Name("LibraryUpdated"), object: nil)
            }
        } catch {
            sendResponse(connection, status: "500 Write Error", body: error.localizedDescription)
        }
    }

    
    private func handleSplashUpload(slot: Int, data: Data, connection: NWConnection) {
        // Validation
        guard slot >= 1 && slot <= 5 else {
            sendResponse(connection, status: "400 Bad Request", body: "Slot must be 1-5")
            return
        }
        
        // Use ImageCacheService helper
        let destURL = ImageCacheService.shared.getSplashCoverURL(slot: slot)
        
        do {
            try data.write(to: destURL)
            print("WebServer: Uploaded Splash Cover \(slot)")
            sendResponse(connection, status: "200 OK", body: "Splash \(slot) Saved")
        } catch {
             sendResponse(connection, status: "500 Write Error", body: error.localizedDescription)
        }
    }
    
    private func handleSplashStatus(connection: NWConnection) {
        let status = (1...5).map { ImageCacheService.shared.hasSplashCover(slot: $0) }
        do {
            let data = try JSONEncoder().encode(status)
            let jsonString = String(data: data, encoding: .utf8) ?? "[]"
            sendResponse(connection, status: "200 OK", contentType: "application/json", body: jsonString)
        } catch {
            sendResponse(connection, status: "500 Internal Error", body: "[]")
        }
    }
    
    // MARK: - Response Helper
    
    private func sendResponse(_ connection: NWConnection, status: String, contentType: String = "text/plain", headers: [String: String] = [:], body: String) {
        var response = "HTTP/1.1 \(status)\r\n"
        response += "Content-Type: \(contentType)\r\n"
        response += "Content-Length: \(body.utf8.count)\r\n"
        response += "Connection: close\r\n"
        response += "Access-Control-Allow-Origin: *\r\n" // CORS for local dev
        
        for (key, value) in headers {
            response += "\(key): \(value)\r\n"
        }
        
        response += "\r\n"
        response += body
        
        connection.send(content: response.data(using: .utf8), completion: .contentProcessed({ _ in
            connection.cancel()
             DispatchQueue.main.async { [weak self] in self?.activeConnections -= 1 }
        }))
    }
}
