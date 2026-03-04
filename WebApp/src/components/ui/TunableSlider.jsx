import React, { useState, useEffect } from 'react';

const TunableSlider = ({ control, activeConfig, setActiveConfig }) => {
    const [localValue, setLocalValue] = useState(activeConfig[control.key] || 0);
    const [isDragging, setIsDragging] = useState(false);

    // Sync with global config when not dragging (for resets/external changes)
    useEffect(() => {
        if (!isDragging) {
            setLocalValue(activeConfig[control.key] || 0);
        }
    }, [activeConfig[control.key], isDragging]);

    const commitChange = (newValue) => {
        const safeValue = Math.max(control.min, Math.min(control.max, newValue));
        setActiveConfig(prev => ({ ...prev, [control.key]: safeValue }));
        setLocalValue(safeValue);
    };

    return (
        <div className="space-y-2 mb-4 last:mb-0">
            <div className="flex justify-between text-white/70 text-[11px] font-bold uppercase tracking-wide">
                <span>{control.label}</span>
                <span className={`font-mono transition-colors ${isDragging ? 'text-yellow-300' : 'text-yellow-500'}`}>
                    {localValue}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => commitChange(localValue - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 transition-all text-white font-bold"
                >
                    -
                </button>

                <input
                    type="range"
                    min={control.min} max={control.max}
                    value={localValue}
                    onChange={(e) => {
                        setIsDragging(true);
                        setLocalValue(Number(e.target.value));
                    }}
                    onMouseUp={(e) => {
                        setIsDragging(false);
                        commitChange(Number(e.target.value));
                    }}
                    onTouchEnd={(e) => {
                        setIsDragging(false);
                        commitChange(localValue); // Touch event target value might be flaky, trust state
                    }}
                    className="flex-1 accent-yellow-500 bg-white/10 h-2 rounded-full appearance-none cursor-pointer"
                />

                <button
                    onClick={() => commitChange(localValue + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 transition-all text-white font-bold"
                >
                    +
                </button>
            </div>
        </div>
    );
};

export default TunableSlider;
