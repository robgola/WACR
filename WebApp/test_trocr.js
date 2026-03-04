import { pipeline, env } from '@huggingface/transformers';

async function main() {
    console.log("Loading TrOCR pipeline...");
    const pipe = await pipeline('image-to-text', 'Xenova/trocr-small-printed', {
        device: 'cpu', // Just testing CPU in node
        dtype: 'fp32',
    });
    console.log("Model loaded. Testing OCR...");
    // We would need an image here. Let's just confirm it loads.
    console.log("Ready!");
}
main().catch(console.error);
