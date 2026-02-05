import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, Link, useParams, Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { Book, Settings as SettingsIcon, Import, RefreshCw, ArrowLeft, Download, Check, Folder, List, ChevronRight, ChevronLeft, HardDrive, Trash2, X, MoreVertical, DownloadCloud, CheckCircle2, MoreHorizontal, Copy, Scissors, Clipboard, FolderPlus, CheckSquare, Server } from 'lucide-react';
// Components
import GlassCard from './components/ui/GlassCard';
import ComicBox from './components/ui/ComicBox';
import AuthImage from './components/ui/AuthImage';
// No need for PillBar yet
import DebugConsole from './components/debug/DebugConsole';
// Logic
import { AppProvider, useApp } from './context/AppContext';
import { useAuth } from './hooks/useAuth'; // NEW AUTH HOOK
import { libraryManager } from './services/LibraryManager'; // Universal Manager
import { KomgaService } from './services/komgaService'; // Corrected import to Class (if needed), or removed if unused.
// import { komgaService as legacyService } ... Removed invalid named export.
import { downloadManager } from './services/downloadManager';
import { FolderUtilities } from './utils/folderUtils';
import { buildOfflineTree } from './utils/offlineTree';
import { saveImage } from './utils/imageDB';
import { cacheManager } from './services/cacheManager'; // Added cacheManager import
import DownloadProgress from './components/ui/DownloadProgress';
import LocalReader from './components/LocalReader';
import PillFilterBar from './components/ui/PillFilterBar';
import ContinueReadingCarousel from './components/ui/ContinueReadingCarousel';
import StorageInspector from './components/debug/StorageInspector';
import DownloadConfirmationDialog from './components/ui/DownloadConfirmationDialog';
import { checkAndSeed } from './utils/seeder';
import { formatLibraryTitle } from './utils/textUtils';
import SettingsPage from './components/SettingsPage'; // NEW PAGE
import LandingPage from './components/LandingPage';

// Extracted Defaults to avoid duplication
const defaultNavConfig = {
  top: 32,
  padding: 4,
  gap: 4,
  fontSize: 16,
  itemPaddingX: 20,
  itemPaddingY: 8,
  serverBarTop: 105,
  gridTop: 110,
  subBarTop: 106,
  seriesBarTop: 106,
  booksGridTop: 100,

  continueReadingMargin: 130,
  librariesBarTop: 105,
  gridMargin: 20,

  // Library Pill Bar specific
  libPillPadX: 4,
  libPillPadY: 8,
  libPillFontSize: 16,
  libBarGap: 16,
  libBarPadLeft: 16,

  // New Defaults
  libPillPaddingX: 16,
  libPillHeight: 40,
  librariesBarHeight: 60,

  // Continue Reading Tuner
  crHeight: 285,
  crSideMargin: 20,
  crInnerPadding: 24,
  crTextTopMargin: 0,
  crFontSize: 22,

  // Grid Tuner
  gridHeight: 600,
  gridSideMargin: 20,
  gridInnerPadding: 24,
  gridColumns: 5,
  libraryBarTop: 105,
  libraryGridMargin: 130,
  libraryGridSideMargin: 0,
  headerSideMargin: 16,

  seriesGridMargin: 110,

  // Comic Reader Tuner
  comicSideMargin: 16,
  comicTopMargin: 16,

  // Local Menu Tuner (Now Import Menu)
  localMenuTriggerSize: 24,
  localMenuHeight: 200,
  localMenuWidth: 200,
  localMenuPadding: 8,
  localMenuItemGap: 8,
  localMenuX: 0,
  localMenuY: 0,

  // Settings Tuner - UPDATED
  settingsTitleTop: 110,
  settingsPillsTop: 30, // May be deprecated by settingsPillsTopMargin
  settingsPillsGap: 40,
  settingsPillHeight: 'auto',
  settingsPillMinHeight: 100,
  settingsPillSideMargin: 20,
  settingsPillPadding: 24,

  // Settings New
  settingsPillsTopMargin: 120, // New logic
  settingsPillInnerPadding: 10,
  settingsPillTitleSize: 20,
  settingsPillTitleBottomMargin: 10,

  // Import Menu Tuner
  importMenuWidth: 227,
  importMenuHeight: 100,
  importMenuX: 0,
  importMenuY: 0,
  importMenuGap: 12,
  importMenuFontSize: 14,
  importMenuItemPadding: 2,
  importMenuItemPaddingX: 24,
};


// -----------------------------------------------------------------------------
// HELPER: Folder View Components
// -----------------------------------------------------------------------------

const SimpleFolderCard = ({ node }) => {
  // Generate simple collage from first 3 items in the folder (deep) to show activity
  // Logic: Look at node.series, then node.children's series

  // Adjusted logic:
  const getCoverUrls = (n) => {
    let urls = [];
    if (n.series) {
      urls.push(...n.series.map(s => `api/v1/series/${s.id}/thumbnail`));
    }
    if (n.children && n.children.length > 0) { // Check if array
      n.children.forEach(child => {
        if (urls.length < 3) urls.push(...getCoverUrls(child));
      });
    }
    return urls.slice(0, 3);
  };

  // We need baseUrl here... passed via context or props?
  // Let's rely on props passed down or constructed in the parent.
  // Ideally ComicBox handles auth if full URL, but here we only have relative API paths if we construct them manually.
  // The parent calling this should probably pass full URLs.

  return null; // Placeholder, logic moved to main component due to context need
};

