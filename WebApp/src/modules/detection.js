import * as ort from 'onnxruntime-web/wasm';

// Configure ONNX Runtime to use WASM (WebGPU is faster but WASM is more broadly compatible on iPad initially)
// Vite usually handles the .wasm files automatically, but if it fails we might need to copy them
ort.env.wasm.numThreads = 1; // Safari often prefers single thread or small pools
ort.env.wasm.wasmPaths = '/WACR/'; // Point explicitly to the Vite base path where we copied the binaries

/**
 * Detection Module (100% Local PWA)
 * Runs YOLOv8 ONNX model in the browser using WebAssembly.
 */
class DetectionModule {
    constructor() {
        this.modelPath = '/WACR/models/ogkalu-comic-detector/comic-speech-bubble-detector_no_nms.onnx';

        // Calibration Constants (Frozen from previous backend work)
        this.CONF_THRESH = 0.12;
        this.GLOBAL_ONNX_MULTIPLIER = 2.4423236915218913;
        this.MIN_BOX_WH = 10;
        this.MIN_AREA_RATIO = 6e-5;
        this.KEEP_TOPK_PER_CLASS = 100;
        this.IOU_NMS = 0.45;
    }

    /**
     * Detect balloons in an image.
     */
    async detectBalloons(imageBlob) {
        const startTime = performance.now();

        // 1. Create Image Bitmap
        const imgBitmap = await createImageBitmap(imageBlob);
        const origW = imgBitmap.width;
        const origH = imgBitmap.height;
        const targetSize = 1024; // Model expects 1024x1024

        // 2. Letterbox via Canvas (Replaces Server 'sharp')
        const scale = Math.min(targetSize / origW, targetSize / origH);
        const newW = Math.round(origW * scale);
        const newH = Math.round(origH * scale);
        const padLeft = Math.floor((targetSize - newW) / 2);
        const padTop = Math.floor((targetSize - newH) / 2);

        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Fill black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, targetSize, targetSize);
        // Draw centered and scaled
        ctx.drawImage(imgBitmap, 0, 0, origW, origH, padLeft, padTop, newW, newH);

        const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
        const data = imageData.data; // RGBA Uint8ClampedArray

        // 3. Convert to NCHW Float32 Tensor [1, 3, 1024, 1024]
        const planeSize = targetSize * targetSize;
        const inputFloats = new Float32Array(planeSize * 3);

        for (let i = 0; i < planeSize; i++) {
            inputFloats[i] = data[i * 4 + 0] / 255.0;             // R
            inputFloats[planeSize + i] = data[i * 4 + 1] / 255.0; // G
            inputFloats[planeSize * 2 + i] = data[i * 4 + 2] / 255.0; // B
        }

        const inputTensor = new ort.Tensor('float32', inputFloats, [1, 3, targetSize, targetSize]);

        // 4. Load Inference Session (Load -> Run -> Destroy pattern for RAM saving)
        console.log("[Detection] Loading ONNX model into RAM...");
        let session;
        try {
            session = await ort.InferenceSession.create(this.modelPath, {
                executionProviders: ['wasm'] // Fallback to wasm, can try webgpu later
            });
        } catch (e) {
            console.error("[Detection] Failed to load local ONNX model:", e);
            throw new Error(`Local model failed to load: ${e.message}. Are you offline? Check if model exists in public/models.`);
        }

        console.log("[Detection] Running inference...");
        let results;
        try {
            const feeds = {};
            feeds[session.inputNames[0]] = inputTensor;
            results = await session.run(feeds);
        } finally {
            // ALWAYS destroy session after use to free iPad RAM!
            // Wait, releasing explicitly isn't a simple method in ort-web, but we can drop the ref.
            // Under WebGPU we'd call session.release(), for wasm we just let GC handle it.
            if (session?.release) {
                try { session.release(); } catch (e) { }
            }
            session = null;
        }

        // 5. Decode Output
        const outputName = Object.keys(results)[0]; // usually the only output
        const outputTensor = results[outputName];

        // Transpose [1, 84, 8400] to array of 8400 rows
        const dims = outputTensor.dims;
        const anchors = dims[2]; // 8400
        const channels = dims[1]; // 84
        const tData = outputTensor.data;
        const rows = [];
        for (let a = 0; a < anchors; a++) {
            const row = new Float32Array(channels);
            for (let c = 0; c < channels; c++) {
                row[c] = tData[c * anchors + a];
            }
            rows.push(row);
        }

        // Meta info for decoding
        const meta = { origW, origH, scale, padLeft, padTop, targetSize };

        // Decode
        const decoded = this.decodeOnnxOutput(rows, meta);
        const finalDetections = this.postprocess(decoded, meta);

