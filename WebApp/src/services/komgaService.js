export class KomgaService {
    constructor(baseUrl, username, password, logger) {
        this.logger = logger || console.log;

        let url = baseUrl?.trim();
        if (url && !url.startsWith('http') && !url.startsWith('/')) {
            url = 'https://' + url;
        }

        this.baseUrl = url?.replace(/\/$/, '') + '/api/v1';
        this.auth = btoa(`${username}:${password}`);
        this.log(`Service Init: ${this.baseUrl} user=${username}`);
    }

    log(msg) {
        if (this.logger) this.logger(msg, 'info');
    }

    get headers() {
        return {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        };
    }

    async validateConnection() {
        this.log(`Connecting to: ${this.baseUrl}/libraries`);
        try {
            const start = Date.now();
            // Use /libraries as the probe, since users/me is 404ing on this server
            const res = await fetch(`${this.baseUrl}/libraries`, { headers: this.headers });
            const duration = Date.now() - start;
            this.log(`Response Status: ${res.status} (${duration}ms)`);

            if (!res.ok) {
                const text = await res.text();
                this.log(`Error Body: ${text.slice(0, 100)}`);
                throw new Error(`HTTP ${res.status}`);
            }
            const json = await res.json();
            this.log(`Success! Found ${json.length} libraries`);
            return json; // Return libraries directly
        } catch (e) {
            this.log(`Fetch Error: ${e.message}`);
            console.error("Komga Connection Failed:", e);
            throw e;
        }
    }

    async getLibraries() {
        const res = await fetch(`${this.baseUrl}/libraries`, { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async getLibrary(libraryId) {
        console.log(`🐛 [KomgaService] getLibrary called for ID: ${libraryId}`);
        const res = await fetch(`${this.baseUrl}/libraries/${libraryId}`, { headers: this.headers });
        if (!res.ok) {
            console.error(`🐛 [KomgaService] getLibrary FAILED: HTTP ${res.status}`);
            throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        console.log(`🐛 [KomgaService] getLibrary SUCCESS:`, json.name);
        return json;
    }

    async getSeries(libraryId, page = 0, size = 50) {
        const url = new URL(`${this.baseUrl}/series`, window.location.origin);
        if (libraryId) url.searchParams.append('library_id', libraryId);
        url.searchParams.append('page', page);
        url.searchParams.append('size', size);
        url.searchParams.append('sort', 'name,asc');

        this.log(`Fetch Series: ${url.toString().slice(0, 50)}...`);
        const res = await fetch(url.toString(), { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async getSeriesBooks(seriesId, size = 500) {
        const url = `${this.baseUrl}/series/${seriesId}/books?size=${size}&sort=number,asc`;
        this.log(`Fetch Books: ${url.slice(0, 50)}...`);
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async getBook(bookId) {
        const url = `${this.baseUrl}/books/${bookId}`;
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async getAllBooks(libraryId, page = 0, size = 5000) {
        const url = new URL(`${this.baseUrl}/books`, window.location.origin);
        if (libraryId) url.searchParams.append('library_id', libraryId);
        url.searchParams.append('page', page);
        url.searchParams.append('size', size);

        const res = await fetch(url.toString(), { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async getFileSystem(path) {
        console.log(`🐛 [KomgaService] getFileSystem path: ${path || "ROOT"}`);
        const body = path ? JSON.stringify({ path }) : undefined;
        // POST request as per Swagger
        const res = await fetch(`${this.baseUrl}/filesystem`, {
            method: 'POST',
            headers: this.headers,
            body: body
        });
        if (!res.ok) {
            console.error(`🐛 [KomgaService] getFileSystem FAILED: ${res.status}`);
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
    }
}
