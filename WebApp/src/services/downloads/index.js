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

        this.activeDownloads = 0;
    }

    // --- Queue Management ---

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        const total = this.sessionTotal || this.queue.length + (this.currentDownload ? 1 : 0);
        const percent = total > 0 ? Math.round(((this.sessionCompleted + this.sessionFailed) / total) * 100) : 0;

        for (const listener of this.listeners) {
            listener({
                queue: this.queue,
                current: this.currentDownload,
                isDownloading: this.isDownloading,
                stats: {
                    total: this.sessionTotal,
                    completed: this.sessionCompleted,
                    failed: this.sessionFailed,
                    percent: percent
                }
            });
        }
    }

    addToQueue(bookId, bookName, downloadFn, folderPath = "", coverUrl = null, metadata = {}, headers = {}, filename = null) {
        if (this.queue.some(i => i.id === bookId) || this.currentDownload?.id === bookId) return;

        // Use safe fallback if filename not provided
        const safeName = filename || bookName.replace(/[:/\\?%*|"<>]/g, "-") + ".cbz";

        this.queue.push({ id: bookId, name: bookName, downloadFn, folderPath, coverUrl, metadata, headers, filename: safeName });

        if (!this.isDownloading && this.queue.length === 1 && !this.currentDownload) {
            this.sessionTotal = 1;
            this.sessionCompleted = 0;
            this.sessionFailed = 0;
        } else {
            this.sessionTotal++;
        }

        this.notify();
        this.processQueue();
    }

    // Concurrent Queue Processing
    async processQueue() {
        const MAX_CONCURRENT = 3;

        if (this.queue.length === 0 && this.activeDownloads === 0) {
            this.isDownloading = false;
            return;
        }

        while (this.activeDownloads < MAX_CONCURRENT && this.queue.length > 0) {
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
