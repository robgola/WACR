
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import AuthImage from './AuthImage';
import { parseComicInfo } from '../../utils/comicInfo';
import { formatLibraryTitle } from '../../utils/textUtils';


// Add Debug Import
import { Bug } from 'lucide-react';
import MetadataDebugModal from './MetadataDebugModal';

const ContinueReadingCarousel = ({ books = [], onRead, config, className = "" }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [enrichedMetadata, setEnrichedMetadata] = useState(null);
    const [showDebug, setShowDebug] = useState(false); // Debug State

    if (!books || books.length === 0) return null;

    const currentBook = books[currentIndex];

    // Effective Metadata: Merge Props > Parsed > Defaults
    const meta = {
        ...currentBook.metadata,
        ...(enrichedMetadata || {})
    };

    // Fetch ComicInfo if missing
    React.useEffect(() => {
        setEnrichedMetadata(null);

        // ALWAYS try to parse if blob is available (User request: prioritizes correctness over perf)
        // This ensures if IDB has "Default" data, we overwrite it with "Real" XML data
        if (currentBook.blob) {
            parseComicInfo(currentBook.blob).then(info => {
                if (info) setEnrichedMetadata(info);
            });
        }
    }, [currentBook]);

    // Defaults
    const height = config?.crHeight ?? 300;
    const margin = config?.crSideMargin ?? 0;
    const innerPadding = config?.crInnerPadding ?? 24;

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % books.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + books.length) % books.length);
    };

    // ... (rest of render until return)

    return (
        <div
            className={`w-auto mx-auto mb-8 transition-all duration-300 ${className}`}
            style={{
                marginLeft: `${margin}px`,
                marginRight: `${margin}px`,
            }}
        >
            {/* DEBUG MODAL */}
            {showDebug && currentBook && (
                <MetadataDebugModal
                    book={currentBook}
                    onClose={() => setShowDebug(false)}
                />
            )}

            <div
                className="relative group w-full rounded-xl overflow-hidden shadow-2xl bg-[#1C1C1E] border border-white/10 transition-all duration-300"
                style={{ height: `${height}px` }}
            >
                {/* ... (Background) ... */}
                <div className="absolute inset-0 z-0 h-full">
                    <AuthImage
                        src={currentBook.coverUrl}
                        className="w-full h-full object-cover opacity-30 blur-xl scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#1C1C1E] via-[#1C1C1E]/80 to-transparent" />
                </div>

                {/* Content Container */}
                <div
                    className="relative z-10 flex items-center h-full gap-6 transition-all duration-300"
                    style={{ padding: `${innerPadding}px` }}
                >
                    {/* Cover Image */}
                    <div
                        className="relative h-full flex-shrink-0 shadow-lg group/cover cursor-pointer transition-all duration-300"
                        style={{
                            width: config?.crCoverWidth ? `${config.crCoverWidth}%` : 'auto',
                            aspectRatio: '2/3'
                        }}
                        onClick={() => onRead(currentBook)}
                    >
                        <AuthImage
                            src={currentBook.coverUrl}
                            className="w-full h-full object-cover rounded-md border border-white/20 group-hover/cover:border-yellow-500 transition-colors"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-md pointer-events-none" />

                        {/* DEBUG BUTTON overlay on cover - Always Visible for Touch Devices */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowDebug(true); }}
                            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-blue-600 text-white rounded-full transition-all z-20 backdrop-blur-md border border-white/20 shadow-xl"
                            title="Inspect ComicInfo.xml"
                        >
                            <Bug size={18} />
                        </button>
                    </div>

                    {/* Metadata ... (rest of code) ... */}

                    {/* Metadata */}
                    {/* Metadata */}
                    {/* Metadata */}
                    <div
                        className="flex-1 flex flex-col justify-center gap-1.5 pr-8"
                        style={{ marginTop: `${config?.crTextTopMargin ?? 0}px` }}
                    >
                        {/* 1. SERIES (White, Bold) */}
                        <div className="text-white font-bold text-[22px] leading-tight drop-shadow-md">
                            {(() => {
                                const s = meta.seriesTitle || meta.series || currentBook.seriesTitle || currentBook.series || "Unknown Series";
                                const v = meta.volume || meta.v || currentBook.volume;
                                return v ? `${s} Vol.(${v})` : s;
                            })()}
                        </div>

                        {/* 2. TITLE (White, Italic) */}
                        <div className="text-white italic font-medium text-[18px] leading-tight drop-shadow-md opacity-90">
                            {formatLibraryTitle(currentBook.title || currentBook.name || "Untitled")}
                        </div>

                        {/* 3. NUMBER (White) */}
                        {(meta.number || currentBook.number) && (
                            <div className="text-white font-bold text-[16px] mt-0.5">
                                #{meta.number || currentBook.number}
                            </div>
                        )}

                        {/* CREDITS (Writer & Penciller) */}
                        <div className="flex flex-col gap-0.5 mt-2">
                            {meta?.authors?.find(a => a.role === 'writer')?.name && (
                                <p className="text-white/60 text-xs truncate">
                                    <span className="text-white/40 uppercase text-[10px] tracking-wider mr-2 font-bold">Writer:</span>
                                    {meta.authors.find(a => a.role === 'writer').name}
                                </p>
                            )}
                            {meta?.authors?.find(a => a.role === 'penciller')?.name && (
                                <p className="text-white/60 text-xs truncate">
                                    <span className="text-white/40 uppercase text-[10px] tracking-wider mr-2 font-bold">Penciller:</span>
                                    {meta.authors.find(a => a.role === 'penciller').name}
                                </p>
                            )}
                        </div>

                        {/* SUMMARY */}
                        {meta?.summary && (
                            <p className="text-white/50 text-[11px] leading-relaxed line-clamp-3 mt-2 max-w-xl">
                                {meta.summary}
                            </p>
                        )}
                    </div>
                </div>

                {/* Navigation Arrows */}
                {books.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-white/20 text-white/70 hover:text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-white/20 text-white/70 hover:text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ContinueReadingCarousel;
