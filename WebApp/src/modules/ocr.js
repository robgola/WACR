import Ocr from '@gutenye/ocr-browser';
import * as ort from 'onnxruntime-web';

console.log("----------------------------------------------------------------");
console.log("DEBUG: OCR MODULE LOADED. Using: PaddleOCR via @gutenye/ocr-browser");
console.log("DEBUG: Models: ch_PP-OCRv4_det, ch_PP-OCRv4_rec (OFFLINE)");
console.log("----------------------------------------------------------------");

// Force strict offline mode for WASM binaries (Vite static copy)
ort.env.wasm.wasmPaths = '/WACR/';

/**
 * OCR Module (PaddleOCR WASM)
 * Uses DBNet for internal text line detection and CRNN/SVTR for multi-line recognition.
 */
class OCRModule {
    constructor() {
        this.ocrPromise = null;
        this.ocrInstance = null;
    }

    /**
     * Initialize the PaddleOCR Engine (Singleton).
     */
    async init() {
        if (this.ocrInstance) return this.ocrInstance;
        if (this.ocrPromise) return this.ocrPromise;

        this.ocrPromise = (async () => {
            console.log("[OCR] Initializing PaddleOCR Model (WASM)...");

            try {
                // Initialize the PaddleOCR pipeline
                // Following expert advice: Using a pure English recognition model (en_PP-OCRv4)
                // combined with the strict 96-character en_dict.txt.
                // Detection remains V5 as it handles box finding flawlessly.
                const ocr = await Ocr.create({
                    models: {
                        detectionPath: '/WACR/models/paddleocr/PP-OCRv5_server_det_infer.onnx',
                        recognitionPath: '/WACR/models/paddleocr/en_PP-OCRv4_rec_infer.onnx',
                        dictionaryPath: '/WACR/models/paddleocr/en_dict.txt'
                    },
                    isDebug: false, // Turn on if we want to trace the DBNet polygon detections
                    useSpaceChar: true, // Forces English alphabet spacing
                });

                console.log("[OCR] PaddleOCR Pipeline Ready.");
                this.ocrInstance = ocr;
                return ocr;

            } catch (err) {
                console.error("[OCR] Failed to init PaddleOCR pipeline:", err);
                throw new Error("PaddleOCR Initialization Failed.");
            }
        })();

        return this.ocrPromise;
    }

    /**
     * Extract text from balloons.
     * @param {Blob} imageBlob - The full page image.
     * @param {Array} balloons - Array of { box: [x, y, w, h] (0-1), ... }
     * @param {Function} onProgress - Call with (current, total)
     */
    async extractText(imageBlob, balloons, onProgress) {
        if (!balloons || balloons.length === 0) return balloons;

        const ocrEngine = await this.init();
        const results = [...balloons];

        // Prepare Canvas for cropping
        const imgBitmap = await createImageBitmap(imageBlob);
        const canvas = document.createElement('canvas');
        canvas.width = imgBitmap.width;
        canvas.height = imgBitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgBitmap, 0, 0);

        console.log(`[OCR] Processing ${balloons.length} balloons with PaddleOCR...`);

