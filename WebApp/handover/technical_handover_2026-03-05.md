# 🚀 Technical Handover: KomgaReader Antigravity WebApp
**Date:** March 5, 2026
**Version:** 1.0 (Refinement Branch)

---

## 🏗️ Project Architecture & Mission
This project is a React 19 (Vite) porting of the native iOS `KomgaReaderAntigravity` app. The mission is to bring high-performance AI comic translation (Balloon Detection, OCR, and LLM Translation) to the browser using local WASM/WebGPU acceleration and cloud-hybrid fallbacks.

### 🏁 Core Tech Stack
*   **Frontend:** React 19, Vite (PWA enabled).
*   **Styling:** Vanilla CSS + Lucide Icons (Glassmorphic & Liquid UI design).
*   **Storage:** 
    *   **OPFS (Origin Private File System):** Critical for large `.cbz`/`.cbr` files.
    *   **acrStorage (Sidecar):** Stores translation results as `.acr` JSON files alongside the comic.
    *   **IndexedDB:** Metadata and folder structure (localLibrary).
*   **Runtime:** `ONNXRuntime-Web` (Detection/OCR) and `@mlc-ai/web-llm` (Translation).

---

## 🧩 Modularity & Key Components

### 1. The "State Portal" (`src/context/AppContext.jsx`)
Central hub for global state. It provides:
*   `settings`: Combined server credentials (`useAuth`) and UI/App flags (`useSettings`).
*   `komgaService`: Singleton for API calls.
*   `showToast`/`addLog`: Unified feedback system.
*   **Debug Logic**: Toggles visibility of `Tuner`, `StorageInspector`, and `SystemLog`.

### 2. The Reader Core (`src/components/LocalReader.jsx`)
Highly optimized viewer with two execution modes based on `settings.debugMode`:
*   **Debug ON:** Shows intermediate detection steps and final balloon count alerts.
*   **Debug OFF (Silent):** Jumps directly from scan request to translated result for a commercial-grade UX.
*   **Archive Engine:** Supports both JSZip (CBZ) and `node-unrar-js` (CBR).

### 3. Navigation & Layout
*   `NavBar.jsx`: Dynamic navigation based on `activeConfig`.
*   `LocalLibrary.jsx`: Virtualized grid (Virtuoso) for high-performance viewing of thousands of books.
*   `ContinueReadingCarousel.jsx`: Smart preview of recent history and folder contents.

### 4. Optimized Service Layer
*   **PageTranslationOrchestrator (`src/services/PageTranslationOrchestrator.js`):**
    *   Manages AI job concurrency (max 1 active task).
    *   Implements priority (HIGH for current page, LOW for prefetch).
    *   Handles job deduplication and stale request cancellation.
*   **DownloadScheduler (`src/services/downloads/index.js`):**
    *   Prioritized queue (Bulk: 0, Normal: 1, Reader: 2).
    *   Persistent state in IndexedDB (resumes on restart).
    *   Exponential backoff retry policy (2s, 4s, 8s...).

---

## 🤖 AI Modules (WebGPU Accelerated)

1.  **Detection (`src/modules/detection.js`):** YOLOv8 model running via `onnxruntime-web`.
2.  **OCR (`src/modules/ocr.js`):** PaddleOCR wrapper for local text extraction.
3.  **Translate (`src/modules/translate.js`):** WebLLM bridge targeting Qwen2-0.5B for fast, local context-aware translation.
4.  **Hybrid Cloud (`src/services/GeminiService.js`):** Sends balloon blobs to Gemini 2.0 Flash for superior quality when online. Includes 45s timeout and auto-retry logic.

---

## 🛠️ Internal Tooling (Debug Mode)
*   **Layout Tuner:** Live editing of margins, font sizes, and grids.
*   **Storage Inspector:** Real-time analysis of OPFS and IndexedDB contents.
*   **System Logs:** Sequential trace of service worker interactions and download progress.

---

## 📋 Status & Next Steps
*   [x] **Component Decoupling**: App.jsx is slim; components are modular and testable.
*   [x] **Language & Debug Flags**: Persist correctly in `acr_settings_v3`.
*   [x] **Silent Translation**: Production-ready flow implemented.
*   [x] **Optimized Translation Pipeline**: Orchestrator + Prefetching.
*   [x] **Robust Download Scheduler**: Prioritized, persistent, and resilient.
*   [ ] **Magic Wand Adjustments**: User requested removing the automatic merge of overlapping balloons to allow manual refinement.
*   [ ] **BCR Support**: Verify/Implement `.cbr` (RAR) archive compatibility for sidecar storage.

---

**Developed by:** Antigravity (Advanced Agentic Coding Agent)
**Workspace:** `KomgaReaderAntigravity_Experimental/WebApp`
