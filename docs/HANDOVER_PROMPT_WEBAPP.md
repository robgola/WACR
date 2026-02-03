# PROMPT DETTAGLIATO PER CONTINUAZIONE SVILUPPO (HANDOVER)

**Contesto Progetto:**
Questo progetto è una **WebApp React (Vite + Tailwind CSS)** che funge da client per server **Komga**. È un porting/companion di un'app Swift iOS esistente ("Antigravity").
L'obiettivo è creare un'esperienza di lettura "Premium", "Fluid" e "Visually Stunning" (Glassmorphism, animazioni, layout curati).

---

## 🛑 STATO CRITICO & AVVERTIMENTI (LEGGI ATTENTAMENTE)
L'utente ha segnalato che le ultime modifiche hanno causato regressioni ("casino totale", "indietro di giorni").
**REGOLA D'ORO PER LA NUOVA CHAT:**
1.  **NON Dare per scontato nulla sul layout**: Prima di toccare `App.jsx`, **LEGGI** come sono implementati `LocalLibrary` e i componenti Import attuali.
2.  **Download System**: È stato appena riscritto per essere **Concorrente (Batch di 5)** e **Robust** (Timeouts). NON TOCCARE la logica di download se non richiesto. Funziona.
3.  **UI Import vs Local**: L'obiettivo è la **PARITÀ VISIVA**. L'Import deve avere lo stesso "Sticky Header", gli stessi "Breadcrumbs" e la stessa "Glass Grid" della Libreria Locale.

---

## 🏗 Architettura Attuale

### 1. Core (`src/App.jsx`)
Il file è massiccio (2000+ righe) e contiene le viste principali.
-   **`LocalLibrary`**: La Home Offline. Usa `idb` (IndexedDB) per mostrare i contenuti scaricati.
    -   *Caratteristiche*: Sticky Header complesso, Filtri a pillola, Carousel "Continue Reading", Griglia dentro un contenitore "Glass".
-   **`RemoteLibrary` (Import Root)**: Lista delle librerie Komga.
    -   *Modifiche Recenti*: Aggiunta Cache per non ricaricare la lista tornando indietro. Header reso Sticky.
-   **`RemoteSeriesList` (Import Browser)**: Navigazione dentro le librerie (Folder/Series).
    -   *Modifiche Recenti*: Allineamento layout con `LocalLibrary`. Breadcrumbs standardizzati.

### 2. Services
-   **`komgaService.js`**: Wrapper API.
    -   *Nota*: È stato aggiunto `getSeriesBooks` recentemente. Non perderlo.
-   **`downloadManager.js`**: Gestisce la coda e IndexedDB.
    -   *Critico*: Gestisce l'albero delle cartelle offline (`buildOfflineTree`).

### 3. Componenti Chiave (`src/components/ui`)
-   **`AuthImage.jsx`**: Gestisce le immagini autenticate Komg + Caching (Memoria + IDB).
    -   *Ottimizzazione*: Appena aggiunto `React.memo`, `loading="lazy"`, `decoding="async"` per ridurre lag nello scroll.
-   **`ComicBox.jsx`**: Il componente card principale.
    -   *Varianti*: "Folder" (Box 3D Giallo/Blu) e "Book" (Copertina 2D).
    -   *Ottimizzazione*: Appena aggiunto `React.memo`.

---

## 📝 Lista dei Problemi Recenti (Risolti o da Monitorare)

1.  **Download Freeze ("Analyzing...")**:
    -   *Causa*: `getLibraryTree` o analisi sequenziale su cartelle enormi bloccava il thread.
    -   *Fix Attuale*: Implementato **Batch Processing (5 alla volta)** con `Promise.race` e timeout di 15s per serie.
    -   *Azione*: Mantenere assolutamente questa logica in `handleDownloadFolder` dentro `App.jsx`.

2.  **Navigazione Import Lenta**:
    -   *Problema*: Cliccare "Indietro" ricaricava tutto. Scrollare liste di 1000 item laggava.
    -   *Fix Attuale*: Aggiunto `cachedLibs` in `RemoteLibrary` e `content-visibility: auto` (da verificare se applicato correttamente CSS) e memoizzazione componenti.

3.  **Layout Incoerente**:
    -   *User Request*: L'Import deve essere identico alla Locale.
    -   *Stato*: L'ultimo refactoring di `RemoteSeriesList` ha tentato di unificare l'header. **Verificare se questo ha rotto personalizzazioni precedenti.**

---

## 🚀 Istruzioni per il Primo Prompt della Nuova Chat
"Agente, prendi in carico questo progetto WebApp React.
Lo stato attuale è delicato. L'utente ha appena fixato problemi gravi di **Download Freezes** (con concorrenza e timeout) e sta cercando di stabilizzare la **UI di Importazione**.

**I tuoi compiti immediati:**
1.  **Analisi Non Distruttiva**: Leggi `App.jsx` e `downloadManager.js`. Mappa mentalmente le differenze tra `LocalLibrary` e le viste `Remote...`.
2.  **Verifica Performance**: Controlla se le ottimizzazioni (`React.memo` in `ComicBox`, Cache in `RemoteLibrary`) sono state applicate correttamente e non causano effetti collaterali (es. immagini che non caricano).
3.  **Layout Parity**: Se l'utente lamenta che la UI è 'tornata indietro', confronta il codice attuale di `RemoteSeriesList` con quello che ci si aspetta (Sticky Header, Glass Container). Chiedi conferma prima di stravolgere il layout.
4.  **Non toccare i Download**: La logica di download è 'Sacra' per ora, a meno che non ci siano bug bloccanti.

Il file `task.md` contiene lo storico. `implementation_plan.md` contiene l'ultimo piano eseguito. Ripartiamo da lì con massima cautela."
