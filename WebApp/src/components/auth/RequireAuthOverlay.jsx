import React from 'react';
import { Link } from 'react-router-dom';
import { Server } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const RequireAuthOverlay = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center p-8 text-center opacity-50 grayscale transition-all">
                <div className="bg-white/10 p-8 rounded-2xl backdrop-blur-md border border-white/10 flex flex-col items-center gap-4">
                    <Server size={48} className="text-white/50" />
                    <h3 className="text-xl font-bold text-white">Server Setup Required</h3>
                    <p className="text-white/60 max-w-sm">
                        You need to configure your Komga or YACReader server to import content.
                    </p>
                    <Link to="/app/settings" className="px-6 py-3 bg-blue-600 rounded-full text-white font-bold hover:bg-blue-500 transition">
                        Open Settings
                    </Link>
                </div>
            </div>
        );
    }
    return children;
};

export default RequireAuthOverlay;
