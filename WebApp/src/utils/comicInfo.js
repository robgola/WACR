import JSZip from 'jszip';

export const parseComicInfo = async (blob) => {
    if (!blob) return null;
    try {
        const zip = await JSZip.loadAsync(blob);
        // Find ComicInfo.xml case-insensitively
        const file = zip.file(/ComicInfo\.xml$/i)[0];
        if (!file) return null;

        const text = await file.async("string");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        // Helper for Case-Insensitive Tag Search
        // DOMParser with text/xml IS case-sensitive. ComicInfo often varies.
        const getTag = (tagName) => {
            // Try standard case first
            let el = xmlDoc.getElementsByTagName(tagName)[0];
            if (el) return el.textContent;

            // Manual search for case-insensitive match
            // This is "no performance limits" mode :-)
            const all = xmlDoc.getElementsByTagName("*");
            for (let i = 0; i < all.length; i++) {
                if (all[i].tagName.toLowerCase() === tagName.toLowerCase()) {
                    return all[i].textContent;
                }
            }
            return "";
        };

        const authors = [];
        const addAuth = (tag, role) => {
            const val = getTag(tag);
            if (val) {
                // Split multi-authors if comma separated (common in ComicRack)
                val.split(',').forEach(n => {
                    const trimmed = n.trim();
                    if (trimmed) authors.push({ name: trimmed, role });
                });
            }
        };

        addAuth('Writer', 'writer');
        addAuth('Penciller', 'penciller');
        addAuth('Inker', 'inker');
        addAuth('Colorist', 'colorist');
        addAuth('Letterer', 'letterer');
        addAuth('CoverArtist', 'cover');
        addAuth('Editor', 'editor');

        return {
            title: getTag('Title'),
            series: getTag('Series'),
            number: getTag('Number'),
            summary: getTag('Summary'),
            publisher: getTag('Publisher'),
            year: getTag('Year'),
            pageCount: getTag('PageCount') ? parseInt(getTag('PageCount')) : 0,
            volume: getTag('Volume') || getTag('v'), // Extract Volume
            authors
        };
    } catch (e) {
        console.error("Failed to parse ComicInfo.xml", e);
        return null;
    }
};
