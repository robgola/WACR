import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const GlassCard = ({ children, className, onClick, style, animate = false }) => {
    const baseClass = "glass-panel relative overflow-hidden rounded-2xl border border-white/10 shadow-lg transition-all duration-300";

    // Reusable motion variants for "pop in" effect
    const variants = {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 }
    };

    const Component = animate ? motion.div : 'div';

    return (
        <Component
            className={clsx(baseClass, className)}
            style={{
                background: 'hsla(0, 0%, 100%, 0.05)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                ...style
            }}
            onClick={onClick}
            initial={animate ? "hidden" : undefined}
            animate={animate ? "visible" : undefined}
            variants={animate ? variants : undefined}
            transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }} // Apple-like ease
        >
            {/* Optional: Add a subtle gradient overlay for "Liquid" feel */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
                {children}
            </div>
        </Component>
    );
};

export default GlassCard;
