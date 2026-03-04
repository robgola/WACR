import { KomgaProvider } from './providers/KomgaProvider';
import { YacProvider } from './providers/YacProvider';

export class LibraryManager {
    constructor() {
        this.provider = null;
        this.config = {};
    }

    initialize(type, config) {
        this.config = config;
        if (type === 'komga') {
            this.provider = new KomgaProvider(config.baseUrl, config.username, config.password);
        } else if (type === 'yac') {
            this.provider = new YacProvider(config.baseUrl, config.username, config.password);
        } else {
            throw new Error(`Unknown provider type: ${type}`);
        }
    }

    async browse(path) {
        if (!this.provider) throw new Error("Provider not initialized");
        return await this.provider.browse(path);
    }

    getThumbnailUrl(item) {
        if (!this.provider) return "";
        return this.provider.getThumbnailUrl(item);
    }

    get headers() {
        return this.provider ? this.provider.headers : {};
    }

    // --- CONTEXT-RELATIVE LOCAL MIRRORING LOGIC ---

    /**
     * Calculates the local target path for a download task.
     * @param {string} contextPath - The current path in the UI (e.g. "H:/Comics/Marvel/Avengers")
     * @param {Object} item - The item being selected
     * @returns {string} - The "Context-Relative" local path (e.g. "Library/Marvel/Avengers/Item")
     */
    calculateLocalPath(contextPath, item) {
        // 1. Normalize Separators (Always /)
        const normalize = (p) => p ? p.replace(/\\/g, '/') : '';
        const currentPath = normalize(contextPath);

        let relativePath = "";

        // 2. Strip the Library Root if present
        // If we are deep in "H:/Comics/Marvel", and Root is "H:/Comics", we want "Marvel"
        if (this.provider && this.provider.libraryRoot) {
            const root = normalize(this.provider.libraryRoot);
            if (currentPath.startsWith(root)) {
                // +1 to remove the leading slash if strictly congruent
                relativePath = currentPath.substring(root.length);
                if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
            } else {
                relativePath = currentPath; // Fallback
            }
        } else {
            relativePath = currentPath;
        }

        // 3. Compose Final Path
        // Format: Library / {LibraryName} / {RelativePath} / {ItemName}

        const libraryName = this.config.name || this.provider.name || "Unknown Library";
        // Sanitize Library Name (Simple)
        const safeLibName = libraryName.replace(/[<>:"/\\|?*]/g, '').trim();

        // Filter Boolean to remove empty segments (e.g. if relativePath is empty)
        const parts = ['Library', safeLibName, relativePath, item.name].filter(Boolean);
        return parts.join('/');
    }

    async resolveDownloadList(items) {
        if (!this.provider) throw new Error("Provider not initialized");

        // Ensure tree is ready
        if (!this.provider.rootTree) {
            await this.provider.initialize(this.provider.libraryId);
        }

        const downloadList = []; // { sourceId, sourcePath, targetPath, name, size, metadata }

        for (const item of items) {
            // 1. Calculate Base Target Path relative to Selection Context
            // If item is File: "Library/Relative/File.cbz"
            // If item is Folder: "Library/Relative/Folder" -> Inside will be "Library/Relative/Folder/Sub/File.cbz"

            // The "Context Relative" logic is handled by calculateLocalPath, but we need to apply it recursively.
            // But wait, calculateLocalPath determines the *root* of the item in the local mirror.
            // If we select a Folder, we want all its children to be relative to *that folder's* local position.

            // Example: 
            // Server: /Comics/Marvel/Avengers
            // Context (App): /Comics
            // Selection: Marvel (Folder)
            // Local Path for Marvel: Library/Marvel
            // Inside Marvel: Avengers -> Library/Marvel/Avengers

            // We can use extractAllFiles from provider, but we need to map the paths!

            if (item.type === 'book' || item.type === 'file') {
                const localPath = this.calculateLocalPath(item.path, item); // e.g. Library/Marvel/Issue1.cbz
                const folderPath = localPath.substring(0, localPath.lastIndexOf('/'));

                downloadList.push({
                    id: item.id,
                    name: item.name,
                    sourcePath: item.path,
                    targetPath: localPath, // Full OPFS Path
                    folderPath: folderPath,
                    metadata: item.metadata,
                    size: item.size
                });
            } else {
                // It's a Folder/Series
                // 1. Get all files recursively
                // The provider needs a way to give us files *with* their sub-paths relative to the Node we passed.

                // Let's use `extractAllFiles` but we need to know the *structure*.
                // `extractAllFiles` returns a flat array of file objects. 
                // The file objects contain `path` (Virtual Absolute Path).

                const allFiles = await this.provider.extractAllFiles(item);

                for (const file of allFiles) {
                    // Recalculate Path for each file
                    // Since file.path is absolute virtual path (e.g. /Comics/Marvel/Avengers/001.cbz)
                    // And calculateLocalPath handles stripping the Library Root...
                    // It *should* Just Work™ if we pass the file objects directly to calculateLocalPath.

                    const localPath = this.calculateLocalPath(file.path, file);
                    const folderPath = localPath.substring(0, localPath.lastIndexOf('/'));

                    downloadList.push({
                        id: file.id,
                        name: file.name,
                        sourcePath: file.path,
                        targetPath: localPath,
                        folderPath: folderPath,
                        metadata: file.metadata,
                        size: file.size
                    });
                }
            }
        }

        return downloadList;
    }
}
export const libraryManager = new LibraryManager();
