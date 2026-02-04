import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { KomgaService } from '../services/komgaService';

import Toast from '../components/ui/Toast';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // Access Shared Auth State
    const { activeProfile, isAuthenticated } = useAuth();

    // We removed useSettings as it was causing the auth mismatch.
    // If we need saveSettings for other things, we should migrate them or use a different store.
    // For now, let's keep the interface compatible but no-op saveSettings or implement it using useAuth?
    // Actually, saveSettings logic belongs to SettingsPage which now uses useAuth directly.
    // We will provide dummy compatibility if needed, or update consumers.
    const settings = activeProfile ? {
        serverUrl: activeProfile.url,
        username: activeProfile.username,
        password: activeProfile.password
    } : {};

    const saveSettings = () => { console.warn("Legacy saveSettings called. Use useAuth saveProfile."); };

    const [komgaService, setKomgaService] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
    const [toast, setToast] = useState(null);
    const [cache, setCache] = useState({}); // Simple memory cache { key: data }
    const imageCache = useRef({}); // Ref cache to prevent re-renders on update

    const [showDebug, setShowDebug] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState([]);

    const addLog = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [{ timestamp, message, type }, ...prev].slice(0, 50));
    };

    const updateCache = (key, data) => {
        setCache(prev => ({ ...prev, [key]: data }));
    };

    const updateImageCache = (url, blobUrl) => {
        imageCache.current[url] = blobUrl;
    };

    // Initialize Service when Active Profile Changes
    useEffect(() => {
        if (activeProfile && activeProfile.url && activeProfile.username) {
            console.log("🔄 [AppContext] Initializing Service with Profile:", activeProfile.url);

            // 1. Initialize KomgaService (Context Instance for UI helpers)
            const service = new KomgaService(activeProfile.url, activeProfile.username, activeProfile.password, addLog);
            setKomgaService(service);

            // 2. Initialize Singleton LibraryManager (Critical for App.jsx and Downloads)
            // This ensures it has credentials BEFORE App.jsx tries to use it.
            // Using 'komga' type by default or activeType? Assuming 'komga' for now or logic from Settings
            // Ideally we should import libraryManager here. It IS singleton.
            import('../services/LibraryManager').then(({ libraryManager }) => {
                libraryManager.initialize('komga', {
                    baseUrl: activeProfile.url,
                    username: activeProfile.username,
                    password: activeProfile.password,
                    // Name is not known yet, but Provider will fetch it!
                });
            });

            // Auto-validate
            setConnectionStatus('connecting');
            service.validateConnection()
                .then(() => setConnectionStatus('connected'))
                .catch(() => setConnectionStatus('error'));
        }
    }, [activeProfile]);

    // Listen for Download Errors globally
    useEffect(() => {
        const handleError = (e) => {
            // Use internal addLog/setToast directly to avoid closure staleness if any?
            // But showsToast uses state setter, so it's fine.
            const msg = `${e.detail.message} \nReason: ${e.detail.error}`;
            setToast({ message: msg, type: 'error' });
            addLog(msg, 'error');
        };
        window.addEventListener('download-error', handleError);
        return () => window.removeEventListener('download-error', handleError);
    }, []);

    const [showTuner, setShowTuner] = useState(false); // Hidden by default, user can enable in settings
    const toggleTuner = () => setShowTuner(prev => !prev);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
        addLog(message, type); // Auto-log toasts
    };

    // Memoize the value to prevent global re-renders
    const memoizedValue = React.useMemo(() => ({
        settings, saveSettings, // Compat
        komgaService, connectionStatus, setConnectionStatus,
        showToast, addLog, logs,
        cache, updateCache,
        imageCache, updateImageCache,
        showTuner, toggleTuner,
        showDebug, setShowDebug,
        showLogs, setShowLogs
    }), [activeProfile, komgaService, connectionStatus, logs, cache, showTuner, showDebug, showLogs]);

    return (
        <AppContext.Provider value={memoizedValue}>
            {children}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
