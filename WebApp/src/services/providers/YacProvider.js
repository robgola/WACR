import { XMLParser } from 'fast-xml-parser';

export class YacProvider {
    constructor(baseUrl, username, password) {
        this.baseUrl = baseUrl?.replace(/\/$/, '');
        this.auth = btoa(`${username}:${password}`); // YAC might use digest/basic? Usually Basic or custom.
        this.name = "YACReader";
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
    }

    get headers() {
        return {
            'Authorization': `Basic ${this.auth}`
        };
    }

    async validateConnection() {
        const res = await fetch(`${this.baseUrl}/browse`, { headers: this.headers });
        if (!res.ok) throw new Error(`YAC Connection Error: ${res.status}`);
        return true;
    }

    async browse(path) {
        // YAC uses GET /browse?path=...
        const url = new URL(`${this.baseUrl}/browse`);
        if (path) url.searchParams.append('path', path);

        const res = await fetch(url.toString(), { headers: this.headers });
        if (!res.ok) throw new Error(`YAC Browse Error: ${res.status}`);

        const xmlText = await res.text();
        const data = this.parser.parse(xmlText);

        // Parse XML response from YACReaderLibrary
        // Structure is usually <response> <list> <item type="folder|file" .../> </list> </response>

        // Mock parsing logic (to be verified with real response)
        const items = data.response?.list?.item || [];
        const list = Array.isArray(items) ? items : [items];

        const directories = [];
        const files = [];

        list.forEach(item => {
            const entry = {
                name: item['@_name'],
                path: item['@_path'], // YAC returns absolute path
                type: item['@_type'] === 'folder' ? 'dir' : 'file',
                size: parseInt(item['@_size'] || 0)
            };

            if (entry.type === 'dir') directories.push(entry);
            else files.push(entry);
        });

        // Parent logic needs to be derived from path or YAC response if available
        // YAC usually doesn't explicitly return parent in item list, we calculate it?
        let parent = null;
        if (path) {
            // Logic to pop last segment
            // Handled by Manager usually or derived here
            // For now assume null or calculated
        }

        return {
            parent,
            directories,
            files
        };
    }

    async getFileStream(path) {
        // YAC allows file download by path usually
        // GET /library/file?path=...
        const url = new URL(`${this.baseUrl}/library/file`);
        url.searchParams.append('path', path);

        const res = await fetch(url.toString(), { headers: this.headers });
        if (!res.ok) throw new Error(`Download Error: ${res.status}`);
        return res;
    }

    getThumbnailUrl(item) {
        // GET /library/thumbnail?path=...
        return `${this.baseUrl}/library/thumbnail?path=${encodeURIComponent(item.path)}`;
    }
}
