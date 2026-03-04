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
                    if (isDetecting) return;

                    const pipeline = localStorage.getItem('acr_ai_pipeline') || 'local';

                    if (pipeline === 'local') {
                        // ... Local Logic (Refactored to Module)
                        try {
                            setIsDetecting(true);
                            console.log("Starting Local ONNX Detection...");

                            const currentUrl = pages[currentPage];
                            const response = await fetch(currentUrl);
                            const blob = await response.blob();

                            // 1. DETECTION
                            const result = await detectionModule.detectBalloons(blob);
                            console.log("Local Results:", result);

                            let balloons = result.balloons;

                            // Show Detection Immediately only if Debug Mode is ON
                            if (settings?.debugMode) {
                                setOverlayItems(balloons);
                                setShowTranslated(true);
                            }

                            // 2. OCR (Async Update)
                            // Ideally show a "scanning..." state on the balloons?
                            console.log("Starting OCR...");

                            balloons = await ocrModule.extractText(blob, balloons, (curr, total) => {
                                // Optional: Update a progress bar or just log
                                console.log(`OCR Progress: ${curr}/${total}`);
                            });

                            // Update Overlay with Text
                            setOverlayItems([...balloons]); // Force re-render
                            setHasTranslation(true); // Now we have "originals" at least

                            // 3. TRANSLATION (Async Update via WebLLM)
                            console.log("Starting WebLLM Translation...");

                            // Initialize with progress callback to show download status
                            // Ideally this would update a neat UI progress bar, but console is fine for now
                            await translateModule.init((report) => {
                                console.log("[Download Progress]", report);
                            });

                            balloons = await translateModule.translateBalloons(balloons, (curr, total) => {
                                console.log(`Translate Progress: ${curr}/${total}`);
                                setOverlayItems([...balloons]); // Update UI sequentially as balloons are translated
                            });

                            // Ensure GPU is freed after processing the page
                            await translateModule.destroy();

                            // SAVE TO ACR
                            const pageData = {
                                status: "translated", // fully finished
                                source: "offline_yolov8_paddle_qwen",
                                balloons: balloons,
                                processing_time_ms: result.processing_time_ms,
                                image_dimensions: result.image_dimensions
                            };
                            setHasTranslation(true);

                            if (settings?.debugMode) {
                                alert(`Analysis & Translation Complete!\nDetected: ${balloons.length}`);
                            }

                        } catch (err) {
                            console.error("Local Detection Failed:", err);
                            alert(`Local Detection Failed: ${err.message}`);
                        } finally {
                            setIsDetecting(false);
                        }
                        return;
                    }

                    // GEMINI LOGIC (Hybrid YOLO + Cloud)
                    try {
                        setIsDetecting(true);
                        console.log("Starting Cloud Hybrid Pipeline: YOLO (Local) -> Gemini (Cloud)...");

                        const currentUrl = pages[currentPage];
                        const response = await fetch(currentUrl);
                        const blob = await response.blob();

                        const apiKey = localStorage.getItem('acr_gemini_api_key');
                        if (!apiKey) throw new Error("Missing Gemini API Key in Settings.");

                        // 1. DETECTION (Local YOLO)
                        console.log("[Hybrid] Detecting balloons with local YOLO...");
                        const detectionResult = await detectionModule.detectBalloons(blob);
                        let balloons = detectionResult.balloons;

                        if (balloons.length === 0) {
                            showToast("No speech bubbles detected on this page.", "warning");
                            setIsDetecting(false);
                            return;
                        }

                        // Show Detection Immediately only if Debug Mode is ON
                        if (settings?.debugMode) {
                            setOverlayItems(balloons);
                            setShowTranslated(true);
                        }

                        // 2. OCR & TRANSLATION (Cloud Gemini)
                        console.log("[Hybrid] Sending batch balloon crops to Gemini 2.5 Flash...");
                        balloons = await geminiService.translateBalloons(blob, balloons);

                        // Update Overlay with Text
                        setOverlayItems([...balloons]);
                        setHasTranslation(true);
                        setShowTranslated(true);

                        // SAVE TO ACR
                        await acrStorage.setPageTranslation(bookId, currentPage, {
                            status: "translated",
                            source: "hybrid_yolo_gemini",
                            balloons: balloons,
                            processing_time_ms: detectionResult.processing_time_ms
                        });

                        if (settings?.debugMode) {
                            showToast(`Cloud Translation Complete! Processed ${balloons.length} balloons.`, "success");
                        }

                    } catch (err) {
                        console.error("Cloud Translation Failed:", err);
                        showToast(`Cloud Translation Failed: ${err.message}`, "error");
                    } finally {
                        setIsDetecting(false);
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
