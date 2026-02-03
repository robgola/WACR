import { openDB } from 'idb';
import { buildOfflineTree } from '../utils/offlineTree';
import { opfsManager } from './opfsManager';

const DB_NAME = 'acr_downloads_v1';
const STORE_NAME = 'books';

export class DownloadManager {
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
        this.compositeTasks = new Map();
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

        this.updateCompositeProgress();
        this.notify();
        this.processQueue();
    }

    addCompositeTask(task) {
        this.compositeTasks.set(task.id, { ...task, completed: 0 });
        this.notify();
    }

    updateCompositeProgress() {
        if (!this.currentDownload) return;

        // Find parent task (series)
        // This logic presumes we can find which series a book belongs to, 
        // or we just trust the UI updates driven by sessionCompleted?
        // Actually, App.jsx handles the composite logic mostly via 'download-progress' events 
        // or simply by watching the session stats. 
        // But let's restore the placeholder or basic logic if needed.
        // For now, restoring basic structure to prevent crash.
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

            await this.saveBook(item.id, blob, item.name, item.coverUrl, item.folderPath, item.metadata, coverBlob, item.filename);
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

    // --- Storage (OPFS + IDB) ---

    async saveBook(bookId, blob, title, originalCoverUrl, folderPath, metadata, coverBlob, filename) {
        const db = await this.dbPromise;

        // 1. Determine OPFS Paths
        // Priority: Provided Filename > Sanitized Title
        const finalFileName = filename || title.replace(/[:/\\?%*|"<>]/g, "-") + ".cbz";

        // Publisher / Series or Default
        // Replicating Swift Logic: Path is Library/[LibraryName]/[Series]/[Book]
        const library = metadata?.libraryName ? metadata.libraryName.replace(/[:/\\?%*|"<>]/g, " ") : "Unknown Library";
        const series = metadata?.seriesTitle ? metadata.seriesTitle.replace(/[:/\\?%*|"<>]/g, "-") : "Unknown Series";

        // Structure: Library/LibraryName/Series/Filename
        const bookPath = `Library/${library}/${series}/${finalFileName}`;
        const thumbnailPath = `Cache/thumbnails/${bookId}.jpg`;

        // 2. Save Blob to OPFS
        await opfsManager.saveFile(bookPath, blob);

        // 3. Save Thumbnail to OPFS (if available)
        if (coverBlob) {
            await opfsManager.saveFile(thumbnailPath, coverBlob);
        } else if (originalCoverUrl && originalCoverUrl.startsWith('blob:')) {
            // If passed as blob url (from local), we need to fetch it to save it
            // But browser might block fetching blob used in other context? Usually fine.
            try {
                const res = await fetch(originalCoverUrl);
                const b = await res.blob();
                await opfsManager.saveFile(thumbnailPath, b);
            } catch (e) { console.warn("Could not save blob cover to OPFS", e); }
        }

        // 4. Save Metadata to IDB (NO BLOB)
        const bookData = {
            id: bookId,
            title,
            // coverUrl: Stored only if needed for reference, but real source is OPFS
            // We store the OPFS path for re-hydration
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

    async getBook(bookId) {
        const db = await this.dbPromise;
        const meta = await db.get(STORE_NAME, bookId);
        if (!meta) return null;

        // Hydrate Blob from OPFS
        if (meta.opfsPath) {
            const file = await opfsManager.readFile(meta.opfsPath);
            if (file) {
                meta.blob = file; // Attach for usage
            } else {
                console.error(`File missing at ${meta.opfsPath}`);
            }
        }
        return meta;
    }

    async isDownloaded(bookId) {
        const db = await this.dbPromise;
        const item = await db.getKey(STORE_NAME, bookId);
        return !!item;
    }

    async getDownloadedBookIds() {
        const db = await this.dbPromise;
        const keys = await db.getAllKeys(STORE_NAME);
        return new Set(keys);
    }

    async getAllDownloads() {
        const db = await this.dbPromise;
        const items = await db.getAll(STORE_NAME);

        // For Library View, we need covers.
        // Hydrate Covers from OPFS Cache
        const hydrated = await Promise.all(items.map(async (item) => {
            // If legacy item (has blob directly in IDB), use it (no migration implemented here yet)
            // If OPFS item
            if (item.coverOpfsPath) {
                const coverFile = await opfsManager.readFile(item.coverOpfsPath);
                if (coverFile) {
                    item.coverUrl = URL.createObjectURL(coverFile);
                    item._coverObjectUrl = item.coverUrl; // Marker to revoke later if needed?
                }
            } else if (item.blob && !item.coverUrl) {
                // Legacyfallback? usually legacy items had coverUrl? 
                // We'll leave legacy items as is
            }
            return item;
        }));

        return hydrated;
    }

    async deleteBook(bookId) {
        const db = await this.dbPromise;
        const item = await db.get(STORE_NAME, bookId);
        if (item) {
            // Delete from OPFS
            if (item.opfsPath) await opfsManager.deleteFile(item.opfsPath);
            if (item.coverOpfsPath) await opfsManager.deleteFile(item.coverOpfsPath);

            // Delete from IDB
            await db.delete(STORE_NAME, bookId);
            this.notify();
        }
    }

    async reset() {
        const db = await this.dbPromise;
        await db.clear(STORE_NAME);
        await db.clear('folders');

        // Clear OPFS
        await opfsManager.clearAll();

        this.queue = [];
        this.currentDownload = null;
        this.isDownloading = false;
        this.notify();
    }

    // --- File Operations ---

    async createFolder(path) {
        const db = await this.dbPromise;
        await db.put('folders', { path, createdAt: Date.now() });
        this.notify();
    }

    async deleteFolder(path) {
        const db = await this.dbPromise;
        await db.delete('folders', path);
        this.notify();
    }

    // --- Helpers ---
    async getLibraryTree() {
        const items = await this.getAllDownloads();
        const db = await this.dbPromise;
        const folders = await db.getAll('folders');
        return buildOfflineTree(items, folders);
    }
    // --- Exposed Methods for Seeding ---
    async savePage(publisher, series, folderName, filename, blob) {
        // Construct path: Library/Publisher/Series/FolderName/Filename
        const path = `Library/${publisher}/${series}/${folderName}/${filename}`;
        await opfsManager.saveFile(path, blob);
    }

    async registerSeededBook(metadata) {
        const db = await this.dbPromise;
        await db.put(STORE_NAME, {
            ...metadata,
            downloadedAt: Date.now(),
        });
        this.notify();
    }

    async saveThumbnail(bookId, blob) {
        const path = `Cache/thumbnails/${bookId}.jpg`;
        await opfsManager.saveFile(path, blob);
        return path;
    }
}

export const downloadManager = new DownloadManager();
