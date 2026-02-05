import React, { useState, useEffect, memo } from 'react';
import { useApp } from '../../context/AppContext';
import { getImage, saveImage } from '../../utils/imageDB';

const AuthImage = memo(({ src, alt, className, style }) => {
    const { komgaService, imageCache, updateImageCache } = useApp();
    const [blobUrl, setBlobUrl] = useState(null);
    const [error, setError] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const imgRef = React.useRef(null);

    // Reset state when src changes
    useEffect(() => {
        setBlobUrl(null);
        setError(false);
    }, [src]);

    // Intersection Observer to trigger load only when visible
    useEffect(() => {
        if (blobUrl) return; // Already loaded

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '200px' }); // Load when 200px away from viewport

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, [blobUrl]); // Re-attach if blobUrl reset (unlikely but safe)

    useEffect(() => {
        // Only load if Visible AND Resource available
        // CRITICAL FIX: If it's a local BLOB, we don't need komgaService!
        const isLocal = src && src.startsWith('blob:');
        if (blobUrl || !isVisible || !src || (!komgaService && !isLocal)) return;

        let active = true;

        const load = async () => {
            try {
                // 0. If src is already a blob URL, use it directly
                if (src.startsWith('blob:')) {
                    if (active) setBlobUrl(src);
                    return;
                }

                // 1. Check Memory Cache (Instant)
                if (imageCache.current[src]) {
                    if (active) setBlobUrl(imageCache.current[src]);
                    return;
                }

                // 2. Check IndexedDB (Fast)
                let cachedBlob = null;
                try {
                    cachedBlob = await getImage(src);
                } catch (err) {
                    console.warn("Failed to read from ImageDB:", err);
                }

                // Check active again after await
                if (!active) return;

                if (cachedBlob && cachedBlob instanceof Blob) {
                    const url = URL.createObjectURL(cachedBlob);
                    setBlobUrl(url);
                    updateImageCache(src, url); // Populate memory cache
                    return;
                }

                // 3. Fetch if not in DB (Slow)
                const res = await fetch(src, { headers: komgaService.headers });
                if (!res.ok) throw new Error('Failed to load image');

                const blob = await res.blob();

                if (active) {
                    // Save to DB (Fire and forget)
                    saveImage(src, blob).catch(e => console.warn("Failed to save to ImageDB:", e));

                    const url = URL.createObjectURL(blob);
                    setBlobUrl(url);
                    updateImageCache(src, url); // Populate memory cache
                }
            } catch (e) {
                console.error(`❌ [AuthImage] Failed to load: ${src}`, e);
                if (active) setError(true);
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [isVisible, src, komgaService, imageCache, updateImageCache, blobUrl]);

    if (error) {
        return <div ref={imgRef} className={`bg-white/10 ${className} flex items-center justify-center text-white/20 text-xs`} style={style}>Err</div>;
    }

    if (!blobUrl) {
        // Placeholder while loading (Observe this)
        return <div ref={imgRef} className={`bg-white/5 ${className} ${isVisible ? 'animate-pulse' : ''}`} style={style} />;
    }

    return (
        <img
            src={blobUrl}
            alt={alt}
            className={className}
            style={style}
            loading="lazy"
            decoding="async"
            onLoad={(e) => {
                const img = e.target;
                if (img.naturalWidth > img.naturalHeight) {
                    // Double-page spread detected: Align to Right (Right Page)
                    img.style.objectPosition = 'right top';
                }
            }}
        />
    );
});

export default AuthImage;
