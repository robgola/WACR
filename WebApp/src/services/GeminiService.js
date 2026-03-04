
/**
 * Gemini Service (Web Port)
 * Handles communication with Google Gemini 2.5 Flash API for Comic Analysis.
 * Replaces local RT-DETR detection with Server-Side Vision.
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export const geminiService = {

    /**
     * Get API Key from Storage (User must provide it in Settings)
     */
    getApiKey() {
        // v1: Use localStorage for MVP (Match SettingsPage.jsx key)
        return localStorage.getItem("acr_gemini_api_key") || "";
    },

    /**
     * Analyze a Comic Page (Detect + OCR + Translate)
     * Matches Swift `analyzeComicPage` logic.
     * @param {Blob|File} imageBlob - The image to analyze
     * @returns {Promise<Object>} - Format: { balloons: [{ box_2d, text, translation, ... }] }
     */
    async analyzePage(imageBlob) {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("Missing Gemini API Key. Please configure it in Settings.");

        // 1. Convert Blob to Base64
        const base64Image = await this.blobToBase64(imageBlob);

        // 2. Prepare System Prompt (Ported from Swift)
        const systemPrompt = `
        Analyze this comic book page with extreme precision.
        Visualize a strict 1000x1000 coordinate grid overlaid on the image (0,0 is top-left, 1000,1000 is bottom-right).
        All spatial measurements must be exact coordinates on this grid.
        
        Detect all speech balloons, captions, and text effects. 
        For each detected item:
        1. Extract the original text.
        2. Determine if it should be translated. Set "should_translate" to FALSE if:
           - It is a Sound Effect (e.g., "THWAP", "BANG", "WHOOSH").
           - It creates the "Ransom Note" effect (single isolated non-words).
           - It is a Proper Name (e.g., "Donavin", "Abbey Chase").
           - It is a Location Name (e.g., "Costa Rica", "New York").
           - It is unintelligible noise.
        3. If "should_translate" is TRUE, provide a natural Italian translation.
        4. Identify the shape (OVAL, RECTANGLE, CLOUD, JAGGED).
        5. Provide the bounding box [ymin, xmin, ymax, xmax] using the 1000x1000 grid.
        6. Provide the precise center point [y, x] of the balloon content using the 1000x1000 grid.

        Output strictly valid JSON obeying this schema:
        {
          "balloons": [
            {
              "original_text": "...",
              "italian_translation": "...",
              "should_translate": true,
              "shape": "OVAL",
              "box_2d": [ymin, xmin, ymax, xmax],
              "center_point": [y, x]
            }
          ]
        }
        `;

        // 3. Build Request Body
        const body = {
            contents: [
                {
                    parts: [
                        { text: systemPrompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg", // Assuming JPEG for now, ideally detect
                                data: base64Image
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.0,
                response_mime_type: "application/json"
            }
        };

        // 4. Send Request
        const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonString) throw new Error("Empty response from Gemini.");

        // 5. Parse JSON
        try {
            const result = JSON.parse(jsonString);
            return this.postProcess(result);
        } catch (e) {
            console.error("Gemini JSON Parse Error:", e, jsonString);
            throw new Error("Failed to parse Gemini response.");
        }
    },

    /**
     * Convert 1000x1000 grid to Normalized 0-1 for WebApp
     */
    postProcess(data) {
        if (!data.balloons) return [];

        return data.balloons.map(b => {
            // Swift: [ymin, xmin, ymax, xmax] in 1000 grid
            // WebApp: box [x, y, w, h] normalized 0-1
            if (!b.box_2d) return null;

            const [ymin, xmin, ymax, xmax] = b.box_2d;

            const x = xmin / 1000;
            const y = ymin / 1000;
            const w = (xmax - xmin) / 1000;
            const h = (ymax - ymin) / 1000;

            return {
                ...b,
                box: [x, y, w, h], // Standard WebApp Format
                text: b.original_text,
                translated_text: b.italian_translation
            };
        }).filter(Boolean);
    },

    /**
     * PIPELINE: Yolo (Local) + Gemini (Cloud)
     * Takes pre-detected YOLO balloons, crops them, and sends a multi-modal batch to Gemini 2.5 Flash.
     */
    async translateBalloons(imageBlob, balloons) {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("Missing Gemini API Key. Please configure it in Settings.");

        const sourceLang = localStorage.getItem('acr_ocr_lang') || 'English';
        const targetLang = localStorage.getItem('acr_translate_lang') || 'Italian';

        // 1. Prepare image for cropping
        const imageBitmap = await createImageBitmap(imageBlob);

        // 2. Crop all balloons and prepare parts for Gemini
        const parts = [];

        // System Prompt
        const systemPrompt = `You are a professional comic book translator.
You will be provided with ${balloons.length} cropped images containing speech balloons or captions.
Your task is to transcribe the text from ${sourceLang} and translate it into ${targetLang}.

CRITICAL TRANSLATION RULES:
1. If a balloon contains ONLY a sound effect / onomatopoeia (e.g. THWAP, BOOM, ARG, BLINK), DO NOT translate it. Return the original text.
2. If a balloon contains ONLY a proper name (e.g. "Abbey"), DO NOT translate it.
3. If a balloon contains ONLY a geographic location or country name (e.g. "COSTA RICA", "NEW YORK"), DO NOT translate it.
4. If a balloon contains unintelligible symbols or noise, leave it as is.
5. In all other cases, provide a natural translation into ${targetLang}.

Output EXACTLY AND ONLY a valid JSON array of objects, in the exact same order as the images provided.
Array length MUST be exactly ${balloons.length}.

Schema for each object in the array:
{
  "original_text": "The transcribed text",
  "translated_text": "The translated text",
  "shape": "OVAL", // Can be OVAL, RECTANGLE, CLOUD, or JAGGED
  "background_color": "#FFFFFF", // Approximate dominant hex background color of the balloon
  "is_uppercase": true // Boolean, true if original comic text is entirely in ALL CAPS
}`;

        parts.push({ text: systemPrompt });

        // Add each cropped image in sequence
        for (let i = 0; i < balloons.length; i++) {
            const b = balloons[i];
            const base64Data = await this.cropBalloonToBase64(imageBitmap, b.box);
            parts.push({ text: `Image ${i + 1}:` });
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Data
                }
            });
        }

        // 3. Build Request Body
        const body = {
            contents: [{ parts }],
            generationConfig: {
                temperature: 0.1, // Near deterministic
                response_mime_type: "application/json" // Force JSON array mode natively
            }
        };

        // 4. Send Request
        const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonString) throw new Error("Empty response from Gemini.");

        // 5. Parse JSON and merge
        try {
            let translations = JSON.parse(jsonString);
            if (!Array.isArray(translations)) {
                // Sometimes Gemini wraps it in an object like { "translations": [...] }
                const maybeArray = Object.values(translations).find(Array.isArray);
                if (maybeArray) {
                    translations = maybeArray;
                } else {
                    throw new Error("Expected JSON array from Gemini.");
                }
            }

            return balloons.map((b, i) => {
                const trans = translations[i] || {};
                return {
                    ...b,
                    text_original: trans.original_text || "",
                    text_translated: trans.translated_text || "",
                    text_preview: trans.original_text || "[No Text]",
                    shape: trans.shape || "OVAL",
                    background_color: trans.background_color || "#FFFFFF",
                    is_uppercase: trans.is_uppercase ?? true
                };
            });
        } catch (e) {
            console.error("Gemini JSON Parse Error:", e, jsonString);
            throw new Error("Failed to parse Gemini response.");
        }
    },

    async cropBalloonToBase64(imageBitmap, box, padding = 8) {
        const [x_norm, y_norm, w_norm, h_norm] = box;
        const imgW = imageBitmap.width;
        const imgH = imageBitmap.height;

        const px = Math.floor(x_norm * imgW);
        const py = Math.floor(y_norm * imgH);
        const pw = Math.ceil(w_norm * imgW);
        const ph = Math.ceil(h_norm * imgH);

        const pwWithPadding = pw + (padding * 2);
        const phWithPadding = ph + (padding * 2);

        const canvas = document.createElement('canvas');
        canvas.width = pwWithPadding;
        canvas.height = phWithPadding;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(
            imageBitmap,
            px, py, pw, ph,
            padding, padding, pw, ph
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        return dataUrl.split(',')[1];
    },

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result
                    .replace('data:', '')
                    .replace(/^.+,/, '');
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
};
