import React, { useState, useEffect } from 'react';
import GlassCard from './GlassCard';

const DownloadConfirmationDialog = ({ isOpen, targetNode, onClose, onConfirm }) => {
    const [analyzing, setAnalyzing] = useState(true);
    const [stats, setStats] = useState({ folders: 0, series: 0, books: 0 });

    useEffect(() => {
        if (!isOpen || !targetNode) return;

        setAnalyzing(true);
        setStats({ folders: 0, series: 0, books: 0 });

        const targets = Array.isArray(targetNode) ? targetNode : [targetNode];

        let fCount = 0;
        let sCount = 0;
        let bCount = 0;

        const count = (node) => {
            if (node.type === 'folder' || node.children) {
                if (node.children) node.children.forEach(c => { fCount++; count(c); });
                if (node.series) node.series.forEach(s => { sCount++; bCount += s.booksCount || 0; });
            } else if (node.type === 'series' || node.booksCount !== undefined) {
                sCount++;
                bCount += node.booksCount || 0;
            }
        };

        targets.forEach(t => count(t));
        targets.forEach(t => { if (t.type === 'folder') fCount++; });

        setStats({ folders: fCount, series: sCount, books: bCount });
        setAnalyzing(false);
    }, [isOpen, targetNode]);

    const handleConfirm = async () => {
        // Fire and forget (let App manage background task)
        onClose();
        onConfirm(targetNode, () => { }); // No progress callback needed locally
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-sm animate-in zoom-in-95 duration-200">
                <GlassCard className="p-8 border border-white/5 shadow-2xl bg-[#000000]/80 backdrop-blur-3xl flex flex-col items-center text-center">

                    <h2 className="text-2xl font-light text-white mb-2 tracking-wide">
                        Start Download?
                    </h2>

                    <div className="w-16 h-px bg-white/10 my-6" />

                    {/* Stats (Text Only, Spaced) */}
                    <div className="flex justify-center gap-8 w-full mb-8">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-3xl font-light text-white leading-none">{stats.folders}</span>
                            <span className="text-[9px] text-white/30 uppercase tracking-[0.2em]">Folders</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-3xl font-light text-white leading-none">{stats.series}</span>
                            <span className="text-[9px] text-white/30 uppercase tracking-[0.2em]">Series</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-3xl font-light text-white leading-none">{stats.books}</span>
                            <span className="text-[9px] text-white/30 uppercase tracking-[0.2em]">Books</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 rounded-xl text-white/50 hover:text-white transition-colors font-light text-sm tracking-wide"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={analyzing}
                            className="flex-1 py-4 rounded-2xl bg-white text-black hover:bg-white/90 transition-colors font-semibold tracking-wide shadow-lg shadow-white/10"
                        >
                            {analyzing ? "Analyzing..." : "Confirm"}
                        </button>
                    </div>

                </GlassCard>
            </div>
        </div>
    );
};

export default DownloadConfirmationDialog;
