import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { ChevronLeft, ChevronRight, X, Loader2, Settings } from 'lucide-react';
import { downloadManager } from '../services/downloadManager';

const LocalReader = ({ bookId, onClose, config }) => {
    const [pages, setPages] = useState([]);
    const [currentPage, setCurrentPage] = useState(0); // 0-indexed
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showControls, setShowControls] = useState(false); // Default false per request

    // Tuner Config
    const topMargin = config?.comicTopMargin ?? 16;
    const sideMargin = config?.comicSideMargin ?? 16;

    // Load Book
    useEffect(() => {
        const loadBook = async () => {
            try {
                setLoading(true);
                console.log(`Open Local Reader for: ${bookId}`);
                const bookRecord = await downloadManager.getBook(bookId);

                if (!bookRecord || !bookRecord.blob) {
                    throw new Error("Book file not found offline.");
                }

                // Unzip
                const zip = await JSZip.loadAsync(bookRecord.blob);

                // Filter images
                const imageEntries = [];
                zip.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir && relativePath.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                        imageEntries.push(zipEntry);
                    }
                });

                // Natural Sort (Page 1, Page 2, Page 10...)
                imageEntries.sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                );

                console.log(`Found ${imageEntries.length} pages.`);

                // Create Object URLs (batch)
                const urls = await Promise.all(imageEntries.map(async (entry) => {
                    const blob = await entry.async('blob');
                    return URL.createObjectURL(blob);
                }));

                setPages(urls);
            } catch (err) {
                console.error(err);
                setError(err.message || "Failed to load book.");
            } finally {
                setLoading(false);
            }
        };

        loadBook();

        return () => {
            // Cleanup URLs on unmount to prevent memory leaks
            pages.forEach(url => URL.revokeObjectURL(url));
        };
    }, [bookId]);

    // Navigation
    const nextPage = useCallback(() => {
        if (currentPage < pages.length - 1) {
            setCurrentPage(p => p + 1);
            window.scrollTo(0, 0);
            // Also hide controls on tap if active? Maybe keep them sticky if active.
        }
    }, [currentPage, pages.length]);

    const prevPage = useCallback(() => {
        if (currentPage > 0) {
            setCurrentPage(p => p - 1);
        }
    }, [currentPage]);

    const handleTap = (e) => {
        // Simple 3-zone tap: Left=Prev, Center=Toggle, Right=Next
        const width = window.innerWidth;
        const x = e.clientX;

        // If controls are open, tapping center closes them?
        // User request: "When I enter... only visible the wheel, greyed out... if I click it becomes white and... Back appears"
        // So clicking screen acts as page turn? Or does it bring up controls?
        // Usually Center Tap = Toggle Controls.
        // Let's keep Standard behavior for navigation, but handle the specific UI elements visibility.
        // "When I open a comic it goes fullscreen... only visible the wheel"

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

    return (
        <div className="fixed inset-0 z-[200] bg-black overflow-hidden flex flex-col h-screen select-none">

            {/* FORCE FULLSCREEN / OVERLAY STATUS BAR AREA 
                We can't truly hide the browser chrome via JS, but we can make the background black 
                and position elements relative to safe area.
            */}

            {/* -- CONTROLS LAYER -- */}

            {/* 1. BACK BUTTON (Top-Left) - Only visible if showControls (Active) */}
            <button
                onClick={onClose}
                className={`fixed z-[210] flex items-center justify-center w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
                style={{
                    top: `${topMargin}px`,
                    left: `${sideMargin}px`
                }}
            >
                <ChevronLeft size={24} />
            </button>

            {/* 2. SETTINGS COG (Top-Right) - Always visible (Dimmed vs Active) */}
            <button
                onClick={toggleMenu}
                className={`fixed z-[210] flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 backdrop-blur-md shadow-lg ${showControls
                    ? 'bg-white text-black opacity-100 rotate-90 scale-110 shadow-white/20'  // Active State
                    : 'bg-black/20 text-white/30 border border-white/5 opacity-80 hover:bg-black/40' // Dimmed State
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
                {pages[currentPage] && (
                    <img
                        src={pages[currentPage]}
                        alt={`Page ${currentPage + 1}`}
                        className="max-h-full max-w-full object-contain select-none"
                        style={{ height: '100%', width: '100%', objectFit: 'contain' }}
                    />
                )}
            </div>

            {/* Optional Page Indicator (Bottom Center) - Only visible when controls Active */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-1 bg-black/50 backdrop-blur rounded-full border border-white/10 text-white-400 text-xs font-mono transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                {currentPage + 1} / {pages.length}
            </div>

        </div>
    );
};

export default LocalReader;
