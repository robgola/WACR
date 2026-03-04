import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target Model
const HF_REPO = "mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
const MODEL_ID = HF_REPO.split('/')[1]; // Extract model ID from HF_REPO
const WASM_URL = "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Qwen2-1.5B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm";

const outDir = path.resolve(__dirname, '../../public/models/webllm', MODEL_ID);
const wasmDir = path.join(__dirname, '../../public/models/webllm/wasm');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(wasmDir, { recursive: true });

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            const stats = fs.statSync(dest);
            if (stats.size > 0) {
                console.log(`[SKIP] Valid file exists: ${path.basename(dest)}`);
                resolve();
                return;
            } else {
                console.log(`[RETRY] Found corrupt/0-byte file, redownloading: ${path.basename(dest)}`);
                fs.unlinkSync(dest);
            }
        }
        console.log(`[DOWNLOADING] ${url} -> ${dest}`);
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if ([301, 302, 307, 308].includes(response.statusCode)) {
                // follow redirect (safely handle relative URLs)
                const redirectUrl = new URL(response.headers.location, url).href;
                downloadFile(redirectUrl, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

const getRepoFiles = () => {
    return new Promise((resolve, reject) => {
        const url = `https://huggingface.co/api/models/mlc-ai/${MODEL_ID}/tree/main`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const tree = JSON.parse(data);
                    const files = tree.filter(t => t.type === 'file').map(t => t.path);
                    resolve(files);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

async function run() {
    console.log(`Fetching file list for mlc-ai/${MODEL_ID}...`);
    const files = await getRepoFiles();
    console.log(`Found ${files.length} files. Starting download...`);

    // 1. Download Model Weights
    for (const file of files) {
        // Skip gitattributes or huge files if we want, but WebLLM needs all of them
        if (file.includes('.git')) continue;

        const fileUrl = `https://huggingface.co/mlc-ai/${MODEL_ID}/resolve/main/${file}`;
        const targetPath = path.join(outDir, file);

        // ensure target subdir exists if needed
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        await downloadFile(fileUrl, targetPath);
    }

    // 2. Download exact matching WASM from github
    console.log(`Downloading WASM Engine...`);
    const wasmName = path.basename(WASM_URL);
    await downloadFile(WASM_URL, path.join(wasmDir, wasmName));

    console.log("Download Complete! The model is now available offline in public/models/webllm");
}

run().catch(console.error);