        // 6. Normalize Coordinates to 0-1 for Overlay
        const balloons = finalDetections.map(d => {
            const [x1, y1, x2, y2] = d.box;
            const safeX1 = Math.max(0, x1);
            const safeY1 = Math.max(0, y1);
            return {
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2, 11),
                box: [
                    safeX1 / origW,
                    safeY1 / origH,
                    (x2 - safeX1) / origW,
                    (y2 - safeY1) / origH
                ],
                confidence: d.score,
                class_id: d.cls,
                text_preview: "Detected",
                translated_text: null
            };
        });

        const processingTime = Math.round(performance.now() - startTime);
        console.log(`[Detection] Found ${balloons.length} balloons in ${processingTime}ms locally!`);

        return {
            balloons,
            processing_time_ms: processingTime,
            image_dimensions: { width: origW, height: origH }
        };
    }

    decodeOnnxOutput(rows, meta) {
        if (!rows || rows.length === 0) return { boxes: [], scores: [], classes: [] };
        const boxes = [];
        const scores = [];
        const classes = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cx = row[0];
            const cy = row[1];
            const w_raw = row[2];
            const h_raw = row[3];
            const objLogit = row[4];
            const classLogits = row.subarray(5);

            const objProb = 1.0 / (1.0 + Math.exp(-objLogit));

            let classProb = 0;
            let classId = 0;

            if (classLogits.length === 0) {
                classProb = 1.0;
            } else if (classLogits.length === 1) {
                classProb = 1.0 / (1.0 + Math.exp(-classLogits[0]));
                classId = 0;
            } else {
                let maxL = -Infinity;
                for (let v of classLogits) if (v > maxL) maxL = v;
                let sumEx = 0;
                const exps = new Float32Array(classLogits.length);
                for (let c = 0; c < classLogits.length; c++) {
                    const e = Math.exp(classLogits[c] - maxL);
                    sumEx += e;
                    exps[c] = e;
                }
                let maxP = -1;
                for (let c = 0; c < exps.length; c++) {
                    const p = exps[c] / sumEx;
                    if (p > maxP) {
                        maxP = p;
                        classId = c;
                    }
                }
                classProb = maxP;
            }

            let finalScore = objProb * classProb;
            finalScore = finalScore * this.GLOBAL_ONNX_MULTIPLIER;
            if (finalScore > 1.0) finalScore = 1.0;
            if (finalScore < 0.0) finalScore = 0.0;

            let cx_abs = cx;
            let cy_abs = cy;
            let w_abs = w_raw;
            let h_abs = h_raw;

            if (meta.targetSize && cx <= 1.01 && cy <= 1.01 && w_raw <= 1.01) {
                cx_abs *= meta.targetSize;
                cy_abs *= meta.targetSize;
                w_abs *= meta.targetSize;
                h_abs *= meta.targetSize;
            }

            const lb_x1 = cx_abs - (w_abs / 2);
            const lb_y1 = cy_abs - (h_abs / 2);
            const lb_x2 = cx_abs + (w_abs / 2);
            const lb_y2 = cy_abs + (h_abs / 2);

            let x1 = (lb_x1 - meta.padLeft) / meta.scale;
            let y1 = (lb_y1 - meta.padTop) / meta.scale;
            let x2 = (lb_x2 - meta.padLeft) / meta.scale;
            let y2 = (lb_y2 - meta.padTop) / meta.scale;

            x1 = Math.max(0, Math.min(meta.origW, x1));
            y1 = Math.max(0, Math.min(meta.origH, y1));
            x2 = Math.max(0, Math.min(meta.origW, x2));
            y2 = Math.max(0, Math.min(meta.origH, y2));

            boxes.push([x1, y1, x2, y2]);
            scores.push(finalScore);
            classes.push(classId);
        }
        return { boxes, scores, classes };
    }

    postprocess({ boxes, scores, classes }, meta) {
        const finalDetections = [];
        const classIndices = {};

        for (let i = 0; i < scores.length; i++) {
            const [x1, y1, x2, y2] = boxes[i];
            const w = x2 - x1;
            const h = y2 - y1;
            const area = w * h;
            const imgArea = meta.origW * meta.origH;

            if (w < this.MIN_BOX_WH || h < this.MIN_BOX_WH) continue;
            if (imgArea > 0 && (area / imgArea) < this.MIN_AREA_RATIO) continue;
            if (scores[i] < this.CONF_THRESH) continue;

            const cls = classes[i];
            if (!classIndices[cls]) classIndices[cls] = [];
            classIndices[cls].push(i);
        }

        for (const cls in classIndices) {
            let indices = classIndices[cls];
            indices.sort((a, b) => scores[b] - scores[a]);
            if (indices.length > this.KEEP_TOPK_PER_CLASS) {
                indices = indices.slice(0, this.KEEP_TOPK_PER_CLASS);
            }

            const keep = [];
            for (const i of indices) {
                let overlap = false;
                for (const j of keep) {
                    const boxI = boxes[i];
                    const boxJ = boxes[j];

                    const xA = Math.max(boxI[0], boxJ[0]);
                    const yA = Math.max(boxI[1], boxJ[1]);
                    const xB = Math.min(boxI[2], boxJ[2]);
                    const yB = Math.min(boxI[3], boxJ[3]);

                    const interW = Math.max(0, xB - xA);
                    const interH = Math.max(0, yB - yA);
                    const interArea = interW * interH;

                    if (interArea > 0) {
                        const areaI = (boxI[2] - boxI[0]) * (boxI[3] - boxI[1]);
                        const areaJ = (boxJ[2] - boxJ[0]) * (boxJ[3] - boxJ[1]);
                        const union = areaI + areaJ - interArea;
                        if (union > 0) {
                            if ((interArea / union) > this.IOU_NMS) {
                                overlap = true;
                                break;
                            }
                        }
                    }
                }
                if (!overlap) keep.push(i);
            }

            for (const k of keep) {
                finalDetections.push({ box: boxes[k], score: scores[k], cls: classes[k] });
            }
        }
        finalDetections.sort((a, b) => b.score - a.score);
        return finalDetections;
    }
}

export const detectionModule = new DetectionModule();
