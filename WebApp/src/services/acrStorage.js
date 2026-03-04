import { opfsManager } from './opfsManager';
import { localLibrary } from './localLibrary';

/**
 * ACR Storage Service
 * Manages persistence of translation data (.acr files) in OPFS.
 * Sidecar Strategy: Saves `{comicName}.acr` in the same folder as `{comicName}.cbz`
 */
class ACRStorage {
    /**
     * Get the .acr file path for a book based on its comic file path.
     * @param {string} bookId 
     * @returns {Promise<string|null>} Path in OPFS
     */
    async getAcrPath(bookId) {
        const book = await localLibrary.getBook(bookId);
        if (!book || !book.opfsPath) {
            // Fallback for non-OPFS or untracked books
            return `translations/${bookId}.acr`;
        }

        const comicPath = book.opfsPath;
        // Replace extension with .acr
        return comicPath.replace(/\.[^/.]+$/, "") + ".acr";
    }

    /**
     * Save translation data for a comic.
     * Merges with existing data if present.
     * @param {string} bookId 
     * @param {object} acrData - The updated ACR object (schema v1.0)
     */
    async saveAcr(bookId, acrData) {
        try {
            const acrPath = await this.getAcrPath(bookId);
            const dir = acrPath.substring(0, acrPath.lastIndexOf('/'));
            if (dir) await opfsManager.ensureDirectoryStructure(dir);

            // Add metadata
            acrData.last_updated = new Date().toISOString();
            if (!acrData.version) acrData.version = "1.0";

            const blob = new Blob([JSON.stringify(acrData, null, 2)], { type: 'application/json' });
            await opfsManager.saveFile(acrPath, blob);

            console.log(`[ACR] Saved sidecar: ${acrPath}`);
        } catch (err) {
            console.error(`[ACR] Failed to save sidecar for ${bookId}:`, err);
            throw err;
        }
    }

    /**
     * Load the full ACR object for a book.
     * @param {string} bookId 
     * @returns {Promise<object|null>} ACR Object or null if not found.
     */
    async loadAcr(bookId) {
        try {
            const acrPath = await this.getAcrPath(bookId);
            const file = await opfsManager.readFile(acrPath);
            if (!file) return null;
            const text = await file.text();
            return JSON.parse(text);
        } catch (err) {
            console.warn(`[ACR] Failed to load sidecar for ${bookId}:`, err);
            return null;
        }
    }

    /**
     * Get translation data for a specific page.
     * @param {string} bookId 
     * @param {number|string} pageNumber 
     * @returns {Promise<object|null>}
     */
    async getPageTranslation(bookId, pageNumber) {
        const acr = await this.loadAcr(bookId);
        if (!acr || !acr.pages) return null;
        const pageKey = String(pageNumber);
        return acr.pages[pageKey] || null;
    }

    /**
     * Set/Update translation for a specific page.
     * @param {string} bookId 
     * @param {number|string} pageNumber 
     * @param {object} pageData 
     */
    async setPageTranslation(bookId, pageNumber, pageData) {
        let acr = await this.loadAcr(bookId);
        if (!acr) {
            acr = {
                version: "1.0",
                comic_id: bookId,
                pages: {}
            };
        }

        const pageKey = String(pageNumber);
        acr.pages[pageKey] = {
            ...pageData,
            updated_at: new Date().toISOString()
        };

        await this.saveAcr(bookId, acr);
        return acr;
    }

    async deleteAcr(bookId) {
        const acrPath = await this.getAcrPath(bookId);
        await opfsManager.deleteFile(acrPath);
    }
}

export const acrStorage = new ACRStorage();
