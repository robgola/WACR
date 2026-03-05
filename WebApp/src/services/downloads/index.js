import { openDB } from 'idb';
import { opfsManager } from '../opfsManager';

const DB_NAME = 'acr_downloads_v1';
const QUEUE_STORE = 'download_queue'; // Persistence for resume
const BOOKS_STORE = 'books';

/**
 * DownloadService (Refactored to DownloadScheduler)
 * Milestone 3: Prioritized Queue, Retries, and Concurrency Control.
 */
export class DownloadService {
    constructor() {
        this.dbPromise = openDB(DB_NAME, 3, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (oldVersion < 1) db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
                if (oldVersion < 2) db.createObjectStore('folders', { keyPath: 'path' });
                if (oldVersion < 3) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
            },
        });

        // Queue: { id, priority, status, retryCount, ... }
        // Priorities: 0 (bulk), 1 (normal), 2 (reader-target)
        this.queue = [];
        this.isDownloading = false;
        this.isPaused = false;
        this.maxConcurrent = 2;
        this.activeDownloads = 0;
        this.listeners = new Set();

        // Stats
        this.stats = { total: 0, completed: 0, failed: 0 };

        // Initialize queue from DB
        this.init();
    }

    async init() {
        const db = await this.dbPromise;
        const savedQueue = await db.getAll(QUEUE_STORE);
        // Retain only non-completed
        this.queue = savedQueue.filter(item => item.status !== 'completed');
        this.stats.total = this.queue.length;
        this.notify();
        this.processQueue();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        const percent = this.stats.total > 0 ? Math.round((this.stats.completed / this.stats.total) * 100) : 0;
        const currentItems = this.queue.filter(i => i.status === 'downloading');
        const current = currentItems[0] || null;

        for (const listener of this.listeners) {
            listener({
                queue: this.queue,
                current, // Restored for UI compatibility
                isDownloading: this.activeDownloads > 0,
                isPaused: this.isPaused,
                stats: {
                    ...this.stats,
                    percent,
                    currentFile: current?.name || ""
                }
            });
        }
    }

    /**
     * Add to queue with priority
     */
    async addToQueue(bookId, bookName, downloadFn, options = {}) {
        const {
            priority = 1, // 0: bulk, 1: normal, 2: high (reader-target)
            folderPath = "",
            coverUrl = null,
            metadata = {},
            headers = {},
            filename = null
        } = options;

        if (this.queue.some(i => i.id === bookId)) return;

        const safeName = filename || bookName.replace(/[:/\\?%*|"<>]/g, "-") + ".cbz";

        const item = {
            id: bookId,
            name: bookName,
            priority,
            status: 'queued',
            retryCount: 0,
            folderPath,
            coverUrl,
            metadata,
            headers,
            filename: safeName,
            addedAt: Date.now()
        };

        // Persist and add to memory
        const db = await this.dbPromise;
        await db.put(QUEUE_STORE, item);

        this.queue.push(item);
        this.stats.total++;

        // Sort queue by priority
        this._sortQueue();

        this.notify();
        this.processQueue();
    }

    _sortQueue() {
        this.queue.sort((a, b) => b.priority - a.priority || a.addedAt - b.addedAt);
    }

    pause() {
        this.isPaused = true;
        this.notify();
    }

    resume() {
        this.isPaused = false;
        this.notify();
        this.processQueue();
    }

    async processQueue() {
        if (this.isPaused || this.activeDownloads >= this.maxConcurrent) return;

        const nextItem = this.queue.find(i => i.status === 'queued' || i.status === 'failed_retry');
        if (!nextItem) return;

        this.activeDownloads++;
        nextItem.status = 'downloading';
        this.notify();

        this.downloadItem(nextItem).finally(() => {
            this.activeDownloads--;
            this.processQueue();
        });

        // If we have room for more, trigger again
        if (this.activeDownloads < this.maxConcurrent) {
            this.processQueue();
        }
    }

    async downloadItem(item) {
        try {
            // Smart Skip
            const targetPath = item.filename ? `${item.folderPath}/${item.filename}` : null;
            if (await opfsManager.fileExists(targetPath)) {
                console.log(`[Scheduler] Smart Skip: ${item.name}`);
                await this._completeItem(item);
                return;
            }

            // Execute actual download logic (this needs to be reconstructed from komgaService if needed)
            // For now, let's assume the downloadFn is passed or we fetch it.
            // Wait, in previous version downloadFn was passed. But we can't persist functions in DB.
            // We should use bookId to fetch from provider via libraryManager.

            const { libraryManager } = await import('../LibraryManager');
            const blob = await libraryManager.provider.downloadBook(item.id);

            // Cover
            let coverBlob = null;
            if (item.coverUrl) {
                try {
                    const res = await fetch(item.coverUrl, { headers: item.headers });
                    if (res.ok) coverBlob = await res.blob();
                } catch (e) { console.warn("Cover fetch failed", e); }
            }

            // Save
            await this.saveBookRef(item, blob, coverBlob);
            await this._completeItem(item);

        } catch (error) {
            console.error(`[Scheduler] Failed: ${item.name}`, error);

            // Retry Policy
            const isRetryable = error.status === 429 || error.status >= 500 || error.message.includes('network') || error.message.includes('timeout');
            const isCriticalId = error.status === 401 || error.status === 403 || error.status === 404;

            if (isRetryable && item.retryCount < 3) {
                item.retryCount++;
                item.status = 'failed_retry';
                const wait = Math.pow(2, item.retryCount) * 2000;
                console.log(`[Scheduler] Retrying ${item.name} in ${wait}ms...`);
                setTimeout(() => this.processQueue(), wait);
            } else {
                item.status = 'failed';
                this.stats.failed++;
                if (isCriticalId) {
                    console.error(`[Scheduler] Critical Error for ${item.name}. Stopping retries.`);
                }
            }

            const db = await this.dbPromise;
            await db.put(QUEUE_STORE, item);
        } finally {
            this.notify();
        }
    }

    async _completeItem(item) {
        item.status = 'completed';
        this.stats.completed++;

        const db = await this.dbPromise;
        await db.delete(QUEUE_STORE, item.id); // Remove from queue, it's now in 'books' store

        this.notify();
    }

    async saveBookRef(item, blob, coverBlob) {
        const finalFileName = item.filename;
        const bookPath = item.folderPath ? `${item.folderPath}/${finalFileName}` : `Library/Auto/${finalFileName}`;
        const thumbnailPath = `Cache/thumbnails/${item.id}.jpg`;

        await opfsManager.saveFile(bookPath, blob);
        if (coverBlob) await opfsManager.saveFile(thumbnailPath, coverBlob);

        const bookData = {
            id: item.id,
            title: item.name,
            opfsPath: bookPath,
            coverOpfsPath: thumbnailPath,
            folderPath: item.folderPath || "",
            downloadedAt: Date.now(),
            metadata: item.metadata || {},
            name: item.name
        };

        const db = await this.dbPromise;
        await db.put(BOOKS_STORE, bookData);
    }
}

export const downloadService = new DownloadService();
