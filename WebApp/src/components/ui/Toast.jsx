import React, { useEffect } from 'react';
import { Check, Info, AlertTriangle, X } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColors = {
        info: 'bg-blue-500/20 border-blue-500/50 text-blue-100',
        success: 'bg-green-500/20 border-green-500/50 text-green-100',
        error: 'bg-red-500/20 border-red-500/50 text-red-100',
        warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-100',
    };

    const icons = {
        info: <Info size={18} />,
        success: <Check size={18} />,
        error: <X size={18} />,
        warning: <AlertTriangle size={18} />,
    };

    return (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 ${bgColors[type] || bgColors.info}`}>
            <div className="shrink-0">{icons[type] || icons.info}</div>
            <span className="text-sm font-medium">{message}</span>
        </div>
    );
};

export default Toast;
