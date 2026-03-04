import React, { useRef, useState, useEffect } from 'react';

/**
 * FitText Sub-Component
 * Uses a classic DOM binary search to find the maximum font size
 * without bleeding outside the bubble boundaries. No canvas, pure React.
 */
const FitText = ({ item, isHidden, onToggle, clusterFontSize, onFit }) => {
    const textRef = useRef(null);
    const containerRef = useRef(null);
    const [fontSize, setFontSize] = useState(6);
    const [isFitted, setIsFitted] = useState(false);
    const calculatedSizeRef = useRef(0);

    const [x, y, w, h] = item.box || [0, 0, 0, 0];
    const rawText = item.text_translated || item.text_preview || "...";
    const isDebug = !item.text_translated;

    // Purge AI OCR manual newlines to prevent single-word butchering
    const cleanText = rawText.replace(/\n|\r|\t/g, ' ').replace(/\s+/g, ' ').trim();

    const shape = (item.shape || "OVAL").toUpperCase();
    const isOval = shape === "OVAL" || shape === "CLOUD" || shape === "JAGGED";

    // Standard generous padding to guarantee text never touches the balloon border
    let padXPct = 0.08;
    let padYPct = 0.08;

    if (isOval) {
        if (h > 0 && w / h > 1.8) {
            // Pill shape: needs extra side padding near the very round edges
            padXPct = 0.12;
            padYPct = 0.06;
        } else if (h > 0 && w / h < 0.6) {
            padXPct = 0.06;
            padYPct = 0.12;
        }
    }

    const textInsetX = w * padXPct;
    const textInsetY = h * padYPct;
    const txPct = `${(x + textInsetX) * 100}%`;
    const tyPct = `${(y + textInsetY) * 100}%`;
    const twPct = `${(w - textInsetX * 2) * 100}%`;
    const thPct = `${(h - textInsetY * 2) * 100}%`;

    const orig = item.text_original || "";
    const isOrigUpper = orig.length > 0 && orig === orig.toUpperCase() && /[A-Z]/.test(orig);
    const forceUpper = item.is_uppercase !== undefined ? item.is_uppercase : isOrigUpper;

    useEffect(() => {
        const containerEl = containerRef.current;
        const textEl = textRef.current;
        if (!containerEl || !textEl) return;

        let resizeTimeout;

        const performFit = () => {
            containerEl.style.opacity = '0';
            textEl.style.width = '100%';
            textEl.style.height = 'auto';

            const maxW = containerEl.clientWidth;
            const maxH = containerEl.clientHeight;

            // Wait for DOM
            if (maxW === 0 || maxH === 0) return;

            // Robust bounds
            let min = 1;
            let max = 150;
            let best = 1;

            // Fast Binary scaling loop
            for (let i = 0; i < 20 && min <= max; i++) {
                const mid = Math.floor((min + max) / 2);
                textEl.style.fontSize = `${mid}px`;

                // +1 padding buffer for decimal CSS pixels on mobile
                if (textEl.scrollHeight <= maxH + 1 && textEl.scrollWidth <= maxW + 1) {
                    best = mid;
                    min = mid + 1; // It fits! Push higher
                } else {
                    max = mid - 1; // Overflow! Push lower
                }
            }

            textEl.style.fontSize = `${best}px`;
            setFontSize(best);
            containerEl.style.opacity = '1';
            setIsFitted(true);

            // Report the locally calculated ideal max size to the cluster manager to sync font sizes
            if (best !== calculatedSizeRef.current) {
                calculatedSizeRef.current = best;
                if (item.clusterId && onFit) {
                    onFit(item.clusterId, best);
                }
            }
        };

        const observer = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(performFit, 50);
        });

        observer.observe(containerEl);
        performFit();

        return () => {
            clearTimeout(resizeTimeout);
            observer.disconnect();
        };
    }, [cleanText]);

    return (
        <div
            ref={containerRef}
            onClick={onToggle}
            className="absolute flex items-center justify-center p-0 m-0 text-center cursor-pointer"
            style={{
                left: txPct,
                top: tyPct,
                width: twPct,
                height: thPct,
                opacity: isHidden ? 0 : (isFitted ? 1 : 0),
                transition: 'opacity 0.2s ease-in-out',
                overflow: 'hidden', // Strict containment
                pointerEvents: 'auto'
            }}
        >
            <p
                ref={textRef}
                className="leading-none select-none m-0 p-0"
                style={{
                    color: isDebug ? 'white' : 'black',
                    fontSize: `${Math.min(fontSize, clusterFontSize || Infinity)}px`,
                    lineHeight: '1.05',
                    fontFamily: '"Comic Neue", "Comic Sans MS", "Arial", sans-serif',
                    fontWeight: 700,
                    textShadow: isDebug ? '1px 1px 0 #000' : 'none',
                    textTransform: forceUpper ? 'uppercase' : 'none',
                    letterSpacing: '-0.02em',

                    // Using keep-all to strongly discourage breaking words mid-string. If it's too big, it will overflow and shrinking will handle it.
                    wordBreak: 'keep-all',
                    overflowWrap: 'normal',
                    hyphens: 'none',
                    whiteSpace: 'pre-wrap',
                    width: '100%',
                    textAlign: 'center'
                }}
            >
                {cleanText}
            </p>
        </div>
    );
};

