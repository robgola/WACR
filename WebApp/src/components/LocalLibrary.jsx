import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, Book, MoreHorizontal, CheckSquare, Copy, Scissors, Clipboard, Trash2, FolderPlus, X } from 'lucide-react';
import { VirtuosoGrid } from 'react-virtuoso';

// Components
import ComicBox from './ui/ComicBox';
import AuthImage from './ui/AuthImage';
import PillFilterBar from './ui/PillFilterBar';
import ContinueReadingCarousel from './ui/ContinueReadingCarousel';
import LocalReader from './LocalReader';

// Context & Logic
import { useApp } from '../context/AppContext';
import { downloadService } from '../services/downloads';
import { localLibrary } from '../services/localLibrary';
import { formatLibraryTitle } from '../utils/textUtils';
import { checkAndSeed } from '../utils/seeder';

// -----------------------------------------------------------------------------
// HELPER: Local Library Item (Book)
// -----------------------------------------------------------------------------
const LocalLibraryItem = ({ item, onBookClick, onBookDoubleClick, selectionMode, isSelected, onToggleSelect }) => {
    return (
        <div
            className="relative cursor-pointer group h-full"
            onClick={(e) => {
                if (selectionMode) {
                    e.stopPropagation();
                    onToggleSelect && onToggleSelect();
                    return;
                }
                onBookClick(item);
            }}
            onDoubleClick={(e) => {
                if (selectionMode) {
                    e.preventDefault();
                    return;
                }
                if (onBookDoubleClick) onBookDoubleClick(item);
            }}
        >
            <ComicBox
                title={formatLibraryTitle(item.metadata?.title || item.name)}
                coverUrl={item.coverUrl}
                variant="book"
                number={item.metadata?.number || item.metadata?.Number || item.number}
                readingProgress={item.readProgress}
                isDownloaded={true}
                selectionMode={selectionMode}
                isSelected={isSelected}
                onToggleSelect={onToggleSelect}
            />
        </div>
    );
};

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
const LocalLibrary = ({ config }) => {
    const { komgaService, showToast } = useApp();
    const [rootTree, setRootTree] = useState(null);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [folderStack, setFolderStack] = useState([]);
    const [readingBook, setReadingBook] = useState(null);

    const [isSelectionMode, setSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [clipboard, setClipboard] = useState(null);
    const [showMenu, setShowMenu] = useState(false);

    const [selectedTab, setSelectedTab] = useState("Tutte");
    const [bgImage, setBgImage] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    const [pasteProcessing, setPasteProcessing] = useState(false);

    // Download Status
    const [downloadStatus, setDownloadStatus] = useState({ isDownloading: false, isPaused: false });

    useEffect(() => {
        const unsub = downloadService.subscribe((state) => {
            setDownloadStatus({ isDownloading: state.isDownloading, isPaused: state.isPaused });
        });
        return unsub;
    }, []);

    // Reading History
    const [readingHistory, setReadingHistory] = useState(() => {
        try {
            const stored = localStorage.getItem('reading_history');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });

    const openBook = (book) => {
        setReadingBook(book);
        const existing = readingHistory.find(b => b.id === book.id);
        setReadingHistory(prev => {
            const others = prev.filter(b => b.id !== book.id);
            const updatedBook = existing ? { ...existing, ...book, readProgress: existing.readProgress } : book;
            const newHistory = [updatedBook, ...others].slice(0, 20);
            localStorage.setItem('reading_history', JSON.stringify(newHistory));
            return newHistory;
        });
    };

    const handleProgressUpdate = useCallback((bookId, page, total) => {
        setReadingHistory(prev => {
            const idx = prev.findIndex(b => b.id === bookId);
            if (idx === -1) return prev;
            const newHistory = [...prev];
            const book = { ...newHistory[idx] };
            if (book.readProgress?.page === page && book.readProgress?.total === total) return prev;
            book.readProgress = { page, total, completed: page >= total - 1 };
            newHistory[idx] = book;
            localStorage.setItem('reading_history', JSON.stringify(newHistory));
            return newHistory;
        });
    }, []);

    // Load Local Data
    const loadLocal = useCallback(async () => {
        try {
            const tree = await localLibrary.getLibraryTree();
            setRootTree(tree);

            // Restore Background
            const cachedId = localStorage.getItem('bg_cover_id');
            let bgBlobUrl = null;
            if (cachedId) {
                const book = await localLibrary.getBook(cachedId);
                if (book?.blob) bgBlobUrl = URL.createObjectURL(book.blob);
            }
            if (!bgBlobUrl) {
                const allBooks = await localLibrary.getAllDownloads();
                if (allBooks.length > 0) {
                    const randomBook = allBooks[Math.floor(Math.random() * allBooks.length)];
                    if (randomBook?.blob) {
                        bgBlobUrl = URL.createObjectURL(randomBook.blob);
                        localStorage.setItem('bg_cover_id', randomBook.id);
                    }
                }
            }
            if (bgBlobUrl) setBgImage(bgBlobUrl);
        } catch (e) {
            console.error("Local Library Load Failed", e);
        }
    }, []);

    useEffect(() => {
        loadLocal();
        const unsub = downloadService.subscribe(() => loadLocal());
        const onLibraryUpdate = () => loadLocal();
        window.addEventListener('library-updated', onLibraryUpdate);
        checkAndSeed();

        return () => {
            window.removeEventListener('library-updated', onLibraryUpdate);
        };
    }, [loadLocal]);

    // Derived Logic
    const displayContent = useMemo(() => {
        if (!rootTree) return { children: [], items: [] };
        if (folderStack.length > 0) return currentFolder;

        if (selectedTab === "Tutte") {
            let allSeries = [];
            let allBooks = [];
            const libraryContainer = rootTree.children.find(c => c.name === 'Library');
            const rootChildren = libraryContainer ? libraryContainer.children : rootTree.children;
            allBooks.push(...rootTree.items);
            rootChildren.forEach(lib => {
                allSeries.push(...lib.children.map(s => ({ ...s, _libName: lib.name })));
                allBooks.push(...lib.items);
            });
            return {
                name: "Tutte",
                children: allSeries.sort((a, b) => a.name.localeCompare(b.name)),
                items: allBooks
            };
        } else {
            let libNode = rootTree.children.find(c => c.name === selectedTab);
            if (!libNode) {
                const libraryContainer = rootTree.children.find(c => c.name === 'Library');
                if (libraryContainer) {
                    libNode = libraryContainer.children.find(c => c.name === selectedTab);
                }
            }
            return libNode || { children: [], items: [] };
        }
    }, [rootTree, selectedTab, folderStack, currentFolder]);

    const tabs = useMemo(() => {
        if (!rootTree) return ["Tutte"];
        const libraryContainer = rootTree.children.find(c => c.name === 'Library');
        const sourceNodes = libraryContainer ? libraryContainer.children : rootTree.children;
        return ["Tutte", ...sourceNodes.map(c => c.name).sort()];
    }, [rootTree]);

    const backgroundCovers = useMemo(() => {
        if (!rootTree) return [];
        let allBooks = [];
        const traverse = (node) => {
            allBooks.push(...node.items);
            node.children.forEach(traverse);
        };
        traverse(rootTree);
        return allBooks.sort(() => 0.5 - Math.random()).slice(0, 10).map(b => b.coverUrl).filter(Boolean);
    }, [rootTree]);

    const gridBackgroundCover = useMemo(() => {
        if (displayContent?.items?.length > 0) {
            const random = displayContent.items[Math.floor(Math.random() * Math.min(10, displayContent.items.length))];
            return random?.coverUrl;
        }
        return backgroundCovers[Math.floor(Math.random() * backgroundCovers.length)];
    }, [displayContent.items, backgroundCovers]);

    const carouselContent = useMemo(() => {
        if (selectedTab !== "Tutte" || folderStack.length > 0) {
            if (previewItem) return [previewItem];
            let previewBooks = displayContent?.items?.slice(0, 5) || [];
            if (previewBooks.length === 0 && displayContent?.children) {
                const collected = [];
                const traverse = (nodes) => {
                    for (const node of nodes) {
                        if (collected.length >= 5) return;
                        if (node.items?.length > 0) collected.push(...node.items);
                        if (node.children) traverse(node.children);
                    }
                };
                traverse(displayContent.children);
                previewBooks = collected.slice(0, 5);
            }
            return previewBooks;
        }
        return readingHistory.length > 0 ? readingHistory : [];
    }, [selectedTab, displayContent, readingHistory, previewItem]);

    // Handlers
    const enterFolder = (folder) => {
        setFolderStack(prev => [...prev, currentFolder || rootTree]);
        setCurrentFolder(folder);
        window.scrollTo(0, 0);
    };

    const handleBack = () => {
        if (folderStack.length > 0) {
            const prev = folderStack[folderStack.length - 1];
            setFolderStack(prevStack => prevStack.slice(0, -1));
            if (prev) setCurrentFolder(prev);
        } else if (rootTree) {
            setCurrentFolder(rootTree);
        }
    };

    const handleToggleSelect = () => {
        setSelectionMode(!isSelectionMode);
        setSelectedItems(new Set());
    };

    const handleSelectItem = (id) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleTabSelect = (tab) => {
        setSelectedTab(tab);
        setFolderStack([]);
        if (rootTree) setCurrentFolder(rootTree);
    };

    const handleDelete = async () => {
        const itemsToDelete = Array.from(selectedItems);
        for (const id of itemsToDelete) {
            if (id.startsWith("folder:")) {
                await localLibrary.deleteFolder(id.substring(7));
            } else {
                await localLibrary.deleteBook(id);
            }
        }
        setSelectedItems(new Set());
        setSelectionMode(false);
        setShowMenu(false);
        showToast(`Deleted ${itemsToDelete.length} items`, "success");
        loadLocal();
    };

    const handleCopy = () => {
        const items = displayContent.items.filter(i => selectedItems.has(i.id));
        setClipboard({ op: 'copy', items });
        setSelectionMode(false);
        setSelectedItems(new Set());
        showToast(`${items.length} items copied`, "info");
        setShowMenu(false);
    };

    const handleCut = () => {
        const items = displayContent.items.filter(i => selectedItems.has(i.id));
        setClipboard({ op: 'cut', items });
        setSelectionMode(false);
        setSelectedItems(new Set());
        showToast(`${items.length} items cut`, "info");
        setShowMenu(false);
    };

    const handlePaste = async () => {
        if (!clipboard?.items.length) return;
        let targetPath = selectedTab !== "Tutte" ? selectedTab : "";
        const stackNames = folderStack.map(f => f.name);
        targetPath = [targetPath, ...stackNames].filter(Boolean).join("/");

        setPasteProcessing(true);
        try {
            for (const item of clipboard.items) {
                if (item.type === 'book') {
                    if (clipboard.op === 'cut') await localLibrary.moveBook(item.id, targetPath);
                    else await localLibrary.copyBook(item.id, targetPath);
                }
            }
            setClipboard(null);
            await loadLocal();
            showToast(`Pasted ${clipboard.items.length} items`, "success");
        } catch (e) {
            showToast("Paste failed: " + e.message, "error");
        } finally {
            setPasteProcessing(false);
            setShowMenu(false);
        }
    };

    const handleCreateFolder = async () => {
        const name = prompt("Folder Name:");
        if (!name) return;
        let targetPath = selectedTab !== "Tutte" ? selectedTab : "";
        const stackNames = folderStack.map(f => f.name);
        targetPath = [targetPath, ...stackNames].filter(Boolean).join("/");
        const newPath = targetPath ? `${targetPath}/${name}` : name;
        await localLibrary.createFolder(newPath);
        setShowMenu(false);
        loadLocal();
    };

    // VIRTUALIZATION PREP
    const gridItems = useMemo(() => {
        const folders = displayContent.children.map(child => ({
            id: `folder:${child.path}`,
            type: 'folder',
            data: child
        }));
        const books = displayContent.items.map(item => ({
            id: item.id,
            type: 'book',
            data: item
        }));
        return [...folders, ...books];
    }, [displayContent]);

    if (!rootTree) return <div className="p-10 text-center text-white/50">Loading Offline Library...</div>;

    return (
        <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden overscroll-none">
            {bgImage && (
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <img src={bgImage} className="w-full h-full object-cover blur-2xl opacity-40 scale-105 transition-all duration-1000" />
                    <div className="absolute inset-0 bg-black/40" />
                </div>
            )}

            {/* HEADER */}
            <div className="flex-none z-40 bg-transparent flex justify-center transition-all duration-300 pb-2 pointer-events-none"
                style={{
                    marginTop: `${config?.librariesBarTop ?? 32}px`,
                    paddingLeft: `${config?.librariesBarSideMargin ?? 32}px`,
                    paddingRight: `${config?.librariesBarSideMargin ?? 32}px`,
                }}>
                <div className="pointer-events-auto flex items-center justify-between px-2 py-1 transition-all duration-300 w-full"
                    style={{
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(28, 28, 30, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(24px)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        gap: `${config?.gap ?? 4}px`,
                        padding: `${config?.padding ?? 4}px`,
                        minWidth: '320px',
                        height: `${config?.librariesBarHeight ?? 64}px`,
                        position: 'relative',
                    }}>
                    <div className="absolute inset-0 z-0 flex opacity-20 pointer-events-none overflow-hidden" style={{ borderRadius: '9999px' }}>
                        {backgroundCovers.length > 0 ? backgroundCovers.map((url, i) => (
                            <div key={i} className="flex-1 h-full relative overflow-hidden">
                                <AuthImage src={url} className="w-full h-full object-cover blur-[2px] scale-150 grayscale" />
                            </div>
                        )) : <div className="w-full h-full bg-white/5" />}
                        <div className="absolute inset-0 bg-[#1C1C1E]/80 mix-blend-multiply" />
                    </div>

                    <div className="relative z-10 flex items-center justify-between w-full h-full pr-1 overflow-hidden">
                        <div className="flex-1 flex items-center min-w-0 mr-2 h-full gap-4 overflow-hidden">
                            {folderStack.length === 0 ? (
                                <div className="flex-1 min-w-0 overflow-hidden pl-4">
                                    <PillFilterBar tabs={tabs} selectedTab={selectedTab} onSelect={handleTabSelect} config={config} className="w-full" />
                                </div>
                            ) : (
                                <div className="relative flex items-center justify-between w-full h-full min-h-[44px]">
                                    <button onClick={handleBack} className="group p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors z-20">
                                        <div className="flex items-center gap-1 text-white/70 group-hover:text-white transition-colors">
                                            <ChevronLeft size={24} />
                                            <span className="font-medium">Back</span>
                                        </div>
                                    </button>
                                    <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-lg font-bold text-white truncate max-w-[60%] drop-shadow-md">
                                            <span className="text-white/60 font-medium mr-2">{(selectedTab !== "Tutte" ? selectedTab : (currentFolder?._libName || folderStack[0]?._libName)) || "Library"}</span>
                                            - <span className="ml-2">{currentFolder?.name}</span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex-none z-[100]">
                            <button onClick={() => setShowMenu(!showMenu)} className="flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full"
                                style={{ width: `${(config?.localMenuTriggerSize || 24) * 1.5}px`, height: `${(config?.localMenuTriggerSize || 24) * 1.5}px` }}>
                                <MoreHorizontal size={config?.localMenuTriggerSize || 24} className="text-white" />
                            </button>
                            {showMenu && (
                                <>
                                    {!isSelectionMode && <div className="fixed inset-0 z-[99]" onClick={() => setShowMenu(false)} />}
                                    <div className="absolute top-full right-0 mt-2 bg-[#1C1C1E]/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-[101]"
                                        style={{ width: `${config?.localMenuWidth ?? 200}px`, padding: `${config?.localMenuPadding ?? 8}px` }}>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={handleToggleSelect} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isSelectionMode ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-white/10 text-white'}`}><CheckSquare size={16} /> <span className="text-sm font-medium">Select Items</span></button>
                                            <button onClick={handleCopy} disabled={selectedItems.size === 0} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30"><Copy size={16} /><span className="text-sm font-medium">Copy</span></button>
                                            <button onClick={handleCut} disabled={selectedItems.size === 0} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30"><Scissors size={16} /><span className="text-sm font-medium">Cut</span></button>
                                            <button onClick={handlePaste} disabled={!clipboard} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white disabled:opacity-30"><Clipboard size={16} /><span className="text-sm font-medium">Paste</span></button>
                                            <button onClick={handleDelete} disabled={selectedItems.size === 0} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-red-400 disabled:opacity-30"><Trash2 size={16} /><span className="text-sm font-medium">Delete</span></button>
                                            <button onClick={handleCreateFolder} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-white border-t border-white/10 pt-3"><FolderPlus size={16} /><span className="text-sm font-medium">New Folder</span></button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 flex flex-col min-h-0 px-4 pb-4 space-y-4">
                {carouselContent.length > 0 && (
                    <div className="flex-none z-30" style={{ marginTop: `${config?.continueReadingMargin ?? 0}px` }}>
                        <div className="flex items-center justify-between px-2 mb-4" style={{ margin: `0 ${config?.crSideMargin ?? 20}px` }}>
                            <h3 className="font-bold text-white uppercase tracking-widest text-xs opacity-50">{folderStack.length > 0 || selectedTab !== "Tutte" ? "In this folder" : "Continue reading"}</h3>
                        </div>
                        <ContinueReadingCarousel books={carouselContent} onRead={openBook} config={config} />
                    </div>
                )}

                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="relative flex-1 rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
                        style={{
                            marginTop: `${config?.gridMargin ?? 32}px`,
                            backgroundColor: `rgba(28, 28, 30, ${(config?.bgOpacity ?? 30) / 100})`,
                            backdropFilter: 'blur(20px)'
                        }}>
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                            {gridBackgroundCover && <AuthImage src={gridBackgroundCover} className="w-full h-full object-cover opacity-70 blur-xl scale-110" />}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                        </div>

                        {gridItems.length === 0 ? (
                            <div className="relative z-10 flex flex-col items-center justify-center h-full text-white/20">
                                <Book size={64} strokeWidth={1} />
                                <span className="mt-4 font-medium uppercase tracking-widest text-sm">Library Empty</span>
                            </div>
                        ) : (
                            <div className="relative z-10 flex-1 min-h-0">
                                <VirtuosoGrid
                                    data={gridItems}
                                    totalCount={gridItems.length}
                                    style={{ height: '100%' }}
                                    listClassName="grid p-6 transition-all duration-300 gap-8"
                                    itemClassName="flex flex-col"
                                    components={{
                                        List: React.forwardRef(({ children, style, ...props }, ref) => (
                                            <div
                                                {...props}
                                                ref={ref}
                                                style={{
                                                    ...style,
                                                    display: 'grid',
                                                    gridTemplateColumns: `repeat(${config?.gridColumns || 5}, minmax(0, 1fr))`,
                                                    gap: '24px',
                                                    padding: `${config?.gridInnerPadding ?? 24}px`
                                                }}
                                            >
                                                {children}
                                            </div>
                                        )),
                                        Item: ({ children, ...props }) => <div {...props}>{children}</div>
                                    }}
                                    itemContent={(index, item) => {
                                        if (item.type === 'folder') {
                                            return (
                                                <div key={item.id} onClick={() => !isSelectionMode && enterFolder(item.data)} className="cursor-pointer">
                                                    <ComicBox title={item.data.name} itemCount={item.data.items.length + item.data.children.length} variant="folder" coverUrl={item.data.coverUrl} />
                                                </div>
                                            );
                                        }
                                        return (
                                            <LocalLibraryItem
                                                key={item.id}
                                                item={{
                                                    ...item.data,
                                                    readProgress: readingHistory.find(h => h.id === item.id)?.readProgress || item.data.readProgress
                                                }}
                                                selectionMode={isSelectionMode}
                                                isSelected={selectedItems.has(item.id)}
                                                onToggleSelect={() => handleSelectItem(item.id)}
                                                onBookClick={setPreviewItem}
                                                onBookDoubleClick={openBook}
                                            />
                                        );
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {readingBook && (
                <LocalReader
                    bookId={readingBook.id}
                    onClose={() => setReadingBook(null)}
                    config={config}
                    onProgressUpdate={handleProgressUpdate}
                    initialPage={readingHistory.find(h => h.id === readingBook.id)?.readProgress?.page || 0}
                />
            )}
        </div>
    );
};

export default LocalLibrary;