// -----------------------------------------------------------------------------
// HELPER: Local Library Item (Book)
// -----------------------------------------------------------------------------
const LocalLibraryItem = ({ item, onBookClick, onDelete, selectionMode, isSelected, onToggleSelect }) => {
  // DEBUG LOG
  // console.log(`[Render] Item ${item.name} coverUrl:`, item.coverUrl);

  return (
    <div
      className="relative cursor-pointer group"
      onClick={(e) => {
        if (selectionMode) {
          e.stopPropagation();
          onToggleSelect && onToggleSelect();
          return;
        }
        if (onDelete) {
          if (confirm(`Delete "${item.name || item.metadata?.title}"?`)) {
            onDelete(item);
          }
        } else {
          onBookClick(item);
        }
      }}
    >
      <ComicBox
        title={formatLibraryTitle(item.metadata?.title || item.name)}
        // Local items should have coverUrl attached by buildFolderTree/buildOfflineTree
        coverUrl={item.coverUrl}
        variant="book"
        number={item.metadata?.number || item.metadata?.Number || item.number} // Pass Number
        readingProgress={item.readProgress} // Verify item has this, usually passed from buildOfflineTree?
        isDownloaded={true}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        // But if 'book' is passed here, it's from the processed list.
        onDownload={() => {
          // Local re-download? Or just do nothing?
          // If it's local, we might want to delete?
          // For now, keep as is.
        }}
      />
      {onDelete && (
        <div className="absolute top-2 right-2 bg-red-500 rounded-full p-1 z-20">
          <X size={12} className="text-white" />
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// LOCAL LIBRARY VIEW (HOME)
// -----------------------------------------------------------------------------
const LocalLibrary = ({ config }) => {
  const { komgaService } = useApp();
  const [rootTree, setRootTree] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [readingBook, setReadingBook] = useState(null);


  /* ---------------------------------------------------------------------------
   * HELPER: Resolve Folder Cover (Persistent Config)
   * --------------------------------------------------------------------------- */
  const resolveFolderCover = (folder) => {
    if (folder._cachedCover) return folder._cachedCover;
    const cacheKey = `folder_cover_${folder.path}`;
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      folder._cachedCover = stored;
      return stored;
    }
    return null;
  };
  const [isSelectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set()); // IDs
  const [clipboard, setClipboard] = useState(null); // { op: 'copy'|'cut', items: [] }
  const [showMenu, setShowMenu] = useState(false);

  const [selectedTab, setSelectedTab] = useState("Tutte");
  const [bgImage, setBgImage] = useState(null); // Local background state
  const [previewBook, setPreviewBook] = useState(null); // For Folder Preview Logic
  const [diagLog, setDiagLog] = useState(""); // DIAGNOSTIC STATE

  // Reading History (Persisted)
  const [readingHistory, setReadingHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('reading_history');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Update history when opening a book
  const openBook = (book) => {
    setReadingBook(book);
    setReadingHistory(prev => {
      // Remove existing if present to move to top
      const others = prev.filter(b => b.id !== book.id);
      const newHistory = [book, ...others].slice(0, 20); // Keep last 20
      localStorage.setItem('reading_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  // Hydrate History on Load (Refresh Blob URLs from RootTree)
  useEffect(() => {
    if (!rootTree || readingHistory.length === 0) return;

    // 1. Index all available books in rootTree
    const bookMap = new Map();
    const traverse = (node) => {
      node.items.forEach(b => bookMap.set(b.id, b));
      node.children.forEach(traverse);
    };
    traverse(rootTree);

    // 2. Hydrate History
    setReadingHistory(prev => {
      let changed = false;
      const hydrated = prev.map(hItem => {
        const fresh = bookMap.get(hItem.id);
        // Debug
        if (hItem.id.includes('spacedetective')) {
          console.log("Hydrate Debug: Found in history:", hItem, "Found in Tree:", fresh);
        }

        // If found and (cover is different OR fresh has blob while history might not), update
        if (fresh) {
          // Check if we gained a blob or valid cover
          if (fresh.coverUrl !== hItem.coverUrl || !hItem.coverUrl) {
            changed = true;
            // Merge history progress with fresh metadata/blobs
            // (History might have newer readingProgress from localReader?)
            // Actually, App state is source of truth for progress usually?
            // Let's prefer Fresh Metadata but keep History timestamp if needed.
            return { ...fresh, ...hItem, coverUrl: fresh.coverUrl, metadata: fresh.metadata || hItem.metadata };
          }
        }
        return hItem;
      });

      return changed ? hydrated : prev;
    });
  }, [rootTree]); // Run whenever library reloads (e.g. initial load)

  // Flattening / Filtering Logic
  const displayContent = useMemo(() => {
    if (!rootTree) return { children: [], items: [] };

    // If we are deep in navigation (folderStack not empty), show currentFolder content
    if (folderStack.length > 0) {
      return currentFolder; // Normal behavior inside a series/folder
    }

    // Top Level Logic (Tab Selections)
    if (selectedTab === "Tutte") {
      // Flatten: Collect ALL Series (Children of Libraries) + Root Books
      // Structure: Root -> Library -> {LibName} -> Series
      let allSeries = [];
      let allBooks = [];

      // Check for "Library" container
      const libraryContainer = rootTree.children.find(c => c.name === 'Library');
      const rootChildren = libraryContainer ? libraryContainer.children : rootTree.children;

      // Add loose books from Root (and Library folder if weirdly placed)
      allBooks.push(...rootTree.items);

      // Iterate Libraries
      rootChildren.forEach(lib => {
        // Add library's series (folders)
        // Inject Library Name for navigation context
        const seriesWithLib = lib.children.map(s => ({ ...s, _libName: lib.name }));
        allSeries.push(...seriesWithLib);
        // Add library's loose books
        allBooks.push(...lib.items);
      });

      return {
        name: "Tutte",
        children: allSeries.sort((a, b) => a.name.localeCompare(b.name)),
        items: allBooks
      };
    } else {
      // Specific Library (e.g. "Avengers")
      // It might be under Root -> Library -> Avengers
      // OR Root -> Avengers (legacy)

      let libNode = rootTree.children.find(c => c.name === selectedTab);

      // Try finding inside 'Library' container
      if (!libNode) {
        const libraryContainer = rootTree.children.find(c => c.name === 'Library');
        if (libraryContainer) {
          libNode = libraryContainer.children.find(c => c.name === selectedTab);
        }
      }

      return libNode ? libNode : { children: [], items: [] };
    }
  }, [rootTree, selectedTab, folderStack, currentFolder]);

  // Derived Tabs (Libraries)
  const tabs = useMemo(() => {
    if (!rootTree) return ["Tutte", "Avon"]; // Avon default

    // Check for "Library" container
    const libraryContainer = rootTree.children.find(c => c.name === 'Library');
    // If exists, use its children as libraries. Else use root children (legacy/flat)
    const sourceNodes = libraryContainer ? libraryContainer.children : rootTree.children;

    const libs = sourceNodes.map(c => c.name).sort();

    // Inject Avon if not present
    if (!libs.includes("Avon")) libs.push("Avon");

    // Sort again
    libs.sort();

    return ["Tutte", ...libs];
  }, [rootTree]);

  // Featured Books (For Carousel)
  const featuredBooks = useMemo(() => {
    if (!rootTree || rootTree.items.length === 0 && rootTree.children.length === 0) {
      return [];
    }

    let books = [];
    const traverse = (node) => {
      books.push(...node.items);
      node.children.forEach(traverse);
    };
    traverse(rootTree);
    // Randomize or just take first 10
    return books.sort(() => 0.5 - Math.random()).slice(0, 5);
  }, [rootTree]);

  // CACHED BACKGROUND COVERS (Random from Library)
  // Use a ref to persist them across renders to avoid flickering, only update if allBooks changes length significantly or explicitly requested
  const allBooksRef = useRef([]);
  const backgroundCovers = useMemo(() => {
    // Re-use logic to get all books
    if (!rootTree) return [];

    let allBooks = [];
    const traverse = (node) => {
      allBooks.push(...node.items);
      node.children.forEach(traverse);
    };
    traverse(rootTree);

    if (allBooks.length === 0) return [];

    // Update ref for comparison if needed, but for now just randomize on mount/tree-change
    // Shuffle and pick 10
    const shuffled = [...allBooks].sort(() => 0.5 - Math.random());
    // Use local blob if available, else construct URL (only if service exists)
    return shuffled.slice(0, 10).map(b => {
      if (b.coverUrl) return b.coverUrl;
      if (komgaService) return `${komgaService.baseUrl}/books/${b.id}/thumbnail`;
      return null;
    }).filter(url => url !== null);
  }, [rootTree, komgaService]); // Depend on rootTree so it updates when library loads



  // --- Context Menu Logic ---
  const handleToggleSelect = () => {
    setSelectionMode(!isSelectionMode);
    setSelectedItems(new Set());
    setDeleteMode(false); // Disable legacy delete mode
  };

  const handleSelectItem = (id) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const handleCopy = () => {
    const items = displayContent.items.filter(i => selectedItems.has(i.id));
    // Also support folders eventually? For now books only as per prompt simplicity for "file manager"
    setClipboard({ op: 'copy', items: items });
    setSelectionMode(false);
    setSelectedItems(new Set());
    showToast(`${items.length} items copied`, "info");
    setShowMenu(false);
  };

  const handleCut = () => {
    const items = displayContent.items.filter(i => selectedItems.has(i.id));
    setClipboard({ op: 'cut', items: items });
    setSelectionMode(false);
    setSelectedItems(new Set());
    showToast(`${items.length} items cut`, "info");
    setShowMenu(false);
  };

  const handlePaste = async () => {
    if (!clipboard || clipboard.items.length === 0) return;

    // Target Path: based on currentFolder location
    // We need to reconstruct the path string from folderStack + currentFolder?
    // currentFolder is a node. We need the PATH string.
    // The nodes don't store their full path easily unless we track it.
    // Wait, offlineTree nodes don't have 'path' property explicitly.
    // But items have 'folderPath'.

    // Let's reconstruct path:
    // If folderStack is empty -> "LibraryName" (Tab) or just "Root"?
    // Local library "Root" usually means NO path prefix or just "root".
    // Actually `downloadManager` uses `folderPath` string.

    let targetPath = "";
    if (selectedTab !== "Tutte") {
      targetPath = selectedTab;
    }

    // Append stack
    const stackNames = folderStack.map(f => f.name);
    if (targetPath) {
      targetPath = [targetPath, ...stackNames].join("/");
    } else {
      targetPath = stackNames.join("/");
    }

    // If we are just at "Tutte" root, path is empty string?
    // "Tutte" is a virtual view. We can't paste into "Tutte". 
    // We must be in a specific library/folder or Root.
    // If selectedTab is "Tutte", and stack is empty, we are at GLOBAL root?
    // Files need a folderPath. Empty string is valid for "Root".

    if (selectedTab === "Tutte" && folderStack.length === 0) {
      // Root paste allowed
      targetPath = "";
    }

    console.log(`Pasting ${clipboard.items.length} items to: ${targetPath}`);

    try {
      if (clipboard.op === 'cut') {
        for (const item of clipboard.items) {
          await downloadManager.moveBook(item.id, targetPath);
        }
        setClipboard(null);
      } else {
        for (const item of clipboard.items) {
          await downloadManager.copyBook(item.id, targetPath);
        }
      }
      showToast(`Pasted ${clipboard.items.length} items`, "success");
    } catch (e) {
      console.error(e);
      showToast("Paste failed", "error");
    }
    setShowMenu(false);
  };

  const handleCreateFolder = async () => {
    const name = prompt("Folder Name:");
    if (!name) return;

    let targetPath = "";
    if (selectedTab !== "Tutte") targetPath = selectedTab;
    const stackNames = folderStack.map(f => f.name);
    if (targetPath) targetPath = [targetPath, ...stackNames].join("/");
    else targetPath = stackNames.join("/");

    const newPath = targetPath ? `${targetPath}/${name}` : name;

    await downloadManager.createFolder(newPath);
    setShowMenu(false);
  };

  const handleDelete = async () => {
    const itemsToDelete = Array.from(selectedItems);

    for (const id of itemsToDelete) {
      if (id.startsWith("folder:")) {
        const path = id.substring(7); // Remove 'folder:' prefix
        await downloadManager.deleteFolder(path);
      } else {
        await downloadManager.deleteBook(id);
      }
    }

    setSelectedItems(new Set());
    setSelectionMode(false);
    setShowMenu(false);
    showToast(`Deleted ${itemsToDelete.length} items`, "success");
  };

  // Navigation Handler
  const handleTabSelect = (tab) => {
    setSelectedTab(tab);
    setFolderStack([]);
    if (rootTree) setCurrentFolder(rootTree);
  };

  useEffect(() => {
    const loadLocal = async () => {
      // DEBUG: Inspect Raw DB
      try {
        const rawBooks = await downloadManager.getAllDownloads();
        console.log("DEBUG: RAW IDB CONTENTS:", rawBooks);
        if (rawBooks.length > 0) {
          console.log("DEBUG: First Book FolderPath:", rawBooks[0].folderPath);
        } else {
          console.log("DEBUG: IDB IS EMPTY!");
        }
      } catch (e) { console.error("DEBUG: Failed to read IDB", e); }

      // 1. Get Tree
      const allDownloads = await downloadManager.getAllDownloads();
      const tree = await downloadManager.getLibraryTree();
      setRootTree(tree);

      // DIAGNOSTIC CHECK
      let treeItems = 0;
      const count = (n) => { treeItems += n.items.length; n.children.forEach(count); };
      count(tree);

      console.log(`DIAGNOSTIC: IDB=${allDownloads.length}, Tree=${treeItems}`);

      if (allDownloads.length > 0 && treeItems === 0) {
        showToast(`Error: ${allDownloads.length} items in DB but 0 in Tree!`, "error");
      } else if (allDownloads.length > 0) {
        // showToast(`Loaded ${treeItems} books. (DB: ${allDownloads.length})`, "info");
      }


      // 2. Restore Cached Background or Pick New Random
      try {
        const cachedId = localStorage.getItem('bg_cover_id');
        let bgBlobUrl = null;

        // Try Cache First
        if (cachedId) {
          const book = await downloadManager.getBook(cachedId);
          if (book && book.blob) {
            bgBlobUrl = URL.createObjectURL(book.blob);
          }
        }

        // If no cache or invalid, pick random
        if (!bgBlobUrl) {
          const allBooks = await downloadManager.getAllDownloads();
          if (allBooks.length > 0) {
            const randomBook = allBooks[Math.floor(Math.random() * allBooks.length)];
            if (randomBook.blob) {
              bgBlobUrl = URL.createObjectURL(randomBook.blob);
              localStorage.setItem('bg_cover_id', randomBook.id);
            }
          }
        }

        if (bgBlobUrl) setBgImage(bgBlobUrl);

      } catch (e) {
        console.error("Failed to load background", e);
      }

      // 3. Set Current Folder
      setCurrentFolder(tree);
    };

    loadLocal();

    // Subscribe to changes (e.g. new downloads)
    const unsub = downloadManager.subscribe(() => loadLocal());

    // Listen for Seeder updates
    const onLibraryUpdate = () => loadLocal();
    window.addEventListener('library-updated', onLibraryUpdate);

    // Listen for Generic Toasts (e.g. from Seeder)
    const onAppToast = (e) => {
      if (e.detail && e.detail.message) {
        showToast(e.detail.message, e.detail.type || 'info');
      }
    };
    window.addEventListener('app-toast', onAppToast);

    return () => {
      unsub();
      window.removeEventListener('library-updated', onLibraryUpdate);
      window.removeEventListener('app-toast', onAppToast);
    };
  }, []);

  // Folder Preview Logic: Auto-select first book
  useEffect(() => {
    // Logic: If in a specific Folder OR Specific Library (selectedTab !== "Tutte")
    // If NO preview book set, set it to the first available item.

    // 1. Get candidate items
    let candidates = [];
    if (folderStack.length > 0) {
      // Deep navigation
      candidates = currentFolder?.items || [];
    } else if (selectedTab !== "Tutte") {
      // Top Level Library View
      candidates = displayContent.items || [];
    }

    // 2. Set Preview if needed
    if (candidates.length > 0) {
      // Only set if we don't have one (or it's not in the list? No, sticky selection is fine usually, but user wants default)
      // If we switch tabs, previewBook needs to reset or update.
      // Let's force update if the current previewBook is NOT in the new list to avoid showing book from Lib A in Lib B preview
      const isValid = previewBook && candidates.some(i => i.id === previewBook.id);

      if (!previewBook || !isValid) {
        setPreviewBook(candidates[0]);
      }
    } else {
      // No candidates? Clear it unless we are in "Tutte" where history takes over
      if (selectedTab !== "Tutte" || folderStack.length > 0) {
        setPreviewBook(null);
      }
    }
  }, [currentFolder, folderStack.length, selectedTab, displayContent]);

  const startReadingPreview = () => {
    if (previewBook) openBook(previewBook);
  };

  const handleGridBookClick = (book) => {
    // If in Folder OR Single Library View (Not "Tutte"), update Preview
    if (folderStack.length > 0 || selectedTab !== "Tutte") {
      setPreviewBook(book);
    } else {
      // Root "Tutte" View: Open Reader directly (History view usually doesn't need preview update)
      openBook(book);
    }
  };

  // Sync currentFolder when rootTree updates (e.g. after loadLocal)
  // This prevents the "No content found" issue when starting fresh
  useEffect(() => {
    if (rootTree && folderStack.length === 0) {
      setCurrentFolder(rootTree);
    }
  }, [rootTree, folderStack.length]);

  const enterFolder = (folder) => {
    if (!folder) return;
    setFolderStack(prev => [...prev, currentFolder || rootTree]); // Fallback to rootTree if current is somehow null
    setCurrentFolder(folder);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (folderStack.length > 0) {
      const prev = folderStack[folderStack.length - 1];
      setFolderStack(prevStack => prevStack.slice(0, -1));
      if (prev) setCurrentFolder(prev);
    } else {
      // Fallback for weird state
      if (rootTree) setCurrentFolder(rootTree);
    }
  };



  if (!rootTree) return <div className="p-10 text-center text-white/50">Loading Offline Library...</div>;

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      {bgImage && (
        <div className="fixed inset-0 z-0 overflow-hidden">
          <img
            src={bgImage}
            className="w-full h-full object-cover blur-2xl opacity-40 scale-105 pointer-events-none transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        </div>
      )}
      {/* 2. Sub-Header Area (Sticky below global nav)
          Global Nav is roughly: SafeTop + 20px (pt) + Height (~50px) + pb-4 ≈ 100px.
          We push sticky header to top-32 (~128px) to be safe.
      */}
      <div
        className="sticky z-40 bg-transparent flex justify-center pointer-events-none transition-all duration-300 pb-4"
        style={{ top: `${config?.librariesBarTop ?? 105}px` }}
      >
        <div className="pointer-events-auto flex items-center justify-between px-2 py-1 mx-4 transition-all duration-300"
          style={{
            borderRadius: '9999px',
            backgroundColor: 'rgba(28, 28, 30, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            gap: `${config?.gap ?? 4}px`,
            padding: `${config?.padding ?? 4}px`,
            // Fixed width relative to viewport based on margins
            width: `calc(100vw - ${(config?.librariesBarSideMargin ?? 32) * 2}px)`,
            marginLeft: `${config?.librariesBarSideMargin ?? 32}px`,
            marginRight: `${config?.librariesBarSideMargin ?? 32}px`,
            minWidth: '320px', // Ensure minimum sizing
            maxWidth: '100vw', // Override previous 95vw
            overflow: 'visible', // ALLOW MENU TO OVERFLOW
            position: 'relative', // Context for absolute bg
            height: `${config?.librariesBarHeight ?? 64}px`, // Configurable Height
          }}
        >
          {/* Dynamic Background Collage - Clipped to Shape */}
          <div className="absolute inset-0 z-0 flex opacity-20 pointer-events-none overflow-hidden" style={{ borderRadius: '9999px' }}>
            {backgroundCovers.length > 0 ? backgroundCovers.map((url, i) => (
              <div key={i} className="flex-1 h-full relative overflow-hidden">
                <AuthImage src={url} className="w-full h-full object-cover blur-[2px] scale-150 grayscale" />
              </div>
            )) : <div className="w-full h-full bg-white/5" />}
            <div className="absolute inset-0 bg-[#1C1C1E]/80 mix-blend-multiply" />
          </div>

          {/* Content Overlay */}
          {/* Content Overlay */}
          <div className="relative z-10 flex items-center justify-between w-full h-full pr-1">
            <div className="flex-1 flex items-center min-w-0 mr-2 h-full">
              {folderStack.length === 0 ? (
                <div className="flex items-center justify-between gap-4 flex-1">
                  <div className="flex items-center gap-4 overflow-hidden flex-1 pl-4">
                    <h1 className="text-xl font-bold text-white truncate drop-shadow-lg">
                      {currentFolder?.name === 'Root' ? 'Libreria' : currentFolder?.name}
                    </h1>
                  </div>

                  <PillFilterBar
                    tabs={tabs}
                    selectedTab={selectedTab}
                    onSelect={handleTabSelect}
                    config={config}
                  />
                </div>
              ) : (
                /* NEW FOLDER NAV BAR */
                <div className="relative flex items-center justify-between w-full h-full min-h-[44px]">
                  {/* Left: Back Button */}
                  <button
                    onClick={handleBack}
                    className="group p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors z-20"
                  >
                    <div className="flex items-center gap-1 text-white/70 group-hover:text-white transition-colors">
                      <ChevronLeft size={24} />
                      <span className="font-medium">Back</span>
                    </div>
                  </button>

                  {/* Center: Title <Library> - <Folder> */}
                  <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                    <span className="text-lg font-bold text-white truncate max-w-[60%] drop-shadow-md">
                      <span className="text-white/60 font-medium mr-2">
                        {(selectedTab !== "Tutte" ? selectedTab : (currentFolder?._libName || folderStack[0]?._libName)) || "Library"}
                      </span>
                      -
                      <span className="ml-2">
                        {currentFolder?.name}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Shared Context Menu */}
            <div className="relative z-[100]">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center justify-center transition-opacity hover:opacity-80 rounded-none bg-white/5 hover:bg-white/10 rounded-full"
                style={{
                  width: `${config?.localMenuTriggerSize * 1.5}px`,
                  height: `${config?.localMenuTriggerSize * 1.5}px`,
                  borderRadius: '50%'
                }}
              >
                <MoreHorizontal size={config?.localMenuTriggerSize} className="text-white" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  {!isSelectionMode && <div className="fixed inset-0 z-[99]" onClick={() => setShowMenu(false)} />}
                  <div
                    className="absolute top-full right-0 mt-2 bg-[#1C1C1E]/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-[101] animate-in fade-in zoom-in-95 origin-top-right"
                    style={{
                      width: `${config?.localMenuWidth ?? 200}px`,
                      height: `${config?.localMenuHeight ?? 200}px`,
                      padding: `${config?.localMenuPadding ?? 8}px`,
                      transform: `translate(${config?.localMenuX ?? 0}px, ${config?.localMenuY ?? 0}px)`
                    }}
                  >
                    <div className="flex flex-col h-full" style={{ gap: `${config?.localMenuItemGap}px` }}>
                      <button
                        onClick={handleToggleSelect}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${isSelectionMode ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-white/10 text-white'}`}
                      >
                        <CheckSquare size={16} />
                        <span className="text-sm font-medium">Item Select {selectedItems.size > 0 && `(${selectedItems.size})`}</span>
                      </button>

                      <button
                        onClick={handleCopy}
                        disabled={selectedItems.size === 0}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Copy size={16} />
                        <span className="text-sm font-medium">Copy</span>
                      </button>

                      <button
                        onClick={handleCut}
                        disabled={selectedItems.size === 0}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Scissors size={16} />
                        <span className="text-sm font-medium">Cut</span>
                      </button>

                      <button
                        onClick={handlePaste}
                        disabled={!clipboard}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Clipboard size={16} />
                        <span className="text-sm font-medium">Paste {clipboard && `(${clipboard.items.length})`}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Delete ${selectedItems.size > 0 ? selectedItems.size + ' items' : 'current selection'}? This cannot be undone.`)) {
                            handleDelete();
                          }
                        }}
                        disabled={selectedItems.size === 0 && !isSelectionMode}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-red-400 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Trash2 size={16} />
                        <span className="text-sm font-medium">Delete</span>
                      </button>

                      <button
                        onClick={handleCreateFolder}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white transition-colors mt-auto border-t border-white/10 pt-3"
                      >
                        <FolderPlus size={16} />
                        <span className="text-sm font-medium">Create Folder</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* 2. Main Content */}
      <div className="p-4 space-y-8">

        {/* Featured Carousel OR Folder Preview */}
        {/* Continue Reading (History) Layout */}
        {
          (folderStack.length === 0 && (readingHistory.length > 0 || featuredBooks.length > 0)) || (folderStack.length > 0 && previewBook) ? (
            <div style={{ marginTop: `${config?.continueReadingMargin ?? 0}px` }}>
              {/* Header */}
              <div className="flex items-center justify-between px-2 mb-4 transition-all duration-300" style={{
                marginLeft: config?.crSideMargin ? `${config.crSideMargin}px` : '0px',
                marginRight: config?.crSideMargin ? `${config.crSideMargin}px` : '0px',
              }}>
                <h3 className="font-bold text-white" style={{ fontSize: `${config?.crFontSize ?? 16}px` }}>
                  {/* Logic: Root (Tutte) -> "Continue reading...". Library/Folder -> "Preview" */}
                  {folderStack.length > 0 || selectedTab !== "Tutte" ? "Preview..." : "Continue reading..."}
                </h3>
              </div>

              {/* No wrapper div here, let Carousel handle its own margins */}
              <ContinueReadingCarousel
                books={
                  folderStack.length > 0 && previewBook
                    ? [previewBook]
                    : (readingHistory.length > 0 ? readingHistory : featuredBooks)
                }
                onRead={openBook}
                config={config}
              />
            </div>
          ) : null
        }

        {/* Breadcrumbs removed (moved to top logic if needed, but requested to remove "Back" button) */}

        {/* Grid */}
        {
          displayContent.children.length === 0 && displayContent.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <Book size={48} className="mb-4 text-white/20" />
              <p>No content found.</p>
            </div>
          ) : (
            /* GRID CONTAINER (GLASS BOX) */
            <div
              className="relative group rounded-xl overflow-hidden shadow-2xl bg-[#1C1C1E] border border-white/10 transition-all duration-300"
              style={{
                height: `${config?.gridHeight ?? 600}px`,
                marginTop: `${config?.gridMargin ?? 32}px`,
                marginLeft: `${config?.gridSideMargin ?? 0}px`,
                marginRight: `${config?.gridSideMargin ?? 0}px`,
              }}
            >
              {/* Background Blur */}
              <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-[#1C1C1E] via-[#1C1C1E]/80 to-transparent" />
                <div className="absolute inset-0 backdrop-blur-3xl bg-black/20" />
              </div>

              {/* EMPTY STATE / LOADING */}
              {(!rootTree || (displayContent.children.length === 0 && displayContent.items.length === 0)) && (
                <div className="relative z-10 flex flex-col items-center justify-center h-full text-white/50 animate-in fade-in zoom-in-95">
                  {!rootTree ? (
                    <>
                      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-blue-500 animate-spin mb-4" />
                      <span>Loading Library...</span>
                    </>
                  ) : (
                    <>
                      <Book size={48} className="mb-4 opacity-50" />
                      <h3 className="text-xl font-bold text-white mb-2">No Books Found</h3>
                      <p className="max-w-xs text-center text-sm">
                        Import content from your server to get started.
                      </p>
                      <Link to="/app/import" className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white font-medium transition-colors">
                        Go to Import
                      </Link>
                    </>
                  )}
                </div>
              )}

              {/* SCROLLABLE INNER CONTENT */}
              <div
                className="relative z-10 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/20"
                style={{
                  padding: `${config?.gridInnerPadding ?? 24}px`
                }}
              >
                <div
                  className="grid transition-all duration-300"
                  style={{
                    gridTemplateColumns: `repeat(${config?.gridColumns || 5}, minmax(0, 1fr))`,
                    gap: `${(config?.gap ?? 4) * 5}px`,
                  }}
                >
                  {/* Folders */}
                  {displayContent.children.map(child => {
                    // RESOLVE FOLDER COVER
                    // offlineTree.js now bubbles up 'coverUrl' from children to the folder node.
                    // So we can strictly rely on child.coverUrl (which is a Blob URL).
                    const folderCover = child.coverUrl || null;

                    return (
                      <div key={child.id} onClick={() => {
                        if (isSelectionMode) {
                          return;
                        }
                        enterFolder(child);
                      }} className="cursor-pointer relative">
                        <ComicBox
                          title={child.name}
                          itemCount={child.items.length + child.children.length}
                          variant="folder"
                          coverUrl={folderCover} // Pass resolved cover
                        />
                      </div>
                    )
                  })}

                  {/* Books */}
                  {displayContent.items.map((item) => (
                    <LocalLibraryItem
                      key={item.id}
                      item={item}
                      // Selection Props
                      selectionMode={isSelectionMode}
                      isSelected={selectedItems.has(item.id)}
                      onToggleSelect={() => handleSelectItem(item.id)}

                      onFolderClick={enterFolder}
                      onBookClick={handleGridBookClick}
                    />
                  ))}
                </div>
              </div>
            </div>

          )
        }
      </div >

      {/* Reader Overlay */}
      {
        readingBook && (
          <LocalReader
            bookId={readingBook.id}
            onClose={() => setReadingBook(null)}
            config={config}
          />
        )
      }
    </div >
  );
};

// -----------------------------------------------------------------------------
// REMOTE LIBRARY VIEW (IMPORT)
// -----------------------------------------------------------------------------
const RemoteLibrary = ({ config }) => {
  const { komgaService, connectionStatus, settings, cache, updateCache } = useApp(); // Access settings for server name/url

  // Cache Key for Libraries List
  const CACHE_KEY_LIBS = 'libraries-list';
  const memoryCache = cache[CACHE_KEY_LIBS];

  const [libraries, setLibraries] = useState(memoryCache || []);
  const [loading, setLoading] = useState(!memoryCache || memoryCache.length === 0);

  // Initialize BG from memory cache immediately if available
  const [bgImage, setBgImage] = useState(() => {
    if (memoryCache && memoryCache.length > 0) {
      const all = memoryCache.flatMap(l => l.covers || []);
      if (all.length > 0) return all[Math.floor(Math.random() * all.length)];
    }
    return null;
  });

  // Defaults if config not ready
  // Standardize Top Bar height to match LocalLibrary (config.librariesBarTop or ~128px is too low for this, we want it at top)
  // Actually LocalLibrary puts the sub-bar at librariesBarTop. The main header is global.
  // We want the "Server Status" bar to be consistent. Let's place it at a fixed top offset + config.

  const serverTop = config?.serverBarTop ?? 30; // Customizeable
  const gridMargin = config?.gridTop ?? 100;

  useEffect(() => {
    if (!komgaService) return; // Ensure komgaService is available before proceeding

    const fetchLibs = async () => {
      // Determine if we have data visually available right now
      // Logic: libraries state (local) OR memoryCache (global)
      // If we have data, we must NOT show spinner, and we must NOT degrade to empty.
      const localHasData = libraries.length > 0;
      const globalHasData = memoryCache && memoryCache.length > 0;
      const hasData = localHasData || globalHasData;

      if (hasData) {
        setLoading(false);
      } else {
        setLoading(true);
      }

      // 1. Check IDB (Async) - Hydration step if memory was empty
      let cachedFromIDB = [];
      try {
        cachedFromIDB = await cacheManager.get(CACHE_KEY_LIBS) || [];
        if (cachedFromIDB.length > 0) {
          // If we have IDB data, populate state + memory immediately
          setLibraries(cachedFromIDB);
          updateCache(CACHE_KEY_LIBS, cachedFromIDB);
          setLoading(false); // Stop spinner if it was running

          // Background Bg
          const allCovers = cachedFromIDB.flatMap(l => l.covers || []);
          if (allCovers.length > 0) {
            setBgImage(allCovers[Math.floor(Math.random() * allCovers.length)]);
          }
        }
      } catch (e) {
        console.warn("IDB Read Error", e);
      }

      // 2. Decide if we need Network Fetch
      // Repair logic:
      const currentLibs = cachedFromIDB.length > 0 ? cachedFromIDB : (memoryCache || []);
      const needsRepair = currentLibs.some(l => !l.covers || l.covers.length === 0);
      const isTotallyEmpty = currentLibs.length === 0;

      if (!isTotallyEmpty && !needsRepair) {
        // We have valid data. Respect "Instant Load". 
        // Do not auto-fetch unless user pulls/reloads.
        return;
      }

      // 3. Network Fetch
      if (connectionStatus !== 'connected') {
        if (connectionStatus === 'error' && isTotallyEmpty) setLoading(false);
        return;
      }

      // If we are here, we are fetching.
      // If we have data, do NOT set loading=true (silent background refresh).
      // Only set loading if empty.
      if (isTotallyEmpty) setLoading(true);

      try {
        const fetchPromise = komgaService.getLibraries();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000));

        const libs = await Promise.race([fetchPromise, timeoutPromise]);

        // Fetch Covers (SEQUENTIAL to prevent Network Congestion/Freeze)
        const librariesWithCovers = [];
        for (const lib of libs) {
          // Check if we already have valid covers for this library
          const existing = currentLibs.find(c => String(c.id) === String(lib.id));
          if (existing && existing.covers && existing.covers.length > 0) {
            librariesWithCovers.push({ ...lib, covers: existing.covers });
            continue;
          }

          try {
            // Fetch Series for this lib
            // Increased timeout to 10s to be safe
            const seriesPromise = komgaService.getSeries(lib.id, 0, 3);
            const coverTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));

            const series = await Promise.race([seriesPromise, coverTimeout]);
            const covers = series.content.map(s => `${komgaService.baseUrl}/series/${s.id}/thumbnail`);

            if (covers.length === 0 && existing && existing.covers) {
              // Keep old covers if new fetch is empty
              librariesWithCovers.push({ ...lib, covers: existing.covers });
            } else {
              librariesWithCovers.push({ ...lib, covers });
            }
          } catch (e) {
            console.warn(`Failed to fetch covers for ${lib.name}:`, e);
            // Fallback to cache if possible
            if (existing && existing.covers) {
              librariesWithCovers.push({ ...lib, covers: existing.covers });
            } else {
              librariesWithCovers.push({ ...lib, covers: [] });
            }
          }
        }

        setLibraries(librariesWithCovers);
        updateCache(CACHE_KEY_LIBS, librariesWithCovers);

        const allCovers = librariesWithCovers.flatMap(l => l.covers);
        if (allCovers.length > 0) setBgImage(allCovers[Math.floor(Math.random() * allCovers.length)]);

      } catch (err) {
        console.error("Fetch Error:", err);
        // Do not wipe state on error
      } finally {
        if (isTotallyEmpty) setLoading(false);
      }
    };
    fetchLibs();
  }, [komgaService, connectionStatus]);

  // REMOVED BLOCKING CHECK to prevent black screen on flakey connection
  // if (connectionStatus !== 'connected') {... }

  // Parse Server Name for Header (from settings or default)
  let serverName = 'Komga Server';
  try {
    if (settings?.serverUrl) {
      serverName = new URL(settings.serverUrl).hostname;
    }
  } catch (e) {
    serverName = settings?.serverUrl || 'Komga Server';
  }

  // Generate random covers for Header Background (take from loaded libraries if available)
  // We can just use the first few covers we have.
  const headerCovers = libraries.flatMap(l => l.covers).slice(0, 12); // Take 12 for collage

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-[#121212] relative">
      {/* DownloadProgress moved to MainLayout */}

      {/* 0. Page Background (Blurred Random Cover) */}
      {/* "invece la pagina con tutte le librerie deve avere una copertina a caso come sfondo blurred" */}
      {bgImage && (
        <div className="fixed inset-0 z-0 overflow-hidden">
          <AuthImage
            src={bgImage}
            className="w-full h-full object-cover blur-xl opacity-80 scale-105 pointer-events-none"
          />
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />
        </div>
      )}

      {/* 1. Server Status Header (iOS Style - Floating)
          Uses config.serverBarTop for positioning
      */}
      <div
        className="sticky z-30 transition-all duration-300 w-full flex justify-center"
        style={{ top: `${serverTop}px`, marginTop: '20px' }}
      >

        {/* The Floating Bar */}
        <div className="relative overflow-hidden rounded-2xl shadow-xl border border-white/10 bg-[#1C1C1E]/80 backdrop-blur-md h-16 w-[96%] flex-shrink-0">

          {/* Header Background Collage (Random Covers) - INSIDE the bar */}
          <div className="absolute inset-0 z-0 flex opacity-80">
            {headerCovers.map((src, i) => (
              <div key={i} className="flex-1 h-full relative overflow-hidden">
                <AuthImage src={src} className="w-full h-full object-cover blur-[0.5px] scale-110 opacity-70" />
              </div>
            ))}
            {/* Gradient overlay reduced for visibility */}
            <div className="absolute inset-0 bg-black/30" />
          </div>

          {/* Top Bar Content */}
          <div className="relative z-10 flex items-center justify-between h-full px-4">

            {/* Left: Server Info */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-lg shadow-green-900/20">
                <HardDrive size={24} className="text-green-400" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[11px] text-white/50 font-bold tracking-wider uppercase mb-0.5">SERVER NAME</span>
                <span className="text-xl font-bold text-white leading-none tracking-tight">{serverName}</span>
              </div>
            </div>

            {/* Right: Status Indicators */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { cacheManager.delete(CACHE_KEY_LIBS); window.location.reload(); }}
                className="p-2.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                title="Refresh Libraries"
              >
                <RefreshCw size={18} /> {/* Increased from 16 (+~10%) */}
              </button>

              {connectionStatus === 'connected' && libraries.length > 0 ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-white/10 backdrop-blur-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  <span className="text-[10px] font-bold text-green-500">On-Line</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-red-500/20 backdrop-blur-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <span className="text-[10px] font-bold text-red-500">{loading ? 'Connecting...' : 'Off-Line'}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 2. Main Content Area */}
      {/* Dynamic Spacer based on gridConfig */}
      <div
        className="w-full pointer-events-none"
        style={{ height: `${gridMargin}px` }}
      />

      <div className="flex justify-center w-full relative z-10">
        <div className="w-[96%]">

          {loading ? (
            <div className="flex justify-center pt-20">
              <RefreshCw className="animate-spin text-blue-500 w-10 h-10" />
            </div>
          ) : (
            // GLASS BOX WRAPPER
            <div
              className="relative group rounded-xl overflow-hidden shadow-2xl bg-[#1C1C1E] border border-white/10 transition-all duration-300"
              style={{
                minHeight: '600px',
                padding: `${config?.gridInnerPadding ?? 24}px`
              }}
            >
              {/* Inner Blur */}
              <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-[#1C1C1E] via-[#1C1C1E]/80 to-transparent" />
                <div className="absolute inset-0 backdrop-blur-3xl bg-black/20" />
              </div>

              <div className="relative z-10 w-full h-full">
                <div
                  className="grid gap-6 transition-all duration-300"
                  style={{
                    gridTemplateColumns: `repeat(${config?.gridColumns || 5}, minmax(0, 1fr))`
                  }}
                >
                  {libraries.map(lib => (
                    <Link
                      key={lib.id}
                      to={`/app/import/library/${lib.id}`}
                      state={{ libName: lib.name }}
                      className="block w-full"
                    >
                      <ComicBox
                        title={lib.name}
                        covers={lib.covers}
                        color="#3b82f6" // Pass blue intent if needed by component logic not hardcoded
                        variant="folder"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>

  );
};

// -----------------------------------------------------------------------------
// REMOTE SERIES LIST (With Folder Toggle)
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// REMOTE SERIES LIST (With Folder Toggle)
// -----------------------------------------------------------------------------
const RemoteSeriesList = ({ config }) => {
  const { libId } = useParams();
  const { komgaService, showToast, cache, updateCache } = useApp();
  const navigate = useNavigate();
  const location = useLocation(); // Added location

  // PERSISTENCE: Save this path and Library Name (Session only)
  useEffect(() => {
    sessionStorage.setItem('lastImportPath', location.pathname);
  }, [location.pathname]);



  // Instant Cache Check
  const cacheKey = `series-${libId}`;
  // Removed direct `cache[cacheKey]` check here, will use `cacheManager.get` in useEffect

  const [series, setSeries] = useState([]); // Initialize as empty, will load from cache/fetch
  // const [loading, setLoading] = useState(true); // LEGACY REMOVED
  const [libraryName, setLibraryName] = useState(() => {
    return location.state?.libName || sessionStorage.getItem('currentLibName') || "";
  });

  useEffect(() => {
    if (libraryName) {
      sessionStorage.setItem('currentLibName', libraryName);
    }
  }, [libraryName]);

  const subBarTop = config?.libraryBarTop ?? 105;
  const gridMargin = config?.libraryGridMargin ?? 110;
  const sideMargin = config?.libraryGridSideMargin ?? 0;

  // FileSystem State (New Universal)
  const [currentPath, setCurrentPath] = useState(null);
  const [fileSystemData, setFileSystemData] = useState({ directories: [], files: [] });
  const [loadingFS, setLoadingFS] = useState(false);
  const [libraryRoot, setLibraryRoot] = useState(null);

  // --- LEGACY COMPATIBILITY (Prevents ReferenceError) ---
  const [useFolderView, setUseFolderView] = useState(true);
  const currentFolder = currentPath ? { name: currentPath.split('/').pop() } : { name: 'Root' };
  const folderStack = useMemo(() => {
    if (!currentPath) return [];

    // Normalize: Remove Library Root from the visual stack
    let displayPath = currentPath;
    if (libraryRoot && currentPath.startsWith(libraryRoot)) {
      displayPath = currentPath.substring(libraryRoot.length);
    }

    return displayPath.split(/[/\\]/).filter(Boolean).map(p => ({ name: p }));
  }, [currentPath, libraryRoot]);
  const [downloadDialog, setDownloadDialog] = useState({ isOpen: false, target: null, onConfirm: null });
  const [bgImage, setBgImage] = useState(null);

  // SELECTION MODE STATE
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showMenu, setShowMenu] = useState(false);

  // Selection Handlers
  const toggleSelection = (id) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
    setShowMenu(false);
  };

  // 1. Init: Initialize Provider & Get Root
  useEffect(() => {
    const init = async () => {
      setLoadingFS(true);
      try {
        // 1. Initialize Provider (Tree) & Fetch Metadata internally
        // Note: LibraryManager is already hydrated with credentials by AppContext
        await libraryManager.provider.initialize(libId);

        // 2. Retrieve Library Name from Provider (fetched internally)
        const name = libraryManager.provider.libraryName || "Unknown Library";
        setLibraryName(name);
        setLibraryRoot(libraryManager.provider.libraryRoot);

        // 3. Update LibraryManager config with the discovered name
        // This ensures subsequent downloads use "Library/{Name}/..."
        libraryManager.config.name = name;

        // Restore Path (ID Mode Fix)
        // Ensure legacy filesystem paths don't crash the ID-browse API
        let startPath = sessionStorage.getItem(`lastPath-${libId}`);
        if (!startPath || startPath === lib.root || startPath.startsWith('/') || startPath.includes('\\')) {
          startPath = "";
        }
        setCurrentPath(startPath);
      } catch (e) {
        console.error("Browser Init Failed", e);
        showToast("Failed to connect to library provider", "error");
        setLoadingFS(false);
      }
    };
    init();
  }, [libId]);

  // Safety Timeout
  useEffect(() => {
    if (loadingFS) {
      const t = setTimeout(() => {
        setLoadingFS(false);
      }, 5000);
    }
  }, [loadingFS]);

  // 2. Navigation
  useEffect(() => {
    // If path is null (initial load), wait.
    if (currentPath === null) return;

    let isMounted = true;

    const fetchFS = async () => {
      // 1. Immediate UI Feedback: Loading ON, Clear Stale Data
      setLoadingFS(true);
      setFileSystemData({ directories: [], files: [] }); // Prevent stale view

      try {
        console.log(`🐛 Browser: Navigating to ${currentPath}`);

        // 2. Fetch Data
        const data = await libraryManager.browse(currentPath);

        // 3. Update State if still mounted
        if (isMounted) {
          setFileSystemData(data);
          sessionStorage.setItem(`lastPath-${libId}`, currentPath);
        }
      } catch (e) {
        console.error("❌ Debug: Browse Failed for path:", currentPath);
        console.error("❌ Debug Error Details:", e);
      } finally {
        if (isMounted) setLoadingFS(false);
      }
    };

    fetchFS();

    return () => { isMounted = false; };
  }, [currentPath, libraryRoot, libId]);

  const handleEnterFolder = (path) => {
    setCurrentPath(path);
  };

  // Navigation Logic
  const handleUpLevel = () => {
    // If we have a provider-supplied parent, use it
    if (fileSystemData.parent) {
      setCurrentPath(fileSystemData.parent);
      return;
    }

    // ID-based fallback:
    // If we are deep in IDs, determining "parent" is hard without a stack.
    // We can rely on a crude history or just go Root.
    // For this strict ID-refactor, if we lack parent ID, we go Root.
    if (currentPath && currentPath !== "") {
      setCurrentPath(""); // Reset to Root
    } else {
      navigate('/app/import'); // Exit to Library List
    }
  };

  const handleBack = () => {
    // History pop logic could go here, but for now UpLevel is safer
    handleUpLevel();
  };

  // 3. Render Items
  const displayItemsFS = useMemo(() => {
    const dirs = (fileSystemData.directories || []).map(d => ({
      ...d, // Preserve Provider Injected Props (thumbnailUrl, thumbId, thumbType)
      id: d.id || d.path, // Prefer Provider ID (which handles Real vs Virtual), fallback to path
      name: d.name,
      type: 'folder',
      path: d.path,
    }));

    const files = (fileSystemData.files || [])
      // Relaxed Filter: Allow uppercase and make sure we don't miss anything.
      .filter(f => /\.(cbz|cbr|epub|pdf|zip|rar)$/i.test(f.name))
      .map(f => ({
        ...f, // Preserve Provider Injected Props
        id: f.id,
        name: f.name,
        type: 'book',
        path: f.path,
        size: f.size
      }));

    // Debug: Log if we have files but they are being filtered?
    if (fileSystemData.files && fileSystemData.files.length > 0 && files.length === 0) {
      console.warn("⚠️ Files exist but were all filtered out!", fileSystemData.files);
    }

    // Simple sort by name
    return [...dirs, ...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [fileSystemData]);



  // JSX RENDER
  // ...




  // Handle Single Series Download (from Series List View)
  const handleDownloadSeries = (seriesItem) => {
    // 1. Build Correct Path
    const stackNames = folderStack
      .filter(n => n.name !== 'Root')
      .map(n => n.name);

    // Ensure we have a library name. If we are deep link, we might rely on state or fetch.
    // In RemoteSeriesList, 'libraryName' is available in state.
    const libPrefix = libraryName || "UnknownLibrary";

    // Path: Library / Folder / ... / SeriesName
    const seriesPath = [libPrefix, ...stackNames, seriesItem.metadata?.title || seriesItem.name].filter(Boolean).join("/");

    // 2. Open Dialog with Synthetic Node
    setDownloadDialog({
      isOpen: true,
      target: {
        name: seriesItem.metadata?.title || seriesItem.name,
        series: [seriesItem], // Treat this series as the content
        children: []
      },
      onConfirm: async (targetNode, reportProgress) => {
        try {
          if (!komgaService) throw new Error("Komga Service unavailable");

          // TIMEOUT PROTECTION (30s)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          let books = [];

          try {
            // Fetch all books for the series
            const res = await fetch(`${komgaService.baseUrl}/series/${seriesItem.id}/books?size=2000`, {
              headers: komgaService.headers,
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
            const data = await res.json();
            books = data.content || [];
          } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') {
              throw new Error("Analysis timed out (30s). Series is too large or server is slow.");
            }
            throw fetchErr;
          }

          if (books.length === 0) throw new Error("No books found");

          const total = books.length;
          let processed = 0;

          // Add composite task for the series
          downloadManager.addCompositeTask({
            id: seriesItem.id,
            name: seriesItem.metadata?.title || seriesItem.name,
            total: total,
            progress: 0
          });

          // Queue downloads
          for (const book of books) {
            const exists = await downloadManager.isDownloaded(book.id);
            if (!exists) {
              const downloadFn = async () => {
                const res = await fetch(`${komgaService.baseUrl}/books/${book.id}/file`, { headers: komgaService.headers });
                if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                return await res.blob();
              };

              // Fetch Filename - Swift Logic Replica
              // Priority: 1. HEAD (Golden) 2. URL (Silver) 3. book.name (Bronze - Swift Default)
              const getFilename = async () => {
                // 1. Try HEAD for Content-Disposition with Timeout
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 2000);

                  const head = await fetch(`${komgaService.baseUrl}/books/${book.id}/file`, {
                    method: 'HEAD',
                    headers: komgaService.headers,
                    signal: controller.signal
                  });
                  clearTimeout(timeoutId);

                  const disp = head.headers.get('Content-Disposition');
                  if (disp && disp.includes('filename=')) {
                    const filename = disp.split('filename=')[1].replace(/["']/g, "").trim();
                    if (filename) return filename;
                  }
                } catch (e) { console.warn("HEAD check failed", e); }

                // 2. Try URL (Server provided)
                if (book.url) {
                  const parts = book.url.split('/');
                  const last = parts[parts.length - 1];
                  if (last.toLowerCase().endsWith('.cbz') || last.toLowerCase().endsWith('.cbr')) {
                    return decodeURIComponent(last);
                  }
                }

                // 3. Fallback: Use book.name + extension (Swift App Logic)
                let safeName = book.name;
                if (!safeName.toLowerCase().endsWith('.cbz') && !safeName.toLowerCase().endsWith('.cbr')) {
                  safeName += ".cbz";
                }
                return safeName;
              };

              const realFilename = await getFilename();

              if (!realFilename) {
                console.error(`❌ Download Skipped: No filename found for ${book.name}`);
                showToast(`Could not determine filename for ${book.name}`, 'error');
                continue;
              }

              console.log(`✅ Queueing ${book.name} as ${realFilename}`);
              // Debug Metadata Passing
              console.log("Download Metadata Check:", {
                lib: libraryName,
                series: seriesItem.name,
                pub: seriesItem.metadata?.publisher,
                meta: seriesItem.metadata
              });

              downloadManager.addToQueue(
                book.id,
                book.metadata?.title || book.name,
                downloadFn,
                seriesPath,
                `${komgaService.baseUrl}/books/${book.id}/thumbnail`,
                {
                  libraryName: libraryName || "Unknown Library",
                  publisher: seriesItem.metadata?.publisher, // Saved in metadata but not path
                  seriesTitle: seriesItem.metadata?.title || seriesItem.name || "Unknown Series",
                  number: book.metadata?.number,
                  summary: book.metadata?.summary
                },
                komgaService.headers,
                realFilename
              );
            }
            processed++;
            // Don't spam progress updates for huge lists to keep UI responsive
            if (processed % 5 === 0 || processed === total) {
              reportProgress((processed / total) * 100);
            }
          }
          reportProgress(100);

        } catch (e) {
          console.error(e);
          // Crucial: Close dialog or show error in existing dialog
          // Alert is safest for now to break the freeze
          alert(`Download failed: ${e.message}`);
          setDownloadDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };


  // --- BULK DOWNLOAD LOGIC ---
  const handleBulkDownloadRequest = () => {
    // Gather selected nodes
    const targets = displayItemsFS.filter(i => selectedItems.has(i.id));

    setDownloadDialog({
      isOpen: true,
      target: targets, // Pass Array!
      isBulk: true,
      onConfirm: async (targetList, reportProgress) => {
        // Same logic as folder/series but looped over list
        let totalTasks = 0;
        let processedTasks = 0;

        // 1. Calculate Totals (Mock for now, or pre-scan?)
        // Real calculation happens inside processing usually. 
        // We can rely on recursive "collect" to count.

        // Helper to queue an item (Series or Folder)
        const queueTarget = async (item) => {
          if (item.type === 'series') {
            await handleDownloadSeries(item, true); // Pass flag to skip dialog?
            // Wait, handleDownloadSeries opens dialog. We need logic *without* dialog.
            // Refactoring needed: extract "processSeriesDownload" logic.
          } else {
            await handleDownloadFolder(item, true); // Same here.
          }
        };

        // Better: We need a "Unified Processor" that accepts a list of nodes.
        await processBulkDownload(targets, reportProgress);
      }
    });
  };

  // REFACTORED: Universal Context-Relative Download Processor
  // NOW USES libraryManager.resolveDownloadList for Recursion & Paths
  const processBulkDownload = async (targets, reportProgress) => {
    try {
      const processedList = await libraryManager.resolveDownloadList(targets);

      if (processedList.length === 0) {
        showToast("No files found to download", "info");
        return;
      }

      const batchId = `Download-${Date.now()}`;
      downloadManager.addCompositeTask({
        id: batchId,
        name: `Importing ${targets.length} items`,
        total: processedList.length,
        progress: 0
      });

      let processed = 0;
      for (const item of processedList) {
        downloadManager.addToQueue(
          item.id,
          item.name,
          async () => {
            // Use KomgaService or simple fetch
            const res = await fetch(`${komgaService.baseUrl}/books/${item.id}/file`, {
              headers: komgaService.headers
            });
            if (!res.ok) throw new Error(`Download failed: ${res.status}`);
            return await res.blob();
          },

          item.folderPath,
          libraryManager.getThumbnailUrl({ id: item.id, type: 'book' }), // Cover
          { ...item.metadata, type: 'manual_import' }, // Metadata
          komgaService.headers, // Headers
          item.name // Filename (source filename? or book name? usually book name + cbz)
        );

        processed++;
        if (processed % 5 === 0) reportProgress((processed / processedList.length) * 100);
      }

      reportProgress(100);
      setSelectionMode(false);
      setSelectedItems(new Set());
      showToast(`Queued ${processedList.length} files`, "success");

    } catch (e) {
      console.error("Bulk Processing Failed", e);
      showToast("Failed to process selection", "error");
    }
  };

  // --- DOWNLOAD FOLDER LOGIC (Legacy / Single) ---
  const handleDownloadFolder = (node) => {
    // Re-route to Bulk logic for simplicity
    // Wrap single node as target
    setDownloadDialog({
      isOpen: true,
      target: [node],
      isBulk: true,
      onConfirm: async (t, p) => processBulkDownload([node], p)
    });
  };

  return (
    <div className="min-h-screen pb-32 bg-[#121212] relative">
      <DownloadProgress />

      {/* RESTORED: Download Confirmation Dialog */}
      <DownloadConfirmationDialog
        isOpen={downloadDialog.isOpen}
        targetNode={downloadDialog.target}
        onClose={() => setDownloadDialog({ ...downloadDialog, isOpen: false })}
        onConfirm={downloadDialog.onConfirm}
      />

      {bgImage && (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <AuthImage
            src={bgImage}
            className="w-full h-full object-cover blur-2xl opacity-40 scale-105 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Sticky Header (Floating Pill Style with BG) */}
      <div
        className="sticky z-40 transition-all duration-300 w-full flex justify-center pointer-events-none"
        style={{ top: `${subBarTop}px` }}
      >
        <div
          className="relative h-16 w-[96%] flex-shrink-0 pointer-events-auto flex items-center justify-between transition-all duration-300"
          style={{ paddingLeft: `${config?.headerSideMargin ?? 16}px`, paddingRight: `${config?.headerSideMargin ?? 16}px` }}
        >

          {/* Header Background & Border (Clipped) */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-xl border border-white/10 bg-[#1C1C1E]/90 backdrop-blur-md">
            {/* Header BG Collage (matches Server Bar) */}
            <div className="absolute inset-0 z-0 flex opacity-100">
              {series.slice(0, 10).map((s, i) => (
                <div key={s.id} className="flex-1 h-full relative overflow-hidden">
                  <AuthImage src={`${komgaService.baseUrl}/series/${s.id}/thumbnail`} className="w-full h-full object-cover blur-[2px] scale-150 opacity-80" />
                </div>
              ))}
              <div className="absolute inset-0 bg-black/30" />
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between w-full px-2">
            {/* Left: Back Only (Liquid Glass - Large) */}
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 text-white transition-all backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] active:scale-95 ml-2"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Center: Title (Large) OR Selection Count */}
            <div className="flex flex-col items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/5 pointer-events-none">
              <>
                <span className="text-xl font-light text-white drop-shadow-lg truncate w-full text-center tracking-wide">
                  {(currentFolder?.name === 'Root' || currentPath === libraryRoot) ? (libraryName || "Library") : formatLibraryTitle(currentFolder?.name)}
                </span>
                {(currentFolder?.name !== 'Root' && currentPath !== libraryRoot) && (
                  <span className="text-[9px] text-white/60 uppercase tracking-[0.2em] font-light mt-1">Folder</span>
                )}
              </>
            </div>

            {/* Right: Actions (Liquid Glass - Large & Spaced) */}
            <div className="flex items-center gap-4 mr-2 pointer-events-auto">

              {selectionMode ? (
                // SELECTION ACTIONS (X Button)
                <div className="flex items-center gap-3">
                  <button
                    onClick={exitSelectionMode}
                    className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 text-white backdrop-blur-xl border border-white/20 shadow-lg active:scale-95 transition-all"
                  >
                    <X size={22} />
                  </button>
                </div>
              ) : (
                // NORMAL ACTIONS (View Toggle)
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 bg-black/30 rounded-2xl p-2 border border-white/10 backdrop-blur-xl shadow-lg">
                    <button
                      onClick={() => setUseFolderView(true)}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${useFolderView ? 'bg-white/20 text-white shadow-inner border border-white/10' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                      title="Folder View"
                    >
                      <Folder size={18} />
                    </button>
                    <div className="w-px h-6 bg-white/10" />
                    <button
                      onClick={() => setUseFolderView(false)}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${!useFolderView ? 'bg-white/20 text-white shadow-inner border border-white/10' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                      title="List View"
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* THREE DOTS MENU */}
              <div className="relative z-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className={`relative z-[100] w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 backdrop-blur-md border ${showMenu ? 'bg-white/20 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-white/10 hover:bg-white/10 shadow-sm'}`}
                >
                  <MoreVertical size={20} className="text-white/90" />
                </button>

                {showMenu && (
                  <>
                    {!selectionMode && <div className="fixed inset-0 z-[99]" onClick={() => setShowMenu(false)} />}
                    <div
                      className="fixed top-28 right-6 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden z-[100] animate-in fade-in zoom-in-95 origin-top-right text-white"
                      style={{
                        width: `${config?.importMenuWidth ?? 320}px`,
                        height: `${config?.importMenuHeight ?? 140}px`,
                        transform: `translate(${config?.importMenuX ?? 0}px, ${config?.importMenuY ?? 0}px)`
                      }}
                    >
                      <div className="flex flex-col h-full justify-center">
                        <button
                          onClick={() => {
                            if (selectionMode) {
                              exitSelectionMode();
                              setShowMenu(false);
                            } else {
                              setSelectionMode(true);
                              // Maintain menu open
                            }
                          }}
                          className="w-full text-left hover:bg-white/10 rounded-xl text-white flex items-center justify-between transition-colors group mb-0"
                          style={{ padding: `${config?.importMenuItemPadding ?? 0}px ${config?.importMenuItemPaddingX ?? 24}px` }}
                        >
                          <span className="font-medium tracking-wide" style={{ fontSize: `${config?.importMenuFontSize ?? 16}px` }}>
                            {selectionMode ? 'Cancel Selection' : 'Select Items'} {selectedItems.size > 0 && <span className="text-white/50 ml-1">({selectedItems.size})</span>}
                          </span>
                          {selectionMode ? (
                            <X size={20} className="text-white/50 group-hover:text-white transition-colors" />
                          ) : (
                            <CheckCircle2 size={20} className="text-white/50 group-hover:text-white transition-colors" />
                          )}
                        </button>

                        {/* Tunable Gap */}
                        <div style={{ height: `${config?.importMenuGap ?? 16}px` }} />

                        <button
                          disabled={selectedItems.size === 0}
                          onClick={() => {
                            if (selectedItems.size > 0) {
                              handleBulkDownloadRequest();
                              setShowMenu(false);
                            }
                          }}
                          className={`w-full text-left rounded-xl flex items-center justify-between transition-colors group ${selectedItems.size > 0 ? 'bg-white/10 hover:bg-white/20 text-white cursor-pointer shadow-sm' : 'text-white/30 cursor-not-allowed'}`}
                          style={{ padding: `${config?.importMenuItemPadding ?? 0}px ${config?.importMenuItemPaddingX ?? 24}px` }}
                        >
                          <span className="font-medium tracking-wide" style={{ fontSize: `${config?.importMenuFontSize ?? 16}px` }}>
                            Download Selected
                          </span>
                          <DownloadCloud size={20} className={`${selectedItems.size > 0 ? 'text-white group-hover:scale-110' : 'text-white/20'} transition-all`} />
                        </button>


                      </div>
                    </div>

                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="p-4" style={{
        paddingLeft: `${sideMargin > 0 ? sideMargin : 16}px`,
        paddingRight: `${sideMargin > 0 ? sideMargin : 16}px`
      }}>
        {/* Dynamic Margin for Content Start */}
        <div style={{ marginTop: `${gridMargin}px` }}>

          {/* Grid Container (Glass) */}
          <div
            className="relative group rounded-xl overflow-hidden shadow-2xl bg-[#1C1C1E] border border-white/10 transition-all duration-300"
            style={{
              minHeight: '600px', // Ensure min height
              padding: `${config?.gridInnerPadding ?? 24}px`
            }}
          >
            {/* Inner Blur */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-[#1C1C1E] via-[#1C1C1E]/80 to-transparent" />
              <div className="absolute inset-0 backdrop-blur-3xl bg-black/20" />
            </div>

            <div className="relative z-10 w-full h-full">
              {loadingFS ? <div className="flex justify-center pt-20"><RefreshCw className="animate-spin text-yellow-500 w-10 h-10" /></div> : (
                <>
                  <div className="grid transition-all duration-300 gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${config?.gridColumns ?? 5}, minmax(0, 1fr))`,
                    }}
                  >
                    {/* Folders & Files */}
                    {displayItemsFS.map((item) => {
                      const isSelected = selectedItems.has(item.id);

                      // Resolve Cover via LibraryManager
                      const thumb = libraryManager.getThumbnailUrl(item);
                      const covers = thumb ? [thumb] : [];

                      return (
                        <div
                          key={item.id}
                          className={`block relative group ${selectionMode ? 'scale-[0.98]' : ''} transition-transform duration-200`}
                          onClick={(e) => {
                            if (selectionMode) {
                              e.preventDefault();
                              toggleSelection(item.id);
                            }
                          }}
                        >
                          {/* Selection Overlay - MINIMAL (Border Only) */}
                          {selectionMode && (
                            <div className={`absolute inset-0 z-20 rounded-xl transition-all border-4 pointer-events-none ${isSelected ? 'border-blue-500' : 'border-transparent'}`} />
                          )}

                          {item.type === 'folder' ? (
                            <div onClick={() => !selectionMode && handleEnterFolder(item.path)}>
                              <ComicBox
                                title={item.name}
                                covers={covers}
                                variant="folder" // Always use Folder style for folders, even with covers
                                isSelected={isSelected}
                                className="cursor-pointer"
                                readingProgress={0}
                              />
                            </div>
                          ) : (
                            // It's a Book/File
                            // It's a Book/File
                            <div className="relative group transition-transform duration-200"
                              onClick={() => {
                                if (!selectionMode) {
                                  // TODO: Handle File Open/Download Preview
                                  // For now, trigger download dialog?
                                  handleDownloadSeries({ ...item, metadata: { title: item.name } });
                                }
                              }}
                            >
                              <ComicBox
                                title={item.name}
                                covers={covers} // File might have cover too via Provider
                                variant="book" // Use 'book' variant for files (2D)
                                isSelected={isSelected}
                                className="cursor-pointer opacity-100" // Ensure opacity is 100
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>


                  {/* Empty State */}
                  {!loadingFS && displayItemsFS.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-white/30">
                      <Book size={48} className="mb-4" />
                      <span>Empty Folder</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DEBUG OVERLAY */}
      <div className="fixed bottom-4 right-4 z-[9999] bg-black/80 text-green-400 p-4 rounded-lg border border-green-500/50 shadow-2xl font-mono text-xs max-w-sm max-h-[300px] overflow-auto pointer-events-none">
        <h3 className="font-bold border-b border-green-500/30 mb-2 pb-1">🪲 Debug: Current View</h3>
        <div className="mb-2">
          <span className="text-white/70">Path:</span> {currentPath || "Root"}
        </div>

        <div className="space-y-1">
          <div className="font-bold text-blue-400">Folders ({fileSystemData.directories?.length || 0}):</div>
          {fileSystemData.directories?.map(d => (
            <div key={d.name} className="truncate pl-2">- {d.name}</div>
          ))}
        </div>

        <div className="space-y-1 mt-2">
          <div className="font-bold text-orange-400">Files ({fileSystemData.files?.length || 0}):</div>
          {fileSystemData.files?.map(f => (
            <div key={f.name} className="truncate pl-2">- {f.name} ({f.size})</div>
          ))}
        </div>

        {fileSystemData.debug && (
          <div className="mt-2 pt-2 border-t border-green-500/30 text-[10px] text-gray-400">
            <div>Raw Items: {fileSystemData.debug.rawCount}</div>
            <div>Types: {fileSystemData.debug.rawTypes?.join(', ')}</div>
            <div>Root: {fileSystemData.debug.root}</div>
            <div className="text-yellow-500 break-words">Keys: {fileSystemData.debug.apiKeys}</div>
          </div>
        )}
      </div>

    </div>
  );
};

// -----------------------------------------------------------------------------
// REMOTE BOOKS LIST (Download View)
// -----------------------------------------------------------------------------
const RemoteBookList = ({ config }) => {
  const { seriesId } = useParams();
  const { komgaService, showToast, settings } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize LibraryManager with Credentials
  useEffect(() => {
    if (settings?.serverUrl && settings?.username && settings?.password) {
      libraryManager.initialize('komga', {
        baseUrl: settings.serverUrl,
        username: settings.username,
        password: settings.password
      });
      console.log("🐛 [App] LibraryManager initialized with settings");
    }
  }, [settings]);

  // PERSISTENCE: Save this path (Session only)
  useEffect(() => {
    sessionStorage.setItem('lastImportPath', location.pathname);
  }, [location.pathname]);

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState({});

  const [downloadProgress, setDownloadProgress] = useState({}); // {bookId: percentage }
  const [seriesMetadata, setSeriesMetadata] = useState(null);


  const seriesBarTop = config?.seriesBarTop ?? 106;
  const seriesGridMargin = config?.seriesGridMargin ?? 110;

  // Navigation State
  const folderStack = location.state?.folderStack || [];
  const libId = location.state?.libId;
  const [libraryName, setLibraryName] = useState(location.state?.libName || "");

  useEffect(() => {
    if (libId && !libraryName && komgaService) {
      komgaService.getLibrary(libId).then(l => setLibraryName(l.name)).catch(console.error);
    }
  }, [libId, libraryName, komgaService]);

  useEffect(() => {
    if (!komgaService) return;
    const fetchB = async () => {
      // Fetch Series Metadata for Title
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Timeout

      try {
        const seriesRes = await fetch(`${komgaService.baseUrl}/series/${seriesId}`, {
          headers: komgaService.headers,
          signal: controller.signal
        });
        const seriesData = await seriesRes.json();
        console.log("🔍 [RemoteBookList] Fetched Series Meta:", seriesData);
        setSeriesMetadata(seriesData);

        // ROBUSTNESS: Fetch Library Name from Series Data (Fixes Unknown Library on refresh)
        if (seriesData.libraryId && !libraryName) {
          console.log("🔍 [RemoteBookList] Fetching Library Name for ID:", seriesData.libraryId);
          komgaService.getLibrary(seriesData.libraryId)
            .then(l => {
              console.log("🔍 [RemoteBookList] Fetched Library Name:", l.name);
              setLibraryName(l.name);
            })
            .catch(e => console.error("Library fetch failed", e));
        }
      } catch (e) { console.error("Failed to fetch series meta", e); }

      try {
        const res = await fetch(`${komgaService.baseUrl}/series/${seriesId}/books?size=500&sort=metadata.number,asc`, {
          headers: komgaService.headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("Fetch failed");
        const data = await res.json();


        // OPTIMIZATION: Bulk check IDB instead of N x Transactions
        const downloadedIds = await downloadManager.getDownloadedBookIds();

        const withStatus = data.content.map(b => ({
          ...b,
          isDownloaded: downloadedIds.has(b.id) // Synchronous Key Check
        }));
        setBooks(withStatus);
      } catch (e) {
        console.error("Fetch Error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchB();
  }, [komgaService, seriesId]);

  // SELECTION MODE STATE (Added for Single Series View)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showMenu, setShowMenu] = useState(false);

  const toggleSelection = (id) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
    setShowMenu(false);
  };

  const handleBulkDownload = () => {
    // Filter selected books
    const selectedBooks = books.filter(b => selectedItems.has(b.id));

    // Add to queue
    selectedBooks.forEach(book => {
      handleDownload(book); // Reuse existing single download logic which queues it
    });

    // Reset selection
    exitSelectionMode();
    showToast(`${selectedBooks.length} books added to download queue`, 'success');
  };

  const downloadWithProgress = async (url, bookId) => {
    const res = await fetch(url, { headers: komgaService.headers });
    if (!res.ok) throw new Error("Network response was not ok");

    const contentLength = res.headers.get('Content-Length');
    if (!contentLength) {
      // Fallback if no content-length
      const blob = await res.blob();
      return blob;
    }

    const total = parseInt(contentLength, 10);
    let loaded = 0;

    const reader = res.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      setDownloadProgress(prev => ({ ...prev, [bookId]: (loaded / total) * 100 }));
    }

    const blob = new Blob(chunks);
    return blob;
  };

  const handleDownload = async (book) => {
    console.log(`🐛 [handleDownload] Clicked for ${book.name}`);
    console.log(`🐛 [handleDownload] Current State -> Library: "${libraryName}", Series:`, seriesMetadata);

    // Determine title securely
    const bTitle = book.metadata?.title || book.name;
    const thumbUrl = `${komgaService.baseUrl}/books/${book.id}/thumbnail`;
    const downloadUrl = `${komgaService.baseUrl}/books/${book.id}/file`;

    // Construct Metadata
    const fullMetadata = {
      ...book.metadata, // existing book metadata
      seriesTitle: seriesMetadata?.metadata?.title || seriesMetadata?.name || book.seriesTitle || "",
    };

    // Determine Real Filename - Swift Logic Replica
    let realFilename = null;

    // 1. Try HEAD
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const head = await fetch(downloadUrl, {
        method: 'HEAD',
        headers: komgaService.headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const disp = head.headers.get('Content-Disposition');
      if (disp && disp.includes('filename=')) {
        realFilename = disp.split('filename=')[1].replace(/["']/g, "").trim();
      }
    } catch (e) { console.warn("Head failed/timedout", e); }

    // 2. Check URL
    if (!realFilename && book.url) {
      const parts = book.url.split('/');
      const last = parts[parts.length - 1];
      if (last.toLowerCase().endsWith('.cbz') || last.toLowerCase().endsWith('.cbr')) {
        realFilename = decodeURIComponent(last);
      }
    }

    // 3. Fallback to book.name (Swift Default)
    if (!realFilename) {
      realFilename = book.name;
      if (!realFilename.toLowerCase().endsWith('.cbz') && !realFilename.toLowerCase().endsWith('.cbr')) {
        realFilename += ".cbz";
      }
    }

    console.log("Single Download Meta:", {
      series: fullMetadata.seriesTitle,
      file: realFilename
    });
    console.log(`🐛 [handleDownload] Queueing with -> Lib: "${fullMetadata.libraryName}", Series: "${fullMetadata.seriesTitle}"`);

    // Add to Manager Queue (Triggering Global Dialog)
    downloadManager.addToQueue(
      book.id,
      bTitle,
      async () => {
        // Fetch Blob logic inside the task
        const res = await fetch(downloadUrl, { headers: komgaService.headers });
        if (!res.ok) throw new Error("Download failed");
        return await res.blob();
      },
      "",
      thumbUrl,
      fullMetadata,
      komgaService.headers, // Pass headers for cover fetch
      realFilename // Real Filename from Server
    );
  };

  const handleBreadcrumbClick = (node, index) => {
    if (libId) {
      navigate(`/app/import/library/${libId}`, {
        state: { restoreFolderId: 'virtual_root', libName: libraryName }
      });
    } else {
      navigate('/app/import');
    }
  };

  return (
    <div className="min-h-screen relative pb-32">
      {/* 1. Background (Blurred Cover) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Use series thumbnail as background */}
        <AuthImage
          src={`${komgaService.baseUrl}/series/${seriesId}/thumbnail`}
          className="w-full h-full object-cover blur-md opacity-70 scale-110"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* 2. Custom Header Bar */}
      {/* 2. Custom Header Bar (Floating Pill Style match) */}
      <div
        className="sticky z-40 transition-all duration-300 w-full flex justify-center pointer-events-none"
        style={{ top: `${seriesBarTop}px` }}
      >
        <div
          className="relative overflow-hidden rounded-2xl shadow-xl border border-white/10 bg-[#1C1C1E]/90 backdrop-blur-md h-16 w-[96%] flex-shrink-0 pointer-events-auto flex items-center justify-between transition-all duration-300"
          style={{ paddingLeft: `${config?.headerSideMargin ?? 16}px`, paddingRight: `${config?.headerSideMargin ?? 16}px` }}
        >

          {/* Header BG Collage */}
          <div className="absolute inset-0 z-0 flex opacity-100">
            {books.slice(0, 10).map((b, i) => (
              <div key={b.id} className="flex-1 h-full relative overflow-hidden">
                <AuthImage src={`${komgaService.baseUrl}/books/${b.id}/thumbnail`} className="w-full h-full object-cover blur-[2px] scale-150 opacity-80" />
              </div>
            ))}
            <div className="absolute inset-0 bg-black/30" />
          </div>

          <div className="relative z-10 flex items-center justify-between w-full px-2">
            {/* Left: Back (Liquid Glass - Large) */}
            <button
              onClick={() => {
                // ROBUST BACK NAVIGATION:
                // Use seriesMetadata.libraryId if available (source of truth), fallback to state libId, fallback to import root
                const targetLibId = seriesMetadata?.libraryId || libId;
                if (targetLibId) {
                  navigate(`/app/import/library/${targetLibId}`, { state: { restoreFolderId: 'virtual_root', libName: libraryName } });
                } else {
                  navigate('/app/import');
                }
              }}
              className="w-11 h-11 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 text-white transition-all backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] active:scale-95"
            >
              <ChevronLeft size={26} />
            </button>

            {/* Center: Title (Large) */}
            <div className="flex flex-col items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/5 pointer-events-none">
              <span className="text-2xl font-bold text-white drop-shadow-lg truncate w-full text-center leading-tight">
                {seriesMetadata ? formatLibraryTitle(seriesMetadata.metadata?.title || seriesMetadata.name || "Untitled") : 'Loading...'}
              </span>
              <div className="w-full text-center text-white/80 mt-1 font-bold tracking-wider" style={{ fontSize: '120%' }}> {/* +20% size */}
                {seriesMetadata?.booksCount ? `${seriesMetadata.booksCount} Books` : ""}
              </div>
            </div>

            {/* Right: Actions (Menu) */}
            <div className="flex items-center gap-4 mr-2 pointer-events-auto">
              {selectionMode && (
                <button
                  onClick={exitSelectionMode}
                  className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 text-white backdrop-blur-xl border border-white/20 shadow-lg active:scale-95 transition-all"
                >
                  <X size={22} />
                </button>
              )}

              {/* THREE DOTS MENU (Imported logic) */}
              <div className="relative z-50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className={`relative z-[100] w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 backdrop-blur-md border ${showMenu ? 'bg-white/20 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-white/5 border-white/10 hover:bg-white/10 shadow-sm'}`}
                >
                  <MoreVertical size={20} className="text-white/90" />
                </button>

                {showMenu && (
                  <>
                    {!selectionMode && <div className="fixed inset-0 z-[99]" onClick={() => setShowMenu(false)} />}
                    <div
                      className="fixed top-28 right-6 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden z-[100] animate-in fade-in zoom-in-95 origin-top-right text-white"
                      style={{
                        width: `${config?.importMenuWidth ?? 320}px`,
                        height: `${config?.importMenuHeight ?? 140}px`,
                        transform: `translate(${config?.importMenuX ?? 0}px, ${config?.importMenuY ?? 0}px)`
                      }}
                    >
                      <div className="flex flex-col h-full justify-center">
                        <button
                          onClick={() => {
                            if (selectionMode) {
                              exitSelectionMode();
                              setShowMenu(false);
                            } else {
                              setSelectionMode(true);
                            }
                          }}
                          className="w-full text-left hover:bg-white/10 rounded-xl text-white flex items-center justify-between transition-colors group mb-0"
                          style={{ padding: `${config?.importMenuItemPadding ?? 0}px ${config?.importMenuItemPaddingX ?? 24}px` }}
                        >
                          <span className="font-medium tracking-wide" style={{ fontSize: `${config?.importMenuFontSize ?? 16}px` }}>
                            {selectionMode ? 'Cancel Selection' : 'Select Items'} {selectedItems.size > 0 && <span className="text-white/50 ml-1">({selectedItems.size})</span>}
                          </span>
                          {selectionMode ? (
                            <X size={20} className="text-white/50 group-hover:text-white transition-colors" />
                          ) : (
                            <CheckCircle2 size={20} className="text-white/50 group-hover:text-white transition-colors" />
                          )}
                        </button>

                        {/* Tunable Gap */}
                        <div style={{ height: `${config?.importMenuGap ?? 16}px` }} />

                        <button
                          disabled={selectedItems.size === 0}
                          onClick={() => {
                            if (selectedItems.size > 0) {
                              handleBulkDownload();
                              setShowMenu(false);
                            }
                          }}
                          className={`w-full text-left rounded-xl flex items-center justify-between transition-colors group ${selectedItems.size > 0 ? 'bg-white/10 hover:bg-white/20 text-white cursor-pointer shadow-sm' : 'text-white/30 cursor-not-allowed'}`}
                          style={{ padding: `${config?.importMenuItemPadding ?? 0}px ${config?.importMenuItemPaddingX ?? 24}px` }}
                        >
                          <span className="font-medium tracking-wide" style={{ fontSize: `${config?.importMenuFontSize ?? 16}px` }}>
                            Download Selected
                          </span>
                          <DownloadCloud size={20} className={`${selectedItems.size > 0 ? 'text-white group-hover:scale-110' : 'text-white/20'} transition-all`} />
                        </button>

                      </div>
                    </div>

                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="h-6 w-full" />

      {/* GRID START: Configurable Top Margin */}
      <div style={{ marginTop: `${seriesGridMargin}px` }} className="flex justify-center w-full relative z-10 safe-bottom">
        <div className="w-[96%]">
          {loading ? (
            <div className="flex justify-center pt-20">
              <RefreshCw className="animate-spin text-yellow-500 w-10 h-10" />
            </div>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${config?.gridColumns ?? 5}, minmax(0, 1fr))` }}>
              {books.map(book => {
                const cleanName = book.name.replace(/\.(cbz|cbr|zip|rar|epub|pdf)$/i, '');
                // Debug log to console
                console.log(`Book: ${book.id}`, { name: book.name, metaTitle: book.metadata?.title, cleanName });
                return (
                  <div key={book.id} className="relative group">
                    {/* Book Cover Card - Transparent Wrapper (No Grey Box) */}
                    <div className="relative group transition-transform duration-200">
                      <ComicBox
                        // Metadata Priority: 1. ComicInfo Title 2. Filename (minus extension)
                        title={book.metadata?.title || book.name.replace(/\.(cbz|cbr|zip|rar|epub|pdf)$/i, '')}
                        series={seriesMetadata?.metadata?.title || seriesMetadata?.name}
                        number={book.metadata?.number}

                        readingProgress={book.readProgress}
                        writer={book.metadata?.authors?.find(a => a.role === 'writer')?.name}
                        penciller={book.metadata?.authors?.find(a => a.role === 'penciller')?.name}
                        summary={book.metadata?.summary}

                        coverUrl={`${komgaService.baseUrl}/books/${book.id}/thumbnail`}
                        variant="book"

                        // Selection Logic
                        selectionMode={selectionMode}
                        isSelected={selectedItems.has(book.id)}
                        onToggleSelect={() => toggleSelection(book.id)}

                        // Click Handler
                        onClick={(e) => {
                          if (selectionMode) {
                            toggleSelection(book.id);
                          } else {
                            handleDownload(book);
                          }
                        }}

                        isDownloaded={book.isDownloaded}
                        isDownloading={downloading[book.id]}
                        downloadProgress={downloadProgress[book.id]}
                      // onDownload removed as onClick handles it now based on mode or directly
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div >
  );
};

// -----------------------------------------------------------------------------
// SETTINGS
// -----------------------------------------------------------------------------
const Settings = ({ config }) => {
  const { settings, saveSettings, connectionStatus, downloadStats } = useApp(); // Added downloadStats
  const [form, setForm] = useState(settings);
  const [isTesting, setIsTesting] = useState(false);
  const { showDebug, setShowDebug, showLogs, setShowLogs, toggleTuner } = useApp();

  const handleSaveAndTest = async () => {
    setIsTesting(true);
    saveSettings(form);
  };

  useEffect(() => {
    if (connectionStatus !== 'connecting') {
      setIsTesting(false);
    }
  }, [connectionStatus]);

  // Use config passed from parent (MainLayout) which comes from Tuner
  // Fallback to defaults to prevent crashes
  const safeConfig = config || defaultNavConfig;

  const SectionBox = ({ title, children, style }) => (
    <div className="flex flex-col w-full" style={style}>
      <h3 className="text-xl font-bold text-white mb-4 px-2">{title}</h3>
      <GlassCard
        className="space-y-6"
        style={{
          minHeight: `${safeConfig.settingsPillMinHeight ?? 100}px`,
          padding: `${safeConfig.settingsPillPadding ?? 24}px`,
        }}
      >
        {children}
      </GlassCard>
    </div>
  );

  const containerStyle = {
    marginTop: `${safeConfig.settingsTitleTop ?? 48}px`,
    paddingLeft: `${safeConfig.settingsPillSideMargin ?? 0}px`,
    paddingRight: `${safeConfig.settingsPillSideMargin ?? 0}px`,
    marginBottom: '120px'
  };

  return (
    <div className="safe-top text-white w-full" style={containerStyle}>
      <h1 className="text-4xl font-bold text-gradient px-2 w-full text-center md:text-left">Settings</h1>

      <div style={{ marginTop: `${safeConfig.settingsPillsTop ?? 32}px`, display: 'flex', flexDirection: 'column', gap: `${safeConfig.settingsPillsGap ?? 32}px` }}>
        {/* SECTION 1: COMICS SERVER */}
        <SectionBox title="Comics Server">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <div className="text-sm text-white/60">Connection Status</div>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && (
                <span className="flex items-center gap-2 text-xs font-bold text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> ONLINE
                </span>
              )}
              {connectionStatus === 'error' && (
                <span className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                  <div className="w-2 h-2 rounded-full bg-red-500" /> ERROR
                </span>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/50 ml-1 uppercase tracking-wider">Server URL</label>
              <input
                type="url"
                value={form.serverUrl}
                onChange={e => setForm({ ...form, serverUrl: e.target.value })}
                placeholder="https://komga.example.com"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/20 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all font-mono"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/50 ml-1 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/20 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/50 ml-1 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/20 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleSaveAndTest}
              disabled={isTesting || !form.serverUrl}
              className="w-full mt-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg py-4 rounded-xl shadow-lg shadow-yellow-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isTesting ? <RefreshCw className="animate-spin w-5 h-5" /> : 'Save & Connect'}
            </button>
          </div>
        </SectionBox>

        {/* SECTION 2: APP SETTINGS */}
        <SectionBox title="Impostazioni Applicazione">

          {/* Menu Tuner Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
            <div>
              <h4 className="font-bold text-white">Menu Layout Tuner</h4>
              <p className="text-xs text-white/40 mt-1">Adjust position and spacing of UI elements</p>
            </div>
            <button
              onClick={toggleTuner}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Open Tuner
            </button>
          </div>

          {/* Debug Tools */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <h4 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-2">Debug Tools</h4>

            <button onClick={() => setShowDebug(true)} className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <HardDrive size={20} />
                </div>
                <div>
                  <span className="block font-bold text-white">Storage Inspector</span>
                  <span className="text-xs text-white/40">Manage cached downloads and DB</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-white/20 group-hover:text-white transition-colors" />
            </button>

            {/* FORCE RESEED ACTION */}
            <button
              onClick={async () => {
                if (confirm("Force re-import sample comic?")) {
                  await checkAndSeed(true); // Force
                }
              }}
              className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <Book size={20} />
                </div>
                <div>
                  <span className="block font-bold text-white">Re-Import Sample</span>
                  <span className="text-xs text-white/40">Force download sample comic</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-white/20 group-hover:text-white transition-colors" />
            </button>

            <button onClick={() => setShowLogs(true)} className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 text-orange-400 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <List size={20} />
                </div>
                <div>
                  <span className="block font-bold text-white">System Logs & Reset</span>
                  <span className="text-xs text-white/40">View logs or FACTORY RESET</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-white/20 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Direct Reset Button (Added as requested) */}
          <div className="pt-6 border-t border-white/10">
            <button
              onClick={() => setShowLogs(true)} // Opens Logs which has the Reset UI
              className="w-full py-4 text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <span className="text-xl">💣</span> Reset Storage / Factory Reset
            </button>
            <p className="text-center text-[10px] text-white/30 mt-2">DANGER: Wipes all downloads and settings</p>
          </div>
        </SectionBox>
      </div>

    </div>
  );
};

// -----------------------------------------------------------------------------
// NAV BAR
// -----------------------------------------------------------------------------
const NavBar = ({ config }) => {
  // Dynamic Config Styling
  const safeConfig = config || {}; // Safe access
  const containerStyle = {
    padding: `${safeConfig.padding ?? 16}px`,
    gap: `${safeConfig.gap ?? 8}px`,
    borderRadius: '9999px',
    backgroundColor: 'rgba(28, 28, 30, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(24px)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  };

  const navLinkClass = ({ isActive }) =>
    `rounded-full font-semibold transition-all duration-300 whitespace-nowrap flex items-center justify-center ${isActive
      ? 'bg-white text-black shadow-lg shadow-black/20 scale-105'
      : 'text-white/50 hover:text-white'
    }`;

  // Link styling needs specific font size/padding from config
  const linkStyle = {
    fontSize: `${safeConfig.fontSize ?? 16}px`,
    paddingLeft: `${safeConfig.itemPaddingX ?? 20}px`,
    paddingRight: `${safeConfig.itemPaddingX ?? 20}px`,
    paddingTop: `${safeConfig.itemPaddingY ?? 8}px`,
    paddingBottom: `${safeConfig.itemPaddingY ?? 8}px`,
  };

  return (
    <div
      className="fixed inset-x-0 z-[200] pointer-events-none flex justify-center pb-4"
      style={{ top: `${safeConfig.top ?? 32}px` }}
    >
      <div className="pointer-events-auto mx-4">
        <div className="flex items-center" style={containerStyle}>
          <NavLink to="/app" end className={navLinkClass} style={linkStyle}>
            Libreria
          </NavLink>
          <NavLink
            to={sessionStorage.getItem('lastImportPath') || "/app/import"}
            className={({ isActive }) => {
              // Manual check for /import sub-routes
              const isImportActive = window.location.pathname.startsWith('/app/import');
              return `rounded-full font-semibold transition-all duration-300 whitespace-nowrap flex items-center justify-center ${isImportActive
                ? 'bg-white text-black shadow-lg shadow-black/20 scale-105'
                : 'text-white/50 hover:text-white'
                }`;
            }}
            style={linkStyle}
          >
            Importa
          </NavLink>
          <NavLink to="/app/settings" className={navLinkClass} style={linkStyle}>
            Impostazioni
          </NavLink>
          <NavLink to="/app/help" className={navLinkClass} style={linkStyle}>
            Aiuto
          </NavLink>
        </div>
      </div>
    </div>
  );
};



const MainLayout = () => {
  const { showTuner, showToast, showDebug, setShowDebug, showLogs, setShowLogs, logs } = useApp();
  const location = useLocation();

  // Dual Config State (Load from Storage or Default)
  const [importConfig, setImportConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('importConfig');
      return saved ? { ...defaultNavConfig, ...JSON.parse(saved) } : defaultNavConfig;
    } catch { return defaultNavConfig; }
  });

  const [libraryConfig, setLibraryConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('libraryConfig');
      return saved ? { ...defaultNavConfig, ...JSON.parse(saved) } : defaultNavConfig;
    } catch { return defaultNavConfig; }
  });

  const [tunerTab, setTunerTab] = useState('general'); // 'general' | 'layout'
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState('');

  // Determine Context
  const isImportContext = location.pathname.startsWith('/app/import') || location.pathname.startsWith('/import'); // Backwards compat
  const isSettingsContext = location.pathname.startsWith('/app/settings') || location.pathname.startsWith('/settings');

  // Select Active Config for Tuner/NavBar
  const activeConfig = isImportContext ? importConfig : libraryConfig;
  const setActiveConfig = isImportContext ? setImportConfig : setLibraryConfig;

  let tunerTitle = "Libreria - Menu Tuner";
  if (isImportContext) tunerTitle = "Import - Menu Tuner";
  if (isSettingsContext) tunerTitle = "Settings - Menu Tuner";

  const saveDefaults = () => {
    const configToExport = isImportContext ? importConfig : libraryConfig;
    const jsonString = JSON.stringify(configToExport, null, 2);
    setExportConfig(jsonString);
    setShowExportModal(true);

    // Also save to local storage as before
    if (isImportContext) {
      localStorage.setItem('importConfig', jsonString);
      showToast("Import Layout Saved locally", "success");
    } else {
      localStorage.setItem('libraryConfig', jsonString);
      showToast("Library Layout Saved locally", "success");
    }
  };

  const handleResetStorage = async () => {
    try {
      console.log("💥 INITIALIZING FACTORY RESET...");
      await downloadManager.reset();
      localStorage.clear();
      sessionStorage.clear();

      // Force reload to clear memory state
      console.log("✅ Reset Complete. Reloading...");
      window.location.href = '/';
    } catch (e) {
      console.error("Reset Failed:", e);
      showToast("Reset Failed: " + e.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] font-sans text-white selection:bg-yellow-500/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#1a1a2e] to-black -z-20" />

      <NavBar config={activeConfig} />
      <DownloadProgress />

      {/* CONFIG EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-2">Export Configuration</h3>
            <p className="text-white/60 text-sm mb-4">Copy this JSON and paste it to the AI assistant.</p>

            <textarea
              readOnly
              id="export-config-area"
              value={exportConfig}
              onClick={(e) => e.target.select()}
              className="w-full h-64 bg-black/50 border border-white/10 rounded-xl p-4 text-[10px] font-mono text-green-400 mb-4 focus:outline-none focus:border-white/30 resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const textArea = document.getElementById("export-config-area");
                  if (textArea) {
                    textArea.select();
                    textArea.setSelectionRange(0, 99999); // For mobile devices

                    try {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(exportConfig).then(() => {
                          showToast("Copied!", "success");
                        }).catch(() => {
                          document.execCommand('copy');
                          showToast("Copied (Legacy)!", "success");
                        });
                      } else {
                        document.execCommand('copy');
                        showToast("Copied (Legacy)!", "success");
                      }
                    } catch (err) {
                      alert("Automatic copy failed. Please copy the text manually.");
                    }
                  }
                }}
                className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <Clipboard size={18} />
                Copy JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURATOR OVERLAY */}
      {showTuner && (
        <div className="fixed bottom-20 right-4 z-[250] p-4 bg-black/80 border border-white/20 rounded-xl backdrop-blur-xl w-64 shadow-2xl text-xs space-y-3 font-mono">
          <div className="flex flex-col gap-2 mb-6 border-b border-white/10 pb-4"> {/* Increased Height/Padding */}
            <strong className="text-yellow-500 text-sm mb-2 block text-center uppercase tracking-widest">{tunerTitle}</strong>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setActiveConfig(isImportContext ? defaultNavConfig : defaultNavConfig)}
                className="flex-1 py-3 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-xs transition-all font-bold uppercase tracking-wider active:scale-95"
                title="Reset to factory defaults"
              >
                Reset
              </button>
              <button
                onClick={saveDefaults}
                className="flex-1 py-3 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black rounded-lg text-xs transition-all font-bold uppercase tracking-wider active:scale-95"
                title="Save current settings as default"
              >
                Save
              </button>
            </div>
          </div>

          {/* Tuner Tabs */}
          <div className="flex bg-white/10 rounded-lg p-1 mb-2">
            <button
              onClick={() => setTunerTab('general')}
              className={`flex-1 py-3 rounded-md text-xs font-bold transition-all ${tunerTab === 'general' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
            >
              MAIN MENU
            </button>
            <button
              onClick={() => setTunerTab('layout')}
              className={`flex-1 py-3 rounded-md text-xs font-bold transition-all ${tunerTab === 'layout' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
            >
              LAYOUT
            </button>
          </div>

          {/* Tuner Content */}
          <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/20">

            {/* GENERAL TAB (Pill Bar) */}
            {tunerTab === 'general' && (
              <>
                {[
                  { label: 'Top (px)', key: 'top', min: 0, max: 100 },
                  { label: 'Cont. Padding', key: 'padding', min: 0, max: 20 },
                  { label: 'Gap (px)', key: 'gap', min: 0, max: 20 },
                  { label: 'Font Size', key: 'fontSize', min: 10, max: 24 },
                  { label: 'Item Pad X', key: 'itemPaddingX', min: 0, max: 40 },
                  { label: 'Item Pad Y', key: 'itemPaddingY', min: 0, max: 20 },
                ].map(control => (
                  <div key={control.key} className="space-y-2 mb-4 hover:bg-white/5 p-2 rounded-lg transition-colors">
                    <div className="flex justify-between text-white/70 text-[11px] font-bold uppercase tracking-wide">
                      <span>{control.label}</span>
                      <span className="text-yellow-500 font-mono">{activeConfig[control.key]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveConfig(prev => ({ ...prev, [control.key]: Math.max(control.min, (prev[control.key] || 0) - 1) }))}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 transition-all text-white font-bold"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={control.min} max={control.max}
                        value={activeConfig[control.key]}
                        onChange={(e) => setActiveConfig({ ...activeConfig, [control.key]: Number(e.target.value) })}
                        className="flex-1 accent-yellow-500 bg-white/10 h-2 rounded-full appearance-none cursor-pointer"
                      />
                      <button
                        onClick={() => setActiveConfig(prev => ({ ...prev, [control.key]: Math.min(control.max, (prev[control.key] || 0) + 1) }))}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 transition-all text-white font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* LAYOUT TAB */}
            {tunerTab === 'layout' && (
              <>
                {/* GLOBAL TUNER - Visible in all contexts */}
                <div className="space-y-6 pt-6 border-b border-white/10 pb-6 mb-6">
                  {/* Cleaned up - Content moved to specific contexts */}
                </div>

                {/* Context-Aware Tuner Groups */}
                {(() => {
                  const path = location.pathname;
                  const isImport = path.startsWith('/import') || path.startsWith('/app/import');
                  const isSettings = path.startsWith('/app/settings') || path.startsWith('/settings');
                  const isLibrary = !isImport && !isSettings;

                  // Helper for Uniform Slider Group
                  const SliderGroup = ({ title, controls }) => (
                    <div className="space-y-4 mb-8 bg-white/5 rounded-xl p-4 border border-white/5">
                      <h4 className="text-white/40 font-bold text-[10px] uppercase mb-4 tracking-wider">{title}</h4>
                      {controls.map(control => (
                        <div key={control.key} className="space-y-2 mb-4 last:mb-0">
                          <div className="flex justify-between text-white/70 text-[11px] font-bold uppercase tracking-wide">
                            <span>{control.label}</span>
                            <span className="text-yellow-500 font-mono">{activeConfig[control.key]}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Decrement Button */}
                            <button
                              onClick={() => setActiveConfig(prev => ({ ...prev, [control.key]: Math.max(control.min, (prev[control.key] || 0) - 1) }))}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 transition-all text-white font-bold"
                            >
                              -
                            </button>

                            {/* Slider */}
                            <input
                              type="range"
                              min={control.min} max={control.max}
                              value={activeConfig[control.key]}
                              onChange={(e) => setActiveConfig({ ...activeConfig, [control.key]: Number(e.target.value) })}
                              className="flex-1 accent-yellow-500 bg-white/10 h-2 rounded-full appearance-none cursor-pointer"
                            />

                            {/* Increment Button */}
                            <button
                              onClick={() => setActiveConfig(prev => ({ ...prev, [control.key]: Math.min(control.max, (prev[control.key] || 0) + 1) }))}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 transition-all text-white font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );

                  return (
                    <div className="space-y-2">
                      {/* GLOBAL / COMMON - Hide in Settings if requested */}
                      {!isSettings && (
                        <SliderGroup title="Global UI" controls={[
                          { label: 'Global Text Scale', key: 'fontSize', min: 12, max: 32 },
                          { label: 'Top Margin', key: 'top', min: 0, max: 200 }
                        ]} />
                      )}

                      {/* LIBRARY CONTEXT */}
                      {isLibrary && (
                        <>
                          <SliderGroup title="Library Bar" controls={[
                            { label: 'Top Dist', key: 'librariesBarTop', min: 0, max: 200 },
                            { label: 'Height', key: 'librariesBarHeight', min: 40, max: 120 },
                            { label: 'Side Margin', key: 'librariesBarSideMargin', min: 0, max: 200 },
                            { label: 'Pill Padding X', key: 'libPillPaddingX', min: 0, max: 50 },
                            { label: 'Pill Height', key: 'libPillHeight', min: 20, max: 100 },
                            { label: 'Pill Gap', key: 'libBarGap', min: 0, max: 50 },
                          ]} />
                          <SliderGroup title="Continue Reading" controls={[
                            { label: 'Top Dist', key: 'continueReadingMargin', min: 0, max: 200 },
                            { label: 'Height', key: 'crHeight', min: 100, max: 600 },
                            { label: 'Side Margin', key: 'crSideMargin', min: 0, max: 200 },
                            { label: 'Cover Size %', key: 'crCoverWidth', min: 10, max: 100 },
                            { label: 'Title Size', key: 'crFontSize', min: 12, max: 60 },
                          ]} />
                          <SliderGroup title="Main Grid" controls={[
                            { label: 'Top Dist', key: 'gridMargin', min: 0, max: 200 }, // This is marginTop of Grid Container
                            { label: 'Height', key: 'gridHeight', min: 200, max: 1200 },
                            { label: 'Side Margin', key: 'gridSideMargin', min: 0, max: 200 },
                            { label: 'Columns', key: 'gridColumns', min: 2, max: 10 },
                          ]} />
                        </>
                      )}

                      {/* IMPORT CONTEXT */}
                      {isImport && (
                        <>
                          <SliderGroup title="Server List" controls={[
                            { label: 'Bar Top', key: 'serverBarTop', min: 0, max: 200 },
                            { label: 'Grid Margin', key: 'gridTop', min: 0, max: 200 },
                          ]} />
                          <SliderGroup title="Library Grid" controls={[
                            { label: 'Bar Top', key: 'libraryBarTop', min: 0, max: 200 },
                            { label: 'Grid Margin', key: 'libraryGridMargin', min: 0, max: 200 },
                            { label: 'Side Margin', key: 'libraryGridSideMargin', min: 0, max: 100 },
                            { label: 'Header Side Margin', key: 'headerSideMargin', min: 0, max: 60 },
                            { label: 'Columns', key: 'gridColumns', min: 3, max: 5 },
                          ]} />
                          <SliderGroup title="Series Detail" controls={[
                            { label: 'Bar Top', key: 'seriesBarTop', min: 0, max: 200 },
                            { label: 'Grid Margin', key: 'seriesGridMargin', min: 0, max: 200 },
                          ]} />

                          {/* IMPORT MENU TUNER */}
                          <SliderGroup title="Imp Menu" controls={[
                            { label: 'Menu Width', key: 'importMenuWidth', min: 200, max: 600 },
                            { label: 'Menu Height', key: 'importMenuHeight', min: 50, max: 600 },
                            { label: 'Pos X', key: 'importMenuX', min: -500, max: 500 },
                            { label: 'Pos Y', key: 'importMenuY', min: -500, max: 500 },
                            { label: 'Text Gap', key: 'importMenuGap', min: 0, max: 100 },
                            { label: 'Font Size', key: 'importMenuFontSize', min: 10, max: 30 },
                            { label: 'Vert Padding', key: 'importMenuItemPadding', min: 0, max: 40 },
                            { label: 'Side Padding', key: 'importMenuItemPaddingX', min: 0, max: 100 },
                          ]} />
                        </>
                      )}

                      {/* SETTINGS CONTEXT */}
                      {isSettings && (
                        <SliderGroup title="Settings Layout" controls={[
                          { label: 'Top Margin', key: 'settingsPillsTopMargin', min: 0, max: 400 },
                          { label: 'Side Margin', key: 'settingsPillSideMargin', min: 0, max: 200 },
                          { label: 'Inner Padding', key: 'settingsPillInnerPadding', min: 0, max: 100 },
                          { label: 'Title Size', key: 'settingsPillTitleSize', min: 12, max: 40 },
                          { label: 'Title Margin', key: 'settingsPillTitleBottomMargin', min: 0, max: 100 },
                        ]} />
                      )}
                    </div>
                  );
                })()}
              </>
            )}

          </div>

          <div className="pt-2 border-t border-white/10 text-[9px] text-white/40 break-all">
            Top: {activeConfig.top} | Font: {activeConfig.fontSize}
          </div>
        </div >
      )
      }

      <div className="pt-36"> {/* Increased Global Padding for Lower Menu */}
        <Routes>
          {/* OFFLINE LIBRARY uses libraryConfig - Root matched relative to /app */}
          <Route path="/" element={<LocalLibrary config={libraryConfig} />} />

          {/* ONLINE IMPORT uses importConfig (Protected) */}
          <Route path="import" element={<RequireAuthOverlay><RemoteLibrary config={importConfig} /></RequireAuthOverlay>} />
          <Route path="import/library/:libId" element={<RequireAuthOverlay><RemoteSeriesList config={importConfig} /></RequireAuthOverlay>} />
          <Route path="import/series/:seriesId" element={<RequireAuthOverlay><RemoteBookList config={importConfig} /></RequireAuthOverlay>} />

          <Route path="settings" element={<SettingsPage config={activeConfig} />} />
          <Route path="help" element={<div className="p-20 text-center text-white">Aiuto & Supporto (Coming Soon)</div>} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </div>
      <DownloadProgress />

      {showLogs && <DebugConsole logs={logs} onClose={() => setShowLogs(false)} onResetStorage={handleResetStorage} />}

      {/* STORAGE INSPECTOR OVERLAY */}
      {
        showDebug && (
          <StorageInspector onClose={() => setShowDebug(false)} />
        )
      }
    </div >
  );
};

// Moved import to top

// Main App Component with Router
// -----------------------------------------------------------------------------
// AUTH OVERLAY (For Remote Sections)
// -----------------------------------------------------------------------------
const RequireAuthOverlay = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center p-8 text-center opacity-50 grayscale transition-all">
        <div className="bg-white/10 p-8 rounded-2xl backdrop-blur-md border border-white/10 flex flex-col items-center gap-4">
          <Server size={48} className="text-white/50" />
          <h3 className="text-xl font-bold text-white">Server Setup Required</h3>
          <p className="text-white/60 max-w-sm">
            You need to configure your Komga or YACReader server to import content.
          </p>
          <Link to="/app/settings" className="px-6 py-3 bg-blue-600 rounded-full text-white font-bold hover:bg-blue-500 transition">
            Open Settings
          </Link>
        </div>
      </div>
    );
  }
  return children;
};

// Main App Component (Inside Router)
const AppContent = () => {
  console.log(">>> 🧩 AppContent Mounting...");
  const { activeProfile, activeType, isAuthenticated, loadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize LibraryManager with Active Profile
  useEffect(() => {
    if (activeProfile?.url && activeProfile?.username) {
      console.log(`🐛 [App] Initializing Manager for: ${activeType}`);
      libraryManager.initialize(activeType, {
        baseUrl: activeProfile.url,
        username: activeProfile.username,
        password: activeProfile.password
      });
    }
  }, [activeProfile, activeType]);

  // Auth Protection REMOVED for Global blocking.
  // Now handled per-route via RequireAuthOverlay.

  if (loadingAuth) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading Security...</div>;

  return (
    <Routes>
      {/* Redirect Root to /app (Classic View) */}
      {/* Root Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Global Settings Route (Full Page if needed, but we prefer inside App for Layout) */}
      <Route path="/settings" element={<SettingsPage />} />

      {/* Main App Routes - ACCESSIBLE OFFLINE */}
      <Route path="/app/*" element={<MainLayout />} />
    </Routes>
  );
};

// Function App (Legacy) Removed to resolve conflict

// -----------------------------------------------------------------------------
// APP WRAPPER (Router + Provider)
// -----------------------------------------------------------------------------
const App = () => {
  const base = import.meta.env.BASE_URL;
  console.warn(">>> 📦 App Wrapper Mounting... Router about to start. Base: ", base);
  return (
    <Router basename={base}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </Router>
  );
};

export default App;
