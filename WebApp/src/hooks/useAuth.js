import { useState, useEffect, useCallback } from 'react';
import { encrypt, decrypt } from '../utils/crypto';

const AUTH_STORAGE_KEY = 'wacr_auth_v2';

const defaultProfile = {
    url: '/komga-proxy',
    username: '',
    password: ''
};

export function useAuth() {
    const [profiles, setProfiles] = useState({
        komga: { ...defaultProfile },
        yac: { ...defaultProfile }
    });
    const [activeType, setActiveType] = useState('komga'); // 'komga' or 'yac'
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(true);

    // Load from Storage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(AUTH_STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);

                // Decrypt credentials
                const loadedProfiles = {
                    komga: {
                        url: data.komga?.url || '',
                        username: data.komga?.username || '',
                        password: decrypt(data.komga?.password)
                    },
                    yac: {
                        url: data.yac?.url || '',
                        username: data.yac?.username || '',
                        password: decrypt(data.yac?.password)
                    }
                };

                setProfiles(loadedProfiles);
                setActiveType(data.activeType || 'komga');

                // Check if active profile has minimal data
                const active = loadedProfiles[data.activeType || 'komga'];
                if (active && active.url && active.username) {
                    setIsAuthenticated(true);
                }
            }
        } catch (e) {
            console.error("Auth Load Failed", e);
        } finally {
            setLoadingAuth(false);
        }
    }, []);

    const saveProfile = useCallback((type, url, username, password) => {
        setProfiles(prev => {
            const next = {
                ...prev,
                [type]: { url, username, password }
            };

            // Persist Encrypted
            const toStore = {
                activeType: type, // Auto-switch to updated? Or keep current?
                komga: {
                    ...next.komga,
                    password: encrypt(next.komga.password)
                },
                yac: {
                    ...next.yac,
                    password: encrypt(next.yac.password)
                }
            };

            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toStore));
            return next;
        });

        // If updating active, re-auth check
        if (type === activeType) {
            if (url && username) setIsAuthenticated(true);
        }
    }, [activeType]);

    const switchProfile = useCallback((type) => {
        setActiveType(type);
        const profile = profiles[type];
        const isAuth = !!(profile?.url && profile?.username);
        setIsAuthenticated(isAuth);

        // Persist Selection
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            data.activeType = type;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
        }
    }, [profiles]);

    const logout = useCallback(() => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setProfiles({ komga: { ...defaultProfile }, yac: { ...defaultProfile } });
        setIsAuthenticated(false);
    }, []);

    return {
        profiles,
        activeType,
        activeProfile: profiles[activeType],
        isAuthenticated,
        loadingAuth,
        saveProfile,
        switchProfile,
        logout
    };
}
