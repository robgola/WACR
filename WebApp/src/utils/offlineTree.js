export const buildOfflineTree = (items, explicitFolders = []) => {
    // Root node
    const root = {
        id: 'root',
        name: 'Root',
        children: [], // Sub-folders
        items: []     // Comics at this level
    };

    // Help to get/create node at path
    const getNodeAtPath = (pathParts) => {
        let currentNode = root;
        let currentPath = "";
        pathParts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            let child = currentNode.children.find(c => c.name === part);
            if (!child) {
                child = {
                    id: `folder:${currentPath}`, // Stable ID
                    name: part,
                    path: currentPath, // Store full path
                    children: [],
                    items: [],
                    type: 'folder'
                };
                currentNode.children.push(child);
            }
            currentNode = child;
        });
        return currentNode;
    };

    // 1. Process Explicit Folders First (Empty ones)
    explicitFolders.forEach(folder => {
        const pathParts = folder.path ? folder.path.split('/').filter(Boolean) : [];
        if (pathParts.length > 0) {
            getNodeAtPath(pathParts);
        }
    });

    // 2. Process Items
    items.forEach(item => {
        // item = { id, title, folderPath, blob... }
        // Folder Path: "Library/Folder/Series"
        const pathParts = item.folderPath ? item.folderPath.split('/').filter(Boolean) : [];
        const currentNode = getNodeAtPath(pathParts);
        currentNode.items.push(item);
    });

    // 2. Assign Covers (Bubble up)
    const assignCovers = (node) => {
        // 1. Check local items (Check ALL items, not just first)
        const itemWithCover = node.items.find(i => i.coverUrl);
        if (itemWithCover) {
            node.coverUrl = itemWithCover.coverUrl;
        }

        // 2. Check children (Process ALL children to ensure they get covers too!)
        let childCover = null;
        for (const child of node.children) {
            const res = assignCovers(child);
            // If we don't have a cover yet, candidate this child's cover
            if (res && !childCover) {
                childCover = res;
            }
        }

        // 3. Adoption
        if (!node.coverUrl && childCover) {
            node.coverUrl = childCover;
        }

        return node.coverUrl;
    };
    assignCovers(root);

    // 3. Smart Flattening (Matches Swift FolderUtilities.swift)
    // We process bottom-up.
    const flatten = (node) => {
        // 1. Recursively flatten children first
        // We need to iterate a COPY because we might modify the array
        [...node.children].forEach(flatten);

        const newChildren = []; // Folders to keep
        const promotedItems = []; // Items to steal from children

        node.children.forEach(child => {
            // Check criteria from Swift:
            // 1. No sub-folders (already flattened so safe to check length)
            const hasNoSubFolders = child.children.length === 0;
            // 2. Exactly one item
            const hasSingleItem = child.items.length === 1;

            // 3. Name Redundancy Check (Heuristic for "Series Wrapper")
            // e.g. Folder "Silver Surfer" contains "Silver Surfer Vol 1" -> Collapse
            // e.g. Folder "Specials" contains "Silver Surfer" -> KEEP Folder
            let isNameRedundant = false;
            if (hasSingleItem) {
                const itemName = child.items[0]?.title || child.items[0]?.name || "";
                const folderName = child.name;
                // Simple case-insensitive inclusion check
                // "Series Wrapper" check: Book Title contains Folder Name?
                // e.g. Book "Silver Surfer #1" contains "Silver Surfer" -> Yes -> Flatten
                // e.g. Book "WildCATS #1" contains "WildCATS Vol 1"? -> No -> Keep Folder (Box)
                isNameRedundant = itemName.toLowerCase().includes(folderName.toLowerCase());
            }

            // Swift Logic: isCollapsible = childFolders.isEmpty && childPromotedSeries.count == 1 && isNameRedundant
            if (hasNoSubFolders && hasSingleItem && isNameRedundant) {
                // Collapse!
                // Promote the item to THIS node's item list
                promotedItems.push(child.items[0]);
            } else {
                // Keep the child folder
                newChildren.push(child);
            }
        });

        // Update this node
        node.children = newChildren;
        node.items = [...node.items, ...promotedItems];

        // Items should be sorted alphabetically? (Swift does this)
        node.items.sort((a, b) => (a?.title || a?.name || "").localeCompare(b?.title || b?.name || ""));
        node.children.sort((a, b) => a.name.localeCompare(b.name));
    };

    flatten(root);

    return root;
};
