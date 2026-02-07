import { openDB } from 'idb';
import { opfsManager } from '../opfsManager';
import { buildOfflineTree } from '../../utils/offlineTree';

const DB_NAME = 'acr_downloads_v1';
const STORE_NAME = 'books';
const FOLDER_STORE = 'folders';

export class LocalLibraryService {
    constructor() {
        this.dbPromise = openDB(DB_NAME, 2);
    }

    // --- Retrieval ---

    async getAllDownloads() {
        const db = await this.dbPromise;
        const items = await db.getAll(STORE_NAME);

        const hydrated = [];
        for (const item of items) {
            if (item.coverOpfsPath) {
                try {
                    const coverFile = await opfsManager.readFile(item.coverOpfsPath);
                    if (coverFile) {
                        item.coverUrl = URL.createObjectURL(coverFile);
                        item._coverObjectUrl = item.coverUrl;
                    } else {
                        console.warn(`[Hydrate] File missing: ${item.coverOpfsPath}`);
                    }
                } catch (e) {
                    console.warn(`Failed to hydrate cover for ${item.id}`, e);
                }
            }
            hydrated.push(item);
        }
        return hydrated;
    }

    async getLibraryTree() {
        const items = await this.getAllDownloads();
        const db = await this.dbPromise;
        const folders = await db.getAll(FOLDER_STORE);
        return buildOfflineTree(items, folders);
    }

