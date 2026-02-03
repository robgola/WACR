
// folderTree.js

/**
 * Normalizes a file path to use forward slashes and removes empty components.
 */
function getPathComponents(path) {
    if (!path) return [];
    return path.replace(/\\/g, '/').split('/').filter(p => p.length > 0);
}

/**
 * Builds a folder tree from a list of Series objects.
 * Expects series objects to have a 'url' property representing the file path.
 */
export function buildFolderTree(seriesList) {
    // 1. Identify valid paths
    const validSeries = seriesList.filter(s => s.url);
    if (validSeries.length === 0) {
        // Fallback: If no paths, put everything in root
        return {
            id: 'virtual_root',
            name: 'Root',
            children: [],
            series: seriesList.sort((a, b) => (a.metadata?.title || a.name || "").localeCompare(b.metadata?.title || b.name || ""))
        };
    }

    // 2. Find Common Prefix
    // (Optimization to start tree at the meaningful root)
    const allPaths = validSeries.map(s => getPathComponents(s.url));
    let commonPrefix = null;

    if (allPaths.length > 0) {
        commonPrefix = [...allPaths[0]];
        // Just folders, drop filename/leaf if it looks like one (usually series URL is a directory)
        // Komga Series URL is typically the folder path.
        // Let's assume standard Komga behavior: Series URL = Folder Path.

        for (const pathComponents of allPaths) {
            // Find intersection
            const newPrefix = [];
            const len = Math.min(commonPrefix.length, pathComponents.length);
            for (let i = 0; i < len; i++) {
                if (commonPrefix[i] === pathComponents[i]) {
                    newPrefix.push(commonPrefix[i]);
                } else {
                    break;
                }
            }
            commonPrefix = newPrefix;
            if (commonPrefix.length === 0) break;
        }
    }

    // 3. Build Tree
    const rootName = commonPrefix && commonPrefix.length > 0 ? commonPrefix[commonPrefix.length - 1] : 'Root';

    // Node Structure: { name, children: Map<name, Node>, series: [] }
    const root = { name: rootName, children: {}, series: [] };
    const prefixCount = commonPrefix ? commonPrefix.length : 0;

    // Pre-scan for directory paths (if series name matches a folder name exactly)
    // In JS we can just build the tree dynamically.

    for (const series of seriesList) {
        const fullPath = series.url || "";
        const components = getPathComponents(fullPath);

        // Strip common prefix
        let relativeComponents = components;
        if (prefixCount > 0 && relativeComponents.length >= prefixCount) {
            relativeComponents = relativeComponents.slice(prefixCount);
        }

        // Walk tree
        let currentNode = root;
        // In Komga, series are folders. So the series itself IS the leaf folder.
        // However, if we have nested series (Folder A -> Series B), we want Folder A to contain Series B.
        // If relativeComponents is ["FolderA"], then Series B is at root? No.

        // Let's assume logic:
        // Series Path: /Comics/Marvel/Spider-Man
        // Common Prefix: /Comics
        // Relative: [Marvel, Spider-Man]
        // If we treat "Spider-Man" as the Series Folder, then "Marvel" is the Parent Folder.

        // Swift Logic adapted:
        // The series resides in the folder specified by its path components.
        // If the Series *is* the folder (typical), then the parent path components define the tree structure.

        // Let's use simpler logic: The last component is the Series Name (usually), previous are parents.
        // BUT wait, Komga Series Name might differ from Folder Name.
        // We really just want to place the Series object into the node represented by its PATH.
        // If Series Path is "A/B", and we have Series X at "A/B", then X belongs to node "B" which is child of "A".

        // Correction: Swift puts series IN the folder node.
        // So for "A/B", we create node A, then node B, and put Series in node B.
        // UNLESS we want to collapse.

        const folderPath = relativeComponents; // The full path IS the folder for the series.

        for (const folderName of folderPath) {
            if (!currentNode.children[folderName]) {
                currentNode.children[folderName] = { name: folderName, children: {}, series: [] };
            }
            currentNode = currentNode.children[folderName];
        }

        currentNode.series.push(series);
    }

    // 4. Collapse and Convert to Array format
    // Recursively convert Map to Array and collapse redundant nodes
    function convertAndCollapse(node, idPrefix) {
        let finalFolders = [];
        let finalSeries = [...node.series]; // Start with any series at this exact level (rare if detailed path used)

        const sortedKeys = Object.keys(node.children).sort((a, b) => a.localeCompare(b));

        // Content Context Flattening:
        // If the current node ITSELF has series (it's a "Series Folder" or mixed content),
        // we want to show EVERYTHING inside it as a flat list of series (recursively promoted).
        // This solves "Folders containing comics and folders must be flat".
        // We do this by aggressively promoting children's series to THIS level if we have series.
        const parentHasSeries = node.series.length > 0;

        for (const key of sortedKeys) {
            const childNode = node.children[key];
            const childId = idPrefix + "/" + key;
            const [childFolders, childPromotedSeries] = convertAndCollapse(childNode, childId);

            // Collapse Logic
            // 1. Ghost Folder: Single series wrapper -> Collapse (Existing logic)
            // 2. Flattening: If PARENT has series, absorb CHILD series (Existing logic request)

            let shouldAbsorb = false;

            // If we are in a content folder (parentHasSeries), absorb the child's series
            // FIX: User reported this destroys structure. Removed aggressive flattening.
            // Only collapse if it's a true Ghost Folder (handled by isCollapsible below).

            // if (parentHasSeries) {
            //     shouldAbsorb = true;
            // }

            // Standard Ghost Folder Collapse (Empty child folder, 1 series)
            const isCollapsible = childFolders.length === 0 && childPromotedSeries.length === 1;

            if (shouldAbsorb) {
                finalSeries.push(...childPromotedSeries);
                // If child still has sub-folders, keep it as a folder node (minus the series)
                if (childFolders.length > 0) {
                    finalFolders.push({
                        id: childId,
                        name: key,
                        children: childFolders,
                        series: [] // Series moved up
                    });
                }
            } else if (isCollapsible) {
                // Collapse logic
                finalSeries.push(...childPromotedSeries);
            } else if (childFolders.length > 0 || childPromotedSeries.length > 0) {
                // Keep as Folder Node
                finalFolders.push({
                    id: childId,
                    name: key,
                    children: childFolders,
                    series: childPromotedSeries.sort((a, b) => (a.metadata?.title || a.name || "").localeCompare(b.metadata?.title || b.name || ""))
                });
            }
        }

        return [finalFolders, finalSeries];
    }

    const [rootFolders, rootSeries] = convertAndCollapse(root, "root");

    // Return a virtual root Node
    return {
        id: 'virtual_root',
        name: 'Root',
        children: rootFolders,
        series: rootSeries.sort((a, b) => (a.metadata?.title || a.name || "").localeCompare(b.metadata?.title || b.name || ""))
    };
}
