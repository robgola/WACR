import React, { useState, useCallback, useRef } from 'react';
import { ScanText, Languages, Loader2 } from 'lucide-react';

/**
 * ViewerControls
 * Touch-optimized controls for the comic viewer.
 * 
 * Props:
 * - onTranslate: () => void (Single Tap)
 * - onForceTranslate: () => void (Double Tap)
 * - onToggleTranslate: () => void
 * - showTranslated: boolean (Current State)
 * - isDetecting: boolean (Loading State)
 * - hasTranslation: boolean (If translation exists)
 */
const ViewerControls = ({
    onTranslate,
    onForceTranslate,
    onToggleTranslate,
    showTranslated,
    isDetecting,
    hasTranslation
}) => {
    // tap timer for double tap detection
    const lastTapRef = useRef(0);
    const timeoutRef = useRef(null);

    const handleTranslateTap = (e) => {
        e.stopPropagation();

        const now = Date.now();
        const DOUBLE_TAP_DELAY = 250; // ms

        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Double Tap Detected
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            console.log("forceTranslation()");
            if (onForceTranslate) onForceTranslate();
            lastTapRef.current = 0; // reset
        } else {
            // Potential Single Tap
            lastTapRef.current = now;
            timeoutRef.current = setTimeout(() => {
                console.log("startTranslation()");
                if (onTranslate) onTranslate();
                lastTapRef.current = 0;
            }, DOUBLE_TAP_DELAY);
        }
    };

    return (
        <>
            {/* Toggle Original / Translated (Bottom Left) */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    console.log("toggleOriginalTranslated()");
                    if (onToggleTranslate) onToggleTranslate();
                }}
                className={`fixed bottom-8 left-8 z-[220] flex items-center justify-center w-12 h-12 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all duration-300 active:scale-95 opacity-100 touch-manipulation`}
                style={{ minWidth: '44px', minHeight: '44px' }} // iOS Touch Target Rule
                title="Toggle Translation"
            >
                {showTranslated ? <Languages size={24} className="text-green-400" /> : <Languages size={24} className="text-white/50" />}
            </button>

            {/* Translate Button (Bottom Right) */}
            <button
                onClick={handleTranslateTap}
                className={`fixed bottom-8 right-8 z-[220] flex items-center justify-center w-12 h-12 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20 shadow-lg transition-all duration-300 active:scale-95 opacity-100 touch-manipulation`}
                style={{ minWidth: '44px', minHeight: '44px' }} // iOS Touch Target Rule
                title="Translate Page (Double tap to force)"
            >
                {isDetecting ? (
                    <Loader2 size={24} className="animate-spin text-blue-400" />
                ) : (
                    <ScanText size={24} className={hasTranslation ? "text-blue-400" : "text-white"} />
                )}
            </button>
        </>
    );
};

export default ViewerControls;
