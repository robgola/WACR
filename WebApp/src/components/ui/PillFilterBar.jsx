import React, { useRef, useEffect } from 'react';

const PillFilterBar = ({ tabs, selectedTab, onSelect, config, className = "" }) => {
    const scrollRef = useRef(null);

    // Auto-scroll to selected tab
    useEffect(() => {
        if (scrollRef.current) {
            const selectedEl = scrollRef.current.querySelector(`[data-tab="${selectedTab}"]`);
            if (selectedEl) {
                selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [selectedTab]);

    // Defaults if config is missing (fallbacks)
    const padX = config?.libPillPaddingX ?? 16;
    const padY = config?.libPillPadY ?? 8;
    const fontSize = config?.libPillFontSize ?? 16;
    const gap = config?.libBarGap ?? 16;
    const padLeft = config?.libBarPadLeft ?? 16;

    // New Tuner Props
    const height = config?.libPillHeight ?? 'auto';

    // Dynamic Color Generator
    const getTabColor = (str) => {
        const lower = str.toLowerCase();
        if (lower === 'tutte' || lower === 'all') return 'hsl(0, 85%, 60%)'; // Red for All

        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // HSL: 0-360 Hue, 75-90% Saturation, 55-65% Lightness for vibrancy
        const h = Math.abs(hash) % 360;
        return `hsl(${h}, 85%, 60%)`;
    };

    return (
        <div className={`w-full relative ${className}`}>
            {/* Background Blur Layer matching 'Continue Reading' style */}
            {/* Background Removed - Handled by Parent Wrapper */}

            <div
                ref={scrollRef}
                className="relative z-10 flex items-center overflow-x-auto no-scrollbar mask-linear-fade w-full"
                style={{
                    gap: `${gap}px`,
                    paddingLeft: `${padLeft}px`,
                    paddingRight: `${padLeft}px`,
                    paddingTop: '12px',
                    paddingBottom: '12px'
                }}
            >
                {tabs.map(tab => {
                    const isSelected = selectedTab === tab;
                    const baseColor = getTabColor(tab);

                    return (
                        <button
                            key={tab}
                            data-tab={tab}
                            onClick={() => onSelect(tab)}
                            style={{
                                paddingLeft: `${padX}px`,
                                paddingRight: `${padX}px`,
                                paddingTop: `${padY}px`,
                                paddingBottom: `${padY}px`,
                                fontSize: `${fontSize}px`,
                                lineHeight: '100%', // Critical for vertical centering
                                display: 'flex', // Use flex to center content
                                alignItems: 'center', // Vertical center
                                justifyContent: 'center', // Horizontal center

                                height: height === 'auto' ? 'auto' : `${height}px`,
                                // Dynamic Colors
                                borderColor: baseColor,
                                color: isSelected ? '#FFFFFF' : baseColor, // Invert Text
                                backgroundColor: isSelected ? baseColor : 'transparent', // Invert BG
                                boxShadow: isSelected ? `0 4px 12px ${baseColor.replace(')', ', 0.4)')}` : 'none',
                                textShadow: isSelected ? 'none' : '0 1px 2px rgba(0,0,0,0.5)' // Readability for colored text
                            }}
                            className={`
                            rounded-full font-bold whitespace-nowrap transition-all duration-300
                            border-2 backdrop-blur-md
                            ${isSelected ? 'scale-105' : 'hover:bg-white/5'}
                        `}
                        >
                            {tab}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default PillFilterBar;
