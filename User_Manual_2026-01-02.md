# User Manual - KomgaReaderAntigravity
**Date:** 2026-01-02

## 1. Introduction
KomgaReaderAntigravity is an advanced comic reader for iPad that connects to your Komga server. It features a unique "Antigravity" mode that uses AI to detect, extract, and translate speech balloons in real-time.

## 2. Library Organization
Your library is visualized as a hierarchical tree of folders and series boxes.

### 2.1. Automatic Organizing
The app reads the file paths from your Komga server and reconstructs a folder tree.
*   **Roots**: Top-level libraries (e.g., "Comics", "Manga") appear as tabs or root sections.
*   **Navigation**: Tap folders to drill down.
*   **Smart Collapse**: To keep the interface clean, if a folder contains **only one series** and the folder name is similar to the series name (e.g., Folder "Watchmen" containing Series "Watchmen"), the folder is hidden, and the series is shown directly.

### 2.2. Naming Conventions (The "Year" Rule)
The app applies specific formatting rules to clean up series names for display.

**Rule:** `YYYY Series Name` → `Series Name Vol. YYYY`

If a series folder on disk starts with a 4-digit year, it is automatically reformatted in the UI.
*   **Original:** `2001 Superman`
*   **Displayed:** `Superman Vol. 2001`
*   **Original:** `1963 The Amazing Spider-Man`
*   **Displayed:** `The Amazing Spider-Man Vol. 1963`

This ensures your library looks sorted and professional without renaming actual files on the server.

## 3. Dashboard Layout
You can customize the look of the library grid.
1.  Go to **Settings** (Gear Icon) -> **Dashboard Layout**.
2.  A transparent window will appear over your library.
3.  **Customize**:
    *   **Grid System**: Adjust column count and spacing.
    *   **Dimensions**: Change margins (white space around cover).
    *   **Aesthetics**: Move the text or the "handle" (the graphical tab on the box) up or down.
4.  **Save/Cancel**: Use the buttons to apply or revert changes.

## 4. Reading & Translation
### 4.1. The Reader
*   Tap a book to open.
*   Swipe or tap edges to turn pages.

### 4.2. Antigravity Mode (AI Translation)
During reading, the app's pipeline analyzes the page:
1.  **Detects** speech balloons.
2.  **Extracts** the text.
3.  **Translates** it continuously.
4.  **Overlays** the translated text precisely over the original balloon.

*Note: Performance depends on network speed (for Gemini AI) and device capabilities (for Neural Engine).*
