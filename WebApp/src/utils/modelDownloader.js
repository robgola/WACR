import { pipeline, env } from '@huggingface/transformers';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Transformers.js to download models to our public folder 
// so the WebApp can serve them statically later.
env.allowLocalModels = false; // Force download from HF
env.localModelPath = path.join(__dirname, '../../public/models');
env.cacheDir = path.join(__dirname, '../../public/models');

async function downloadModel() {
    console.log("-----------------------------------------");
    console.log("Hugging Face Model Offline Downloader");
    console.log("Target Directory:", env.localModelPath);
    console.log("-----------------------------------------");

    const modelName = 'Xenova/trocr-small-printed';
    console.log(`\n⏳ Downloading Model: ${modelName} ...`);
    console.log("This may take a few minutes depending on your connection.");

    try {
        // By instantiating the pipeline, Transformers.js will automatically
        // download all necessary config.json, tokenizer.json, and .onnx weights
        // into the cacheDir we specified above.
        const extractor = await pipeline('image-to-text', modelName, {
            dtype: 'q8', // Explicitly request 8-bit Quantized weights in Transformers.js v3
            progress_callback: (info) => {
                if (info.status === 'downloading') {
                    // Note: keeping logs minimal so it doesn't flood the console
                    process.stdout.write(`.`);
                } else if (info.status === 'done') {
                    console.log(`\n✅ Downloaded: ${info.file}`);
                }
            }
        });

        console.log("\n🎉 Model downloaded and cached successfully!");
        console.log(`Check the 'public/models/${modelName}' directory.`);

    } catch (error) {
        console.error("\n❌ Failed to download model:", error);
    }
}

downloadModel();
