import React, { useEffect, useState } from 'react';
import { downloadService } from '../../services/downloads';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';

const DownloadProgress = () => {
    const [state, setState] = useState({
        queue: [],
        current: null,
        isDownloading: false,
        stats: { total: 0, completed: 0, failed: 0, percent: 0 }
    });

    const [visible, setVisible] = useState(false);

    // Drag State (Simple Absolute Positioning)
    const [position, setPosition] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 150 });
    const [dragging, setDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Subscribe to manager
        const unsub = downloadService.subscribe((newState) => {
            setState(newState);
            // Show if downloading or if items remain in queue
            if (newState.isDownloading || newState.queue.length > 0) {
                setVisible(true);
            } else if (newState.stats.total > 0 && newState.stats.completed + newState.stats.failed === newState.stats.total) {
                // If finished, hide immediately? As per previous request "Delete on finish".
                // But let's keep a tiny delay or just setVisible(false) via the render logic below.
                // Actually reset state?
                setTimeout(() => setVisible(false), 2000);
            }
        });
        return unsub;
    }, []);

    useEffect(() => {
        if (dragging) {
            const handleMove = (e) => {
                // Update position directly
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            };
            const handleUp = () => setDragging(false);

            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
            return () => {
                window.removeEventListener('pointermove', handleMove);
                window.removeEventListener('pointerup', handleUp);
            };
        }
    }, [dragging, dragOffset]);

    const handlePointerDown = (e) => {
        // Calculate offset from top-left of the element
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId); // Ensure we capture drag even if moving fast
    };

    if (!visible || state.stats.total === 0) return null;

    const { stats, current } = state;
    const isFinished = stats.completed + stats.failed === stats.total && stats.total > 0;

    if (isFinished) return null;

    return (
        <div
            onPointerDown={handlePointerDown}
            className="fixed z-[100] bottom-8 left-1/2 -translate-x-1/2 w-80 h-14 bg-black/60 backdrop-blur-3xl rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 flex items-center px-4 gap-4 cursor-grab active:cursor-grabbing select-none hover:bg-black/70 transition-colors"
            style={{
                touchAction: 'none'
            }}
        >
            {/* Icon Circle */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isFinished ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
                {isFinished ? <CheckCircle size={16} /> : <Download size={16} className={state.isDownloading ? 'animate-bounce' : ''} />}
            </div>

            {/* Info + Bar */}
            <div className="flex-1 flex flex-col justify-center gap-1.5">
                {/* Top Row: Filename (scrolling if long?) or just Stats */}
                <div className="flex items-center justify-between text-[10px] text-white/60 font-medium tracking-wide">
                    <span className="truncate max-w-[120px]">{current ? current.name : (isFinished ? 'Done' : 'Loading...')}</span>
                    <span className="font-mono opacity-80">{stats.completed}/{stats.total}</span>
                </div>

                {/* Progress Track */}
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white/90 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                        style={{ width: `${stats.percent}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default DownloadProgress;
