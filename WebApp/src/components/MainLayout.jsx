import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Clipboard, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { localLibrary } from '../services/localLibrary';
import { defaultNavConfig } from '../constants/defaults';

// Components
import NavBar from './ui/NavBar';
import TunableSlider from './ui/TunableSlider';
import DownloadProgress from './ui/DownloadProgress';
import DebugConsole from './debug/DebugConsole';
import StorageInspector from './debug/StorageInspector';
import RequireAuthOverlay from './auth/RequireAuthOverlay';

// Page Components
import LocalLibrary from './LocalLibrary';
import RemoteLibrary from './RemoteLibrary';
import RemoteSeriesList from './RemoteSeriesList';
import RemoteBookList from './RemoteBookList';
import SettingsPage from './SettingsPage';

const MainLayout = () => {
    const { settings, showTuner, showToast, showDebug, setShowDebug, showLogs, setShowLogs, logs, toggleTuner } = useApp();
    const location = useLocation();
    const navigate = useNavigate();

    // Dual Config State (Load from Storage or Default)
    const [importConfig, setImportConfig] = useState(() => {
        try {
            const saved = localStorage.getItem('importConfig');
            return saved ? { ...defaultNavConfig, ...JSON.parse(saved) } : defaultNavConfig;
        } catch { return defaultNavConfig; }
    });

    const [libraryConfig, setLibraryConfig] = useState(() => {
        try {
            const saved = localStorage.getItem('libraryConfig');
            return saved ? { ...defaultNavConfig, ...JSON.parse(saved) } : defaultNavConfig;
        } catch { return defaultNavConfig; }
    });

    const [tunerTab, setTunerTab] = useState('general'); // 'general' | 'layout'
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportConfig, setExportConfig] = useState('');

    // Determine Context
    const isImportContext = location.pathname.startsWith('/app/import');
    const isSettingsContext = location.pathname.startsWith('/app/settings');

    // Select Active Config for Tuner/NavBar
    const activeConfig = isImportContext ? importConfig : libraryConfig;
    const setActiveConfig = isImportContext ? setImportConfig : setLibraryConfig;

    let tunerTitle = "Libreria - Menu Tuner";
    if (isImportContext) tunerTitle = "Import - Menu Tuner";
    if (isSettingsContext) tunerTitle = "Settings - Menu Tuner";

    const saveDefaults = () => {
        const configToExport = isImportContext ? importConfig : libraryConfig;
        const jsonString = JSON.stringify(configToExport, null, 2);
        setExportConfig(jsonString);
        setShowExportModal(true);

        if (isImportContext) {
            localStorage.setItem('importConfig', jsonString);
            showToast("Import Layout Saved locally", "success");
        } else {
            localStorage.setItem('libraryConfig', jsonString);
            showToast("Library Layout Saved locally", "success");
        }
    };

    const handleResetStorage = async () => {
        try {
            console.log("💥 INITIALIZING FACTORY RESET...");
            await localLibrary.reset();
            localStorage.clear();
            sessionStorage.clear();
            console.log("✅ Reset Complete. Reloading...");
            window.location.href = '/';
        } catch (e) {
            console.error("Reset Failed:", e);
            showToast("Reset Failed: " + e.message, "error");
        }
    };

    return (
        <div className="h-screen overflow-y-auto bg-[#121212] font-sans text-white selection:bg-yellow-500/30">
            <div className="fixed inset-0 bg-gradient-to-b from-[#1a1a2e] to-black -z-20" />

            {/* DEBUG: Emergency Cache Clear Button */}
            {settings?.debugMode && (
                <button
                    onClick={async () => {
                        if (confirm("Reset App & Clear Cache? (Fixes update issues)")) {
                            if ('serviceWorker' in navigator) {
                                const registrations = await navigator.serviceWorker.getRegistrations();
                                for (const registration of registrations) {
                                    await registration.unregister();
                                }
                            }
                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.reload();
                        }
                    }}
                    className="fixed bottom-4 right-4 z-[9999] bg-red-600/90 hover:bg-red-500 text-white text-[10px] uppercase font-bold px-3 py-2 rounded-full backdrop-blur shadow-lg border border-red-400/30 flex items-center gap-2"
                >
                    ☢️ Reset App
                </button>
            )}

            <NavBar config={activeConfig} />
            <DownloadProgress />

            {/* CONFIG EXPORT MODAL */}
            {showExportModal && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-bold text-white mb-2">Export Configuration</h3>
                        <p className="text-white/60 text-sm mb-4">Copy this JSON and paste it to the AI assistant.</p>

                        <textarea
                            readOnly
                            id="export-config-area"
                            value={exportConfig}
                            onClick={(e) => e.target.select()}
                            className="w-full h-64 bg-black/50 border border-white/10 rounded-xl p-4 text-[10px] font-mono text-green-400 mb-4 focus:outline-none focus:border-white/30 resize-none"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    const textArea = document.getElementById("export-config-area");
                                    if (textArea) {
                                        textArea.select();
                                        textArea.setSelectionRange(0, 99999);
                                        try {
                                            if (navigator.clipboard) {
                                                navigator.clipboard.writeText(exportConfig).then(() => {
                                                    showToast("Copied!", "success");
                                                }).catch(() => {
                                                    document.execCommand('copy');
                                                    showToast("Copied (Legacy)!", "success");
                                                });
                                            } else {
                                                document.execCommand('copy');
                                                showToast("Copied (Legacy)!", "success");
                                            }
                                        } catch (err) {
                                            alert("Automatic copy failed. Please copy the text manually.");
                                        }
                                    }
                                }}
                                className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <Clipboard size={18} />
                                Copy JSON
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIGURATOR OVERLAY */}
            {showTuner && (
                <div className="fixed bottom-20 right-4 z-[250] p-4 bg-black/80 border border-white/20 rounded-xl backdrop-blur-xl w-64 shadow-2xl text-xs space-y-3 font-mono">
                    <div className="flex flex-col gap-2 mb-6 border-b border-white/10 pb-4">
                        <strong className="text-yellow-500 text-sm mb-2 block text-center uppercase tracking-widest">{tunerTitle}</strong>
                        <div className="flex gap-2 w-full">
                            <button
                                onClick={() => setActiveConfig(defaultNavConfig)}
                                className="flex-1 py-3 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-xs transition-all font-bold uppercase tracking-wider active:scale-95"
                                title="Reset to factory defaults"
                            >
                                Reset
                            </button>
                            <button
                                onClick={saveDefaults}
                                className="flex-1 py-3 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black rounded-lg text-xs transition-all font-bold uppercase tracking-wider active:scale-95"
                                title="Save current settings as default"
                            >
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="flex bg-white/10 rounded-lg p-1 mb-2">
                        <button
                            onClick={() => setTunerTab('general')}
                            className={`flex-1 py-3 rounded-md text-xs font-bold transition-all ${tunerTab === 'general' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
                        >
                            MAIN MENU
                        </button>
                        <button
                            onClick={() => setTunerTab('layout')}
                            className={`flex-1 py-3 rounded-md text-xs font-bold transition-all ${tunerTab === 'layout' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
                        >
                            LAYOUT
                        </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/20">
                        {tunerTab === 'general' && (
                            <>
                                {[
                                    { label: 'Top (px)', key: 'top', min: 0, max: 100 },
                                    { label: 'Cont. Padding', key: 'padding', min: 0, max: 20 },
                                    { label: 'Gap (px)', key: 'gap', min: 0, max: 20 },
                                    { label: 'Font Size', key: 'fontSize', min: 10, max: 24 },
                                    { label: 'Item Pad X', key: 'itemPaddingX', min: 0, max: 40 },
                                    { label: 'Item Pad Y', key: 'itemPaddingY', min: 0, max: 20 },
                                ].map(control => (
                                    <div key={control.key} className="space-y-2 mb-4 hover:bg-white/5 p-2 rounded-lg transition-colors">
                                        <div className="flex justify-between text-white/70 text-[11px] font-bold uppercase tracking-wide">
                                            <span>{control.label}</span>
                                            <span className="text-yellow-500 font-mono">{activeConfig[control.key]}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setActiveConfig(prev => ({ ...prev, [control.key]: Math.max(control.min, (prev[control.key] || 0) - 1) }))}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 transition-all text-white font-bold"
                                            >
                                                -
                                            </button>
                                            <input
                                                type="range"
                                                min={control.min} max={control.max}
                                                value={activeConfig[control.key]}
                                                onChange={(e) => setActiveConfig({ ...activeConfig, [control.key]: Number(e.target.value) })}
                                                className="flex-1 accent-yellow-500 bg-white/10 h-2 rounded-full appearance-none cursor-pointer"
                                            />
                                            <button
                                                onClick={() => setActiveConfig(prev => ({ ...prev, [control.key]: Math.min(control.max, (prev[control.key] || 0) + 1) }))}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 transition-all text-white font-bold"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {tunerTab === 'layout' && (
                            <div className="space-y-2">
                                {(() => {
                                    const path = location.pathname;
                                    const isImport = path.startsWith('/app/import');
                                    const isSettings = path.startsWith('/app/settings');
                                    const isLibrary = !isImport && !isSettings;

                                    const SliderGroup = ({ title, controls }) => (
                                        <div className="space-y-4 mb-8 bg-white/5 rounded-xl p-4 border border-white/5">
                                            <h4 className="text-white/40 font-bold text-[10px] uppercase mb-4 tracking-wider">{title}</h4>
                                            {controls.map(control => (
                                                <TunableSlider
                                                    key={control.key}
                                                    control={control}
                                                    activeConfig={activeConfig}
                                                    setActiveConfig={setActiveConfig}
                                                />
                                            ))}
                                        </div>
                                    );

                                    return (
                                        <>
                                            {!isSettings && (
                                                <SliderGroup title="Global UI" controls={[
                                                    { label: 'Global Text Scale', key: 'fontSize', min: 12, max: 32 },
                                                    { label: 'Top Margin', key: 'top', min: 0, max: 200 }
                                                ]} />
                                            )}

                                            {isLibrary && (
                                                <>
                                                    <SliderGroup title="Library Bar" controls={[
                                                        { label: 'Top Dist', key: 'librariesBarTop', min: 0, max: 200 },
                                                        { label: 'Height', key: 'librariesBarHeight', min: 40, max: 120 },
                                                        { label: 'Side Margin', key: 'librariesBarSideMargin', min: 0, max: 200 },
                                                        { label: 'Pill Padding X', key: 'libPillPaddingX', min: 0, max: 50 },
                                                        { label: 'Pill Height', key: 'libPillHeight', min: 20, max: 100 },
                                                        { label: 'Pill Gap', key: 'libBarGap', min: 0, max: 50 },
                                                    ]} />
                                                    <SliderGroup title="Continue Reading" controls={[
                                                        { label: 'Top Dist', key: 'continueReadingMargin', min: 0, max: 200 },
                                                        { label: 'Height', key: 'crHeight', min: 100, max: 600 },
                                                        { label: 'Side Margin', key: 'crSideMargin', min: 0, max: 200 },
                                                        { label: 'Cover Size %', key: 'crCoverWidth', min: 10, max: 100 },
                                                        { label: 'Title Size', key: 'crFontSize', min: 12, max: 60 },
                                                        { label: 'Text Top', key: 'crTextTopMargin', min: -50, max: 100 },
                                                    ]} />
                                                    <SliderGroup title="Main Grid" controls={[
                                                        { label: 'Top Dist', key: 'gridMargin', min: 0, max: 200 },
                                                        { label: 'Side Margin', key: 'gridSideMargin', min: 0, max: 200 },
                                                        { label: 'Columns (Size)', key: 'gridColumns', min: 2, max: 10 },
                                                    ]} />
                                                    <SliderGroup title="Background & Transparency" controls={[
                                                        { label: 'Glass Opacity', key: 'bgOpacity', min: 0, max: 100 },
                                                    ]} />
                                                </>
                                            )}

                                            {isImport && (
                                                <>
                                                    <SliderGroup title="Server List" controls={[
                                                        { label: 'Bar Top', key: 'serverBarTop', min: 0, max: 200 },
                                                        { label: 'Grid Margin', key: 'gridTop', min: 0, max: 200 },
                                                    ]} />
                                                    <SliderGroup title="Library Grid" controls={[
                                                        { label: 'Bar Top', key: 'libraryBarTop', min: 0, max: 200 },
                                                        { label: 'Grid Margin', key: 'libraryGridMargin', min: 0, max: 200 },
                                                        { label: 'Side Margin', key: 'libraryGridSideMargin', min: 0, max: 100 },
                                                        { label: 'Header Side Margin', key: 'headerSideMargin', min: 0, max: 60 },
                                                        { label: 'Columns', key: 'gridColumns', min: 3, max: 5 },
                                                    ]} />
                                                    <SliderGroup title="Series Detail" controls={[
                                                        { label: 'Bar Top', key: 'seriesBarTop', min: 0, max: 200 },
                                                        { label: 'Grid Margin', key: 'seriesGridMargin', min: 0, max: 200 },
                                                    ]} />
                                                    <SliderGroup title="Imp Menu" controls={[
                                                        { label: 'Menu Width', key: 'importMenuWidth', min: 200, max: 600 },
                                                        { label: 'Menu Height', key: 'importMenuHeight', min: 50, max: 600 },
                                                        { label: 'Pos X', key: 'importMenuX', min: -500, max: 500 },
                                                        { label: 'Pos Y', key: 'importMenuY', min: -500, max: 500 },
                                                        { label: 'Text Gap', key: 'importMenuGap', min: 0, max: 100 },
                                                        { label: 'Font Size', key: 'importMenuFontSize', min: 10, max: 30 },
                                                        { label: 'Vert Padding', key: 'importMenuItemPadding', min: 0, max: 40 },
                                                        { label: 'Side Padding', key: 'importMenuItemPaddingX', min: 0, max: 100 },
                                                    ]} />
                                                </>
                                            )}

                                            {isSettings && (
                                                <SliderGroup title="Settings Layout" controls={[
                                                    { label: 'Top Margin', key: 'settingsPillsTopMargin', min: 0, max: 400 },
                                                    { label: 'Side Margin', key: 'settingsPillSideMargin', min: 0, max: 200 },
                                                    { label: 'Inner Padding', key: 'settingsPillInnerPadding', min: 0, max: 100 },
                                                    { label: 'Title Size', key: 'settingsPillTitleSize', min: 12, max: 40 },
                                                    { label: 'Title Margin', key: 'settingsPillTitleBottomMargin', min: 0, max: 100 },
                                                ]} />
                                            )}

                                            {!isImport && !isSettings && (
                                                <>
                                                    <SliderGroup title="Continue Reading" controls={[
                                                        { label: 'Height', key: 'crHeight', min: 200, max: 500 },
                                                        { label: 'Margin', key: 'crSideMargin', min: 0, max: 100 },
                                                        { label: 'Content Margin', key: 'crContentSideMargin', min: 0, max: 100 },
                                                        { label: 'Inner Pad', key: 'crInnerPadding', min: 0, max: 50 },
                                                        { label: 'Text Top', key: 'crTextTopMargin', min: -100, max: 100 },
                                                        { label: 'Cover Width %', key: 'crCoverWidth', min: 10, max: 50 },
                                                        { label: 'Font Size', key: 'crFontSize', min: 12, max: 32 },
                                                    ]} />
                                                    <SliderGroup title="Comic Reading" controls={[
                                                        { label: 'Buttons Vert', key: 'comicTopMargin', min: 0, max: 100 },
                                                        { label: 'Buttons Side', key: 'comicSideMargin', min: 0, max: 100 },
                                                        { label: 'Page Num Size', key: 'comicPageNumFontSize', min: 8, max: 24 },
                                                    ]} />
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="pt-2 border-t border-white/10 text-[9px] text-white/40 break-all">
                        Top: {activeConfig.top} | Font: {activeConfig.fontSize}
                    </div>
                </div>
            )}

            <div className="pt-36">
                <Routes>
                    <Route path="/" element={<LocalLibrary config={libraryConfig} />} />
                    <Route path="import" element={<RequireAuthOverlay><RemoteLibrary config={importConfig} /></RequireAuthOverlay>} />
                    <Route path="import/library/:libId" element={<RequireAuthOverlay><RemoteSeriesList config={importConfig} /></RequireAuthOverlay>} />
                    <Route path="import/series/:seriesId" element={<RequireAuthOverlay><RemoteBookList config={importConfig} /></RequireAuthOverlay>} />
                    <Route path="settings" element={<SettingsPage config={activeConfig} />} />
                    <Route path="help" element={<div className="p-20 text-center text-white">Aiuto & Supporto (Coming Soon)</div>} />
                    <Route path="*" element={<Navigate to="" replace />} />
                </Routes>
            </div>

            {showLogs && <DebugConsole logs={logs} onClose={() => setShowLogs(false)} onResetStorage={handleResetStorage} />}
            {showDebug && <StorageInspector onClose={() => setShowDebug(false)} />}
        </div>
    );
};

export default MainLayout;
