import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HardDrive, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import AuthImage from './ui/AuthImage';
import ComicBox from './ui/ComicBox';
import { cacheManager } from '../services/cacheManager';

const RemoteLibrary = ({ config }) => {
    const { komgaService, connectionStatus, settings, cache, updateCache } = useApp();

    const CACHE_KEY_LIBS = 'libraries-list';
    const memoryCache = cache[CACHE_KEY_LIBS];

    const [libraries, setLibraries] = useState(memoryCache || []);
    const [loading, setLoading] = useState(!memoryCache || memoryCache.length === 0);

    const [bgImage, setBgImage] = useState(() => {
        if (memoryCache && memoryCache.length > 0) {
            const all = memoryCache.flatMap(l => l.covers || []);
            if (all.length > 0) return all[Math.floor(Math.random() * all.length)];
        }
        return null;
    });

    const serverTop = config?.serverBarTop ?? 30;
    const gridMargin = config?.gridTop ?? 100;

    useEffect(() => {
        if (!komgaService) return;

        const fetchLibs = async () => {
            const localHasData = libraries.length > 0;
            const globalHasData = memoryCache && memoryCache.length > 0;
            const hasData = localHasData || globalHasData;

            if (hasData) {
                setLoading(false);
            } else {
                setLoading(true);
            }

            let cachedFromIDB = [];
            try {
                cachedFromIDB = await cacheManager.get(CACHE_KEY_LIBS) || [];
                if (cachedFromIDB.length > 0 && (!memoryCache || memoryCache.length === 0)) {
                    setLibraries(cachedFromIDB);
                    updateCache(CACHE_KEY_LIBS, cachedFromIDB);
                    setLoading(false);

                    const allCovers = cachedFromIDB.flatMap(l => l.covers || []);
                    if (allCovers.length > 0) {
                        setBgImage(allCovers[Math.floor(Math.random() * allCovers.length)]);
                    }
                }
            } catch (e) {
                console.warn("IDB Read Error", e);
            }

            const currentLibs = cachedFromIDB.length > 0 ? cachedFromIDB : (memoryCache || []);
            const needsRepair = currentLibs.some(l => !l.covers || l.covers.length === 0);
            const isTotallyEmpty = currentLibs.length === 0;

            if (!isTotallyEmpty && !needsRepair) {
                return;
            }

            if (connectionStatus !== 'connected') {
                if (connectionStatus === 'error' && isTotallyEmpty) setLoading(false);
                return;
            }

            if (isTotallyEmpty) setLoading(true);

            try {
                const fetchPromise = komgaService.getLibraries();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000));

                const libs = await Promise.race([fetchPromise, timeoutPromise]);

                const librariesWithCovers = [];
                for (const lib of libs) {
                    const existing = currentLibs.find(c => String(c.id) === String(lib.id));

                    try {
                        const seriesPromise = komgaService.getSeries(lib.id, 0, 3);
                        const coverTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));

                        const series = await Promise.race([seriesPromise, coverTimeout]);
                        const covers = series.content.map(s => `${komgaService.baseUrl}/series/${s.id}/thumbnail`);

                        if (covers.length > 0) {
                            librariesWithCovers.push({ ...lib, covers });
                        } else if (existing && existing.covers && existing.covers.length > 0) {
                            librariesWithCovers.push({ ...lib, covers: existing.covers });
                        } else {
                            librariesWithCovers.push({ ...lib, covers: [] });
                        }

                    } catch (e) {
                        console.warn(`Failed to fetch covers for ${lib.name}:`, e);
                        if (existing && existing.covers && existing.covers.length > 0) {
                            librariesWithCovers.push({ ...lib, covers: existing.covers });
                        } else {
                            librariesWithCovers.push({ ...lib, covers: [] });
                        }
                    }
                }

                setLibraries(librariesWithCovers);
                updateCache(CACHE_KEY_LIBS, librariesWithCovers);

                const allCovers = librariesWithCovers.flatMap(l => l.covers);
                if (allCovers.length > 0) setBgImage(allCovers[Math.floor(Math.random() * allCovers.length)]);

            } catch (err) {
                console.error("Fetch Error:", err);
            } finally {
                if (isTotallyEmpty) setLoading(false);
            }
        };
        fetchLibs();
    }, [komgaService, connectionStatus]);

    let serverName = 'Komga Server';
    try {
        if (settings?.serverUrl) {
            serverName = new URL(settings.serverUrl).hostname;
        }
    } catch (e) {
        serverName = settings?.serverUrl || 'Komga Server';
    }

    const headerCovers = libraries.flatMap(l => l.covers).slice(0, 12);

    return (
        <div className="flex flex-col min-h-screen pb-32 bg-[#121212] relative">
            {bgImage && (
                <div className="fixed inset-0 z-0 overflow-hidden">
                    <AuthImage
                        src={bgImage}
                        className="w-full h-full object-cover blur-xl opacity-80 scale-105 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/50 pointer-events-none" />
                </div>
            )}

            <div
                className="sticky z-30 transition-all duration-300 w-full flex justify-center"
                style={{ top: `${serverTop}px`, marginTop: '20px' }}
            >
                <div className="relative overflow-hidden rounded-2xl shadow-xl border border-white/10 bg-[#1C1C1E]/80 backdrop-blur-md h-16 w-[96%] flex-shrink-0">
                    <div className="absolute inset-0 z-0 flex opacity-80">
                        {headerCovers.map((src, i) => (
                            <div key={i} className="flex-1 h-full relative overflow-hidden">
                                <AuthImage src={src} className="w-full h-full object-cover blur-[0.5px] scale-110 opacity-70" />
                            </div>
                        ))}
                        <div className="absolute inset-0 bg-black/30" />
                    </div>

                    <div className="relative z-10 flex items-center justify-between h-full px-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-lg shadow-green-900/20">
                                <HardDrive size={24} className="text-green-400" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-[11px] text-white/50 font-bold tracking-wider uppercase mb-0.5">SERVER NAME</span>
                                <span className="text-xl font-bold text-white leading-none tracking-tight">{serverName}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { cacheManager.delete(CACHE_KEY_LIBS); window.location.reload(); }}
                                className="p-2.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                                title="Refresh Libraries"
                            >
                                <RefreshCw size={18} />
                            </button>

                            {connectionStatus === 'connected' && libraries.length > 0 ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-white/10 backdrop-blur-md">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                                    <span className="text-[10px] font-bold text-green-500">On-Line</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-red-500/20 backdrop-blur-md">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                    <span className="text-[10px] font-bold text-red-500">{loading ? 'Connecting...' : 'Off-Line'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div
                className="w-full pointer-events-none"
                style={{ height: `${gridMargin}px` }}
            />

            <div className="flex justify-center w-full relative z-10">
                <div className="w-[96%]">
                    {loading ? (
                        <div className="flex justify-center pt-20">
                            <RefreshCw className="animate-spin text-blue-500 w-10 h-10" />
                        </div>
                    ) : (
                        <div
                            className="relative group rounded-xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-300"
                            style={{
                                minHeight: '600px',
                                padding: `${config?.gridInnerPadding ?? 24}px`,
                                backgroundColor: `rgba(28, 28, 30, ${(config?.bgOpacity ?? 30) / 100})`,
                                backdropFilter: 'blur(20px)'
                            }}
                        >
                            <div className="absolute inset-0 z-0 pointer-events-none">
                                <div className="absolute inset-0 bg-gradient-to-r from-[#1C1C1E]/50 via-[#1C1C1E]/30 to-transparent" />
                            </div>

                            <div className="relative z-10 w-full h-full">
                                <div
                                    className="grid gap-6 transition-all duration-300"
                                    style={{
                                        gridTemplateColumns: `repeat(${config?.gridColumns || 5}, minmax(0, 1fr))`
                                    }}
                                >
                                    {libraries.map(lib => (
                                        <Link
                                            key={lib.id}
                                            to={`/app/import/library/${lib.id}`}
                                            state={{ libName: lib.name }}
                                            className="block w-full h-full"
                                            style={{ aspectRatio: '0.68' }}
                                        >
                                            <ComicBox
                                                title={lib.name}
                                                covers={lib.covers}
                                                color="#3b82f6"
                                                variant="folder"
                                                className="w-full h-full"
                                            />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RemoteLibrary;
