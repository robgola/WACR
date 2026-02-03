import React, { useState, useEffect } from 'react';

const DebugConsole = ({ logs = [], onClose, onResetStorage }) => {
    const [confirmReset, setConfirmReset] = useState(0); // 0: Idle, 1: Confirm, 2: Final
    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
            {/* Modal Container: 80% Width/Height */}
            <div className="w-[90%] md:w-[80%] h-[80%] bg-[#1C1C1E] border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">

                {/* Safe Area Header */}
                <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                        <span className="text-2xl">🐞</span>
                        System Logs
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-all hover:rotate-90"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono bg-black/20">
                    {/* Danger Zone */}
                    <div className="p-5 bg-red-900/10 border border-red-500/20 rounded-2xl mb-6">
                        <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                            <span className="text-lg">⚠️</span> Danger Zone
                        </h3>
                        <div className="flex flex-col gap-2">
                            {!confirmReset ? (
                                <button
                                    onClick={() => setConfirmReset(1)}
                                    className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 font-bold rounded-xl transition-all"
                                >
                                    Reset All Storage (OPFS & DB)
                                </button>
                            ) : (
                                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-red-300 text-sm font-bold text-center">
                                        {confirmReset === 1 ? "Are you sure? This deletes ALL downloads." : "FINAL WARNING: This action is irreversible!"}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setConfirmReset(0)}
                                            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirmReset === 1) setConfirmReset(2);
                                                else {
                                                    // Execute Reset
                                                    onResetStorage();
                                                    setConfirmReset(0);
                                                }
                                            }}
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg animate-pulse text-sm"
                                        >
                                            {confirmReset === 1 ? "Yes, Delete Everything" : "DESTROY DATA"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-48 text-white/30">
                            <div className="text-4xl mb-4">📝</div>
                            <div className="text-lg">No logs recorded yet.</div>
                        </div>
                    )}
                    {logs.map((log, i) => (
                        <div
                            key={i}
                            className={`p-3 rounded-lg border border-white/5 flex gap-3 text-xs ${log.type === 'error'
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-white/5'
                                }`}
                        >
                            <div className="flex flex-col gap-0.5 min-w-[70px]">
                                <span className="text-white/40 font-bold uppercase tracking-wider text-[9px]">{log.type}</span>
                                <span className="text-white/30 text-[9px] font-mono">{log.timestamp.split(' ')[1]}</span>
                            </div>
                            <div className={`flex-1 break-words leading-relaxed font-mono ${log.type === 'error' ? 'text-red-200' : 'text-white/80'}`}>
                                {log.message}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DebugConsole;
