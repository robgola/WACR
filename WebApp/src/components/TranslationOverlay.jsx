import React from 'react';

/**
 * Translation Overlay Component
 * Renders translated balloons over the comic page.
 * 
 * Props:
 * - items: Array of balloon objects { x, y, w, h, text, ... }
 *   Note: Coordinates are normalized (0.0 to 1.0) relative to image size.
 * - visible: boolean
 * - debug: boolean (draws borders)
 */
const TranslationOverlay = ({ items = [], visible = true, debug = false }) => {
    if (!visible || !items || items.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {items.map((item, index) => {
                // Support both formats: {x,y,w,h} or {box: [x,y,w,h]}
                const [x, y, w, h] = item.box || [item.x, item.y, item.w, item.h];

                if (x === undefined || w === undefined) return null;

                return (
                    <div
                        key={item.id || index}
                        className="absolute flex items-center justify-center p-1 text-center leading-tight select-none border-2 border-red-500 bg-red-500/20"
                        style={{
                            left: `${x * 100}%`,
                            top: `${y * 100}%`,
                            width: `${w * 100}%`,
                            height: `${h * 100}%`,
                            borderRadius: '4px', // Box for debug
                            color: 'white',
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            pointerEvents: 'none' // Click through
                        }}
                    >
                        {/* Debug Label */}
                        <span className="bg-black/80 px-1 rounded">
                            {item.text_preview || item.translated_text || `#${index + 1}`}
                        </span>
                    </div>
                )
            })}
        </div>
    );
};

export default TranslationOverlay;
