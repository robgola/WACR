
import { pipeline, env, AutoModel } from '@huggingface/transformers';

console.log("Testing Transformers version...");
// There isn't a direct version property exposed usually, but we can check model registry?
// console.log(AutoModel.config.architectures); // Not exposed like this.

async function test() {
    try {
        console.log("Attempting to load Florence-2 pipeline...");
        // Use CPU for node test to avoid webgpu requirement issues in headless
        const pipe = await pipeline('image-to-text', 'onnx-community/Florence-2-base-ft', {
            device: 'cpu',
            dtype: 'fp32'
        });
        console.log("SUCCESS: Pipeline loaded!");
    } catch (e) {
        console.error("FAILURE:", e.message);
        if (e.message.includes("Unsupported model type")) {
            console.log("CONFIRMED: This version does not support florence2.");
        }
    }
}

test();
