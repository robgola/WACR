import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useSettings } from '../hooks/useSettings';
import { KomgaService } from '../services/komgaService';

import Toast from '../components/ui/Toast';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const { settings, saveSettings } = useSettings();
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

    useEffect(() => {
        if (settings.serverUrl && settings.username && settings.password) {
            const service = new KomgaService(settings.serverUrl, settings.username, settings.password, addLog);
            setKomgaService(service);

            // Auto-validate on mount
            setConnectionStatus('connecting');
            service.validateConnection()
                .then(() => setConnectionStatus('connected'))
                .catch(() => setConnectionStatus('error'));
        }
    }, [settings]);

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
        settings, saveSettings,
        komgaService, connectionStatus, setConnectionStatus,
        showToast, addLog, logs,
        cache, updateCache,
        imageCache, updateImageCache,
        showTuner, toggleTuner,
        showDebug, setShowDebug,
        showLogs, setShowLogs
    }), [settings, komgaService, connectionStatus, logs, cache, showTuner, showDebug, showLogs]);

    return (
        <AppContext.Provider value={memoizedValue}>
            {children}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);
