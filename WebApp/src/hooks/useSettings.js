import { useState, useEffect } from 'react';

const STORAGE_KEY = 'acr_settings_v1';
const FORCE_REFRESH_KEY = 'acr_settings_v3_proxy_final'; // Bump version to invalidate old cache

const defaultSettings = {
    serverUrl: '/komga-proxy',
    username: 'test@test.it',
    password: 'test',
    appLanguage: 'Italiano',
    debugMode: false
};

export function useSettings() {
    const [settings, setSettings] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return { ...defaultSettings, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        }
        return defaultSettings;
    });

    const saveSettings = (newSettings) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    };

    return { settings, saveSettings };
}
