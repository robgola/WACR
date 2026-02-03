# Documento di Trasferimento Tecnico - KomgaReaderAntigravity_Experimental

**Data:** 27 Gennaio 2026
**Autore:** Technical Lead (AI)
**Versione:** 1.0.0

---

## 1. Panoramica del Progetto

### Obiettivo
`Web Antigravity Comics Reader (WebApp)` è un'applicazione **Web / PWA (Progressive Web App)** progettata per offrire un'esperienza di lettura di fumetti (CBR/CBZ) di fascia alta ("Liquid Glass Design"), integrata con un server **Komga** personale.

> **📦 STATO DELLE VERSIONI (27/01/2026)**:
> 1.  **Swift Native (v1 RC)**: Questa versione è considerata **Frozen / Stable Release Candidate**. È completa per quanto riguarda le funzionalità attuali e pronta per la distribuzione nativa iOS.
> 2.  **WebApp (Active Dev)**: Lo sviluppo attivo continua su questa versione (cartella `WebApp`) per renderla autonoma e paritaria alla versione Swift.

### Target Utenti
-   **v1 (iOS)**: Utenti che vogliono la massima integrazione nativa e performance AI immediate.
-   **v2 (Web)**: Utenti che preferiscono una PWA installabile ovunque con capacità offline (OPFS).

### Funzionalità Principali (WebApp)
-   **Sincronizzazione Komga**: Connessione diretta alle API Komga (senza proxy nativo).
-   **Offline Storage**: Download e salvataggio locale dei file CBZ tramite **OPFS** (Origin Private File System) e IndexedDB.
-   **Lettura**: Reader avanzato React con supporto Touch/Gestures.
-   **AI Translation**: (Da Portare) Funzionalità attualmente presente solo nella versione Legacy Swift, da reimplementare in JS.

---

## 2. Architettura dell’App

Il progetto è ora una **SPA (Single Page Application)** React pura, potenzialmente installabile come PWA.

### Pattern Architetturale
-   **Frontend**: React 19 + Vite.
-   **State Management**: Context API (`AppContext`).
-   **Storage**:
    -   `IndexedDB` (via `idb`): Metadati libri, impostazioni, struttura cartelle.
    -   `OPFS` (Origin Private File System): Blob binari (file .cbz, immagini copertine).
    -   `localStorage`: Configurazioni leggere (Tuner settings).

### Moduli Chiave (`WebApp/src`)
-   **Services**:
    -   `komgaService.js`: Client API per Komga (Gestisce Auth Basic, Fetch Series/Books).
    -   `downloadManager.js`: Gestore code di download e persistenza su OPFS (+ `opfsManager.js`).
    -   `cacheManager.js`: Gestione cache immagini (placeholder).
-   **Components**:
    -   `LocalReader`: Motore di rendering pagine.
    -   `LocalLibrary`: Gestione file system virtuale e navigazione offline.
-   **Styling**:
    -   `TailwindCSS` v4 per il design system "Glass".

### Flusso dei Dati
1.  **Online**: `KomgaService` interroga il server remoto.
2.  **Download**: `downloadManager` scarica il blob → Salva in OPFS (`Library/{Publisher}/{Series}/{Book}.cbz`).
3.  **Offline**: `LocalLibrary` legge l'albero file da IDB e carica i blob da OPFS per la lettura.

---

## 3. Tecnologie e Strumenti (WebApp Focus)

-   **Runtime**: Browser Moderno (Chrome/Safari/Edge) con supporto OPFS.
-   **Language**: JavaScript (ESModules) / JSX.
-   **Build System**: Vite.
-   **Dependencies**:
    -   `react`, `react-dom`, `react-router-dom`.
    -   `lucide-react` (Icone).
    -   `framer-motion` (Animazioni).
    -   `idb` (Promise wrapper per IndexedDB).
    -   `jszip` (Parsing CBZ client-side).

---

## 4. Gestione dei Comics

### Parsing e Gestione File
-   **CBZ (ZIP)**: Supportato nativamente tramite `ZIPFoundation`. `KomgaService` estrae i file o serve lo stream.
-   **CBR (RAR)**: **NON IMPLEMENTATO**. Il codice controlla l'estensione `.cbr`, ma tenta di usare decompressione ZIP, il che fallirà. Richiede integrazione di `UnrarKit`.
-   **Streaming**: Il server locale usa `Data(contentsOf: options: .mappedIfSafe)` per lo streaming efficiente di file grandi senza caricare tutto in RAM.

### Cache e Storage
-   **File System**: Struttura `Documents/Library/{Series}/{Book}.cbz`.
-   **Cache Immagini**: `ImageCacheService` salva copertine e thumbnails in `Library/Caches` per evitare rigenerazione.
-   **Database**: Non c'è un DB SQL locale (CoreData/Realm). La "verità" è il file system + `UserDefaults` (per i settings) + JSON Cache in memoria (`seriesCache`, `booksCache`).

---

## 5. Traduzione AI delle Balloon

### Pipeline Tecnica
1.  **Rilevamento (Detection)**:
    -   Modello: `comic-speech-bubble-detector.mlpackage` (YOLOv8 quantizzato).
    -   Framework: `Vision` + `CoreML`.
    -   Input: `UIImage`.
    -   Output: `[DetectedBalloon]` (Array di `CGRect` normalizzati + confidenza).
    -   Logica in: `BalloonDetector.swift`.
