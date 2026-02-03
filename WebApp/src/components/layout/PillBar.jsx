import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const PillBar = ({ items, activeId, onSelect }) => {

    // Helper to generate consistent colors from string ID
    const getColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // HSL for nice colors (Saturation 90%, Lightness 60%)
        const h = Math.abs(hash) % 360;
        return `hsl(${h}, 90%, 60%)`;
    };

    return (
        <div className="flex items-center justify-center p-2 gap-3 flex-wrap">
            {items.map((item) => {
                const isActive = activeId === item.id;
                const color = getColor(item.id || item.label);

                return (
                    <button
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        className={clsx(
                            "relative px-4 py-2 text-sm font-bold rounded-full transition-all duration-300 z-10 border-2 select-none",
                            // Interactions handled by style mostly to support dynamic colors
                        )}
                        style={{
                            borderColor: color,
                            backgroundColor: isActive ? color : 'transparent',
                            color: isActive ? '#000000' : '#FFFFFF', // Invert: Active=ColorBG/BlackText, Inactive=Transp/WhiteText
                            // User said: "pills... border distinct color... when selected invert bg with text"
                            // If inactive text is white, active bg should be white? 
                            // Re-reading: "bordo colore diverso... inverti sfondo con testo"
                            // Scheme A: Inactive [Border=Col, Text=Col, BG=Transp] -> Active [Border=Col, Text=Black, BG=Col]
                            // Scheme B (Current Code): Inactive [Border=Col, Text=White, BG=Transp] -> Active [Border=Col, Text=Black, BG=Col]
                            // Let's stick to Scheme B (White text inactive is standard for dark mode apps).
                            boxShadow: isActive ? `0 0 15px ${color}` : 'none',
                        }}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
};

export default PillBar;
