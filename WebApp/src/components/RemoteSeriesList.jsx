import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronLeft, X, Folder, List, MoreVertical,
    CheckCircle2, DownloadCloud, RefreshCw, Book
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { libraryManager } from '../services/LibraryManager';
import { downloadService } from '../services/downloads';
import { localLibrary } from '../services/localLibrary';
import AuthImage from './ui/AuthImage';
import ComicBox from './ui/ComicBox';
import DownloadProgress from './ui/DownloadProgress';
import DownloadConfirmationDialog from './ui/DownloadConfirmationDialog';
import { formatLibraryTitle } from '../utils/textUtils';

const RemoteSeriesList = ({ config }) => {
    const { libId } = useParams();
    const { komgaService, showToast, cache, updateCache } = useApp();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        sessionStorage.setItem('lastImportPath', location.pathname);
    }, [location.pathname]);

    const [series, setSeries] = useState([]);
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

    const [currentPath, setCurrentPath] = useState(null);
    const [fileSystemData, setFileSystemData] = useState({ directories: [], files: [] });
    const [loadingFS, setLoadingFS] = useState(false);
    const [libraryRoot, setLibraryRoot] = useState(null);

    const [downloadStatus, setDownloadStatus] = useState({ isDownloading: false, isPaused: false });

    useEffect(() => {
        const unsub = downloadService.subscribe((state) => {
            setDownloadStatus({ isDownloading: state.isDownloading, isPaused: state.isPaused });
        });
        return unsub;
    }, []);

    const [useFolderView, setUseFolderView] = useState(true);
    const currentFolder = currentPath ? { name: currentPath.split('/').pop() } : { name: 'Root' };

    const folderStack = useMemo(() => {
        if (!currentPath) return [];
        let displayPath = currentPath;
        if (libraryRoot && currentPath.startsWith(libraryRoot)) {
            displayPath = currentPath.substring(libraryRoot.length);
        }
        return displayPath.split(/[/\\]/).filter(Boolean).map(p => ({ name: p }));
    }, [currentPath, libraryRoot]);

    const [downloadDialog, setDownloadDialog] = useState({ isOpen: false, target: null, onConfirm: null });
    const [bgImage, setBgImage] = useState(null);

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

    useEffect(() => {
        const init = async () => {
            setLoadingFS(true);
            try {
                await libraryManager.provider.initialize(libId);
                const name = libraryManager.provider.libraryName || "Unknown Library";
                setLibraryName(name);
                setLibraryRoot(libraryManager.provider.libraryRoot);
                libraryManager.config.name = name;

                let startPath = sessionStorage.getItem(`lastPath-${libId}`);
                if (!startPath || (libraryManager.provider && startPath === libraryManager.provider.libraryRoot) || startPath.startsWith('/') || startPath.includes('\\')) {
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

    useEffect(() => {
        if (loadingFS) {
            const t = setTimeout(() => {
                setLoadingFS(false);
            }, 5000);
            return () => clearTimeout(t);
        }
    }, [loadingFS]);

    useEffect(() => {
        if (currentPath === null) return;
        let isMounted = true;
        const fetchFS = async () => {
            setLoadingFS(true);
            setFileSystemData({ directories: [], files: [] });
            try {
                const data = await libraryManager.browse(currentPath);
                if (isMounted) {
                    setFileSystemData(data);
                    sessionStorage.setItem(`lastPath-${libId}`, currentPath);
                }
            } catch (e) {
                console.error("❌ Debug: Browse Failed for path:", currentPath);
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

    const handleUpLevel = () => {
        if (fileSystemData.parent) {
            setCurrentPath(fileSystemData.parent);
            return;
        }
        if (currentPath && currentPath !== "") {
            setCurrentPath("");
        } else {
            navigate('/app/import');
        }
    };

    const handleBack = () => {
        handleUpLevel();
    };

    const displayItemsFS = useMemo(() => {
        const dirs = (fileSystemData.directories || []).map(d => ({
            ...d,
            id: d.id || d.path,
            name: d.name,
            type: 'folder',
            path: d.path,
        }));

        const files = (fileSystemData.files || [])
            .filter(f => /\.(cbz|cbr|epub|pdf|zip|rar)$/i.test(f.name))
            .map(f => ({
                ...f,
                id: f.id,
                name: f.name,
                type: 'book',
                path: f.path,
                size: f.size
            }));

        return [...dirs, ...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }, [fileSystemData]);

    const processBulkDownload = async (targets, reportProgress) => {
        try {
            const processedList = await libraryManager.resolveDownloadList(targets);
            if (processedList.length === 0) {
                showToast("No files found to download", "info");
                return;
            }

            let processed = 0;
            for (const item of processedList) {
                downloadService.addToQueue(
                    item.id,
                    item.name,
                    null,
                    {
                        priority: 0, // Bulk priority
                        folderPath: item.folderPath,
                        coverUrl: libraryManager.getThumbnailUrl({ id: item.id, type: 'book' }),
                        metadata: { ...item.metadata, type: 'manual_import' },
                        headers: komgaService.headers,
                        filename: item.name
                    }
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

    const handleDownloadSeries = (seriesItem) => {
        if (downloadStatus.isDownloading) {
            showToast("Download in progress. Please wait.", "info");
            return;
        }

        const stackNames = folderStack
            .filter(n => n.name !== 'Root')
            .map(n => n.name);

        const libPrefix = libraryName || "UnknownLibrary";
        const seriesPath = [libPrefix, ...stackNames, seriesItem.metadata?.title || seriesItem.name].filter(Boolean).join("/");

        setDownloadDialog({
            isOpen: true,
            target: {
                name: seriesItem.metadata?.title || seriesItem.name,
                series: [seriesItem],
                children: []
            },
            onConfirm: async (targetNode, reportProgress) => {
                try {
                    if (!komgaService) throw new Error("Komga Service unavailable");
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000);

                    let books = [];
                    try {
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

                    for (const book of books) {
                        const exists = await localLibrary.isDownloaded(book.id);
                        if (!exists) {
                            const downloadFn = async () => {
                                const res = await fetch(`${komgaService.baseUrl}/books/${book.id}/file`, { headers: komgaService.headers });
                                if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                                return await res.blob();
                            };

                            const getFilename = async () => {
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
                                if (book.url) {
                                    const parts = book.url.split('/');
                                    const last = parts[parts.length - 1];
                                    if (last.toLowerCase().endsWith('.cbz') || last.toLowerCase().endsWith('.cbr')) {
                                        return decodeURIComponent(last);
                                    }
                                }
                                let safeName = book.name;
                                if (!safeName.toLowerCase().endsWith('.cbz') && !safeName.toLowerCase().endsWith('.cbr')) {
                                    safeName += ".cbz";
                                }
                                return safeName;
                            };

                            const realFilename = await getFilename();
                            if (!realFilename) continue;

                            downloadService.addToQueue(
                                book.id,
                                book.metadata?.title || book.name,
                                null,
                                {
                                    priority: 2, // High priority for series-level trigger
                                    folderPath: seriesPath,
                                    coverUrl: `${komgaService.baseUrl}/books/${book.id}/thumbnail`,
                                    metadata: {
                                        libraryName: libraryName || "Unknown Library",
                                        publisher: seriesItem.metadata?.publisher,
                                        seriesTitle: seriesItem.metadata?.title || seriesItem.name || "Unknown Series",
                                        number: book.metadata?.number,
                                        summary: book.metadata?.summary
                                    },
                                    headers: komgaService.headers,
                                    filename: realFilename
                                }
                            );
                        }
                        processed++;
                        if (processed % 5 === 0 || processed === total) {
                            reportProgress((processed / total) * 100);
                        }
                    }
                    reportProgress(100);
                } catch (e) {
                    console.error(e);
                    alert(`Download failed: ${e.message}`);
                    setDownloadDialog(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleBulkDownloadRequest = () => {
        if (downloadStatus.isDownloading) {
            showToast("Download in progress. Please wait.", "info");
            return;
        }
        const targets = displayItemsFS.filter(i => selectedItems.has(i.id));
        setDownloadDialog({
            isOpen: true,
            target: targets,
            isBulk: true,
            onConfirm: async (t, p) => processBulkDownload(targets, p)
        });
    };

    const handleDownloadFolder = (node) => {
        setDownloadDialog({
            isOpen: true,
            target: [node],
            isBulk: true,
            onConfirm: async (t, p) => processBulkDownload([node], p)
        });
    };

    return (
        <div className="min-h-screen pb-32 bg-[#121212] relative">
            {!downloadDialog.isOpen && <DownloadProgress />}

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

            <div
                className="sticky z-40 transition-all duration-300 w-full flex justify-center pointer-events-none"
                style={{ top: `${subBarTop}px` }}
            >
                <div
                    className="relative h-16 w-[96%] flex-shrink-0 pointer-events-auto flex items-center justify-between transition-all duration-300"
                    style={{ paddingLeft: `${config?.headerSideMargin ?? 16}px`, paddingRight: `${config?.headerSideMargin ?? 16}px` }}
                >
                    <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-xl border border-white/10 bg-[#1C1C1E]/90 backdrop-blur-md">
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
                        <button
                            onClick={handleBack}
                            className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 text-white transition-all backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] active:scale-95 ml-2"
                        >
                            <ChevronLeft size={24} />
                        </button>

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

                        <div className="flex items-center gap-4 mr-2 pointer-events-auto">
                            {selectionMode ? (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={exitSelectionMode}
                                        className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 text-white backdrop-blur-xl border border-white/20 shadow-lg active:scale-95 transition-all"
                                    >
                                        <X size={22} />
                                    </button>
                                </div>
                            ) : (
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
                                                <div style={{ height: `${config?.importMenuGap ?? 16}px` }} />
                                                <button
                                                    disabled={selectedItems.size === 0 || downloadStatus.isDownloading}
                                                    onClick={() => {
                                                        if (selectedItems.size > 0 && !downloadStatus.isDownloading) {
                                                            handleBulkDownloadRequest();
                                                            setShowMenu(false);
                                                        }
                                                    }}
                                                    className={`w-full text-left rounded-xl flex items-center justify-between transition-colors group ${selectedItems.size > 0 && !downloadStatus.isDownloading ? 'bg-white/10 hover:bg-white/20 text-white cursor-pointer shadow-sm' : 'text-white/30 cursor-not-allowed'}`}
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

            <div className="p-4" style={{
                paddingLeft: `${sideMargin > 0 ? sideMargin : 16}px`,
                paddingRight: `${sideMargin > 0 ? sideMargin : 16}px`
            }}>
                <div style={{ marginTop: `${gridMargin}px` }}>
                    <div
                        className="relative group rounded-xl overflow-hidden shadow-2xl bg-[#1C1C1E] border border-white/10 transition-all duration-300"
                        style={{
                            minHeight: '600px',
                            padding: `${config?.gridInnerPadding ?? 24}px`
                        }}
                    >
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
                                        {displayItemsFS.map((item) => {
                                            const isSelected = selectedItems.has(item.id);
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
                                                    {selectionMode && (
                                                        <div className={`absolute inset-0 z-20 rounded-xl transition-all border-4 pointer-events-none ${isSelected ? 'border-blue-500' : 'border-transparent'}`} />
                                                    )}
                                                    {item.type === 'folder' ? (
                                                        <div onClick={() => !selectionMode && handleEnterFolder(item.path)}>
                                                            <ComicBox
                                                                title={item.name}
                                                                covers={covers}
                                                                variant="folder"
                                                                isSelected={isSelected}
                                                                className="cursor-pointer"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="relative group transition-transform duration-200"
                                                            onClick={() => {
                                                                if (!selectionMode) {
                                                                    handleDownloadSeries({ ...item, metadata: { title: item.name } });
                                                                }
                                                            }}
                                                        >
                                                            <ComicBox
                                                                title={item.name}
                                                                covers={covers}
                                                                variant="book"
                                                                isSelected={isSelected}
                                                                className="cursor-pointer opacity-100"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
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
        </div>
    );
};

export default RemoteSeriesList;
