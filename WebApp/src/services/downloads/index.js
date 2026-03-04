import { openDB } from 'idb';
import { opfsManager } from '../opfsManager';

const DB_NAME = 'acr_downloads_v1';
const STORE_NAME = 'books';

export class DownloadService {
    constructor() {
        this.dbPromise = openDB(DB_NAME, 2, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (oldVersion < 1) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
                if (oldVersion < 2) {
                    db.createObjectStore('folders', { keyPath: 'path' });
                }
            },
        });

        // Queue State
        this.queue = [];
        this.currentDownload = null;
        this.isDownloading = false;
        this.listeners = new Set();

        // Session Stats
        this.sessionTotal = 0;
        this.sessionCompleted = 0;
        this.sessionFailed = 0;

        this.isPaused = false;
        this.activeDownloads = 0;
    }

    // --- Queue Management ---

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        if (this._notifyTimeout) clearTimeout(this._notifyTimeout);
        this._notifyTimeout = setTimeout(() => {
            const total = this.sessionTotal || this.queue.length + (this.currentDownload ? 1 : 0);
            const percent = total > 0 ? Math.round(((this.sessionCompleted + this.sessionFailed) / total) * 100) : 0;

            for (const listener of this.listeners) {
                listener({
                    queue: this.queue,
                    current: this.currentDownload,
                    isDownloading: this.isDownloading,
                    isPaused: this.isPaused,
                    stats: {
                        total: this.sessionTotal,
                        completed: this.sessionCompleted,
                        failed: this.sessionFailed,
                        percent: percent,
                        currentFile: this.currentDownload?.name || "" // Add Filename
                    }
                });
            }
        }, 300); // Debounce 300ms
    }

    addToQueue(bookId, bookName, downloadFn, folderPath = "", coverUrl = null, metadata = {}, headers = {}, filename = null) {
        if (this.queue.some(i => i.id === bookId) || this.currentDownload?.id === bookId) return;

        // Use safe fallback if filename not provided
        const safeName = filename || bookName.replace(/[:/\\?%*|"<>]/g, "-") + ".cbz";

        this.queue.push({ id: bookId, name: bookName, downloadFn, folderPath, coverUrl, metadata, headers, filename: safeName });

        if (!this.isDownloading && !this.isPaused && this.queue.length === 1 && !this.currentDownload) {
            // Start new session if idle
            this.sessionTotal = 1;
            this.sessionCompleted = 0;
            this.sessionFailed = 0;
        } else {
            // Append to running session
            this.sessionTotal++;
        }

        // Force immediate notify on add, then debounce updates
        // Actually, debounce is fine.
        this.notify();
        this.processQueue();
    }

    // Controls
    pause() {
        if (this.isDownloading) {
            this.isPaused = true;
            this.notify();
        }
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.notify();
            this.processQueue();
        }
    }

    stop() {
        // Stop: Clear queue, let current finish, then idle.
        console.log("🛑 Stopping Download Queue");
        this.queue = [];
        this.isPaused = false;
        // We let the current download finish (no abort controller yet).
        // But we update UI immediately? 
        // Wait for current to finish to set isDownloading=false?
        // Let's set a flag "stopping".
        // Actually, clearing queue is enough. processQueue loop will exit after current.
        this.notify();
    }

    // Concurrent Queue Processing
    async processQueue() {
        const MAX_CONCURRENT = 1; // Simplify to 1 for stability/pause logic? Or keep 3?
        // 3 concurrent downloads might be heavy if not careful. Stick to 1 or 2.
        // Let's stick to existing logic but sequential is safer for pause.
        // Or stick to parallel.
        // Resume logic needs to be careful not to spawn multiple loops.

        // Stop processing if paused or empty
        if ((this.queue.length === 0 && this.activeDownloads === 0) || (this.isPaused && this.activeDownloads === 0)) {
            // Only set downloading false if actually done (or paused and everything finished)
            if (this.queue.length === 0) {
                this.isDownloading = false;
            }
            return;
        }

        // If Paused, do not pick new tasks.
        if (this.isPaused) return;

        while (this.activeDownloads < 3 && this.queue.length > 0) { // Keep 3 concurrent

            // Re-check pause in loop
            if (this.isPaused) break;

            this.isDownloading = true;
            this.activeDownloads = (this.activeDownloads || 0) + 1;

            const item = this.queue.shift();
            this.currentDownload = item;
            this.notify();

            this.downloadItem(item).then(() => {
                this.activeDownloads--;
                this.processQueue();
            });
        }
    }

    async downloadItem(item) {
        try {
            // 1. SMART SKIP: Check if file already exists in OPFS
            const exists = await opfsManager.fileExists(item.filename ? `${item.folderPath}/${item.filename}` : null);
            if (exists) {
                console.log(`⏩ [Smart Skip] File already exists: ${item.name}`);
                this.sessionCompleted++; // Count as success (instant)
                this.notify();
                return;
            }

            console.log(`⬇️ Starting download: ${item.name}`);

            // 2. Ensure Directory exists
            if (item.folderPath) {
                await opfsManager.ensureDirectoryStructure(item.folderPath);
            }

            const blob = await item.downloadFn();

            // Try fetch cover blob if url provided
            let coverBlob = null;
            if (item.coverUrl && !item.coverUrl.startsWith('blob:')) {
                try {
                    const response = await fetch(item.coverUrl, { headers: item.headers });
                    coverBlob = await response.blob();
                } catch (e) { console.warn("Failed to fetch cover for saving", e); }
            }

            await this.saveBookRef(item.id, blob, item.name, item.coverUrl, item.folderPath, item.metadata, coverBlob, item.filename);
            console.log(`✅ Finished download: ${item.name}`);
            this.sessionCompleted++;
        } catch (error) {
            console.error(`❌ Failed download: ${item.name}`, error);
            this.sessionFailed++;
            // Dispatch error event for UI Toast
            window.dispatchEvent(new CustomEvent('download-error', {
                detail: { message: `Download failed: ${item.name}`, error: error.message }
            }));
        } finally {
            this.notify();
        }
    }

    // --- Persistance (Write-Only for Download Service) ---

    async saveBookRef(bookId, blob, title, originalCoverUrl, folderPath, metadata, coverBlob, filename) {
        const db = await this.dbPromise;

        // 1. Determine OPFS Paths
        const finalFileName = filename || title.replace(/[:/\\?%*|"<>]/g, "-") + ".cbz";

        let bookPath;
        if (folderPath) {
            const cleanFolder = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
            bookPath = `${cleanFolder}/${finalFileName}`;
        } else {
            const library = metadata?.libraryName ? metadata.libraryName.replace(/[:/\\?%*|"<>]/g, " ") : "Unknown Library";
            const series = metadata?.seriesTitle ? metadata.seriesTitle.replace(/[:/\\?%*|"<>]/g, "-") : "Unknown Series";
            bookPath = `Library/${library}/${series}/${finalFileName}`;
        }
        const thumbnailPath = `Cache/thumbnails/${bookId}.jpg`;

        // 2. Save Blob to OPFS
        await opfsManager.saveFile(bookPath, blob);

        // 3. Save Thumbnail to OPFS
        if (coverBlob) {
            await opfsManager.saveFile(thumbnailPath, coverBlob);
        } else if (originalCoverUrl && originalCoverUrl.startsWith('blob:')) {
            try {
                const res = await fetch(originalCoverUrl);
                const b = await res.blob();
                await opfsManager.saveFile(thumbnailPath, b);
            } catch (e) { console.warn("Could not save blob cover to OPFS", e); }
        }

        // 4. Save Metadata to IDB
        const bookData = {
            id: bookId,
            title,
            opfsPath: bookPath,
            coverOpfsPath: thumbnailPath,
            folderPath: folderPath || "",
            downloadedAt: Date.now(),
            metadata: metadata || {},
            seriesTitle: metadata?.seriesTitle || "",
            name: title
        };

        await db.put(STORE_NAME, bookData);
    }
}

export const downloadService = new DownloadService();
