import { openDB } from 'idb';

/**
 * OPFS Manager
 * Handles interactions with the Origin Private File System.
 * Fallback to IDB ('opfs-polyfill') if OPFS is unavailable (HTTP).
 */

export class OPFSManager {
    constructor() {
        this.root = null;
        this.usePolyfill = false;
        this.dbPromise = null;
    }

    async initPolyfill() {
        if (!this.dbPromise) {
            this.dbPromise = openDB('opfs-polyfill', 1, {
                upgrade(db) {
                    db.createObjectStore('files');
                },
            });
        }
    }

    async getRoot() {
        if (!this.root && !this.usePolyfill) {
            if (!navigator.storage || !navigator.storage.getDirectory) {
                console.warn("OPFS API unavailable (HTTP?). Using IndexedDB Polyfill.");
                this.usePolyfill = true;
                await this.initPolyfill();
                return null;
            }
            this.root = await navigator.storage.getDirectory();
        }
        return this.root;
    }

    /**
     * Save a Blob/File
     */
    async saveFile(path, blob) {
        await this.getRoot(); // Init check

        if (this.usePolyfill) {
            const db = await this.dbPromise;
            // Normalize path
            console.log(`[Polyfill] Saving ${path} (${blob.size} bytes)`);
            try {
                await db.put('files', blob, path);
                console.log(`[Polyfill] Saved ${path}`);
            } catch (e) {
                console.error(`[Polyfill] FAILED to save ${path}`, e);
            }
            return;
        }

        try {
            // Native OPFS
            const { dirHandle, fileName } = await this.getParentHandleAndName(path, true);
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            return fileHandle;
        } catch (err) {
            console.error(`OPFS Save Error (${path}):`, err);
            throw err;
        }
    }

    /**
     * Read a file
     */
    async readFile(path) {
        await this.getRoot();

        if (this.usePolyfill) {
            const db = await this.dbPromise;
            const blob = await db.get('files', path);
            return blob || null;
        }

        try {
            const { dirHandle, fileName } = await this.getParentHandleAndName(path, false);
            const fileHandle = await dirHandle.getFileHandle(fileName);
            return await fileHandle.getFile();
        } catch (err) {
            // console.warn(`OPFS Read Error (${path}): File not found.`);
            return null;
        }
    }

    /**
     * Delete a file
     */
    async deleteFile(path) {
        await this.getRoot();

        if (this.usePolyfill) {
            const db = await this.dbPromise;
            await db.delete('files', path);
            return;
        }

        try {
            const { dirHandle, fileName } = await this.getParentHandleAndName(path, false);
            await dirHandle.removeEntry(fileName);
        } catch (err) {
            if (err.name !== 'NotFoundError') console.error(`OPFS Delete Error (${path}):`, err);
        }
    }

    /**
     * Delete a folder (Polyfill: delete all starting with path)
     */
    async deleteFolder(path) {
        await this.getRoot();

        if (this.usePolyfill) {
            const db = await this.dbPromise;
            const keys = await db.getAllKeys('files');
            const related = keys.filter(k => k.startsWith(path));
            const tx = db.transaction('files', 'readwrite');
            await Promise.all(related.map(k => tx.store.delete(k)));
            return;
        }

        try {
            const parts = path.split('/').filter(Boolean);
            const folderName = parts.pop();
            const parentPath = parts.join('/');
            const parentHandle = parentPath ? await this.getDirectoryHandle(parentPath) : await this.root;
            await parentHandle.removeEntry(folderName, { recursive: true });
        } catch (err) {
            console.warn(`OPFS Delete Folder Error (${path}):`, err);
        }
    }

    async clearAll() {
        await this.getRoot();
        if (this.usePolyfill) {
            const db = await this.dbPromise;
            await db.clear('files');
            return;
        }

        for await (const [name, handle] of this.root.entries()) {
            await this.root.removeEntry(name, { recursive: true });
        }
    }

    // --- Helpers for Native OPFS ---

    async getDirectoryHandle(path, create = false) {
        const root = this.root;
        const parts = path.split('/').filter(Boolean);
        let currentHandle = root;
        for (const part of parts) {
            currentHandle = await currentHandle.getDirectoryHandle(part, { create });
        }
        return currentHandle;
    }

    async getParentHandleAndName(fullPath, create = false) {
        const parts = fullPath.split('/').filter(Boolean);
        const fileName = parts.pop();
        const dirPath = parts.join('/');
        const dirHandle = dirPath ? await this.getDirectoryHandle(dirPath, create) : this.root;
        return { dirHandle, fileName };
    }
    async fileExists(path) {
        if (!path) return false;
        await this.getRoot();

        if (this.usePolyfill) {
            const db = await this.dbPromise;
            const blob = await db.get('files', path);
            return !!blob;
        }

        try {
            const { dirHandle, fileName } = await this.getParentHandleAndName(path, false);
            await dirHandle.getFileHandle(fileName);
            return true;
        } catch (e) {
            return false;
        }
    }

    async ensureDirectoryStructure(path) {
        await this.getRoot(); // Init
        if (this.usePolyfill) return; // Polyfill doesn't need folders

        // Ensure the directory path exists. Path provided might be a file path "A/B/c.cbz" or just "A/B"
        // If it's a file path, we want the parent.
        // But the caller might pass just the folder structure.
        // Let's assume input is the FOLDER path we want to ensure.
        await this.getDirectoryHandle(path, true);
    }
}

export const opfsManager = new OPFSManager();
