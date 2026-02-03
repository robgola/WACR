# WebApp Technical & Architectural Specifications

## 1. Overview
The **KomgaReader WebApp** is a modern, responsive React application designed to interface with a Komga Server. It serves as a rich client for browsing, reading, and downloading comics, with a strong focus on "Liquid Glass" aesthetics, performance (lazy loading), and offline capabilities (IndexedDB).

## 2. Technology Stack

### Core Framework
- **Runtime**: React 19.x (Experimental/Latest)
- **Build Tool**: Vite 7.x
- **Language**: JavaScript (ESModule)

### Styling & UI
- **CSS Engine**: TailwindCSS v4.x (via `@tailwindcss/vite`)
- **Animation**: Framer Motion 12.x
- **Icons**: Lucide React
- **Design System**: "Liquid Glass" (Heavy usage of `backdrop-blur`, translucent backgrounds, and thin borders)

### Data & State
- **State Management**: React Context (`AppContext`)
- **Routing**: React Router DOM 7.x
- **Local Storage**: IndexedDB (via `idb` library)
- **HTTP Client**: Native `fetch` with custom `KomgaService` wrapper

## 3. Architecture

### 3.1 Directory Structure
```
src/
├── components/     # UI Components (Atomic design elements)
│   ├── layout/     # Structural components (PillBar, Headers)
│   └── ui/         # Reusable UI widgets (AuthImage, ComicBox, Toast)
├── context/        # Global State Providers
├── hooks/          # Custom React Hooks (useSettings, etc.)
├── services/       # Business Logic & API Layer
└── utils/          # Helper functions & Data Structures
```

### 3.2 Global State (`AppContext`)
The `AppContext` serves as the central nervous system of the app. It provides:
- **Settings**: Persistent configuration (Server URL, Credentials) via `useSettings`.
- **Service Injection**: Instantiates and holds the `komgaService` instance.
- **Connection Status**: Tracks connectivity (`disconnected` -> `connecting` -> `connected`).
- **Logging**: Centralized debug log buffer.
- **Memory Cache**: Simple key-value store for transient data.

### 3.3 Service Layer

#### `KomgaService`
- **Responsibility**: Abstraction over the Komga REST API.
- **Authentication**: Usage of Basic Auth (`Authorization: Basic <base64>`).
- **Proxying**: Requests are routed through `/komga-proxy` (configured in `vite.config.js`) to bypass CORS during development.
- **Key Methods**: `getLibraries`, `getSeries`, `getSeriesBooks`.

#### `DownloadManager` (Singleton)
- **Responsibility**: Manages background downloads and offline storage.
- **Storage**: Uses IndexedDB (`acr_downloads_v1`) to store large blobs (images/files).
- **Concurrency**: Limits concurrent downloads (default: 3) to prevent browser network saturation.
- **Persistence**: Downloads persist across sessions.
- **Queue System**: Event-driven architecture with subscription model (`subscribe`/`notify`).

### 3.4 Data Handling

#### Lazy Loading (`AuthImage`)
To handle large libraries (hundreds of covers), the app implements `IntersectionObserver` in the `AuthImage` component. Images are only fetched and rendered when they enter the viewport, significantly reducing memory usage and main-thread blocking.

#### Offline Mode
The app is designed to work offline by checking `DownloadManager` for locally stored content.
- **`folderTree.js`**: Reconstructs a hierarchical view from flat series data.
- **`offlineTree.js`**: Adapts the folder structure logic for offline/downloaded content.

## 4. Key Configurations

### Vite Config (`vite.config.js`)
- **Proxy**:
  ```js
  proxy: {
    '/komga-proxy': {
      target: 'https://phnx-komga-mi.duckdns.org:8843',
      changeOrigin: true,
      secure: false
    }
  }
  ```
- **External Access**: `host: true` enabled for testing on devices (e.g., iPad) via LAN.

### Tailwind v4
- Uses the new `@tailwindcss/vite` plugin.
- CSS variables and modern layout engine.

## 5. UI/UX Specifications

### Design Philosophy
- **"Liquid Crystal/Glass"**:
  - Components feature high transparency (`bg-black/40`).
  - Heavy use of `backdrop-blur-xl` or `3xl`.
  - Thin, semi-transparent white borders (`border-white/10`).
- **Typography**:
  - Sans-serif, optimized for readability.
  - Thin font weights in menus for a modern look.
- **Interaction**:
  - **Long Press**: Utilized for context actions (download selection, multi-select).
  - **Haptic Feedback**: Visual scaling/bouncing on interaction.

### Layouts
- **Remote Library**: Sticky Header with "Liquid" pills. Infinite scrolling grid.
- **Local Library**: Replicates Remote structure but powered by IndexedDB.
- **Reader**: Immersive full-screen viewer.

## 6. Future Considerations / Known Limits
- **Large Lists**: While lazy loading helps, extremely large lists (>10k items) might eventually require virtualization (`react-window`).
- **Memory**: Storing full comic books in IndexedDB blobs can hit browser quota limits (typically a few GBs).
- **Security**: Credentials are stored in LocalStorage (basic obfuscation via Base64 in service, but plain JSON in settings). Consider encryption for production.
