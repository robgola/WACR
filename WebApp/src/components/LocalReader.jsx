import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { createExtractorFromData } from 'node-unrar-js';
import { ChevronLeft, ChevronRight, X, Loader2, Settings, Languages, ScanText } from 'lucide-react';
import { localLibrary } from '../services/localLibrary';
import { acrStorage } from '../services/acrStorage';
import { detectionModule } from '../modules/detection';
import { ocrModule } from '../modules/ocr';
import { translateModule } from '../modules/translate';
import { geminiService } from '../services/GeminiService';
import { pageTranslationOrchestrator } from '../services/PageTranslationOrchestrator';
import LocalOverlay from './viewer/LocalOverlay';
import ViewerControls from './viewer/ViewerControls';

import { useApp } from '../context/AppContext';

const LocalReader = ({ bookId, onClose, config, onProgressUpdate, initialPage = 0 }) => {
    const { settings, showToast } = useApp();
    const [pages, setPages] = useState([]);
    const [currentPage, setCurrentPage] = useState(initialPage); // 0-indexed

    // Notify Parent of Progress
    useEffect(() => {
        if (pages.length > 0 && onProgressUpdate && currentPage > 0) {
            onProgressUpdate(bookId, currentPage, pages.length);
        }
    }, [currentPage, pages.length, bookId, onProgressUpdate]);

    // Sidecar ACR Storage (OPFS Sidecar)
    useEffect(() => {
        setOverlayItems([]); // Reset on page change
        setHasTranslation(false);

        const loadAcr = async () => {
            const data = await acrStorage.getPageTranslation(bookId, currentPage);
            console.log(`[ACR-Sidecar] Loaded translations for ${bookId} p${currentPage}:`, data);
            if (data && data.balloons) {
                setOverlayItems(data.balloons);
                setHasTranslation(true);
            }
        };
        loadAcr();
    }, [bookId, currentPage]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showControls, setShowControls] = useState(false); // Default hidden (dimmed state)

    // Translation State
    const [hasTranslation, setHasTranslation] = useState(false);
    const [showTranslated, setShowTranslated] = useState(false);
    const [overlayItems, setOverlayItems] = useState([]); // Balloon Data
    const [isDetecting, setIsDetecting] = useState(false);
    const [translationStatus, setTranslationStatus] = useState('idle'); // idle | translating | translated | failed
    const currentPageRef = useRef(currentPage);

    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    // Tuner Config
    const topMargin = config?.comicTopMargin ?? 16;
    const sideMargin = config?.comicSideMargin ?? 16;
    const pageNumSize = config?.comicPageNumFontSize ?? 18; // Default 18 if missing

    // Load Book
    useEffect(() => {
        const loadBook = async () => {
            try {
                setLoading(true);
                console.log(`Open Local Reader for: ${bookId}`);
                const bookRecord = await localLibrary.getBook(bookId);

                if (!bookRecord || !bookRecord.blob) {
                    throw new Error("Book file not found offline.");
                }

                const fileBlob = bookRecord.blob;
                const isCbr = bookRecord.mediaType === 'application/x-cbr' || bookRecord.mediaType === 'application/x-rar-compressed' || bookId.toLowerCase().endsWith('.cbr');

                let imageEntries = [];

                if (isCbr) {
                    console.log("Detected CBR (RAR) file. Using node-unrar-js...");
                    const arrayBuffer = await fileBlob.arrayBuffer();
                    const extractor = await createExtractorFromData({ data: arrayBuffer });

                    const list = extractor.getFileList();
                    const imageFiles = [];

                    // Filter images from iterator
                    for (const entry of list) {
                        if (!entry.fileHeader.flags.directory && entry.fileHeader.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                            imageFiles.push(entry);
                        }
                    }

                    // Sort
                    imageFiles.sort((a, b) =>
                        a.fileHeader.name.localeCompare(b.fileHeader.name, undefined, { numeric: true, sensitivity: 'base' })
                    );

                    // Extract logic
                    const extracted = extractor.extract({ files: imageFiles.map(f => f.fileHeader.name) });

                    // Iterate extracted files
                    for (const file of extracted.files) {
                        if (file.extraction) {
                            const blob = new Blob([file.extraction], { type: 'image/jpeg' }); // Assume JPEG or detect
                            imageEntries.push({
                                name: file.fileHeader.name,
                                blob: blob
                            });
                        }
                    }

                } else {
                    // Default to ZIP (JSZip)
                    const zip = await JSZip.loadAsync(fileBlob);
                    const entries = [];
                    zip.forEach((relativePath, zipEntry) => {
                        if (!zipEntry.dir && relativePath.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                            entries.push(zipEntry);
                        }
                    });

                    entries.sort((a, b) =>
                        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                    );

                    // Convert to consistent structure
                    for (const entry of entries) {
                        const blob = await entry.async('blob');
                        imageEntries.push({
                            name: entry.name,
                            blob: blob
                        });
                    }
                }

                console.log(`Found ${imageEntries.length} pages.`);

                // Create Object URLs (batch)
                const urls = imageEntries.map(entry => URL.createObjectURL(entry.blob));
                setPages(urls);

            } catch (err) {
                console.error(err);
                setError(err.message || "Failed to load book.");
            } finally {
                setLoading(false);
            }
        };

        loadBook();
    }, [bookId]);

    // Cleanup URLs on unmount or book change
    useEffect(() => {
        return () => {
            if (pages.length > 0) {
                console.log(`[Reader] Revoking ${pages.length} object URLs...`);
                pages.forEach(url => URL.revokeObjectURL(url));
            }
        };
    }, [pages]);

    // Navigation
    const nextPage = useCallback(() => {
        if (currentPage < pages.length - 1) {
            setCurrentPage(p => p + 1);
            window.scrollTo(0, 0);
        }
    }, [currentPage, pages.length]);

    const prevPage = useCallback(() => {
        if (currentPage > 0) {
            setCurrentPage(p => p - 1);
        }
    }, [currentPage]);

    const handleTap = (e) => {
        const width = window.innerWidth;
        const x = e.clientX;

        if (x < width * 0.3) {
            prevPage();
        } else if (x > width * 0.7) {
            nextPage();
        } else {
            // Center tap
            setShowControls(prev => !prev);
        }
    };

    // Toggle via Cog Button
    const toggleMenu = (e) => {
        e.stopPropagation();
        setShowControls(prev => !prev);
    };

    // Keyboard support
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') nextPage();
            if (e.key === 'ArrowLeft') prevPage();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [nextPage, prevPage, onClose]);

    /**
     * Prefetch translation for the next page (Milestone 2)
     */
    const prefetchNextPage = async (pageIndex) => {
        if (pageIndex >= pages.length - 1) return;

        const nextIdx = pageIndex + 1;
        const nextUrl = pages[nextIdx];
        if (!nextUrl) return;

        try {
            console.log(`[Reader] Prefetching Page ${nextIdx}...`);
            const response = await fetch(nextUrl);
            const blob = await response.blob();

            // Enqueue LOW priority job
            await pageTranslationOrchestrator.translatePage(bookId, nextIdx, blob, {
                priority: 'LOW',
                force: false
            });
        } catch (err) {
            console.warn(`[Reader] Prefetch Failed for Page ${nextIdx}:`, err);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white">
                <Loader2 className="animate-spin mr-2" />
                <span className="text-lg">Unpacking Book...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white p-4">
                <div className="text-red-500 text-3xl mb-4">Error</div>
                <p className="mb-6 text-center text-gray-400">{error}</p>
                <button onClick={onClose} className="px-6 py-2 bg-white/10 rounded-full hover:bg-white/20">
                    Close
                </button>
            </div>
        );
    }

    const content = (
        <div className="fixed inset-0 z-[9999] bg-black overflow-hidden flex flex-col h-screen select-none" style={{ backgroundColor: 'black' }}>

            {/* FORCE FULLSCREEN / OVERLAY STATUS BAR AREA 
                We can't truly hide the browser chrome via JS, but we can make the background black 
                and position elements relative to safe area.
            */}

            {/* -- CONTROLS LAYER -- */}

            {/* 1. BACK BUTTON (Top-Left) */}
            <button
                onClick={onClose}
                className={`fixed z-[210] flex items-center justify-center w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all duration-300 ${showControls ? 'opacity-100 pointer-events-auto' : 'opacity-30 pointer-events-none'}`}
                style={{
                    top: `${topMargin}px`,
                    left: `${sideMargin}px`
                }}
            >
                <ChevronLeft size={24} />
            </button>

            {/* 2. SETTINGS COG (Top-Right) - Always active */}
            <button
                onClick={toggleMenu}
                className={`fixed z-[210] flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 backdrop-blur-md shadow-lg ${showControls
                    ? 'bg-white text-black opacity-100 rotate-90 scale-110 shadow-white/20'  // Active State
                    : 'bg-black/20 text-white/30 border border-white/5 opacity-40 hover:bg-black/40' // Dimmed State
                    }`}
                style={{
                    top: `${topMargin}px`,
                    right: `${sideMargin}px`
                }}
            >
                <Settings size={20} />
            </button>

            {/* Main Content (Image) */}
            <div
                className="flex-1 flex items-center justify-center h-full w-full cursor-pointer touch-none"
                onClick={handleTap}
            >
                {!loading && !error && pages[currentPage] && (
                    <div className="relative" style={{ width: 'fit-content', height: 'fit-content', maxHeight: '100%', maxWidth: '100%' }}>
                        <img
                            src={pages[currentPage]}
                            alt={`Page ${currentPage + 1}`}
                            className="max-h-full max-w-full object-contain select-none block"
                            style={{ maxHeight: '100vh', maxWidth: '100vw' }}
                            draggable={false}
                        />
                        {/* OVERLAY */}
                        <LocalOverlay
                            items={overlayItems}
                            visible={showTranslated}
                            imageUrl={pages[currentPage]}
                        />
                    </div>
                )}
            </div>

            {/* Optional Page Indicator (Bottom Center) */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-1 bg-black/50 backdrop-blur rounded-full border border-white/10 text-white-400 text-xs font-mono transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                {currentPage + 1} / {pages.length}
            </div>

            {/* TRANSLATION CONTROLS (Step 1) - ALWAYS VISIBLE */}
            <ViewerControls
                showTranslated={showTranslated}
                isDetecting={isDetecting}
                hasTranslation={hasTranslation}
                onToggleTranslate={() => setShowTranslated(prev => !prev)}
                onTranslate={async () => {
                    // Single Tap Logic - Start Translation
                    // Check if we should translate (or if we already have it)
                    try {
                        setIsDetecting(true);
                        setTranslationStatus('translating');

                        const targetPage = currentPage;
                        const currentUrl = pages[targetPage];
                        const response = await fetch(currentUrl);
                        const blob = await response.blob();

                        const balloons = await pageTranslationOrchestrator.translatePage(bookId, targetPage, blob, {
                            priority: 'HIGH',
                            force: false
                        });

                        // GUARD: Only update if we are still on the same page
                        if (currentPageRef.current === targetPage) {
                            if (balloons && balloons.length > 0) {
                                setOverlayItems(balloons);
                                setHasTranslation(true);
                                setShowTranslated(true);
                                setTranslationStatus('translated');
                                if (settings?.debugMode) {
                                    showToast(`Translation Complete! Found ${balloons.length} balloons.`, "success");
                                }

                                // Trigger Prefetch for next page (Milestone 2)
                                prefetchNextPage(targetPage);
                            } else if (balloons && balloons.length === 0) {
                                setTranslationStatus('idle');
                                showToast("No speech bubbles detected on this page.", "warning");
                            }
                        } else {
                            console.log(`[Reader] Translation for page ${targetPage} finished but user moved to ${currentPageRef.current}. Ignoring UI update.`);
                        }

                    } catch (err) {
                        if (err.message !== "Aborted") {
                            setTranslationStatus('failed');
                            console.error("Translation Failed:", err);
                            showToast(`Translation Failed: ${err.message}`, "error");
                        }
                    } finally {
                        if (currentPageRef.current === currentPage) {
                            setIsDetecting(false);
                        }
                    }
                }}
                onForceTranslate={() => {
                    // Double Tap Logic
                    console.log("Force Translation triggered (Not yet implemented fully)");
                    // Ideally duplicate the logic above but ignoring cache
                    // For now just alias to same logical flow
                    // We'll separate this in STEP 7
                }}
            />

        </div>
    );

    return createPortal(content, document.body);
};

export default LocalReader;
