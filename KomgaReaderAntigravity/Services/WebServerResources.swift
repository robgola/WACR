import Foundation

struct WebServerResources {
    // MARK: - DASHBOARD (Dual Pane)
    static let dashboardHTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ACR Manager</title>
    <style>
        :root {
            --bg-dark: #0f172a;
            --bg-panel: #1e293b;
            --accent: #3b82f6;
            --text-main: #f1f5f9;
            --text-dim: #94a3b8;
            --border: #334155;
            --success: #10b981;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            margin: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        /* Header */
        header {
            background: rgba(30, 41, 59, 0.9);
            backdrop-filter: blur(10px);
            padding: 15px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .brand { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .logout-btn {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-dim);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
        }
        .logout-btn:hover { border-color: var(--text-main); color: var(--text-main); }
        
        /* Main Layout */
        main {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1px 1fr; /* Left | Divider | Right */
            gap: 0;
            overflow: hidden;
        }
        
        .pane {
            display: flex;
            flex-direction: column;
            padding: 20px;
            overflow: hidden;
        }
        
        .divider { background: var(--border); }
        
        h2 { font-size: 1rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }
        
        /* File Lists */
        .file-list {
            flex: 1;
            background: var(--bg-panel);
            border-radius: 12px;
            border: 1px solid var(--border);
            overflow-y: auto;
        }
        .file-item {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 0.95rem;
            cursor: pointer;
            transition: background 0.1s;
        }
        .file-item:hover { background: rgba(255,255,255,0.03); }
        .file-icon { margin-right: 10px; }
        
        /* Drop Zone (Left Pane) */
        .drop-zone {
            border: 2px dashed var(--border);
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin-bottom: 20px;
            transition: all 0.2s;
            cursor: pointer;
            background: rgba(255,255,255,0.02);
        }
        .drop-zone:hover, .drop-zone.dragover {
            border-color: var(--accent);
            background: rgba(59, 130, 246, 0.1);
        }
        
        /* Actions */
        .action-bar {
            padding-top: 20px;
            display: flex;
            justify-content: flex-end;
        }
        .btn-primary {
            background: var(--accent);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        
        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <span>📚</span> Antigravity Comics Reader
        </div>
        <div style="display:flex; gap:10px;">
            <button class="logout-btn" onclick="toggleSplashModal()">Splash</button>
            <button class="logout-btn" onclick="logout()">Logout</button>
        </div>
    </header>
    
    <main>
        <!-- LEFT: PC Staging -->
        <div class="pane">
            <h2>
                <span>Computer (Staging)</span>
                <span id="stagingCount" style="font-size:0.8rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">0</span>
            </h2>
            
            <div class="drop-zone" id="dropZone">
                <div style="font-size: 1.5rem; margin-bottom: 10px;">📥</div>
                <div>Drop files here to Stage</div>
                <div style="font-size: 0.8rem; color: var(--text-dim); margin-top:5px;">(Click to browse)</div>
                <input type="file" id="fileInput" multiple style="display: none;">
            </div>
            
            <div class="file-list" id="stagingList">
                <div style="padding:20px; text-align:center; color:var(--text-dim);">No files staged</div>
            </div>
            
            <div class="action-bar">
                <button id="uploadBtn" class="btn-primary" onclick="startUpload()" disabled>
                    Upload to iPad ➔
                </button>
            </div>
        </div>
        
        <div class="divider"></div>
        
        <!-- RIGHT: iPad Library -->
        <div class="pane">
             <h2>
                <span>iPad Library</span>
                <button onclick="loadRemoteFiles()" style="background:none; border:none; cursor:pointer; color:var(--accent);">↻</button>
            </h2>
            
            <div class="file-list" id="remoteList">
                 <div style="padding:20px; text-align:center;">Loading...</div>
            </div>
            
            <!-- Future download features could go here -->
            <div class="action-bar"></div> 
        </div>
    </main>

    <!-- SPLASH MODAL -->
    <div id="splashModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); backdrop-filter:blur(5px); z-index:1000; align-items:center; justify-content:center;">
        <div style="background:var(--bg-panel); padding:30px; border-radius:12px; border:1px solid var(--border); width:400px; max-width:90%;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="margin:0; color:var(--text-main);">Splash Manager</h2>
                <button onclick="toggleSplashModal()" style="background:none; border:none; color:var(--text-dim); cursor:pointer; font-size:1.5rem;">✕</button>
            </div>
            <p style="color:var(--text-dim); font-size:0.9rem; margin-bottom:20px;">Upload up to 5 custom covers for the splash screen animation.</p>
            
            <div id="splashSlots" style="display:flex; flex-direction:column; gap:10px;">
                <!-- Slots generated by JS -->
            </div>
        </div>
    </div>

    <script>
        // --- STAGING LOGIC (Left Pane) ---
        let stagedFiles = [];
        // --- PREPARE INPUTS ---
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        // Add Folder Input hidden element
        const folderInput = document.createElement('input');
        folderInput.type = 'file';
        folderInput.multiple = true;
        folderInput.webkitdirectory = true;
        folderInput.style.display = 'none';
        document.body.appendChild(folderInput);
        
        // --- STAGING LOGIC ---

        const stagingList = document.getElementById('stagingList');
        const uploadBtn = document.getElementById('uploadBtn');
        const stagingCount = document.getElementById('stagingCount');

        // Drag & Drop
        dropZone.addEventListener('click', () => {
             // Simple hack: Ask user if they want Files or Folder?
             // For now, default to Files. Adding a small ui link for folders is better.
             fileInput.click();
        });
        
        // Add a "Select Folder" link inside the dropzone dynamically
        const browseLink = dropZone.querySelector('.browse-link') || document.createElement('div');
        if (!browseLink.classList.contains('browse-link')) {
            browseLink.className = 'browse-link';
            browseLink.style.marginTop = '10px';
            browseLink.style.fontSize = '0.9rem';
            browseLink.innerHTML = `<span style="text-decoration:underline; cursor:pointer;" onclick="event.stopPropagation(); fileInput.click()">Select Files</span> or <span style="text-decoration:underline; cursor:pointer;" onclick="event.stopPropagation(); folderInput.click()">Select Folder</span>`;
            dropZone.appendChild(browseLink);
            // Remove old text
            const oldText = Array.from(dropZone.children).find(c => c.innerText.includes("Click to browse"));
            if (oldText) oldText.style.display = 'none';
        }

        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const items = e.dataTransfer.items;
            if (!items) return;
            
            const promises = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : (item.getAsEntry ? item.getAsEntry() : null);
                    if (entry) {
                        promises.push(scanEntry(entry));
                    }
                }
            }
            
            const results = await Promise.all(promises);
            // Flatten
            const files = results.flat();
            addFiles(files);
        });
        
        fileInput.addEventListener('change', (e) => addFiles(e.target.files));
        folderInput.addEventListener('change', (e) => addFiles(e.target.files));

        async function scanEntry(entry) {
            if (entry.isFile) {
                return new Promise(resolve => {
                    entry.file(file => {
                        // Patch relative path manually if needed, but entry.fullPath usually has it
                        // file.webkitRelativePath might be empty here.
                        // We attach a custom property we can use later.
                        file.fullPath = entry.fullPath; // e.g. "/Folder/File.cbz"
                        resolve([file]);
                    });
                });
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                return new Promise(resolve => {
                    const dirFiles = [];
                    // readEntries requires loop as it returns blocks
                    const read = () => {
                        reader.readEntries(async entries => {
                            if (entries.length === 0) {
                                resolve(dirFiles);
                            } else {
                                const subPromises = entries.map(scanEntry);
                                const subResults = await Promise.all(subPromises);
                                dirFiles.push(...subResults.flat());
                                read(); // Read next batch
                            }
                        });
                    };
                    read();
                });
            }
            return [];
        }

        function addFiles(files) {
            // Normalize Files
            const newFiles = Array.from(files).filter(f => 
                f.name.endsWith('.cbz') || f.name.endsWith('.cbr') || f.name.endsWith('.zip') || f.name.endsWith('.rar')
            );
            
            // Fix path property: prefer fullPath (from scan) -> webkitRelativePath (input) -> name
            newFiles.forEach(f => {
                // Ensure f.uploadPath exists
                if (f.fullPath) {
                     // fullPath usually starts with / (e.g. /Folder/File), remove first slash
                     f.uploadPath = f.fullPath.startsWith('/') ? f.fullPath.substring(1) : f.fullPath;
                } else {
                     f.uploadPath = f.webkitRelativePath || f.name;
                }
            });

            stagedFiles = [...stagedFiles, ...newFiles];
            renderStaging();
        }

        function renderStaging() {
            stagingCount.innerText = stagedFiles.length;
            uploadBtn.disabled = stagedFiles.length === 0;
            
            if (stagedFiles.length === 0) {
                stagingList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-dim);">No files staged</div>';
                return;
            }
            
            stagingList.innerHTML = '';
            stagedFiles.forEach((file, index) => {
                const div = document.createElement('div');
                div.className = 'file-item';
                
                // Show Upload Path (Relative)
                const displayPath = file.uploadPath || file.name;
                
                div.innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <span class="file-icon">📄</span> ${displayPath}
                    </div>
                    <button onclick="removeFile(${index})" style="color:#ef4444; background:none; border:none; cursor:pointer;">✕</button>
                `;
                stagingList.appendChild(div);
            });
        }
        
        window.removeFile = (index) => {
            stagedFiles.splice(index, 1);
            renderStaging();
        };

        // --- UPLOAD LOGIC ---
        window.startUpload = async () => {
            uploadBtn.disabled = true;
            uploadBtn.innerText = "Uploading...";
            
            for (let i = 0; i < stagedFiles.length; i++) {
                const file = stagedFiles[i];
                const displayPath = file.uploadPath || file.name;
                
                // Update UI item
                stagingList.children[i].innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <span class="file-icon">⏳</span> ${displayPath}
                    </div>
                    <span style="color:var(--accent);">...</span>
                `;
                
                try {
                    await uploadSingleFile(file);
                     stagingList.children[i].innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <span class="file-icon" style="color:var(--success);">✔</span> ${displayPath}
                    </div>
                    `;
                } catch (e) {
                     stagingList.children[i].innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <span class="file-icon" style="color:#ef4444;">⚠️</span> ${displayPath}
                    </div>
                    `;
                }
            }
            
            uploadBtn.innerText = "Done";
            setTimeout(() => {
                uploadBtn.innerText = "Upload to iPad ➔";
                uploadBtn.disabled = false;
                stagedFiles = [];
                renderStaging();
                loadRemoteFiles(currentRemotePath); // Refresh Current Path
            }, 2000);
        };
        
        async function uploadSingleFile(file) {
            // Use the calculated uploadPath which includes subfolders
            const nameToUse = file.uploadPath || file.name;
            const safeName = encodeURIComponent(nameToUse);
            const safePath = encodeURIComponent(currentRemotePath);
            
            // Send destination path (where user is currently looking)
            // Backend will join safePath + nameToUse
            // Example: Path="/" + Name="Series/Vol1.cbz" -> "/Series/Vol1.cbz"
            // Example: Path="/Comics" + Name="Series/Vol1.cbz" -> "/Comics/Series/Vol1.cbz"
            
            const res = await fetch(`/api/upload?filename=${safeName}&path=${safePath}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: file
            });
            if (!res.ok) throw new Error('Failed');
        }

        // --- REMOTE LOGIC (Right Pane) ---
        const remoteList = document.getElementById('remoteList');
        let currentRemotePath = "/";
        
        window.loadRemoteFiles = async (path = "/") => {
            currentRemotePath = path;
            try {
                remoteList.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
                // Fetch with path
                const res = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
                const data = await res.json();
                
                remoteList.innerHTML = '';
                
                // Add ".." if not root
                if (path !== "/" && path !== "") {
                    const div = document.createElement('div');
                    div.className = 'file-item';
                    div.style.background = 'rgba(255,255,255,0.05)';
                    div.innerHTML = `
                        <div style="display:flex; align-items:center;">
                            <span class="file-icon">⤴️</span> ..
                        </div>
                    `;
                    div.onclick = () => {
                        // Go up
                        const parts = path.split('/').filter(p => p !== "");
                        parts.pop();
                        const upPath = "/" + parts.join('/');
                        loadRemoteFiles(upPath || "/");
                    };
                    remoteList.appendChild(div);
                }
                
                if (data.length === 0) {
                     const msg = document.createElement('div');
                     msg.style = "padding:20px; text-align:center; color:var(--text-dim);";
                     msg.innerText = "Folder Empty";
                     remoteList.appendChild(msg);
                }
                
                data.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'file-item';
                    const icon = f.type === 'folder' ? '📁' : '📘';
                    const size = f.size ? (f.size/1024/1024).toFixed(1) + ' MB' : '';
                    
                    div.innerHTML = `
                        <div style="display:flex; align-items:center;">
                            <span class="file-icon">${icon}</span> ${f.name}
                        </div>
                        <span style="font-size:0.8rem; color:var(--text-dim);">${size}</span>
                    `;
                    
                    if (f.type === 'folder') {
                        // Navigate
                        const newPath = path === "/" ? "/" + f.name : path + "/" + f.name;
                        div.onclick = () => loadRemoteFiles(newPath);
                    } else {
                        // Download
                        // Should download relative to ROOT, but server implementation expects relative path from root anyway?
                        // My server `handleDownload` takes param "path".
                        // If I am in /SeriesA/ and file is Vol1.cbz, full path is /SeriesA/Vol1.cbz.
                        const fullPath = path === "/" ? "/" + f.name : path + "/" + f.name;
                        div.onclick = () => window.location.href = `/api/download?path=${encodeURIComponent(fullPath)}`;
                    }
                    remoteList.appendChild(div);
                });
            } catch (e) {
                remoteList.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">Connection Error</div>';
            }
        };
        
        // --- AUTH LOGIC ---
        window.logout = async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.reload();
        };

        // --- SPLASH LOGIC ---
        function toggleSplashModal() {
            const modal = document.getElementById('splashModal');
            const isHidden = modal.style.display === 'none';
            modal.style.display = isHidden ? 'flex' : 'none';
            if (isHidden) fetchSplashStatus();
        }
        
        async function fetchSplashStatus() {
            try {
                const res = await fetch('/api/splash_status');
                const data = await res.json();
                renderSplashSlots(data);
            } catch (e) {
                console.error(e);
                renderSplashSlots([false, false, false, false, false]);
            }
        }
        
        function renderSplashSlots(statusArray) {
            const container = document.getElementById('splashSlots');
            container.innerHTML = '';
            
            for (let i = 1; i <= 5; i++) {
                const hasFile = statusArray[i-1];
                const div = document.createElement('div');
                div.style = "background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between;";
                
                const statusText = hasFile ? '<span style="color:var(--success);">Image Set ✔</span>' : '<span style="color:var(--text-dim);">Empty</span>';
                
                div.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="color:var(--accent); font-weight:bold;">#${i}</span>
                        <span id="splash-status-${i}" style="font-size:0.9rem;">${statusText}</span>
                    </div>
                    <div>
                         <input type="file" id="splash-input-${i}" style="display:none;" accept="image/*" onchange="uploadSplash(${i})">
                         <button class="logout-btn" style="padding:4px 8px; font-size:0.8rem;" onclick="document.getElementById('splash-input-${i}').click()">
                            ${hasFile ? 'Replace' : 'Upload'}
                         </button>
                    </div>
                `;
                container.appendChild(div);
            }
        }
        
        async function uploadSplash(slot) {
            const input = document.getElementById(`splash-input-${slot}`);
            const status = document.getElementById(`splash-status-${slot}`);
            if (!input.files[0]) return;
            
            const file = input.files[0];
            status.innerText = "Uploading...";
            status.style.color = "var(--accent)";
            
            try {
                await fetch(`/api/upload_splash?slot=${slot}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: file
                });
                // Refresh status
                fetchSplashStatus();
            } catch (e) {
                status.innerText = "Error";
                status.style.color = "#ef4444";
            }
        }

        // Init
        loadRemoteFiles("/");
    </script>
</body>
</html>
"""

    // MARK: - LOGIN SCENE (Dynamic)
    static let loginHTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ACR Login</title>
    <style>
        body {
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #000;
            overflow: hidden;
        }
        
        /* Background Image Layer with Blur */
        .bg {
            position: absolute;
            top: -20px; left: -20px; right: -20px; bottom: -20px;
            background-image: url('/api/random_cover'); 
            background-size: cover;
            background-position: center;
            filter: blur(20px) brightness(0.4);
            z-index: 1;
        }
        
        .card {
            position: relative;
            z-index: 2;
            background: rgba(20, 20, 20, 0.8);
            backdrop-filter: blur(20px);
            padding: 40px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            width: 300px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        
        h1 { color: white; margin-bottom: 30px; font-size: 1.8rem; font-weight: 700; }
        
        input {
            width: 100%;
            padding: 14px;
            margin-bottom: 12px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(0,0,0,0.3);
            color: white;
            box-sizing: border-box;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.2s;
        }
        input:focus { border-color: #3b82f6; }
        
        button {
            width: 100%;
            padding: 14px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
            transition: transform 0.1s;
        }
        button:active { transform: scale(0.98); }
        
        .error { color: #ef4444; margin-top: 15px; font-size: 0.9rem; display: none; }
    </style>
</head>
<body>
    <div class="bg"></div>
    
    <div class="card">
        <h1>Antigravity<br><span style="font-size:1rem; font-weight:400; color:#94a3b8;">Comics Reader</span></h1>
        
        <form id="loginForm">
            <input type="text" id="username" placeholder="Username" value="admin" autocapitalize="off">
            <input type="password" id="password" placeholder="Password">
            <button type="submit">Login</button>
            <div id="errorMsg" class="error">Access Denied</div>
        </form>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const err = document.getElementById('errorMsg');
            
            btn.innerText = "Checking...";
            btn.disabled = true;
            err.style.display = 'none';

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        username: document.getElementById('username').value, 
                        password: document.getElementById('password').value 
                    })
                });

                if (res.ok) {
                    window.location.href = '/';
                } else {
                    throw new Error();
                }
            } catch (e) {
                btn.innerText = "Login";
                btn.disabled = false;
                err.style.display = 'block';
                // Shake animation
                document.querySelector('.card').animate([
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 300 });
            }
        });
    </script>
</body>
</html>
"""
}
