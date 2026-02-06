import React, { useEffect, useState } from 'react';
import { localLibrary } from '../../services/localLibrary';
import { downloadService } from '../../services/downloads'; // For reset potentially?
import { ArrowLeft, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StorageInspector = ({ onClose }) => {
    // const navigate = useNavigate(); // Not needed in Modal mode
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const downloads = await localLibrary.getAllDownloads();
            // Map to simplified view
            const mapped = downloads.map(d => ({
                id: d.id,
                title: d.title || d.name || "Untitled",
                path: d.folderPath,
                size: d.blob?.size || 0,
                hasCover: !!d.coverUrl,
                coverSize: d.coverBlob?.size || 'N/A',
                downloadedAt: new Date(d.downloadedAt).toLocaleString()
            }));
            setItems(mapped.sort((a, b) => a.path.localeCompare(b.path)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (id) => {
        if (confirm('Delete this item?')) {
            await localLibrary.deleteBook(id);
            loadData();
        }
    };

    const handleWipe = async () => {
        // Double Confirmation as requested by user
        if (!confirm('WARNING: This will wipe ALL downloaded comics and local data.\n\nAre you sure you want to proceed?')) {
            return;
        }
        if (!confirm('FINAL CONFIRMATION: This cannot be undone.\n\nDelete everything?')) {
            return;
        }

        try {
            setLoading(true);
            await localLibrary.reset();
            alert("Storage successfully wiped.");
            onClose(); // Close modal on success
        } catch (e) {
            console.error("Wipe failed", e);
            alert(`Failed to wipe storage: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 text-white font-sans">
            {/* Modal Container */}
            <div className="w-[90%] md:w-[80%] h-[80%] bg-[#1C1C1E] border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">

                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
                            <span className="text-2xl">💾</span> Storage
                        </h1>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={loadData}
                            className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <button
                            onClick={handleWipe}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors flex items-center gap-2 shadow-lg shadow-red-900/20 text-sm"
                        >
                            <Trash2 size={18} />
                            <span className="hidden sm:inline">Wipe DB</span>
                        </button>
                    </div>
                </div>

                {/* Content Scroller */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-black/20">
                    {loading ? (
                        <div className="flex justify-center p-12 text-white/50 text-lg">Loading database entries...</div>
                    ) : (
                        <div className="space-y-4 max-w-5xl mx-auto">
                            {/* Header Row (Desktop only) */}
                            <div className="hidden md:grid grid-cols-12 gap-4 text-white/40 text-xs font-bold uppercase tracking-wider px-4">
                                <div className="col-span-5">Title / Path</div>
                                <div className="col-span-2">Size</div>
                                <div className="col-span-2">Cover</div>
                                <div className="col-span-3">Action</div>
                            </div>

                            {items.length === 0 && (
                                <div className="p-12 text-center text-white/30 text-lg bg-white/5 rounded-2xl border border-white/5 border-dashed">
                                    Database is empty. No downloads found.
                                </div>
                            )}

                            {items.map(item => (
                                <div
                                    key={item.id}
                                    className="bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-white/5 rounded-xl p-3 transition-colors flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center"
                                >
                                    {/* Title & Path */}
                                    <div className="col-span-5 overflow-hidden w-full">
                                        <div className="text-white font-bold text-sm truncate mb-0.5">{item.title || "Untitled"}</div>
                                        <div className="text-white/40 text-[10px] font-mono truncate bg-black/30 px-2 py-0.5 rounded inline-block">
                                            {item.path || "Root"}
                                        </div>
                                    </div>

                                    {/* Size */}
                                    <div className="col-span-2 text-white/70 text-xs font-mono">
                                        {(item.size / 1024 / 1024).toFixed(2)} MB
                                    </div>

                                    {/* Cover Status */}
                                    <div className="col-span-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.hasCover ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {item.hasCover ? 'OK' : 'MISSING'}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-3 w-full md:w-auto flex justify-end">
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                            title="Delete Item"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StorageInspector;
