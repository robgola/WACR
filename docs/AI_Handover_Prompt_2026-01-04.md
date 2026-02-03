# Documento di Trasferimento Tecnico - KomgaReaderAntigravity

**Data:** 2026-01-04
**Progetto:** `KomgaReaderAntigravity_Experimental`
**Versione Attuale:** v5.0 (Experimental)
**Autore:** Antigravity (AI Technical Lead)

---

## 1. Panoramica del Progetto

### Obiettivo
`KomgaReaderAntigravity` è un'applicazione iOS nativa progettata per ridefinire l'esperienza di lettura dei fumetti digitali (CBR/CBZ) integrando funzionalità avanzate di **Traduzione AI in tempo reale**. L'app si connette a server Komga self-hosted per il download e la gestione della libreria, offrendo un lettore fluido e un motore di traduzione che sostituisce chirurgicamente il testo nei balloon mantenendo lo stile grafico originale.

### Target Utenti
Appassionati di fumetti e manga che possiedono una libreria personale su Komga e desiderano leggere contenuti in lingua originale con il supporto di una traduzione contestuale e visivamente integrata (non semplici overlay di testo grezzo).

### Funzionalià Principali
- **Integrazione Komga**: Navigazione e download di serie e libri da server Komga.
- **Libreria Locale**: Gestione offline di file CBZ/CBR con metadati (ComicInfo.xml).
- **AI Balloon Translation (v6.1)**: Pipeline ibrida che combina Vision/OpenCV per la rilevazione dei balloon e Gemini 1.5 Flash per la traduzione semantica.
- **Surgical Text Masking**: Cancellazione pulita del testo originale (Inpainting) e rendering del testo tradotto all'interno della forma esatta del balloon.
- **Granular Settings**: Configurazione dettagliata di server e chiavi API direttamente in app.

---

## 2. Architettura dell’App

### Pattern Architetturale
Il progetto segue un pattern **MVVM (Model-View-ViewModel)** pragmatico, fortemente orientato a SwiftUI.
- **Views**: Struttura dichiarativa dell'interfaccia (`Views/`).
- **Services**: Logica di business incapsulata in Singleton (`Services/`), che agiscono da ViewModel globali o specifici per feature (es. `KomgaService`, `GeminiService`).
- **Models**: Strutture dati (`Models/`) conformi a `Codable` per la persistenza e il parsing.
- **AppState**: Un `EnvironmentObject` globale (`Utils/AppState.swift`) gestisce lo stato trasversale dell'applicazione (navigazione, credenziali, preferenze utente), agendo come "Sourc of Truth" per l'intera app.

### Suddivisione in Moduli
- **Core**: `KomgaReaderApp.swift` (Entry point).
- **UI Layer**:
  - `MainTabView`: Orchestratore della navigazione principale (Pill Navigation).
  - `LocalLibraryView`: Browser della libreria locale e Settings.
  - `ReaderView`: Motore di rendering delle pagine e gestione gesture.
- **Service Layer**:
  - `BalloonPipeline`: Attore (`actor`) che orchestra la traduzione parallela.
  - `OpenCVWrapper`: Ponte Objective-C++ per operazioni di Computer Vision.
  - `GeminiService`: Client API per Google Gemini.

### Flusso dei Dati
1. **Download**: `KomgaService` scarica il file -> `DownloadManager` salva su disco.
2. **Parsing**: `LocalBook` rappresenta il file decompresso; `ComicInfoParser` estrae i metadati.
3. **Traduzione**: `ReaderView` richiede la traduzione -> `BalloonPipeline` processa l'immagine -> `Gemini` restituisce JSON -> `TranslatedBalloon` viene renderizzato sopra la pagina originaria.

---

## 3. Tecnologie e Strumenti

### Stack Tecnologico
- **iOS Target**: iOS 16.0+ (Ottimizzato per iPad e iPhone).
- **Linguaggio**: Swift 5.9+.
- **Framework Apple**:
  - `SwiftUI`: Interfaccia utente.
  - `Vision`: Rilevamento testo (VNRecognizeTextRequest).
  - `Combine`: Gestione eventi reattivi.
- **Integrazioni C++**:
  - **OpenCV 4.x**: Utilizzato per `GrabCut` (segmentazione), sogliatura adattiva, e operazioni morfologiche. Integrato via `OpenCVWrapper.mm`.
- **Librerie Terze Parti**:
  - `ZIPFoundation`: Decompressione archivi CBZ.
  - `Alamofire` (Opzionale/Legacy): Per networking avanzato (attualmente si usa principalmente `URLSession` nativa).

### Toolchain
- **IDE**: Xcode 15+.
- **AI Coding**: Antigravity (Google Deepmind).

---

## 4. Gestione dei Comics

### Parsing e Storage
- I file `.cbz` vengono trattati come archivi ZIP.
- **Cache**: I libri aperti vengono decompressi in `NSTemporaryDirectory()` in una cartella dedicata.
- **Struttura**:
  - `LocalFolderNode`: Rappresentazione ricorsiva del file system per la navigazione a cartelle.
  - `LocalBook`: Oggetto "foglia" che rappresenta un singolo fumetto, contenente URL locale, cover, e metadati.
  - `ComicInfo.xml`: Parsing dello standard ComicRack per titoli, numeri e serie.

