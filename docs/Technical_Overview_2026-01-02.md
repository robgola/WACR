# Technical Overview - KomgaReaderAntigravity
**Date:** 2026-01-02
**Version:** Experimental

## 1. Technology Stack
*   **Platform:** iOS / iPadOS 16+
*   **Language:** Swift 5.9+
*   **UI Framework:** SwiftUI
*   **Architecture:** MVVM (Model-View-ViewModel) with Global AppState
*   **Backend:** Komga Media Server (API v1)

## 2. Core Architecture
The application acts as a client for a Komga server. It does not manage local files directly but caches structure and metadata from the server.

*   **AppState**: A global `ObservableObject` injected into the environment that manages:
    *   User Preferences (Settings, Layout config).
    *   Navigation State.
    *   Authentication Credentials (managed securely, recently scrubbed from code).
*   **Services**: Singleton-based services for specific domains:
    *   `KomgaService`: Handles HTTP requests to the Komga API.
    *   `GeminiService`: Interacts with Google's Gemini API for semantic understanding.
    *   `BalloonDetector`: Wraps the YOLO CoreML model.
    *   `LocalizationService`: Centralized string management.

## 3. The "Antigravity" Pipeline (v6.1)
The core value proposition is the AI-powered balloon detection and translation pipeline, orchestrated by the `BalloonPipeline` actor.

### 3.1. Hybrid Strategy
The pipeline combines structural detection (YOLO) with semantic understanding (Gemini) to achieve high accuracy.

1.  **Parallel Execution**:
    *   **YOLO (CoreML)**: Detects physical bounding boxes of speech balloons.
    *   **Gemini (Cloud)**: Performs OCR and Semantic segmentation (identifies text blocks and translates them).
2.  **Matching Logic**:
    *   **Stage A (IoU)**: Matches Gemini text blocks to YOLO boxes using Intersection over Union (> 0.1).
    *   **Stage B (Distance)**: Fallback for non-overlapping matches using Euclidean distance (threshold < 0.3 page width).
3.  **Refinement (OpenCV)**:
    *   Matched balloons are passed to **OpenCV** (via Objective-C++ bridge).
    *   **GrabCut Algorithm**: Uses the bounding box (inflated by 10% for safety) to segment the precise organic shape of the balloon.
    *   **Result**: A list of `TranslatedBalloon` objects with vector paths ready for SwiftUI rendering.

### 3.2. External Components
*   **OpenCV (4.x)**: Used for `GrabCut`, Canny Edge Detection, and Morphological operations. Integrated via `OpenCVWrapper.mm`.
*   **YOLO (Ultralytics)**: Custom trained scaffolding model for balloon bounding boxes.

## 4. UI/UX Design System
*   **Dashboard Layout**: Highly customizable grid system with "Liquid Glass" aesthetics.
    *   Persisted via `@AppStorage` in `AppState`.
    *   Visual Editor (`BoxStyleEditorView`) allows real-time adjustment of margins, spacing, and offsets.
*   **Localization**: Dynamic localized strings (Italian/English/etc.) fetched via `LocalizationService`.

## 5. File System & Parsing
*   **FolderUtilities**: Transforms the flat list of `Series` from Komga into a hierarchical tree structure.
*   **Smart Collapse**: Algorithmically hides redundant folders (e.g., if a folder contains only one series with a similar name).
