import React from 'react';
import { NavLink } from 'react-router-dom';

const NavBar = ({ config }) => {
    // Dynamic Config Styling
    const safeConfig = config || {}; // Safe access
    const containerStyle = {
        padding: `${safeConfig.padding ?? 16}px`,
        gap: `${safeConfig.gap ?? 8}px`,
        borderRadius: '9999px',
        backgroundColor: 'rgba(28, 28, 30, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    };

    const navLinkClass = ({ isActive }) =>
        `rounded-full font-semibold transition-all duration-300 whitespace-nowrap flex items-center justify-center ${isActive
            ? 'bg-white text-black shadow-lg shadow-black/20 scale-105'
            : 'text-white/50 hover:text-white'
        }`;

    // Link styling needs specific font size/padding from config
    const linkStyle = {
        fontSize: `${safeConfig.fontSize ?? 16}px`,
        paddingLeft: `${safeConfig.itemPaddingX ?? 20}px`,
        paddingRight: `${safeConfig.itemPaddingX ?? 20}px`,
        paddingTop: `${safeConfig.itemPaddingY ?? 8}px`,
        paddingBottom: `${safeConfig.itemPaddingY ?? 8}px`,
    };

    return (
        <div
            className="fixed inset-x-0 z-[200] pointer-events-none flex justify-center pb-4"
            style={{ top: `${safeConfig.top ?? 32}px` }}
        >
            <div className="pointer-events-auto mx-4">
                <div className="flex items-center" style={containerStyle}>
                    <NavLink to="/app" end className={navLinkClass} style={linkStyle}>
                        Libreria
                    </NavLink>
                    <NavLink
                        to={sessionStorage.getItem('lastImportPath') || "/app/import"}
                        className={({ isActive }) => {
                            // Manual check for /import sub-routes
                            const isImportActive = window.location.pathname.startsWith('/app/import');
                            return `rounded-full font-semibold transition-all duration-300 whitespace-nowrap flex items-center justify-center ${isImportActive
                                ? 'bg-white text-black shadow-lg shadow-black/20 scale-105'
                                : 'text-white/50 hover:text-white'
                                }`;
                        }}
                        style={linkStyle}
                    >
                        Importa
                    </NavLink>
                    <NavLink to="/app/settings" className={navLinkClass} style={linkStyle}>
                        Impostazioni
                    </NavLink>
                    <NavLink to="/app/help" className={navLinkClass} style={linkStyle}>
                        Aiuto
                    </NavLink>
                </div>
            </div>
        </div>
    );
};

export default NavBar;