---

## 5. Traduzione AI delle Balloon (v6.1 Hybrid)

### Pipeline Tecnica
La pipeline è definita in `Services/BalloonPipeline.swift` e segue un approccio parallelo:
1. **Rilevamento Ibrido**:
   - **YOLO/Vision**: `BalloonDetector` identifica le bounding box fisiche dei balloon.
   - **Semantic AI**: `GeminiService` analizza l'intera pagina inviando un prompt multimodale per ottenere trascrizione + traduzione JSON.
2. **Matching (IoU Strategy)**:
   - Le risposte di Gemini vengono mappate sulle box fisiche rilevate tramite calcolo della `Intersection over Union` (IoU).
3. **Refinement (OpenCV)**:
   - `OpenCVWrapper::refinedBalloonContour` (GrabCut) calcola il contorno organico preciso del balloon a partire dalla box rettangolare.
4. **Rendering**:
   - Il testo originale viene coperto (Masking) usando il colore di sfondo rilevato.
   - Il testo tradotto viene disegnato vettorialmente (`Path`) all'interno del contorno.

### Modelli e Lingue
- **Modello AI**: Google Gemini 1.5 Flash (veloce ed economico per il real-time).
- **Lingue**: Attualmente hardcoded verso **Italiano**, ma la struttura `TranslatedBalloon` supporta qualsiasi lingua target.

---

## 6. UI / UX

### Struttura e Design
- **Main Navigation**: Una "Pill Bar" flottante in alto (`MainTabView`) sostituisce la TabBar nativa per un look immersivo.
- **Aestetica**: "Liquid Glass" (blur + trasparenze), palette scura, ombre morbide.
- **Settings**: Integrato dentro `LocalLibraryView`, con un sistema di **Granular Editing** (doppio tocco per modificare il singolo campo) per evitare cambi accidentali.
- **Orientamento**: Bloccato in **Portrait** per stabilità layout.

---

## 7. Networking e Server

### Komga Integration
- **Auth**: Basic Auth (User/Password) salvati in `AppState` (`@AppStorage`).
- **Download**: Download diretto di file raw con gestione progressiva (`DownloadProgress`).
- **Endpoint**: Utilizza le API REST standard di Komga (`/api/v1/ ...`).

---

## 8. Problemi Noti e Debito Tecnico

### Problemi Aperti
- **Vision Coordinate Flip**: Occasionale disallineamento delle coordinate Y tra Vision (Bottom-Left) e UIKit (Top-Left) se non gestito correttamente nel wrapper OpenCV.
- **Memory**: La decompressione di CBR/CBZ molto pesanti può causare picchi di memoria.
- **Text Layout**: Il rendering del testo tradotto a volte esce dai bordi se il balloon è molto piccolo o irregolare.

### Refactoring Necessario
- **Separazione Settings**: La `SettingsView` è attualmente definita all'interno di `LocalLibraryView.swift`. Dovrebbe essere estratta in un file dedicato per pulizia.
- **Hardcoded Strings**: Alcune stringhe di UI sono ancora hardcoded e non passano per `LocalizationService`.

---

## 9. Stato Attuale dello Sviluppo

- [x] **Core Reader**: Funzionante (Swipe, Zoom).
- [x] **Libreria Locale**: Funzionante (Scan ricorsivo).
- [x] **AI Translation v6**: Stabile (Hybrid Pipeline).
- [x] **Settings Refinement**: Completato (Granular Editing, Layout Fixes).
- [ ] **Supporto Kavita/YacReader**: Placeholder presenti nella UI.
- [ ] **Landscape Mode**: Disabilitato temporaneamente.

---

## 10. Prossimi Sviluppi Consigliati

### Short Term (Immediato)
1. **Estrarre `SettingsView`**: Spostare la struct `SettingsView` da `LocalLibraryView.swift` al proprio file `Views/SettingsView.swift`.
2. **Test su Device**: Verificare che il layout "Pill" non confligga con la Dynamic Island su iPhone 15/16.

### Medium Term
1. **Gestione Serie**: Migliorare il grouping dei fumetti per Serie invece che solo per Cartelle.
2. **Pre-Cache Traduzioni**: Permettere di tradurre un intero albo in background prima della lettura.

### Long Term
1. **Database Locale**: Sostituire la scansione file system con SQLite/CoreData per prestazioni su librerie enormi.
2. **Supporto PDF**: Aggiungere supporto driver PDFKit.

---

## 11. Istruzioni Operative

### Setup e Build
1. Aprire `KomgaReaderAntigravity.xcodeproj`.
2. Assicurarsi che i Pod (Opencv) siano installati o linkati correttamente (vedere `Bridging-Header`).
3. Selezionare target fisico o simulatore **iPad o iPhone**.
4. Build & Run (`Cmd+R`).

### File Chiave
- **Logica Settings**: `Views/LocalLibraryView.swift` (cerca `struct SettingsView`).
- **Logica AI**: `Services/BalloonPipeline.swift`.
- **Configurazione**: `Utils/AppState.swift`.
- **Navigazione**: `Views/MainTabView.swift`.

---
*Generated by Antigravity for seamless Project Handover.*