2.  **OCR e Traduzione**:
    -   **Implementazione Attuale**: La classe `GeminiService` è una implementazione **completa e robusta**.
    -   Modelli: Supporta `gemini-2.5-flash` e `gemini-1.5-flash`.
    -   Funzionalità:
        -   **Single Crop Translation**: Traduzione mirata di singole balloon (OCR + Traduzione in un passo).
        -   **Analyze Page**: Analisi completa della pagina con coordinate 1000x1000 (Legacy/Foundation).
        -   **Quota Management**: Include sistema di retry esponenziale e tracciamento RPD (Requests Per Day).
    -   **Stato**: Operativo (backend), in attesa di integrazione finale UI.
3.  **Rendering**:
    -   Il rendering del testo tradotto avviene (o avverrà) tramite overlay Web (React) o View native SwiftUI sopra l'immagine.

---

## 6. UI / UX

### Disegno Ibrido
-   **Liquido & Glass**: Uso estensivo di `UltraThinMaterial` in SwiftUI e `backdrop-blur-xl` in CSS per un look unificato "iOS Native".
-   **Navigazione**:
    -   **Loop Principale**: Tab Bar personalizzata in basso (Libreria, Importa, Opzioni).
    -   **Import**: Menu flottanti configurabili via "Tuner".
-   **Tuner**: Un potente strumento di debug/design (in React) che permette di modificare margini, padding e layout in tempo reale e salvarli come default.

---

## 7. Networking e Server

### Client (Verso Komga)
-   Usa `URLSession` semplice.
-   Autenticazione **Basic Auth** (`username:password`).
-   Endpoint `/api/v1/series`, `/api/v1/books` mappati sulle API ufficiali Komga.

### Server Locale (Verso React)
-   Implementato con `Network.framework` (`NWListener`).
-   Gestisce le richieste HTTP manualmente (parsing stringa header).
-   Supporta streaming video/immagini, upload file (POST) e auth basata su Cookie/SessionToken.

---

## 8. Problemi Noti e Debito Tecnico

### 🔴 Critici
1.  **Supporto CBR Mancante**: Il codice tratta i file `.cbr` come zip. Necessario integrare una libreria `Unrar` nativa (es. `UnrarKit`).
2.  **Parsing HTTP Manuale**: `WebServerService.swift` fa il parsing manuale degli header HTTP. È fragile e non standard. Consigliabile passare a `Swifter` o `Vapor` (embedded) se la complessità aumenta.
3.  **Sicurezza**: Le credenziali Komga sono in `UserDefaults` in chiaro (o quasi). Andrebbero spostate nel Keychain.

### 🟡 Migliorabili
-   **Duplicazione UI**: Esistono viste SwiftUI (`SeriesListView`) e componenti React (`RemoteSeriesList`) che sembrano fare cose simili. Bisogna decidere quale sia la "verità" per l'utente finale. Attualmente React sembra essere il focus per il "Reader".
-   **Performance WebServer**: Servire file pesanti tramite `NWListener` custom potrebbe avere colli di bottiglia su file molto grandi o concorrenza elevata.

---

## 9. Stato Attuale dello Sviluppo

-   [x] **Core iOS**: Scheletro app, Tab Bar, Navigazione funzionante.
-   [x] **Komga Sync**: Listing librerie e serie, Download funzionante (solo CBZ).
-   [x] **Offline System**: Implementato con OPFS + IDB (`downloadManager.js`).
-   [x] **Web Reader**: Interfaccia React avanzata con "Tuner" per layout.
-   [ ] **AI Translation**: **MANCANTE**. La logica `GeminiService` (Swift v1) deve essere portata in JS per parità di funzioni.
-   [ ] **Supporto CBR**: Assente.

---

## 10. Prossimi Sviluppi Consigliati

### Short Term
1.  **Porting AI**: Creare `GeminiService.js` per chiamare le API Gemini direttamente dal browser (usando la stessa chiave API).
2.  **Porting Detection**: Valutare se usare `onnxruntime-web` o `tensorflow.js` per eseguire il modello YOLOv8 (`.onnx` invece di `.mlpackage`) direttamente nel browser per il rilevamento balloon.
3.  **CBR Support**: Integrare una libreria WASM per leggere i RAR.

### Medium Term
1.  **PWA Manifest**: Renderla installabile "Home Screen".
2.  **Sync Background**: Service Worker per download in background (limitato su iOS Web, ma possibile su Desktop/Android).

---

## 11. Istruzioni Operative

### Prerequisiti
-   **Xcode 15+**
-   **Node.js 18+** & **npm** (per la parte WebApp)
-   **CocoaPods** (`pod install` necessario).

### Build & Run
1.  **Web**:
    ```bash
    cd WebApp
    npm install
    npm run build
    ```
    (Copiare la cartella `dist` risultante nelle risorse di Xcode se si deploya per produzione).
2.  **iOS**:
    -   Aprire `KomgaReaderAntigravity_Ex.xcworkspace`.
    -   Selezionare target simulatore o device.
    -   Run (Cmd+R).
3.  **Note**: Durante lo sviluppo, la WebApp gira meglio su `localhost:5173` (Vite dev server) che punta alle API del simulatore/device (`localhost:8080`).

### File Chiave
-   `KomgaReaderAntigravity/Services/WebServerService.swift`: Il cuore della comunicazione iOS-Web.
-   `WebApp/src/App.jsx`: Il cervello dell'UI React.
-   `KomgaReaderAntigravity/Services/KomgaService.swift`: Il gestore dei download e del file system.

---
**Firmato:** Antigravity Agent (Technical Lead)
