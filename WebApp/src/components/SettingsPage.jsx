import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../context/AppContext';
import { Save, Check, AlertCircle, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { libraryManager } from '../services/LibraryManager';

// Shared Styles
const capsuleClass = "rounded-full font-medium text-xs transition-all flex items-center justify-center gap-2 border border-white/5 active:scale-95";
const capsuleStyle = { padding: '5px 10px' };

// Extracted Component to prevent re-renders/focus loss
const SettingRow = ({
    label, value, type = "text", name, onChange, isLast, isSelect, options,
    innerPadding, showPassword, onTogglePassword
}) => (
    <div
        className={`flex items-center justify-between bg-[#1a1a1a] transition-colors duration-200 ${!isLast ? 'border-b border-white/10' : ''}`}
        style={{ padding: `16px ${innerPadding}` }}
    >
        <span className="text-white font-medium pl-2">{label}</span>
        <div className="flex-1 flex justify-end">
            {isSelect ? (
                <div className="relative group">
                    <select
                        name={name}
                        value={value}
                        onChange={onChange}
                        className={`bg-[#2a2a2a] text-blue-400 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:bg-[#333] ${capsuleClass}`}
                        style={{ ...capsuleStyle, paddingRight: '24px' }}
                    >
                        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                </div>
            ) : (
                <div className="relative w-full max-w-[300px] text-right group">
                    <input
                        type={type === 'password' && showPassword ? 'text' : type}
                        name={name}
                        value={value}
                        onChange={onChange}
                        placeholder={label}
                        className="w-full bg-transparent text-right text-gray-300 placeholder-white/20 
                                 focus:bg-white focus:text-black focus:shadow-lg focus:scale-[1.02]
                                 rounded-lg px-3 py-1 transition-all duration-300 outline-none
                                 border border-transparent focus:border-blue-400/50"
                    />
                    {name === 'password' && (
                        <button
                            type="button"
                            onClick={onTogglePassword}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-8 text-white/30 hover:text-white transition-colors p-2"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    )}
                </div>
            )}
        </div>
    </div>
);

const SettingsPage = ({ config }) => {
    const { profiles, activeType, saveProfile, switchProfile, isAuthenticated } = useAuth();
    const { toggleTuner, showTuner, setShowDebug, setShowLogs } = useApp();
    const navigate = useNavigate();

    // Form State
    const [formData, setFormData] = useState({
        type: activeType,
        name: 'Komga Server',
        address: '',
        port: '',
        username: '',
        password: ''
    });

    // UI State
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

    // Initial Load & Sync with Profiles
    useEffect(() => {
        const p = profiles[formData.type];
        if (p && p.url) {
            let addr = p.url;
            let port = '';

            try {
                // Handle standard URLs
                if (p.url.startsWith('http')) {
                    const urlObj = new URL(p.url);
                    port = urlObj.port;
                    addr = urlObj.hostname;
                }
                // Handle relative paths or special proxy strings (e.g. /komga-proxy:8844)
                else {
                    const parts = p.url.split(':');
                    // If last part is a number and not the only part, treat as port
                    if (parts.length > 1 && !isNaN(parts[parts.length - 1])) {
                        port = parts.pop();
                        addr = parts.join(':');
                    } else {
                        addr = p.url;
                    }
                }

                // If specialized proxy, ensure address is clean
                if (addr.includes('/komga-proxy')) {
                    addr = '/komga-proxy';
                }
            } catch (e) {
                addr = p.url;
            }

            setFormData(prev => ({
                ...prev,
                name: formData.type === 'komga' ? 'Komga Server' : 'YACReader Server',
                address: addr,
                port: port || '8080', // Default to 8080 for everyone
                username: p.username || '',
                password: p.password || ''
            }));
        }
    }, [formData.type, profiles]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleTypeChange = (e) => {
        setFormData(prev => ({ ...prev, type: e.target.value }));
    };

    const buildFullUrl = () => {
        let url = formData.address;
        if (!url) return '';
        if (url === 'komga-proxy') url = '/komga-proxy';
        if (!url.startsWith('http') && !url.startsWith('/')) url = 'http://' + url;

        if (formData.port && !url.includes('/komga-proxy')) {
            // Fix: Strip trailing slash AND existing port
            url = url.replace(/\/$/, '').replace(/:\d+$/, '');
            url = `${url}:${formData.port}`;
        }
        return url;
    };

    const handleTestConnection = async () => {
        const fullUrl = buildFullUrl();
        if (!fullUrl || !formData.username) {
            setMessage({ type: 'error', text: 'Missing Address or User.' });
            return;
        }

        // AUTO-SAVE "Sandbox" credentials immediately (so they persist even if test fails)
        saveProfile(formData.type, fullUrl, formData.username, formData.password);
        // Only switch if we are creating a new profile type interaction, 
        // but usually we just want to update the current one's storage.

        setIsTesting(true);
        setMessage(null);

        try {
            console.log("🐛 Testing:", formData.type, fullUrl);
            libraryManager.initialize(formData.type, {
                baseUrl: fullUrl,
                username: formData.username,
                password: formData.password
            });
            await libraryManager.browse("");
            setMessage({ type: 'success', text: 'Connected!' });

            // If successful switch active type confirmation
            if (activeType !== formData.type) switchProfile(formData.type);

        } catch (e) {
            console.error("Test Failed:", e);
            setMessage({ type: 'error', text: e.message || 'Connection Failed' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveManual = () => {
        const fullUrl = buildFullUrl();
        saveProfile(formData.type, fullUrl, formData.username, formData.password);
        if (activeType !== formData.type) switchProfile(formData.type);
        setMessage({ type: 'success', text: 'Settings Saved' });
    };

    // --- STYLES ---
    const sideMargin = `${config?.settingsPillSideMargin ?? 20}px`;
    const innerPadding = `${config?.settingsPillInnerPadding ?? 16}px`;
    const titleSize = `${config?.settingsPillTitleSize ?? 18}px`;
    const titleMargin = `${config?.settingsPillTitleBottomMargin ?? 12}px`;
    const topMargin = `${config?.settingsPillsTopMargin ?? 120}px`;

    return (
        <div className="min-h-screen bg-black text-white p-6 relative overflow-y-auto flex flex-col items-center">
            {/* Background */}
            <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none" />

            {/* Content Container - Centered */}
            <div
                className="w-full max-w-[800px] flex flex-col items-stretch"
                style={{
                    marginTop: topMargin,
                    paddingLeft: sideMargin,
                    paddingRight: sideMargin
                }}
            >
                {/* PILL 1: COMICS SERVER */}
                <div className="mb-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="font-bold text-white mb-2 pl-4" style={{ fontSize: titleSize, marginBottom: titleMargin }}>
                        Comics Server
                    </h2>

                    <div className="bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <SettingRow
                            label="Server Type"
                            isSelect
                            name="type"
                            value={formData.type}
                            onChange={handleTypeChange}
                            innerPadding={innerPadding}
                            options={[
                                { value: 'komga', label: 'Komga' },
                                { value: 'yac', label: 'YACReader' }
                            ]}
                        />
                        <SettingRow innerPadding={innerPadding} label="Server Name" name="name" value={formData.name} onChange={handleChange} />
                        <SettingRow innerPadding={innerPadding} label="Server Address" name="address" value={formData.address} onChange={handleChange} />
                        <SettingRow innerPadding={innerPadding} label="Port" name="port" value={formData.port} onChange={handleChange} />
                        <SettingRow innerPadding={innerPadding} label="User" name="username" value={formData.username} onChange={handleChange} />
                        <SettingRow
                            innerPadding={innerPadding}
                            label="Password"
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            showPassword={showPassword}
                            onTogglePassword={() => setShowPassword(!showPassword)}
                            isLast
                        />
                    </div>

                    {/* Actions - Distanced from pill */}
                    <div className="flex gap-4 mt-10 justify-end px-2">
                        {message && (
                            <div className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transform transition-all animate-in fade-in zoom-in ${message.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                                {message.text}
                            </div>
                        )}

                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className={`bg-white/5 hover:bg-white/10 text-white hover:scale-105 ${capsuleClass}`}
                            style={capsuleStyle}
                        >
                            {isTesting ? 'Testing...' : 'Test'}
                        </button>
                        <button
                            onClick={handleSaveManual}
                            className={`bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:scale-105 ${capsuleClass}`}
                            style={capsuleStyle}
                        >
                            Save
                        </button>
                    </div>
                </div>

                {/* PILL 2: APPLICATION SETTINGS */}
                <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h2 className="font-bold text-white mb-2 pl-4" style={{ fontSize: titleSize, marginBottom: titleMargin }}>
                        Application Settings
                    </h2>

                    <div className="bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        {/* Menu Tuner - Toggle Style */}
                        <div
                            className="flex items-center justify-between py-4 border-b border-white/10 cursor-pointer hover:bg-white/10 transition-colors group"
                            onClick={toggleTuner}
                            style={{ padding: `16px ${innerPadding}` }}
                        >
                            <span className="text-white font-medium pl-2 group-hover:text-blue-400 transition-colors">Menu Layout Tuner</span>

                            {/* Matching Capsule Style */}
                            <div className={`${capsuleClass} ${showTuner ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-white/10 text-white/40'}`}
                                style={capsuleStyle}
                            >
                                <span className="uppercase tracking-wider text-[10px]">{showTuner ? 'Configure UI' : 'Off'}</span>
                            </div>
                        </div>

                        {/* Storage Inspector */}
                        <div
                            className="flex items-center justify-between py-4 border-b border-white/10 cursor-pointer hover:bg-white/10 transition-colors group"
                            onClick={() => setShowDebug(true)}
                            style={{ padding: `16px ${innerPadding}` }}
                        >
                            <span className="text-white font-medium pl-2 group-hover:text-blue-400 transition-colors">Storage Inspector</span>
                            <div className="flex items-center gap-2 text-white/50 pr-2 group-hover:translate-x-1 transition-transform">
                                <span className="text-sm font-medium">View</span>
                                <ChevronRight size={18} />
                            </div>
                        </div>

                        {/* Logs */}
                        <div
                            className="flex items-center justify-between py-4 cursor-pointer hover:bg-white/10 transition-colors group"
                            onClick={() => setShowLogs(true)}
                            style={{ padding: `16px ${innerPadding}` }}
                        >
                            <span className="text-white font-medium pl-2 group-hover:text-blue-400 transition-colors">System Logs</span>
                            <div className="flex items-center gap-2 text-white/50 pr-2 group-hover:translate-x-1 transition-transform">
                                <span className="text-sm font-medium">Debug & Reset</span>
                                <ChevronRight size={18} />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SettingsPage;
