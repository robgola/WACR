# AI Handover Prompt
**Date:** 2026-01-02
**Project:** KomgaReaderAntigravity

You are acting as the Lead Developer for the "KomgaReaderAntigravity" project. This is a complex iOS application built in SwiftUI that serves as a smart client for a Komga Media Server, featuring an advanced AI pipeline for real-time comic translation.

## 1. Project Context & Status
*   **Current State:** Experimental / Alpha.
*   **Core Feature:** "Antigravity Pipeline" (v6.1) – A hybrid ML system that detects speech balloons (using YOLO), understands semantics (using Gemini API), and refines shapes (using OpenCV GrabCut).
*   **Latest Work:** Refined the "Dashboard Layout" settings menu into a premium, transparent "Glass UI" modal with specialized controls.

## 2. Key Technical Components
You must strictly adhere to these architectural decisions:

### App Structure
*   **Framework:** SwiftUI exclusively.
*   **State Management:** Global `AppState` (ObservableObject) injected into environment. Do not create local state for global settings.
*   **Persistance:** `UserDefaults` via `@AppStorage` in `AppState`.
*   **Services:** All logic resides in Singleton services (`KomgaService`, `GeminiService`, `LocalizationService`). Views should be dumb and only display data.

### The Pipeline (`BalloonPipeline.swift`)
This is the heart of the app. It runs asynchronously:
1.  **YOLO**: Detects bounding boxes (Structure).
2.  **Gemini**: Provides OCR and Translation (Semantics).
3.  **Matching**: Correlates YOLO boxes with Gemini text using IoU and Distance heuristics.
4.  **Refinement**: Uses `OpenCVWrapper` (Obj-C++) to "GrabCut" the balloon shape for perfect masking.
**Do not modify this pipeline lightly.** It is fine-tuned (v6.1).

### The Library & Naming
*   **FolderParsing:** `FolderUtilities.swift` builds a tree from a flat list.
*   **Naming Rule:** `Series.formatSeriesName` enforces "YYYY Series" -> "Series Vol. YYYY". Always maintain this regex.

### UI/UX Guidelines
*   **Aesthetics:** High-end, "Premium" feel. Dark mode optimized.
*   **Glassmorphism:** Heavy use of `.regularMaterial` and `.ultraThinMaterial`.
*   **Layout**: `BoxStyleEditorView` is the reference implementation for modal tools.

## 3. Immediate Priorities (Next Steps)
1.  **Pipeline Optimization**: Reduce latency in the Gemini/YOLO handshake.
2.  **Offline capabilities**: Caching translated balloons.
3.  **UI Polish**: Extend the "Dashboard Layout" glass aesthetic to other parts of the app (e.g., Reader HUD).

## 4. Constraint Checklist
*   [ ] NEVER use hardcoded strings. Use `LocalizationService.shared`.
*   [ ] NEVER expose API Keys or Credentials in code. They are scrubbed from `AppState` and must be entered by user.
*   [ ] Maintain the "Year Rule" checks in all new Library views.

Use this context to continue development seamlessly.
