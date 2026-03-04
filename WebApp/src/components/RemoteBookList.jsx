import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronLeft, X, MoreVertical,
    CheckCircle2, DownloadCloud, RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { libraryManager } from '../services/LibraryManager';
import { downloadService } from '../services/downloads';
import { localLibrary } from '../services/localLibrary';
import AuthImage from './ui/AuthImage';
import ComicBox from './ui/ComicBox';
import { formatLibraryTitle } from '../utils/textUtils';

const RemoteBookList = ({ config }) => {
    const { seriesId } = useParams();
    const { komgaService, showToast, settings } = useApp();
    const location = useLocation();
    const navigate = useNavigate();

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

    useEffect(() => {
        sessionStorage.setItem('lastImportPath', location.pathname);
    }, [location.pathname]);

    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState({});
    const [downloadProgress, setDownloadProgress] = useState({});
    const [seriesMetadata, setSeriesMetadata] = useState(null);

    const seriesBarTop = config?.seriesBarTop ?? 106;
    const seriesGridMargin = config?.seriesGridMargin ?? 110;

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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            try {
                const seriesRes = await fetch(`${komgaService.baseUrl}/series/${seriesId}`, {
                    headers: komgaService.headers,
                    signal: controller.signal
                });
                const seriesData = await seriesRes.json();
                setSeriesMetadata(seriesData);

                if (seriesData.libraryId && !libraryName) {
                    komgaService.getLibrary(seriesData.libraryId)
                        .then(l => setLibraryName(l.name))
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

                const downloadedIds = await localLibrary.getDownloadedBookIds();
                const withStatus = data.content.map(b => ({
                    ...b,
                    isDownloaded: downloadedIds.has(b.id)
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

    const handleDownload = async (book) => {
        const bTitle = book.metadata?.title || book.name;
        const thumbUrl = `${komgaService.baseUrl}/books/${book.id}/thumbnail`;
        const downloadUrl = `${komgaService.baseUrl}/books/${book.id}/file`;

        const fullMetadata = {
            ...book.metadata,
            seriesTitle: seriesMetadata?.metadata?.title || seriesMetadata?.name || book.seriesTitle || "",
        };

        let realFilename = null;
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

        if (!realFilename && book.url) {
            const parts = book.url.split('/');
            const last = parts[parts.length - 1];
            if (last.toLowerCase().endsWith('.cbz') || last.toLowerCase().endsWith('.cbr')) {
                realFilename = decodeURIComponent(last);
            }
        }

        if (!realFilename) {
            realFilename = book.name;
            if (!realFilename.toLowerCase().endsWith('.cbz') && !realFilename.toLowerCase().endsWith('.cbr')) {
                realFilename += ".cbz";
            }
        }

        downloadService.addToQueue(
            book.id,
            bTitle,
            async () => {
                const res = await fetch(downloadUrl, { headers: komgaService.headers });
                if (!res.ok) throw new Error("Download failed");
                return await res.blob();
            },
            "",
            thumbUrl,
            fullMetadata,
            komgaService.headers,
            realFilename
        );
    };

    const handleBulkDownload = () => {
        const selectedBooks = books.filter(b => selectedItems.has(b.id));
        selectedBooks.forEach(book => {
            handleDownload(book);
        });
        exitSelectionMode();
        showToast(`${selectedBooks.length} books added to download queue`, 'success');
    };

    return (
        <div className="min-h-screen relative pb-32">
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <AuthImage
                    src={`${komgaService.baseUrl}/series/${seriesId}/thumbnail`}
                    className="w-full h-full object-cover blur-md opacity-70 scale-110"
                />
                <div className="absolute inset-0 bg-black/30" />
            </div>

            <div
                className="sticky z-40 transition-all duration-300 w-full flex justify-center pointer-events-none"
                style={{ top: `${seriesBarTop}px` }}
            >
                <div
                    className="relative overflow-hidden rounded-2xl shadow-xl border border-white/10 bg-[#1C1C1E]/90 backdrop-blur-md h-16 w-[96%] flex-shrink-0 pointer-events-auto flex items-center justify-between transition-all duration-300"
                    style={{ paddingLeft: `${config?.headerSideMargin ?? 16}px`, paddingRight: `${config?.headerSideMargin ?? 16}px` }}
                >
                    <div className="absolute inset-0 z-0 flex opacity-100">
                        {books.slice(0, 10).map((b, i) => (
                            <div key={b.id} className="flex-1 h-full relative overflow-hidden">
                                <AuthImage src={`${komgaService.baseUrl}/books/${b.id}/thumbnail`} className="w-full h-full object-cover blur-[2px] scale-150 opacity-80" />
                            </div>
                        ))}
                        <div className="absolute inset-0 bg-black/30" />
                    </div>

                    <div className="relative z-10 flex items-center justify-between w-full px-2">
                        <button
                            onClick={() => {
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

                        <div className="flex flex-col items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/5 pointer-events-none">
                            <span className="text-2xl font-bold text-white drop-shadow-lg truncate w-full text-center leading-tight">
                                {seriesMetadata ? formatLibraryTitle(seriesMetadata.metadata?.title || seriesMetadata.name || "Untitled") : 'Loading...'}
                            </span>
                            <div className="w-full text-center text-white/80 mt-1 font-bold tracking-wider" style={{ fontSize: '120%' }}>
                                {seriesMetadata?.booksCount ? `${seriesMetadata.booksCount} Books` : ""}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 mr-2 pointer-events-auto">
                            {selectionMode && (
                                <button
                                    onClick={exitSelectionMode}
                                    className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 text-white backdrop-blur-xl border border-white/20 shadow-lg active:scale-95 transition-all"
                                >
                                    <X size={22} />
                                </button>
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

            <div className="h-6 w-full" />

            <div style={{ marginTop: `${seriesGridMargin}px` }} className="flex justify-center w-full relative z-10 safe-bottom">
                <div className="w-[96%]">
                    {loading ? (
                        <div className="flex justify-center pt-20">
                            <RefreshCw className="animate-spin text-yellow-500 w-10 h-10" />
                        </div>
                    ) : (
                        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${config?.gridColumns ?? 5}, minmax(0, 1fr))` }}>
                            {books.map(book => {
                                return (
                                    <div key={book.id} className="relative group">
                                        <div className="relative group transition-transform duration-200">
                                            <ComicBox
                                                title={book.metadata?.title || book.name.replace(/\.(cbz|cbr|zip|rar|epub|pdf)$/i, '')}
                                                series={seriesMetadata?.metadata?.title || seriesMetadata?.name}
                                                number={book.metadata?.number}
                                                readingProgress={book.readProgress}
                                                writer={book.metadata?.authors?.find(a => a.role === 'writer')?.name}
                                                penciller={book.metadata?.authors?.find(a => a.role === 'penciller')?.name}
                                                summary={book.metadata?.summary}
                                                coverUrl={`${komgaService.baseUrl}/books/${book.id}/thumbnail`}
                                                variant="book"
                                                selectionMode={selectionMode}
                                                isSelected={selectedItems.has(book.id)}
                                                onToggleSelect={() => toggleSelection(book.id)}
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
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RemoteBookList;
