import React, { useState, useEffect } from 'react';
import GlassCard from './GlassCard';
import { libraryManager } from '../../services/LibraryManager';
import { downloadService } from '../../services/downloads';
import { Pause, Play, Square, X, CheckCircle, AlertCircle } from 'lucide-react';

const DownloadConfirmationDialog = ({ isOpen, targetNode, onClose, onConfirm }) => {
    const [phase, setPhase] = useState('confirm'); // 'confirm' | 'progress' | 'complete'
    const [analyzing, setAnalyzing] = useState(true);
    const [stats, setStats] = useState({ folders: 0, series: 0, comics: 0 });
    const [downloadList, setDownloadList] = useState([]);

    // Download State (Phase 2)
    const [progressState, setProgressState] = useState({
        total: 0,
        completed: 0,
        failed: 0,
        percent: 0,
        isPaused: false,
        isDownloading: false
    });

    const [hasFinished, setHasFinished] = useState(false);

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setPhase('confirm');
            setAnalyzing(true);
            setHasFinished(false);
            setDownloadList([]);
            analyzeTargets();
        }
    }, [isOpen, targetNode]);

    // Phase 2: Subscribe to DownloadService
    useEffect(() => {
        if (!isOpen) return;

        const unsub = downloadService.subscribe((state) => {
            const { completed, failed, total } = state.stats;

            setProgressState({
                total: total,
                completed: completed,
                failed: failed,
                percent: state.stats.percent,
                isPaused: state.isPaused,
                isDownloading: state.isDownloading
            });

            // Check Completion - More robust logic
            // If we have items and we processed them all
            if (total > 0 && (completed + failed) >= total) {
                if (!hasFinished) {
                    setHasFinished(true);
                    setPhase('complete');
                    // Optionally notify parent if needed, but UI handles it
                }
            }
        });
        return unsub;
    }, [isOpen, hasFinished]);

    const analyzeTargets = async () => {
        try {
            // 1. Resolve recursive list using LibraryManager
            const targets = Array.isArray(targetNode) ? targetNode : [targetNode];
            const list = await libraryManager.resolveDownloadList(targets);
            setDownloadList(list);

            // 2. Calculate Stats
            const uniqueFolders = new Set();
            const uniqueSeries = new Set();
            let comicsCount = 0;

            list.forEach(item => {
                // Folder Count
                let fPath = item.folderPath ? item.folderPath.replace(/\\/g, '/').replace(/\/$/, '') : "";
                uniqueFolders.add(fPath);

                // Series Count
                // Try metadata first, fallback to context props
                const seriesTitle = item.metadata?.seriesTitle || item.seriesTitle || item.metadata?.series;
                if (seriesTitle) uniqueSeries.add(seriesTitle);

                // Comic Count (.cbz/.cbr) - Assuming resolveDownloadList returns files
                // We check existing name logic or just trust it's a file from resolveDownloadList
                if (/\.(cbz|cbr)$/i.test(item.name)) {
                    comicsCount++;
                }
            });

            setStats({
                folders: uniqueFolders.size,
                series: uniqueSeries.size,
                comics: comicsCount
            });
        } catch (e) {
            console.error("Analysis failed", e);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleConfirm = () => {
        setPhase('progress');
        onConfirm(targetNode, () => { });
    };

    const handleClose = () => {
        // If complete, close fully (reset handled by isOpen effect)
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Darker Backdrop for Pop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity" />

            <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
                {/* PREMIUM LIQUID GLASS UI */}
                {/* - High Blur (3xl)
                    - Translucent Dark Grey BG (bg-[#1C1C1E]/80)
                    - Thin White Border (border-white/10)
                    - heavy Shadow
                    - Padding increased to p-10 
                */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#1C1C1E]/80 backdrop-blur-3xl shadow-[0_40px_80px_-12px_rgba(0,0,0,0.8)] p-10 flex flex-col text-center">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-2xl font-semibold text-white tracking-wide drop-shadow-sm">
                            {phase === 'confirm' && "Download Content"}
                            {phase === 'progress' && "Downloading..."}
                            {phase === 'complete' && "Task Complete"}
                        </h2>
                        {/* Close Button - iOS Style Circle */}
                        {(phase !== 'progress' || !progressState.isDownloading) && (
                            <button onClick={handleClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/60 hover:text-white transition-all">
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {phase === 'confirm' && (
                        <>
                            {/* PHASE 1: Stats */}
                            <div className="flex justify-center gap-8 w-full mb-12">
                                <CountItem count={stats.folders} label="Folders" />
                                <CountItem count={stats.series} label="Series" />
                                <CountItem count={stats.comics} label="Comics" />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={handleClose}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors font-medium text-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={analyzing || stats.comics === 0}
                                    className="flex-1 py-4 rounded-2xl bg-white text-black hover:bg-white/90 transition-colors font-bold shadow-lg shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                                >
                                    {analyzing ? "Analyzing..." : "Start"}
                                </button>
                            </div>
                        </>
                    )}

                    {phase === 'progress' && (
                        <div className="space-y-10">
                            {/* Stats Row */}
                            <div className="flex justify-between text-base font-medium text-white/80 px-2 tracking-wide">
                                <span>{progressState.completed} / {progressState.total} items</span>
                                <span>{progressState.percent}%</span>
                            </div>

                            {/* Current File Name */}
                            <div className="text-center h-6">
                                <p className="text-xs text-white/50 truncate font-mono px-4">
                                    {progressState.currentFile || "Preparing..."}
                                </p>
                            </div>

                            {/* Progress Bar - Thicker, Glowing */}
                            <div className="h-6 w-full bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5">
                                <div
                                    className={`h-full transition-all duration-300 relative ${progressState.isPaused ? 'bg-yellow-500' : 'bg-white'}`}
                                    style={{ width: `${progressState.percent}%` }}
                                >
                                    {!progressState.isPaused && <div className="absolute inset-0 bg-white/50 blur-[4px]" />}
                                </div>
                            </div>

                            {/* Controls: iOS Style Glass Buttons */}
                            <div className="flex items-center justify-center gap-10 mt-8">
                                {progressState.isPaused ? (
                                    <button
                                        onClick={() => downloadService.resume()}
                                        className="w-16 h-16 flex items-center justify-center rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 transition-all active:scale-95 shadow-lg shadow-green-900/20"
                                        title="Resume"
                                    >
                                        <Play size={28} fill="currentColor" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => downloadService.pause()}
                                        disabled={!progressState.isDownloading || progressState.percent === 100}
                                        className="w-16 h-16 flex items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-yellow-900/20"
                                        title="Pause"
                                    >
                                        <Pause size={28} fill="currentColor" />
                                    </button>
                                )}

                                <button
                                    onClick={() => downloadService.stop()}
                                    disabled={!progressState.isDownloading && progressState.percent !== 100}
                                    className="w-16 h-16 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-red-900/20"
                                    title="Stop"
                                >
                                    <Square size={28} fill="currentColor" />
                                </button>
                            </div>

                            {progressState.isPaused && (
                                <p className="text-sm text-yellow-400/80 mt-2 font-medium">Paused (finishing current file...)</p>
                            )}
                        </div>
                    )}

                    {phase === 'complete' && (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                            <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mb-8 text-green-400 shadow-[0_0_50px_rgba(74,222,128,0.1)] border border-green-500/20">
                                <CheckCircle size={48} strokeWidth={2} />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-2">Success</h3>
                            <p className="text-white/60 mb-10 text-lg">
                                {progressState.completed} items downloaded.
                                {progressState.failed > 0 && <span className="block text-red-400 mt-2 font-medium">({progressState.failed} failed)</span>}
                            </p>

                            <button
                                onClick={handleClose}
                                className="w-full py-4 rounded-2xl bg-white text-black hover:bg-white/90 transition-colors font-bold text-lg shadow-xl shadow-white/5"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CountItem = ({ count, label }) => (
    <div className="flex flex-col items-center gap-2 px-4">
        <span className="text-4xl font-thin text-white leading-none tracking-tighter">{count}</span>
        <span className="text-xs text-white/40 uppercase tracking-[0.2em] font-medium">{label}</span>
    </div>
);

export default DownloadConfirmationDialog;
