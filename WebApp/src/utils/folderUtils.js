
// folderUtils.js - Ported from FolderUtilities.swift

export class FolderNode {
    constructor(id, name, children = [], series = []) {
        this.id = id;
        this.name = name;
        this.children = children; // Array of FolderNode
        this.series = series;     // Array of Series objects
    }

    get isLeaf() {
        return this.children.length === 0;
    }
}

export const FolderUtilities = {
    // Main Tree Builder
    buildTree: (seriesList, pathMap) => {
        // Helpers
        const getPathComponents = (path) => {
            const standardPath = path.replace(/\\/g, '/');
            return standardPath.split('/').filter(p => p.length > 0);
        };

        // 1. Find Common Prefix (to strip root folders)
        const allPaths = seriesList.map(s => pathMap[s.id]).filter(p => p);
        let commonPrefix = null;

        for (const path of allPaths) {
            const components = getPathComponents(path);
            const folderComponents = components.slice(0, -1); // Drop filename

            if (commonPrefix === null) {
                commonPrefix = folderComponents;
            } else {
                const newPrefix = [];
                const count = Math.min(commonPrefix.length, folderComponents.length);
                for (let i = 0; i < count; i++) {
                    if (commonPrefix[i] === folderComponents[i]) {
                        newPrefix.push(commonPrefix[i]);
                    } else {
                        break;
                    }
                }
                commonPrefix = newPrefix;
            }
            if (commonPrefix.length === 0) break;
        }

        const rootName = (commonPrefix && commonPrefix.length > 0) ? commonPrefix[commonPrefix.length - 1] : "Root";

        // Node Class for localized construction
        class Node {
            constructor(name) {
                this.name = name;
                this.children = {}; // Map<String, Node>
                this.series = [];
            }
        }

        const root = new Node(rootName);
        const prefixCount = commonPrefix ? commonPrefix.length : 0;

        // Pre-scan directory paths to handle nested series folders
        const directoryPaths = new Set();
        for (const series of seriesList) {
            const fullPath = pathMap[series.id] || "";
            let components = getPathComponents(fullPath);
            if (prefixCount > 0 && components.length >= prefixCount) {
                components = components.slice(prefixCount);
            }
            if (components.length > 0) {
                const dir = components.slice(0, -1);
                if (dir.length > 0) {
                    directoryPaths.add(dir.join('/'));
                }
            }
        }

        for (const series of seriesList) {
            const fullPath = pathMap[series.id] || "";
            let components = getPathComponents(fullPath);

            // Strip prefix
            let relativeComponents = components;
            if (prefixCount > 0 && relativeComponents.length >= prefixCount) {
                relativeComponents = relativeComponents.slice(prefixCount);
            }

            let folderPathComponents = [];
            if (relativeComponents.length > 0) {
                // If series path itself is a known directory, it goes inside
                // Wait, JS set check needs string join
                if (directoryPaths.has(relativeComponents.join('/'))) {
                    folderPathComponents = relativeComponents;
                } else {
                    folderPathComponents = relativeComponents.slice(0, -1);
                }
            }

            // Walk Tree
            let currentNode = root;
            for (const folderName of folderPathComponents) {
                if (currentNode.children[folderName]) {
                    currentNode = currentNode.children[folderName];
                } else {
                    const newChild = new Node(folderName);
                    currentNode.children[folderName] = newChild;
                    currentNode = newChild;
                }
            }

            currentNode.series.push(series);
        }

        // Recursive convert and collapse
        function convertAndCollapse(node, idPrefix) {
            let finalFolders = [];
            let finalSeries = [...node.series];

            const sortedKeys = Object.keys(node.children).sort();

            for (const key of sortedKeys) {
                const childNode = node.children[key];
                const childId = idPrefix + "/" + key;
                const { folders: childFolders, series: childPromotedSeries } = convertAndCollapse(childNode, childId);

                // Smart Collapse Logic
                const seriesName = childPromotedSeries.length > 0 ? childPromotedSeries[0].name : "";
                const isNameRedundant = seriesName && (
                    key.toLowerCase().includes(seriesName.toLowerCase()) ||
                    seriesName.toLowerCase().includes(key.toLowerCase())
                );

                const isCollapsible = childFolders.length === 0 && childPromotedSeries.length === 1 && isNameRedundant;

                if (isCollapsible) {
                    finalSeries.push(...childPromotedSeries);
                } else if (childFolders.length > 0 || childPromotedSeries.length > 0) {
                    const folderNode = new FolderNode(
                        childId,
                        key,
                        childFolders,
                        childPromotedSeries.sort((a, b) => a.name.localeCompare(b.name))
                    );
                    finalFolders.push(folderNode);
                }
            }

            return { folders: finalFolders, series: finalSeries };
        }

        const { folders: rootFolders, series: rootSeries } = convertAndCollapse(root, "root");

        const combinedRoot = new FolderNode(
            "virtual_root",
            "Root",
            rootFolders,
            rootSeries.sort((a, b) => a.name.localeCompare(b.name)) // Sort by metadata.title? Swift says name.
        );

        return [combinedRoot];
    }
};