const LocalOverlay = ({ items = [], visible = true, imageUrl = null }) => {
    const [balloonMasks, setBalloonMasks] = useState({});
    const [hiddenBalloons, setHiddenBalloons] = useState({});
    const [clusterSizes, setClusterSizes] = useState({});

    const handleFit = React.useCallback((clusterId, size) => {
        if (!clusterId) return;
        setClusterSizes(prev => {
            if (!prev[clusterId] || size < prev[clusterId]) {
                return { ...prev, [clusterId]: size };
            }
            return prev;
        });
    }, []);

    const toggleBalloon = (id) => {
        setHiddenBalloons(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Pre-process items to merge split YOLO detections (where one translation is fully contained in another)
    // and assign conversation clusters for Font Size syncing
    const mergedItems = React.useMemo(() => {
        if (!items || items.length === 0) return [];

        let arr = JSON.parse(JSON.stringify(items));
        // Remove any null items if they exist for some reason
        arr = arr.filter(x => x !== null);

        // SECOND PASS: Assign Cluster IDs for Font Size Syncing based on proximity
        for (let i = 0; i < arr.length; i++) {
            if (!arr[i].clusterId) arr[i].clusterId = `cluster_${i}`;

            for (let j = i + 1; j < arr.length; j++) {
                const a = arr[i];
                const b = arr[j];
                const [ax, ay, aw, ah] = a.box || [0, 0, 0, 0];
                const [bx, by, bw, bh] = b.box || [0, 0, 0, 0];

                const hGap = Math.max(0, Math.max(ax, bx) - Math.min(ax + aw, bx + bw));
                const vGap = Math.max(0, Math.max(ay, by) - Math.min(ay + ah, by + bh));

                // If balloons are very close (e.g. adjacent in same panel flow)
                if (hGap < Math.max(aw, bw) * 0.25 && vGap < Math.max(ah, bh) * 0.25) {
                    if (!b.clusterId) {
                        b.clusterId = a.clusterId;
                    } else {
                        // Merge clusters
                        const oldCluster = b.clusterId;
                        const newCluster = a.clusterId;
                        for (let k = 0; k <= j; k++) {
                            if (arr[k].clusterId === oldCluster) arr[k].clusterId = newCluster;
                        }
                    }
                }
            }
        }

        return arr;
    }, [items]);

    useEffect(() => {
        if (!visible || !mergedItems || mergedItems.length === 0 || !imageUrl) return;

        let active = true;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;

        img.onload = () => {
            if (!active) return;
            const canvas = document.createElement('canvas');
            const w = img.width;
            const h = img.height;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);

            const masks = {};

            mergedItems.forEach((item, idx) => {
                const id = item.id || idx;
                const [bx, by, bw, bh] = item.box || [0, 0, 0, 0];
                if (bw === 0 || bh === 0) return;

                // Absolute coordinates based on original image
                const ax = Math.floor(bx * w);
                const ay = Math.floor(by * h);
                const aw = Math.floor(bw * w);
                const ah = Math.floor(bh * h);
                const aCx = ax + Math.floor(aw / 2);
                const aCy = ay + Math.floor(ah / 2);

                try {
                    // Extract tightly padded crop for the flood fill. 
                    // This keeps the mask strictly local so it gracefully slices connected balloons without bleeding across the whole page.
                    const expPad = 0.15;
                    const expX = Math.max(0, ax - Math.floor(aw * expPad));
                    const expY = Math.max(0, ay - Math.floor(ah * expPad));
                    const expW = Math.min(w - expX, aw + Math.floor(aw * (expPad * 2)));
                    const expH = Math.min(h - expY, ah + Math.floor(ah * (expPad * 2)));

                    const imgData = ctx.getImageData(expX, expY, expW, expH);
                    const pixels = imgData.data;

                    // 1. Find Average Background Color of the Balloon (ignore ink)
                    const bX = ax - expX, bY = ay - expY, bW = aw, bH = ah;
                    const iX = Math.floor(bX + bW * 0.25);
                    const iY = Math.floor(bY + bH * 0.25);
                    const iW = Math.floor(bW * 0.5);
                    const iH = Math.floor(bH * 0.5);

                    let sumR = 0, sumG = 0, sumB = 0, count = 0;
                    for (let sy = iY; sy < iY + iH; sy += 2) {
                        for (let sx = iX; sx < iX + iW; sx += 2) {
                            if (sx < 0 || sx >= expW || sy < 0 || sy >= expH) continue;
                            const idx = (sy * expW + sx) * 4;
                            const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
                            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                            if (luma > 70) { // Skip dark ink when figuring out the paper color
                                sumR += r; sumG += g; sumB += b;
                                count++;
                            }
                        }
                    }
                    if (count === 0) { count = 1; sumR = 255; sumG = 255; sumB = 255; }
                    const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;

                    // 2. Flood Fill Function
                    // The fill cannot exceed the dynamically created boundary crop.
                    const maxEdgeTouches = (expW + expH) * 1.5; // If it touches the crop border this many times, it's a background leak!
                    const minFillArea = aw * ah * 0.1;

                    const tryFloodFill = (startX, startY) => {
                        if (startX < 0 || startX >= expW || startY < 0 || startY >= expH) return null;

                        const seedIdx = (startY * expW + startX) * 4;
                        const seedLuma = 0.299 * pixels[seedIdx] + 0.587 * pixels[seedIdx + 1] + 0.114 * pixels[seedIdx + 2];
                        if (seedLuma < 60) return null; // Seed is on ink!

                        const visited = new Uint8Array(expW * expH);
                        const queue = [startX, startY];
                        visited[startY * expW + startX] = 1;

                        let painted = 0;
                        let edgeTouches = 0;
                        const toleranceSq = 120 * 120; // High tolerance: stops ONLY at dark ink lines effortlessly

                        while (queue.length > 0) {
                            const cy = queue.pop();
                            const cx = queue.pop();
                            painted++;

                            if (cx === 0 || cx === expW - 1 || cy === 0 || cy === expH - 1) {
                                edgeTouches++;
                                if (edgeTouches > maxEdgeTouches) return null; // Leaked entirely into the background
                            }

                            const neighbors = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
                            for (let i = 0; i < 4; i++) {
                                const nx = neighbors[i][0], ny = neighbors[i][1];
                                if (nx >= 0 && nx < expW && ny >= 0 && ny < expH) {
                                    const nIdx1 = ny * expW + nx;
                                    if (!visited[nIdx1]) {
                                        const nIdx4 = nIdx1 * 4;
                                        const r = pixels[nIdx4], g = pixels[nIdx4 + 1], b = pixels[nIdx4 + 2];
                                        // Compare to the TRUE average paper color, not the single seed point!
                                        const distSq = (r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2;

                                        if (distSq < toleranceSq) {
                                            visited[nIdx1] = 1;
                                            queue.push(nx, ny);
                                        }
                                    }
                                }
                            }
                        }

                        if (painted < minFillArea) return null; // Trapped inside a letter O
                        return { visited, painted };
                    };

                    // 3. Try 5 different seed points (Center, and 4 corners of inner box)
                    let bestFill = null;
                    const seeds = [
                        [Math.floor(bX + bW / 2), Math.floor(bY + bH / 2)],
                        [Math.floor(bX + bW * 0.3), Math.floor(bY + bH * 0.3)],
                        [Math.floor(bX + bW * 0.7), Math.floor(bY + bH * 0.3)],
                        [Math.floor(bX + bW * 0.3), Math.floor(bY + bH * 0.7)],
                        [Math.floor(bX + bW * 0.7), Math.floor(bY + bH * 0.7)],
                    ];

                    for (const [sx, sy] of seeds) {
                        const res = tryFloodFill(sx, sy);
                        if (res) {
                            bestFill = res;
                            break; // Stop at first good fill!
                        }
                    }

                    if (!bestFill) {
                        console.warn(`[Masking] Balloon ${id} failed to find a valid mask (tried 5 seeds). Falling back.`);
                        return;
                    }

                    // 4. Fill Holes (Convex Raycast Fill)
                    // Perfectly fills the original dark text and fixes dent cutouts from panels
                    const visited = bestFill.visited;

                    // Re-parse Gemini's hex color to paint the actual RGB into the mask.
                    let paintR = 255, paintG = 255, paintB = 255;
                    const bgColor = item.background_color || "#FFFFFF";
                    const hex = bgColor.replace('#', '');
                    if (hex.length === 6) {
                        paintR = parseInt(hex.substring(0, 2), 16);
                        paintG = parseInt(hex.substring(2, 4), 16);
                        paintB = parseInt(hex.substring(4, 6), 16);
                    }

                    const maskCanvas = document.createElement('canvas');
                    maskCanvas.width = expW;
                    maskCanvas.height = expH;
                    const maskCtx = maskCanvas.getContext('2d');
                    const maskData = maskCtx.createImageData(expW, expH);
                    const mPixels = maskData.data;
                    for (let i = 0; i < mPixels.length; i += 4) mPixels[i + 3] = 0;

                    for (let y = 0; y < expH; y++) {
                        for (let x = 0; x < expW; x++) {
                            const idx1 = y * expW + x;

                            if (visited[idx1]) {
                                const idx4 = idx1 * 4;
                                mPixels[idx4] = paintR;
                                mPixels[idx4 + 1] = paintG;
                                mPixels[idx4 + 2] = paintB;
                                mPixels[idx4 + 3] = 255;
                                continue;
                            }

                            // Convex Raycast: If an unvisited pixel is bounded by visited pixels on opposite sides,
                            // it constitutes an internal hole (like black text ink) and should be painted.
                            let hitL = false, hitR = false;
                            for (let lx = x - 1; lx >= 0; lx--) { if (visited[y * expW + lx]) { hitL = true; break; } }
                            if (hitL) {
                                for (let rx = x + 1; rx < expW; rx++) { if (visited[y * expW + rx]) { hitR = true; break; } }
                            }

                            let hitT = false, hitB = false;
                            if (!(hitL && hitR)) { // Optimize: only check vertical if horizontal missed
                                for (let ty = y - 1; ty >= 0; ty--) { if (visited[ty * expW + x]) { hitT = true; break; } }
                                if (hitT) {
                                    for (let by = y + 1; by < expH; by++) { if (visited[by * expW + x]) { hitB = true; break; } }
                                }
                            }

                            if ((hitL && hitR) || (hitT && hitB)) {
                                const idx4 = idx1 * 4;
                                mPixels[idx4] = paintR;
                                mPixels[idx4 + 1] = paintG;
                                mPixels[idx4 + 2] = paintB;
                                mPixels[idx4 + 3] = 255;
                            }
                        }
                    }

                    maskCtx.putImageData(maskData, 0, 0);

                    masks[id] = {
                        dataUrl: maskCanvas.toDataURL('image/png'),
                        x: expX / w,
                        y: expY / h,
                        w: expW / w,
                        h: expH / h
                    };
                } catch (e) {
                    console.error("Mask generation failed for item", id, e);
                }
            });

            setBalloonMasks(masks);
        };

        return () => {
            active = false;
        };
    }, [mergedItems, imageUrl]);

    if (!mergedItems || mergedItems.length === 0) return null;

    const validItems = mergedItems.filter(item => {
        const text = item.text_translated || item.text_preview || "...";
        const isDebug = !item.text_translated;

        const cleanCmp = text.toLowerCase().replace(/[^a-z]/g, '');
        if (cleanCmp === 'notext' || cleanCmp.includes('unintelligible') || cleanCmp === 'empty') return false;

        if (!isDebug && item.text_original && item.text_translated) {
            const cleanOrig = item.text_original.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
            const cleanTrans = item.text_translated.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

            // If the AI just repeated the exact same English/SFX back, leave the original artwork intact!
            if (cleanOrig.length > 0 && cleanOrig === cleanTrans) {
                return false;
            }
        }
        return true;
    });

    if (validItems.length === 0) return null;

    return (
        <div
            className={`absolute inset-0 pointer-events-none z-10 w-full h-full transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
            style={{ touchAction: 'none' }}
        >

            <svg className="absolute inset-0 w-full h-full overflow-visible">
                <defs>
                    <filter id="balloon-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
                    </filter>
                </defs>
                <g filter="url(#balloon-shadow)">
                    {validItems.map((item, index) => {
                        const id = item.id || index;
                        const isHidden = hiddenBalloons[id];
                        const [x, y, w, h] = item.box || [0, 0, 0, 0];
                        const isDebug = !item.text_translated;

                        // Precise original bounding box for fallback (no inflation)
                        const cxPct = `${(x + w / 2) * 100}%`;
                        const cyPct = `${(y + h / 2) * 100}%`;
                        const rxPct = `${(w / 2) * 100}%`;
                        const ryPct = `${(h / 2) * 100}%`;

                        const shape = (item.shape || "OVAL").toUpperCase();
                        let bgColor = (item.background_color || "").trim();
                        if (!bgColor || bgColor.toLowerCase() === "transparent" || bgColor.toLowerCase() === "none" || bgColor.toLowerCase() === "null" || bgColor.endsWith("00") || bgColor.length > 7) {
                            bgColor = "white"; // Force white if AI hallucinated transparent colors
                        }

                        const isOval = shape === "OVAL" || shape === "CLOUD" || shape === "JAGGED";

                        // Draw a Pill (rounded rect) if the oval is very squashed, else an Ellipse.
                        const isPill = isOval && (h > 0 && w / h > 1.8);

                        // Prefer the dynamic pixel-perfect mask if it generated successfully
                        const mask = balloonMasks[item.id || index];

                        if (mask && !isDebug) {
                            return (
                                <g
                                    key={`shape-${id}`}
                                    style={{
                                        opacity: isHidden ? 0 : 1,
                                        pointerEvents: 'auto',
                                        cursor: 'pointer',
                                        transition: 'opacity 0.2s ease-in-out'
                                    }}
                                    onClick={() => toggleBalloon(id)}
                                >
                                    {/* Standard SVG Image mapping perfectly rendering the Canvas output */}
                                    <image
                                        x={`${mask.x * 100}%`}
                                        y={`${mask.y * 100}%`}
                                        width={`${mask.w * 100}%`}
                                        height={`${mask.h * 100}%`}
                                        href={mask.dataUrl}
                                        preserveAspectRatio="none"
                                    />
                                </g>
                            );
                        }

                        // Fallback to shapes if no mask or in debug mode
                        return (
                            <g
                                key={`shape-${id}`}
                                style={{
                                    opacity: isHidden ? 0 : 1,
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s ease-in-out'
                                }}
                                onClick={() => toggleBalloon(id)}
                            >
                                {isOval && !isPill ? (
                                    <ellipse cx={cxPct} cy={cyPct} rx={rxPct} ry={ryPct} fill={isDebug ? "rgba(255, 0, 0, 0.2)" : bgColor} stroke={isDebug ? "red" : "transparent"} strokeWidth={isDebug ? "2" : "0"} />
                                ) : (
                                    <rect x={`${x * 100}%`} y={`${y * 100}%`} width={`${w * 100}%`} height={`${h * 100}%`} fill={isDebug ? "rgba(255, 0, 0, 0.2)" : bgColor} stroke={isDebug ? "red" : "transparent"} strokeWidth={isDebug ? "2" : "0"} rx={isPill ? `${(h / 2) * 100}%` : "8"} ry={isPill ? `${(h / 2) * 100}%` : "8"} />
                                )}
                            </g>
                        );
                    })}
                </g>
            </svg>

            {validItems.map((item, index) => {
                const id = item.id || index;
                return (
                    <FitText
                        key={`text-${id}`}
                        item={item}
                        isHidden={hiddenBalloons[id]}
                        onToggle={() => toggleBalloon(id)}
                        clusterFontSize={clusterSizes[item.clusterId]}
                        onFit={handleFit}
                    />
                );
            })}
        </div>
    );
};

export default LocalOverlay;
