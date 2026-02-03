import React, { memo } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import AuthImage from './AuthImage';
import { formatLibraryTitle } from '../../utils/textUtils';

const ComicBox = memo((props) => {
    const {
        title,
        itemCount,
        coverUrl,
        covers = [],
        color = '#364D73',
        variant = 'book',
        isDownloaded,
        selectionMode = false,
        isSelected = false,
        onToggleSelect,
        onClick,
        number
    } = props;

    // Styles based on Swift LibraryBoxView & User Feedback
    // Lid Height = 22%
    // Body Height = 78% (implied remaining)
    // The "Blue Box" surrounds the entire shape.

    // Folder Variant Colors (Yellow/Gold)
    const isFolder = variant === 'folder';
    const boxBg = isFolder ? '#854D0E' : '#334155'; // Dark Yellow vs Slate
    const borderColor = isFolder ? '#EAB308' : '#2563eb'; // Yellow-500 vs Blue-600

    // Normalize input
    const displayCovers = coverUrl ? [coverUrl] : covers;
    const hasCovers = displayCovers.length > 0;
    const mainCover = hasCovers ? displayCovers[0] : null;

    // Green Triangle Indicator for Local/Downloaded Items
    const DownloadIndicator = () => (
        <div className="absolute top-0 left-0 w-0 h-0 border-t-[40px] border-r-[40px] border-t-green-500 border-r-transparent z-30 pointer-events-none drop-shadow-md">
            <div className="absolute top-[-36px] left-[2px] w-2 h-2 bg-white rounded-full shadow-sm" />
        </div>
    );

    // Selection Overlay
    const SelectionOverlay = () => (
        <div className={`absolute inset-0 z-40 transition-colors duration-200 ${isSelected ? 'bg-blue-500/20 box-border border-4 border-blue-500' : 'bg-transparent hover:bg-white/10'}`}>
            <div className="absolute top-2 right-2">
                {isSelected ? (
                    <CheckCircle2 className="text-blue-500 bg-white rounded-full" size={24} fill="currentColor" />
                ) : (
                    <Circle className="text-white/50" size={24} />
                )}
            </div>
        </div>
    );

    const handleClick = (e) => {
        if (selectionMode) {
            e.stopPropagation();
            if (onToggleSelect) onToggleSelect();
        } else {
            if (onClick) onClick(e);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`flex flex-col items-center w-full group cursor-pointer transition-transform duration-200 ${selectionMode ? 'scale-95' : 'active:scale-95'} select-none`}
        >

            {/* Conditional Rendering: Folder (3D Box) vs Book (2D Cover) */}
            {isFolder ? (
                <div className={`relative w-full aspect-[0.75] flex flex-col items-center justify-center rounded-lg border-[3px] shadow-lg overflow-hidden transition-colors duration-300`}
                    style={{
                        backgroundColor: color || '#364D73',
                        borderColor: isSelected ? '#3b82f6' : (color || '#2563eb') // Highligh border if selected
                    }}
                >
                    {/* DOWNLOAD INDICATOR */}
                    {isDownloaded && <DownloadIndicator />}

                    {/* SELECTION OVERLAY */}
                    {selectionMode && <SelectionOverlay />}

                    {/* 2. The 3D Box Shape (Lid + Body) */}
                    <div className="relative w-[85%] h-[85%] flex flex-col items-center">
                        {/* LID (Top Layer) - 22% Height */}
                        <div className="relative w-full h-[22%] z-20">
                            <div className="absolute inset-0 bg-gray-800 rounded-t-sm border-[2px] border-black shadow-sm overflow-hidden">
                                {mainCover && (
                                    <div className="w-full h-full relative overflow-hidden">
                                        <AuthImage
                                            src={mainCover}
                                            className="absolute w-full h-[455%] object-cover object-top"
                                            style={{ top: '0%' }}
                                            alt=""
                                        />
                                        <div className="absolute inset-0 bg-white/20 pointer-events-none" />
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* BODY (Bottom Layer) - 78% Height */}
                        <div className="relative w-[92%] h-[78%] -mt-[1px] z-10">
                            <div className="absolute inset-0 bg-gray-800 border-[2px] border-t-0 border-black rounded-b-md overflow-hidden shadow-md">
                                {mainCover && (
                                    <div className="w-full h-full relative overflow-hidden">
                                        <AuthImage
                                            src={mainCover}
                                            className="absolute w-full h-[129%] object-cover object-top"
                                            style={{ top: '-28.2%' }}
                                            alt=""
                                        />
                                        {/* FOLDER OVERLAY: Enhanced gradient for visibility */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>


                </div>
            ) : (
                // BOOK VARIANT (Simple 2D Cover)
                <div className={`relative w-full aspect-[2/3] flex flex-col shadow-xl rounded overflow-hidden group-hover:scale-105 transition-transform duration-200 ${isSelected ? 'ring-4 ring-blue-500' : ''}`}>
                    {isDownloaded && <DownloadIndicator />}
                    {selectionMode && <SelectionOverlay />}
                    <AuthImage
                        src={mainCover}
                        className="w-full h-full object-cover"
                        alt={title}
                    />
                    {/* Subtle gradient at bottom for depth */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80 pointer-events-none" />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors pointer-events-none" />
                </div>
            )}

            {/* Metadata Fields (Common for both variants) */}
            <div className="mt-2 text-center w-full px-1 space-y-0.5">
                {/* 1. Title */}
                <p className="text-white text-sm font-bold leading-tight line-clamp-2 drop-shadow-md">
                    {formatLibraryTitle(title)}
                </p>

                {/* 2. Number */}
                {number && <p className="text-white text-xs font-bold tracking-wider">#{number}</p>}

                {/* Item Count (for Folders) */}
                {itemCount !== undefined && (
                    <p className="text-[10px] text-white/70 mt-0.5 font-bold tracking-wider">Book # {itemCount}</p>
                )}
            </div>
        </div>
    );
});

export default ComicBox;
