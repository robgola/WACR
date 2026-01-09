# ACR Project Handover - Version 1.0 FINAL
**Date:** 2026-01-09
**Status:** FROZEN (Production Ready Candidate)

## Project Overview
**Name:** Antigravity Comics Reader (ACR)
**Version:** 1.0 (Build 100)
**Platform:** iOS / iPadOS (Target: iPad A14+)
**Stack:** SwiftUI, Combine, Vision Framework (OCR), CoreML (YOLOv8), Metal, OpenAI/Gemini API.

## Core Features (Completed)
- **Komga Integration:** Full sync, library browse, read progress.
- **Reading Engine:** Metal-accelerated, smart zoom, double-tap panel detection.
- **AI Pipeline:**
    -   **YOLOv8 (CoreML):** On-device balloon detection.
    -   **Gemini 1.5 Flash:** Context-aware translation.
    -   **Local Indexing:** Offline-first architecture.
- **UI/UX:**
    -   Premium "Liquid Glass" design.
    -   Unified navigation logic (NavigationView Stack).
    -   Custom Main Tab Bar with safe-area robustness.

## Recent Fixes (v1.0 Final)
-   **Navigation Standardization:** All views (`LocalLibrary`, `Settings`, `Help`) now use `NavigationView` with `.navigationViewStyle(.stack)`.
-   **Settings Layout:** Fixed "Main Menu runs away" regression by enforcing robust safe area checks in `MainTabView` and `SettingsView`.
-   **Help/Credits:** Refactored Manual into a proper Credits view with dynamic Version info and Contact links.

## Known Issues
-   None critical. Layout is stable.

## Future Roadmap (Post-V1)
-   **Web App (PWA):** Porting the experience to a Safari PWA using ONNX Runtime (WebAssembly) for client-side AI.
-   **Kavita Support:** Planned.
-   **FTP/SFTP:** Planned.

## Technical Notes
-   **Safe Area:** The `MainTabView` manually enforcing top padding (24pt) if the system reports 0 is a critical "load-bearing" fix. Do not remove without extensive testing on "Fullscreen" modifiers.
