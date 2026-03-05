# 🛠️ Dettaglio Pipeline WebApp (Offline vs Online)
**Data:** 5 Marzo 2026

Le due pipeline della WebApp sono state progettate per garantire flessibilità tra velocità di risposta locale (PWA) e massima qualità linguistica (Cloud).

---

### 📴 1. Pipeline Offline (100% Locale)
Questa pipeline funziona interamente nel browser, operando anche in assenza di connessione internet.

*   **Balloon Detection**: 
    *   **Modello**: YOLOv8 (`comic-speech-bubble-detector`)
    *   **Esecuzione**: `onnxruntime-web` (WASM/WebGPU).
    *   **Compito**: Identifica i rettangoli (bounding boxes) dei balloon sulla pagina.
*   **OCR (Optical Character Recognition)**:
    *   **Motore**: PaddleOCR (DBNet + CRNN) tramite `@gutenye/ocr-browser`.
    *   **Compito**: Estrae il testo originale da ogni balloon rilevato.
*   **Translation**:
    *   **Modello**: Qwen2.5-1.5B-Instruct eseguito tramite WebLLM (`@mlc-ai/web-llm`).
    *   **Compito**: Traduce il testo dall'inglese all'italiano (o altra lingua selezionata).
*   **Translated Balloon Drawing**:
    *   **Componente**: `LocalOverlay.jsx`
    *   **Compito**: Disegna il testo tradotto sopra l'immagine originale usando coordinate normalizzate (0-1).

---

### 🌐 2. Pipeline Online (Ibrida / Cloud)
Questa pipeline ottimizza il carico combinando la velocità del rilevamento locale con la potenza dei modelli di visione in cloud.

*   **Balloon Detection**:
    *   **Motore**: Stesso rilevamento locale **YOLOv8** della pipeline offline.
    *   **Vantaggio**: Risposta immediata dell'interfaccia utente (UX).
*   **OCR & Translation (Single Pass)**:
    *   **Motore**: Google Gemini 2.0 Flash (Vision API).
    *   **Flusso**: L'app invia i "ritagli" (crops) dei balloon rilevati localmente a Gemini tramite API.
    *   **Vantaggio**: Gemini esegue OCR e Traduzione simultaneamente, comprendendo meglio il contesto visivo e superando i limiti dei piccoli modelli locali.
*   **Translated Balloon Drawing**:
    *   **Componente**: `LocalOverlay.jsx` (Condiviso).
    *   **Compito**: Visualizza i risultati strutturati ricevuti dal cloud.

---

### 📦 Archiviazione Risultati (.ACR)
Entrambe le pipeline salvano i risultati finali nello storage locale (OPFS) come file sidecar con estensione `.acr` (stesso nome del file del fumetto), rendendo le traduzioni successive istantanee.
