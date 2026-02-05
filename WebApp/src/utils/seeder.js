import JSZip from 'jszip';
import { downloadManager } from '../services/downloadManager';
import { parseComicInfo } from './comicInfo';

// Helper to parse ComicInfo.xml
const parseMetadata = (xmlText) => {
    const getTag = (tag) => {
        const match = xmlText.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'i'));
        return match ? match[1] : null;
    };
    return {
        series: getTag('Series') || "Sample Series",
        title: getTag('Title') || "Sample Comic",
        number: getTag('Number') || "1",
        publisher: getTag('Publisher') || "Antigravity",
        summary: getTag('Summary') || "Imported sample comic.",
        year: getTag('Year') || new Date().getFullYear(),
        pageCount: getTag('PageCount') ? parseInt(getTag('PageCount')) : 0,
        writer: getTag('Writer') || "",
        penciller: getTag('Penciller') || ""
    };
};

export const checkAndSeed = async (force = false) => {
    try {
        // User Preference: InstallDefaultComic
        // Logic: If key is missing, default to TRUE. If key is 'STOP', skip.
        // DEBUG: Force install for verification
        const shouldInstall = true; // localStorage.getItem('inst_def_comic') !== 'STOP';

        if (!force && !shouldInstall) {
            console.log("🌱 [Seeder] inst_def_comic is STOP. Skipping.");
            return;
        }

        console.log("🌱 [Seeder] Starting Default Comic Installation...");

        // The target filename we want in the DB/UI
        const finalFileName = "Space Detective Vol.1951 #01__origianl_JVJ_Geo.cbz";
        const basePath = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

        // Create correct URL (Using simple name copy to avoid URL encoding issues)
        const url = `${basePath}sample/default.cbz`;
        let cbzBlob = null;

        try {
            console.log(`🌱 [Seeder] Fetching: ${url}`);
            const response = await fetch(url);
            if (response.ok) {
                const blob = await response.blob();
                if (blob.size > 10240) cbzBlob = blob;
            }
        } catch (e) {
            console.warn("Seeder fetch failed", e);
        }

        if (!cbzBlob) {
            console.error("🌱 [Seeder] Failed to download sample comic.");
            return;
        }

        // -------------------------------------------------------------
        // REVERTED SEEDER logic (Safe State)
        // -------------------------------------------------------------
        // 2. Load Zip to extract Metadata and Cover
        const zip = await JSZip.loadAsync(cbzBlob);

        // Parse Metadata from XML if available
        let metadata = {
            series: "1951 Space Detective",
            title: "Space Detective #1",
            number: "1",
            publisher: "Avon",
            summary: "Imported sample comic (Default Metadata).",
            year: "1951",
            pageCount: 0,
            writer: "",
            penciller: ""
        };

        const parsed = await parseComicInfo(cbzBlob);
        if (parsed) {
            console.log("🌱 [Seeder] Parsed XML Metadata:", parsed);
            metadata = {
                ...metadata,
                ...parsed,
                // Ensure critical fields have fallbacks if XML is partial
                title: parsed.title || metadata.title,
                series: "1951 Space Detective", // STRICTLY FORCE THIS (Ignore XML)
                publisher: parsed.publisher || metadata.publisher,
                number: parsed.number || metadata.number
            };
        } else {
            console.log("🌱 [Seeder] No XML found, using defaults.");
        }

        // Extract Cover
        const imageFiles = Object.values(zip.files).filter(f => !f.dir && /\.(jpg|jpeg|png|webp)$/i.test(f.name));
        imageFiles.sort((a, b) => a.name.localeCompare(b.name));
        metadata.pageCount = imageFiles.length;

        let coverBlob = null;
        if (imageFiles.length > 0) {
            coverBlob = await imageFiles[0].async("blob");
        }

        const bookId = `seeded_spacedetective_01`;
        // Target Path Logic 
        // Must be Library/Avon/1951 Space Detective to be picked up by offlineTree root scanner
        const targetFolder = `Library/Avon/${metadata.series}`;

        await downloadManager.saveBook(
            bookId,
            cbzBlob,
            metadata.title,
            null,
            targetFolder,
            {
                libraryName: "Avon", // Key for Folder Structure
                title: metadata.title,
                seriesTitle: metadata.series,
                number: metadata.number,
                summary: metadata.summary,
                publisher: metadata.publisher,
                year: metadata.year,
                authors: parsed?.authors || []
            },
            coverBlob,
            finalFileName // filename: Explicitly pass the correct filename
        );

        console.log("🌱 [Seeder] Import Complete!");

        // Mark as seeded
        localStorage.setItem('inst_def_comic', 'STOP');

        window.dispatchEvent(new Event('library-updated'));
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: "Default Comic Installed", type: "success" } }));

    } catch (error) {
        console.error("🌱 [Seeder] Failed:", error);
    }
};
