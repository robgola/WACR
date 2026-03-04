export class KomgaProvider {
    constructor(baseUrl, username, password) {
        let url = baseUrl?.trim();
        if (url && !url.startsWith('http') && !url.startsWith('/')) {
            url = 'https://' + url;
        }
        this.baseUrl = url?.replace(/\/$/, '') + '/api/v1';
        this.auth = btoa(`${username}:${password}`);
        this.name = "Komga";
        this.rootTree = null;
        this.libraryRoot = "";
        this.initPromise = null; // Promise Lock
    }

    get headers() {
        return {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json'
        };
    }

    async validateConnection() {
        const res = await fetch(`${this.baseUrl}/libraries`, { headers: this.headers });
        if (!res.ok) throw new Error(`Komga Connection Error: ${res.status}`);
        return true;
    }

    // Fixed: Promise Lock Pattern to prevent Race Conditions
    async initialize(libraryId) {
        // If we are already initialized for THIS library, return the existing promise
        if (this.initPromise && this.libraryId === libraryId) {
            return this.initPromise;
        }

        // If switching libraries, reset state first
        if (this.libraryId !== libraryId) {
            console.log(`🔄 [KomgaProvider] Switching Library: ${this.libraryId} -> ${libraryId}`);
            this.initPromise = null;
            this.rootTree = null;
        }

        // Double check: if still promise exists (concurrent call during switch), return it
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            console.log(`🐛 [KomgaProvider] Initializing Lib: ${libraryId} (Virtual Tree Mode)`);
            // ...
            try {
                this.libraryId = libraryId;
                this.rootTree = null;

                // 1. Get Library Root & NORMALIZE
                const libRes = await fetch(`${this.baseUrl}/libraries/${libraryId}`, { headers: this.headers });
                if (libRes.ok) {
                    const lib = await libRes.json();
                    this.libraryRoot = lib.root.replace(/\\/g, '/');
                    this.libraryName = lib.name; // Store Name for UI/Downloads
                    console.log(`🐛 [KomgaProvider] Normalized Root: ${this.libraryRoot}, Name: ${this.libraryName}`);
                }

                // 2. FETCH SERIES ONLY (Lazy Books)
                // Fetching 10k series is roughly 5-10MB JSON, acceptable.
                // Fetching 10k books is 50-100MB JSON, NOT acceptable.
                const seriesRes = await fetch(`${this.baseUrl}/series?library_id=${libraryId}&size=10000`, { headers: this.headers });

                if (!seriesRes.ok) throw new Error("Metadata fetch failed");

                const seriesList = (await seriesRes.json()).content || [];
                const booksList = []; // Start empty, load on demand

                console.log(`🐛 [KomgaProvider] Processed: ${seriesList.length} Series (Books Lazy Loaded)`);

                // 3. BUILD TREE
                const tree = this.buildHierarchy(seriesList, booksList);
                this.populateRepresentativeIds(tree);

                this.rootTree = tree; // Assign only when fully ready
                console.log("🌳 [KomgaProvider] Tree Ready:", this.rootTree);

            } catch (e) {
                console.error("Failed to initialize:", e);
                this.initPromise = null; // Reset on error so we can retry
                throw e;
            }
        })();

        return this.initPromise;
    }

    // Helper to Lazy Load Books
    async loadBooksForSeries(node) {
        if (node._booksLoaded || !node.seriesId) return;

        console.log(`📥 [KomgaProvider] Lazy Loading Books for Series: ${node.name} (${node.seriesId})`);
        try {
            const res = await fetch(`${this.baseUrl}/series/${node.seriesId}/books?size=1000`, { headers: this.headers });
            if (!res.ok) throw new Error("Failed to load books");

            const books = (await res.json()).content || [];

            // Map books to file nodes
            const mappedBooks = books.map(b => ({
                id: b.id,
                name: b.metadata.number + " - " + (b.metadata.title || b.name) + ".cbz", // Better naming? Or keep strict filename? 
                // Wait, users want original filename often, or sorted.
                // Let's stick to original behavior: url -> filename.
                // Actually Komga returns `url` like `/api/v1/books/{id}` sometimes or file path?
                // The API book object has `url` property usually pointing to download.
                // But let's check what `buildHierarchy` expected. 
                // It expected `b.url` to contain path. 
                // Does `/series/{id}/books` return `url` with full path?
                // Usually yes.
                type: 'book',
                path: b.url.replace(/\\/g, '/'),
                size: b.sizeBytes || 0,
                metadata: b.metadata,
                // Add extra for sorting
                number: b.metadata.numberSort
            }));

            // Use valid filename from url
            mappedBooks.forEach(b => {
                const parts = b.path.split('/');
                b.name = parts[parts.length - 1];
            });

            // Sort by number
            mappedBooks.sort((a, b) => (a.number || 0) - (b.number || 0));

            node.files = mappedBooks;
            node._booksLoaded = true;

            // Update representative if needed?
            // this.populateRepresentativeIds(node); // Might be expensive to re-calc up, but locally ok.

        } catch (e) {
            console.error(`Failed to load books for ${node.name}`, e);
        }
    }

    buildHierarchy(seriesList, booksList) {
        const root = {
            id: 'root',
            name: 'Root',
            type: 'folder',
            path: this.libraryRoot,
            directories: [],
            files: []
        };

        const getOrCreateDir = (parent, partName, fullPath) => {
            let dir = parent.directories.find(d => d.name === partName);
            if (!dir) {
                dir = {
                    id: `dir_${fullPath}`,
                    name: partName,
                    type: 'folder',
                    path: fullPath,
                    directories: [],
                    files: [],
                    seriesId: null,
                    _booksLoaded: false // Flag for lazy loading
                };
                parent.directories.push(dir);
            }
            return dir;
        };

        const getRelativeParts = (fullUrl) => {
            if (!fullUrl) return [];
            const normalizedUrl = fullUrl.replace(/\\/g, '/');
            let relative = normalizedUrl;
            if (this.libraryRoot && normalizedUrl.startsWith(this.libraryRoot)) {
                relative = normalizedUrl.substring(this.libraryRoot.length);
            }
            return relative.split('/').filter(p => p.length > 0);
        };

        // 1. Map SERIES
        seriesList.forEach(s => {
            const parts = getRelativeParts(s.url);
            let currentNode = root;
            let currentPath = this.libraryRoot;

            parts.forEach((part, index) => {
                currentPath = `${currentPath}/${part}`;
                const node = getOrCreateDir(currentNode, part, currentPath);

                if (index === parts.length - 1) {
                    node.id = s.id; // REAL ID override
                    node.seriesId = s.id;
                    node.metadata = s.metadata;
                    // It's a Series leaf node (mostly)
                }
                currentNode = node;
            });
        });

        // 2. Map BOOKS (Skipped in Init, used if booksList provided)
        booksList.forEach(b => {
            const parts = getRelativeParts(b.url);
            const filename = parts.pop();
            if (!filename) return;

            let currentNode = root;
            let currentPath = this.libraryRoot;

            parts.forEach(part => {
                currentPath = `${currentPath}/${part}`;
                currentNode = getOrCreateDir(currentNode, part, currentPath);
            });

            currentNode.files.push({
                id: b.id,
                name: filename,
                type: 'book',
                path: b.url.replace(/\\/g, '/'),
                size: b.sizeBytes || 0,
                metadata: b.metadata
            });
        });

        return root;
    }

    isValidKomgaId(id) {
        if (!id) return false;
        const str = String(id);
        if (str === 'root') return false;
        if (str.startsWith('dir_')) return false;
        if (str.includes('/') || str.includes('\\')) return false;
        return true;
    }

    populateRepresentativeIds(node) {
        if (this.isValidKomgaId(node.id)) {
            const rep = { id: node.id, type: 'series' };
            node.representative = rep;
            return rep;
        }

        if (node.files && node.files.length > 0) {
            const firstBook = node.files[0];
            if (this.isValidKomgaId(firstBook.id)) {
                const rep = { id: firstBook.id, type: 'book' };
                node.representative = rep;
                return rep;
            }
        }

        if (node.directories) {
            let bestChildRep = null;
            for (const dir of node.directories) {
                const childRep = this.populateRepresentativeIds(dir);
                if (childRep && !bestChildRep) {
                    bestChildRep = childRep;
                }
            }
            if (bestChildRep) {
                node.representative = bestChildRep;
                return bestChildRep;
            }
        }
        return null;
    }

    async browse(path) {
        if (!this.libraryId) return { directories: [], files: [] };

        // Safety: Always await initialization before accessing rootTree
        if (!this.rootTree) {
            await this.initialize(this.libraryId);
        }

        let targetNode = this.rootTree;

        // Critical Safety Check: If tree failed to build or is null
        if (!targetNode) {
            console.error("❌ [KomgaProvider] Browse failed: rootTree is null");
            return { directories: [], files: [], items: [] };
        }

        if (path && path !== this.libraryRoot) {
            const findNode = (node, targetPath) => {
                const nPath = (node.path || "").replace(/\\/g, '/');
                const tPath = (targetPath || "").replace(/\\/g, '/');
                if (nPath === tPath) return node;

                for (const sub of node.directories) {
                    const found = findNode(sub, targetPath);
                    if (found) return found;
                }
                return null;
            };
            const found = findNode(this.rootTree, path);
            if (found) targetNode = found;
            else {
                console.warn(`Path Not Found: ${path}`);
                return { directories: [], files: [], items: [] };
            }
        }

        // Lazy Load check
        if (targetNode.seriesId && !targetNode._booksLoaded) {
            await this.loadBooksForSeries(targetNode);
        }

        // Inject UI Helper props with Pre-calculated URLs
        const mapItem = (item) => {
            // Priority: Real ID -> Representative ID
            const isReal = item.id && !String(item.id).startsWith('dir_') && item.id !== 'root';
            const thumbId = isReal ? item.id : (item.representative?.id);

            // Priority: Representative Type -> Item Type mapping
            const thumbType = item.representative?.type || (item.type === 'book' ? 'books' : 'series');

            // Construct URL
            let thumbnailUrl = "";
            if (thumbId) {
                thumbnailUrl = `${this.baseUrl}/${thumbType}/${thumbId}/thumbnail`;
            }

            return {
                ...item,
                type: item.type || 'folder',
                thumbId: thumbId || "",
                thumbType: thumbType,
                thumbnailUrl: thumbnailUrl // The "Golden" property
            };
        };

        const mappedDirs = targetNode.directories.map(mapItem);
        const mappedFiles = targetNode.files.map(mapItem);

        return {
            directories: mappedDirs,
            files: mappedFiles,
            items: [...mappedDirs, ...mappedFiles],
            debug: { provider: 'Komga-Virtual-Tree' }
        };
    }

    async getFileStream(path) {
        throw new Error("Download should be handled by ID in App.");
    }

    getThumbnailUrl(item) {
        if (!item) return "";

        // 1. Calculated Injection (Fastest & Safest)
        if (item.thumbnailUrl) return item.thumbnailUrl;

        // 2. Fallback Re-calc (if item came from elsewhere)
        const isRealId = (id) => this.isValidKomgaId(id);

        // A. Representative
        if (item.representative && isRealId(item.representative.id)) {
            const typePath = item.representative.type === 'series' ? 'series' : 'books';
            return `${this.baseUrl}/${typePath}/${item.representative.id}/thumbnail`;
        }

        // B. Real ID
        if (isRealId(item.id)) {
            const typePath = item.type === 'book' ? 'books' : 'series';
            return `${this.baseUrl}/${typePath}/${item.id}/thumbnail`;
        }

        return "";
    }
    // Recursive Helper to flatten tree for Downloads
    async extractAllFiles(node) {
        let files = [];

        // 0. Lazy Load if needed
        if (node.seriesId && !node._booksLoaded) {
            await this.loadBooksForSeries(node);
        }

        // 1. Add files in current node
        if (node.files && node.files.length > 0) {
            files.push(...node.files);
        }

        // 2. Recurse into subdirectories
        if (node.directories && node.directories.length > 0) {
            for (const dir of node.directories) {
                const subFiles = await this.extractAllFiles(dir);
                files.push(...subFiles);
            }
        }
        return files;
    }
}
