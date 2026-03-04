# KomgaReader Antigravity - Technical Handover (Balloon Masking v2.0)
*Date: 2026-03-04*

This document outlines the current state, architecture, and logic of the advanced Comic Balloon Masking system implemented in `LocalOverlay.jsx`. It serves as a starting point for future AI sessions to understand how the pixel-perfect balloon occlusion works without breaking it.

## 1. Deduplication & Merging Logic (YOLO Mitigation)
The local RT-DETR/YOLO models often fragment dialogue into multiple overlapping boxes, or split a single connected balloon into several chunks.
- **Logic:** We perform an `O(N^2)` sweep over all detected items (`mergedItems` memo).
- **Text Containment + Geometry:** If Box A's translated text is a sub-string of Box B (`tB.includes(tA)`), AND their bounding boxes intersect by more than `40%`, Box A is deleted and its bounding box is merged (Union) into Box B. Box B retains the full, longer text string.
- **Fallback Overlap:** If two boxes overlap by more than `80%` (but their text doesn't match perfectly, e.g. OCR hallucination), they are merged anyway.

## 2. Magic Wand Flood Fill Algorithm (Canvas Masking)
To perfectly occult the original Japanese/English text without creating ugly square boxes or overlapping adjacent art, we generate dynamic SVG Masks.
1. **Target Color Sampling:** We extract a bounding crop of the balloon, expanded by a tight **15% (`expPad = 0.15`)**. We heavily sample the center of the balloon looking for pixels with high luma (`> 70`) to calculate the *average paper color* of that specific balloon, completely ignoring the dark ink of the letters.
2. **Flood Fill:** A Javascript `tryFloodFill` algorithm runs from multiple seed points. It uses a high color `toleranceSq = 120^2` comparing against the *average paper color* (not the seed pixel). This allows it to effortlessly flow through JPEG noise and halftone patterns, stopping instantly at the hard black ink lines of the comic art.
3. **Leak Detection (edgeTouches):** Rather than arbitrary area limits, we track if the flood fill touches the borders of the 15% expanded crop. If it touches the bounds excessively, it has leaked through an open balloon into the page background. The fill aborts and triggers the Fallback.
4. **Hole Filling (Raycast):** To ensure letters with enclosed loops (like 'O' or 'P') don't leave original ink visible, a raycast hole-filler sweeps the canvas lines and fills anything surrounded by the mask.
5. **Mask Render:** The output is drawn onto a hidden `<canvas>`, converted to a DataURL, and displayed in an `<image>` tag inside an SVG `<g>` with a shared `<feDropShadow>` filter.

## 3. Fallback Shapes
If the flood fill fails (due to a leak or transparent background), it gracefully degrades to drawing basic SVG shapes exactly matching the YOLO bounding box (`aw, ah`).
- **Shapes:** It supports pure Ellipses, or rounded "Pill" Rectangles if the aspect ratio is extremely wide/tall (`w/h > 1.8` or `< 0.6`).
- **Colors:** It uses the AI-detected `background_color`. If the AI hallucinates "transparent", it is forced to `#FFFFFF`. The borders (`stroke`) are entirely transparent to avoid drawing black cut-lines over the original art.

## 4. Typography (FitText)
React-based dynamic text fitting.
- **Padding:** Meticulously tuned to `padXPct = 0.08` (8%) horizontally and vertically for Ellipses, and adapted for Pill shapes to prevent text clipping the rounded corners.
- **Binary Search Fit:** A `ResizeObserver` triggers a fast `1-150px` binary search loop in the DOM to find the exact maximum CSS `fontSize` that fits the `<p>` inside the constrained `<div>` without scrolling or overflowing.

## 5. Spatial Clustering (Font Harmonization)
To prevent a comic panel from looking amateurish with wild variations in font size:
- **Clustering:** During the deduplication pass, balloons that are very close to each other (Horizontal/Vertical gap `< 25%` of their dimensions) are assigned a shared `clusterId`.
- **Syncing:** Every `FitText` component calculates its own maximum possible size, but reports it back to a `handleFit` manager in `LocalOverlay`.
- **Enforcement:** The manager enforces the *smallest* font size across the entire cluster. This creates visually uniform lettering across conversational exchanges in the same panel.

## 6. Interactive Visibility Toggle
- Tapping a translated balloon instantly toggles its visibility.
- To prevent visually trashing the expensive Canvas Mask generation, the visibility toggle applies a CSS `opacity: 0` and `pointerEvents: 'none'` transition, rather than unmounting the React component.