    async getBook(bookId) {
        const db = await this.dbPromise;
        const meta = await db.get(STORE_NAME, bookId);
        if (!meta) return null;

        if (meta.opfsPath) {
            const file = await opfsManager.readFile(meta.opfsPath);
            if (file) {
                meta.blob = file;
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

    // --- CRUD ---

    async deleteBook(bookId) {
        const db = await this.dbPromise;
        const item = await db.get(STORE_NAME, bookId);
        if (item) {
            if (item.opfsPath) await opfsManager.deleteFile(item.opfsPath);
            if (item.coverOpfsPath) await opfsManager.deleteFile(item.coverOpfsPath);
            await db.delete(STORE_NAME, bookId);
        }
    }

    async createFolder(path) {
        const db = await this.dbPromise;
        await db.put(FOLDER_STORE, { path, createdAt: Date.now() });
    }

    async deleteFolder(path) {
        const db = await this.dbPromise;
        await db.delete(FOLDER_STORE, path);

        // Also clean up empty directories in OPFS if we wanted to be thorough, 
        // but opfsManager's deleteFolder handles the recursion.
        // Wait, opfsManager.deleteFolder(path) is what we should call if we want to physically remove it.
        // But 'folders' store is virtual? 
        // Logic in downloadManager just deleted from IDB. 
        // Let's stick to previous behaviour for safety unless requested otherwise. 
        // Previous behavior: await db.delete('folders', path);
        // But wait, if it's a real folder in OPFS, we should probably delete it?
        // Let's check opfsManager usage.
        // The previous code ONLY deleted from IDB 'folders' store, relying on OPFS being just a blob store.
        // However, if we move files, we definitely interact with OPFS structure.

        // Use IDB only for now to match behavior strictly.
    }

    // --- Advanced Operations (Move/Copy/Rename) ---

    async moveBook(bookId, targetFolderPath) {
        const db = await this.dbPromise;
        const book = await this.getBook(bookId);
        if (!book || !book.blob) throw new Error("Book not found or missing file");

        const oldPath = book.opfsPath;
        const fileName = oldPath.split('/').pop();

        // Construct new path
        // Ensure standard formatting
        const cleanTarget = targetFolderPath ? targetFolderPath.replace(/\\/g, '/').replace(/\/$/, '') : "";
        const newPath = cleanTarget ? `${cleanTarget}/${fileName}` : fileName;

        if (newPath === oldPath) return; // No op

        // 1. Save to new location
        await opfsManager.saveFile(newPath, book.blob);

        // 2. Delete old file
        await opfsManager.deleteFile(oldPath);

        // 3. Update IDB
        book.opfsPath = newPath;
        book.folderPath = cleanTarget;

        // We do NOT update the ID usually for move.
        // Removing the blob before saving back to IDB to avoid storage error (it's not cloneable usually in IDB in this structure context if we hydrating)
        // Wait, we fetched it into `book.blob` in getBook.
        // The IDB store doesn't store the blob. `book` variable has it.
        // We need to write the METADATA object back.
        const { blob, _coverObjectUrl, coverUrl, ...metaToSave } = book;

        await db.put(STORE_NAME, metaToSave);
    }

    async copyBook(bookId, targetFolderPath) {
        const db = await this.dbPromise;
        const book = await this.getBook(bookId);
        if (!book || !book.blob) throw new Error("Book not found or missing file");

        const fileName = book.opfsPath.split('/').pop();
        const cleanTarget = targetFolderPath ? targetFolderPath.replace(/\\/g, '/').replace(/\/$/, '') : "";
        const newPath = cleanTarget ? `${cleanTarget}/${fileName}` : fileName;

        // 1. Save to new location
        await opfsManager.saveFile(newPath, book.blob);

        // 2. Handle Cover Copy
        // We probably want a separate cover file for the copy so deletion doesn't break the original.
        let newCoverPath = book.coverOpfsPath;
        if (book.coverOpfsPath) {
            const coverBlob = await opfsManager.readFile(book.coverOpfsPath);
            if (coverBlob) {
                // Generate a suffix for the new cover to avoid collision? 
                // Or just use the new ID.
                // We need a new ID for the copied book.
                const newId = `${book.id}_copy_${Date.now()}`;
                newCoverPath = `Cache/thumbnails/${newId}.jpg`;
                await opfsManager.saveFile(newCoverPath, coverBlob);

                // 3. Create New IDB Entry
                const newBookEntry = {
                    ...book,
                    id: newId,
                    opfsPath: newPath,
                    coverOpfsPath: newCoverPath,
                    folderPath: cleanTarget,
                    downloadedAt: Date.now(),
                    title: `${book.title} (Copy)`
                };

                // Remove runtime props
                delete newBookEntry.blob;
                delete newBookEntry._coverObjectUrl;
                if (newBookEntry.coverUrl && newBookEntry.coverUrl.startsWith('blob:')) delete newBookEntry.coverUrl;

                await db.put(STORE_NAME, newBookEntry);
                return;
            }
        }

        // Fallback if no cover found
        const newId = `${book.id}_copy_${Date.now()}`;
        const newBookEntry = {
            ...book,
            id: newId,
            opfsPath: newPath,
            folderPath: cleanTarget,
            downloadedAt: Date.now(),
            title: `${book.title} (Copy)`
        };
        delete newBookEntry.blob;
        delete newBookEntry._coverObjectUrl;
        if (newBookEntry.coverUrl && newBookEntry.coverUrl.startsWith('blob:')) delete newBookEntry.coverUrl;

        await db.put(STORE_NAME, newBookEntry);
    }

    async renameBook(bookId, newName) {
        const db = await this.dbPromise;
        const book = await db.get(STORE_NAME, bookId);
        if (!book) return;

        book.title = newName;
        book.name = newName; // Keep them synced if used
        await db.put(STORE_NAME, book);
    }

    // Seeder Support
    async savePage(publisher, series, folderName, filename, blob) {
        const path = `Library/${publisher}/${series}/${folderName}/${filename}`;
        await opfsManager.saveFile(path, blob);
    }

    async registerSeededBook(metadata) {
        const db = await this.dbPromise;
        await db.put(STORE_NAME, {
            ...metadata,
            downloadedAt: Date.now(),
        });
    }

    async saveThumbnail(bookId, blob) {
        const path = `Cache/thumbnails/${bookId}.jpg`;
        await opfsManager.saveFile(path, blob);
        return path;
    }

    // Reset/Clear
    async reset() {
        const db = await this.dbPromise;
        await db.clear(STORE_NAME);
        await db.clear(FOLDER_STORE);
        await opfsManager.clearAll();
    }
}

export const localLibrary = new LocalLibraryService();
