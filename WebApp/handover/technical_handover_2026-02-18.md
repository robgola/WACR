# 🚀 SUPER-DETAILED HANDOVER PROMPT

**Role:** Expert Full-Stack Developer (React 19, Vite, PWA) with Deep Knowledge of Swift/iOS Architecture.
**Context:** Migrating specific AI features from a native iOS app (`KomgaReaderAntigravity`) to a React WebApp (`WebApp`).

---

## 🏗️ Project Architecture & Status

You are working on `KomgaReaderAntigravity_Experimental/WebApp`.
This is a **Project Porting** task.

### 1. The Dual-App Structure
*   **📂 `/KomgaReaderAntigravity` (Swift 1.0 - Native iOS)**
    *   **Status:** Frozen / Gold Master.
    *   **Role:** **STRICT REFERENCE**. Do NOT modify. Use this to understand *how* features (like "Smart Crop" or "Page Analysis") were implemented logic-wise.
    *   **Key Files:**
        *   `GeminiService.swift`: The *correct* implementation of AI translation (OCR + Translate).
        *   `BalloonDetector.swift`: The original detection logic (Vision framework).
        *   `WebServerService.swift`: Handles local streaming (relevant for how we might want to stream files in Web).

*   **📂 `/WebApp` (React 19 - Web/PWA)**
    *   **Status:** **ACTIVE DEVELOPMENT**.
    *   **Role:** The target application. A "Liquid Glass" design PWA that works offline.
    *   **Tech Stack:**
        *   **Framework:** React 19 + Vite.
        *   **Styling:** TailwindCSS v4 (Heavy use of `backdrop-blur`, `bg-black/50`, `border-white/10`).
        *   **State:** `AppContext.jsx` (Global State) + `idb` (IndexedDB).
        *   **Storage:** **OPFS (Origin Private File System)** for storing large `.cbz` files. `IndexedDB` for metadata (`books`, `series`).

### 2. Core Modules Implementation (WebApp)

#### A. **Sync & Networking (`komgaService.js`)**
*   **Auth:** Basic Auth (`username:password`) stored in `localStorage` (SECURITY RISK: Needs fix).
*   **Fetching:** Connects to user's Komga server. Pulls Series -> Books.
*   **Sync Logic:** "One-way sync". We fetch metadata and store it in IDB (`dbStore.js`).

#### B. **Offline System (`downloadManager.js` + `opfsManager.js`)**
*   **Flow:** User clicks download -> `downloadManager` fetches Blob -> Saves to OPFS (`Library/{Publisher}/{Series}/{Book}.cbz`).
*   **Queue:** Supports Pause/Resume/Cancel.
*   **Persistency:** The app is designed to work 100% offline once files are downloaded. `LocalLibrary.jsx` reads from OPFS, not the network.

#### C. **The Reader (`LocalReader.jsx`)**
*   **Engine:** Canvas-based rendering (currently single page).
*   **Gestures:** Touch support (Tap left/right, Swipe).
*   **Overlay:** `TranslationOverlay.jsx` sits on top of the image to render translated balloons.
*   **Design:** Fullscreen "Immersive Mode". Status bars hidden.

#### D. **Balloon Detection (CURRENT STATE - TO BE REPLACED)**
*   **Current Tech:** `RT-DETR-v2` (ONNX/WASM) running in `detection.js`.
*   **Status:** **WORKING BUT DEPRECATED**. It successfully detects balloons (outputting `[x,y,w,h]`), but the user wants to **ABANDON** this implementation.
*   **Reason:** Heavy WASM payload (~100MB), slow on mobile, or user preference for a different approach (e.g., Server-Side Gemini or lighter client model).
*   **Action:** **DO NOT** debug `detection.js` or `rtdetrv2_webgpu.onnx`. Plan to replace it.

---

## 📝 Features & Roadmap

### ✅ Completed
1.  **UI/UX:** "Liquid Glass" UI is 95% complete and matches the Swift app.
2.  **Navigation:** Complete "File System" drill-down (Library -> Series -> Book).
3.  **Offline Reading:** Fully functional for `.cbz` files (Zip).
4.  **Tuner:** A custom debug tool (`Tuner.jsx`) to tweak UI constants in real-time.

### 🚧 Work In Progress / Pending
1.  **Balloon Detection 2.0:**
    *   *Requirement:* Replace RT-DETR. Investigate **Google MediaPipe**, **Transformers.js** (lighter models), or **Server-Side Analysis** (sending image to Gemini/Komga).
2.  **CBR Support (Critical):**
    *   *Issue:* App treats `.cbr` (RAR) as `.cbz` (ZIP) and fails.
    *   *Fix:* Integrate a WASM Unrar library (`libunrar-js` or similar) into `opfsManager.js`.
3.  **AI Translation:**
    *   *Goal:* Port logic from `GeminiService.swift`.
    *   *Flow:* Detection -> Crop -> OCR (Gemini) -> Translate (Gemini) -> Render.
    *   *Current:* We have the overlay (`TranslationOverlay`), but no translation pipeline connected.

---

## 🐛 Known Bugs & Quirks
1.  **Ghost Balloons:** The `TranslationOverlay` previously rendered all boxes at `0,0`. *Fixed* by mapping `box: [x,y,w,h]` correctly.
2.  **Large Lists:** `LocalLibrary` renders all items. Needs virtualization (`react-window`) for libraries with >1000 books.
3.  **Security:** Credentials in `localStorage`. Must move to encrypted storage or session-only.
4.  **Zoom:** `LocalReader` lacks pinch-to-zoom (Basic implementation only).

---

## 🎯 Immediate Task for New Session
**"Analyze the current `WebApp` code, specifically `LocalReader.jsx` and `detection.js`. Propose a solid architectural plan to REPLACE the current RT-DETR detection with a lighter/better alternative (or Server-Side), and implement CBR support."**

Use the `Swift` reference code to see how `BalloonDetector.swift` (VS) and `GeminiService.swift` handled the logic natively, and find the JS equivalent.