        for (let i = 0; i < balloons.length; i++) {
            const b = balloons[i];
            const [x, y, w, h] = b.box;

            // Pixel coords
            const px = Math.floor(x * canvas.width);
            const py = Math.floor(y * canvas.height);
            const pw = Math.ceil(w * canvas.width);
            const ph = Math.ceil(h * canvas.height);

            if (pw <= 0 || ph <= 0) continue;

            // 1. Calculate Crop Size with Padding
            // Optimal padding is around 4-8px to maintain edges without fetching neighboring noise
            const basePadding = 8;
            const pwWithPadding = pw + (basePadding * 2);
            const phWithPadding = ph + (basePadding * 2);

            // 2. Setup High-Res Canvas (Dynamic Upscale)
            // If balloon is small (e.g. 100px), upscale heavily to reach ~250px for optimal CRNN processing.
            // Minimum scale is 1.5, maximum is 4.0 to prevent severe memory spikes.
            let scale = Math.max(1.5, 250 / ph);
            if (scale > 4.0) scale = 4.0;
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = pwWithPadding * scale;
            cropCanvas.height = phWithPadding * scale;
            const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

            // Fill white background
            cropCtx.fillStyle = 'white';
            cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

            // Draw upscaled image patch into the center
            cropCtx.drawImage(
                canvas,
                px, py, pw, ph,
                basePadding * scale, basePadding * scale, pw * scale, ph * scale
            );

            // 3. Pre-processing: Light Sharpening (Unsharp Mask)
            // As recommended, a 3x3 sharpen convolution matrix enhances font edges for the CRNN.
            // Modern PP-OCRv5 relies on clean internal contrast; sharpening helps prevent
            // merged words like "COULDYOU" or "YOURHOSTILITY".
            const imgData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
            const data = imgData.data;
            const cw = cropCanvas.width;
            const ch = cropCanvas.height;
            const tempData = new Uint8ClampedArray(data);

            // Light Sharpen Kernel
            const kernel = [
                0, -1, 0,
                -1, 5, -1,
                0, -1, 0
            ];

            for (let y = 1; y < ch - 1; y++) {
                for (let x = 1; x < cw - 1; x++) {
                    const offset = (y * cw + x) * 4;
                    let r = 0, g = 0, b = 0;

                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const kWeight = kernel[(ky + 1) * 3 + (kx + 1)];
                            const pOffset = ((y + ky) * cw + (x + kx)) * 4;
                            r += tempData[pOffset] * kWeight;
                            g += tempData[pOffset + 1] * kWeight;
                            b += tempData[pOffset + 2] * kWeight;
                        }
                    }

                    data[offset] = Math.min(255, Math.max(0, r));
                    data[offset + 1] = Math.min(255, Math.max(0, g));
                    data[offset + 2] = Math.min(255, Math.max(0, b));
                }
            }
            cropCtx.putImageData(imgData, 0, 0);

            // Visual Debugging (helpful to see what Paddle actually "sees")
            let debugContainer = document.getElementById('ocr-debug-container');
            if (debugContainer) {
                const debugCanvas = document.createElement('canvas');
                debugCanvas.width = cropCanvas.width;
                debugCanvas.height = cropCanvas.height;
                const dctx = debugCanvas.getContext('2d');
                dctx.drawImage(cropCanvas, 0, 0);
                debugCanvas.style.border = '1px solid magenta';
                debugCanvas.style.margin = '2px';
                debugCanvas.style.maxWidth = '100px';
                debugCanvas.style.height = 'auto';
                debugCanvas.title = `Paddle Box ${i}`;
                debugContainer.appendChild(debugCanvas);
            }

            try {
                // `ocr-browser` expects a URL string, so we convert the canvas to a base64 Data URL
                const cropUrl = cropCanvas.toDataURL('image/jpeg', 0.9);

                // Run PaddleOCR on the cropped canvas URL.
                // It internally runs DBNet to find lines -> Crops them -> Runs CRNN on each line
                const ocrResults = await ocrEngine.detect(cropUrl);

                // ocrResults is an array of Line: { text: string, mean: number, box: [[x,y],...] }
                // @gutenye/ocr-browser already sorts lines by vertical position internally
                const lines = ocrResults.map(line => line.text);
                const fullText = lines.join(' ').replace(/\n\s*\n/g, '\n').trim();

                results[i].text_original = fullText;
                results[i].text_preview = fullText || "[OCR Empty]";

                console.log(`[OCR] Balloon ${i} result:`, fullText, "\nRaw lines:", lines);

            } catch (err) {
                console.warn(`[OCR] Failed for balloon ${i}`, err);
                results[i].text_original = "";
                results[i].text_preview = "[OCR Exception]";
            }

            if (onProgress) onProgress(i + 1, balloons.length);
        }

        return results;
    }
}

export const ocrModule = new OCRModule();
