# Third-Party Assets & Binaries Tracker

This document tracks all external binaries, models, and significant static assets downloaded or copied into the `WebApp` directory. 
This is crucial for ensuring proper open-source licensing compliance, tracking versions, and determining what needs to be bundled for the final offline PWA release.

## 1. WebAssembly (WASM) Binaries

### ONNX Runtime Web (`onnxruntime-web`)
*   **Files:** `public/ort-wasm*.wasm` (WebAssembly Binaries) and `public/ort-wasm*.mjs` (WebWorker Execution Scripts)
*   **Version:** `1.22.0-dev...` / `1.24.2` (via `npm`)
*   **Source:** Copied directly from the local `node_modules/onnxruntime-web/dist/` folder.
*   **Purpose:** Required by the `onnxruntime-web` Javascript library to execute ONNX AI models on the CPU/GPU locally inside the browser. Safari/iOS requires these to be explicitly served as static files.
*   **License:** MIT License (Microsoft)

## 2. Artificial Intelligence Models

### TrOCR: Transformer-based Optical Character Recognition
*   **Model Name:** `Xenova/trocr-small-printed` (ONNX Quantized 8-bit)
*   **Files:** `public/models/Xenova/trocr-small-printed/` (Contains `.json` configs and `.onnx` weights)
*   **Source:** Downloaded via `src/utils/modelDownloader.js` from Hugging Face Hub.
*   **Purpose:** Replaces Tesseract.js. Used to read the text inside the comic balloons detected by YOLOv8. It is a Vision Encoder-Decoder specifically trained on printed text.
*   **License:** MIT License (Microsoft / Xenova)

### WebLLM: Local WebAssembly LLaMA Translation
*   **Model Name:** `Llama-3.2-1B-Instruct-q4f16_1-MLC`
*   **Files:** `public/models/webllm/` (Contains `.bin` shards, JSON configs, and `.wasm` runtime)
*   **Source:** Downloaded via `src/utils/downloadWebLLM.js` from Hugging Face (mlc-ai).
*   **Purpose:** Provides advanced offline grammatical parsing and translation of OCR text directly in the browser via WebGPU.
*   **License:** Meta Llama 3 License (Weights) / Apache 2.0 (MLC Engine)

### Balloon Detection Model (YOLOv8)
*   **File:** `public/models/ogkalu-comic-detector/comic-speech-bubble-detector_no_nms.onnx`
*   **Version:** Custom trained YOLOv8 model (converted to ONNX, without Non-Maximum Suppression).
*   **Source:** Originated from the `backend/` directory of this project. (Original weights likely derived from public datasets for comic OCR).
*   **Purpose:** Local detection of speech bubbles/balloons in comic pages. Executed offline via WebGPU/WASM by the WebApp.
*   **License:** To be determined (Depends on the original `ogkalu-comic-detector` model license, usually GPL or MIT).

## 3. Dynamically Downloaded Assets (Runtime)

*Note: These assets are not bundled in the source code but are downloaded by the user's browser during runtime and cached in IndexedDB.*

### Tesseract.js Language Models
*   **Files:** `eng.traineddata`, `ita.traineddata`, `jpn.traineddata` (approx. 20MB each)
*   **Source:** Downloaded automatically by `tesseract.js` from `https://tesseract.projectnaptha.com/` (GitHub Pages).
*   **Purpose:** OCR text recognition weights.
*   **License:** Apache 2.0 (Google/Tesseract OCR)

---
**Maintenance Note:** 
Before compiling the final release (`npm run build`), ensure that all files marked in sections 1 and 2 are present in the `public/` directory so they are correctly copied into the `dist/` production folder.
