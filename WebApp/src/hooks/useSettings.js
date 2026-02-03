import { useState, useEffect } from 'react';

const STORAGE_KEY = 'acr_settings_v1';
const FORCE_REFRESH_KEY = 'acr_settings_v3_proxy_final'; // Bump version to invalidate old cache

const defaultSettings = {
    serverUrl: '/komga-proxy',
    username: 'test@test.it',
    password: 'test'
};

export function useSettings() {
    const [settings, setSettings] = useState(() => {
        // ALWAYS return defaultSettings for this debugging session to ensure Proxy is used
        // ignoring localStorage to fix the "stuck on old URL" issue
        return defaultSettings;
    });

    const saveSettings = (newSettings) => {
        setSettings(newSettings);
        // basic persistence
        localStorage.setItem(FORCE_REFRESH_KEY, JSON.stringify(newSettings));
    };

    return { settings, saveSettings };
}
