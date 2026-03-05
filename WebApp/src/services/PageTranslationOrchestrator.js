import { detectionModule } from '../modules/detection';
import { ocrModule } from '../modules/ocr';
import { translateModule } from '../modules/translate';
import { geminiService } from './GeminiService';
import { acrStorage } from './acrStorage';

/**
 * PageTranslationOrchestrator
 * Centralized service to manage translation jobs with priority and concurrency control.
 */
class PageTranslationOrchestrator {
    constructor() {
        this.activeJob = null; // { bookId, pageIndex, controller, promise, priority }
        this.queue = []; // Array of pending jobs
        this.maxConcurrent = 1; // Strictly 1 AI job at a time to prevent OOM
    }

    /**
     * Entry point to translate a page.
     * @param {string} bookId 
     * @param {number} pageIndex 
     * @param {Blob} pageBlob 
     * @param {object} options - { priority: 'HIGH'|'LOW', force: boolean }
     */
    async translatePage(bookId, pageIndex, pageBlob, options = {}) {
        const { priority = 'HIGH', force = false } = options;
        const jobId = `${bookId}:${pageIndex}`;

        console.log(`[Orchestrator] Request: ${jobId} (Priority: ${priority})`);

        // 1. Check Cache First (if not forced)
        if (!force) {
            const cached = await acrStorage.getPageTranslation(bookId, pageIndex);
            if (cached && cached.balloons) {
                console.log(`[Orchestrator] Cache Hit: ${jobId}`);
                return cached.balloons;
            }
        }

        // 2. Manage Concurrency & Priority
        if (this.activeJob) {
            // If we are already working on THIS exact page, just return the existing promise
            if (this.activeJob.id === jobId) {
                return this.activeJob.promise;
            }

            // If a HIGH priority job comes in and we are prefetching (LOW), abort the prefetch
            if (priority === 'HIGH' && this.activeJob.priority === 'LOW') {
                console.log(`[Orchestrator] Aborting LOW priority job ${this.activeJob.id} for HIGH priority ${jobId}`);
                this.activeJob.controller.abort();
            } else if (priority === 'HIGH') {
                // Another HIGH priority job? Replace the active one if it's different
                console.log(`[Orchestrator] Aborting previous HIGH priority job ${this.activeJob.id} for NEW HIGH priority ${jobId}`);
                this.activeJob.controller.abort();
            } else {
                // Incoming job is LOW priority and we are busy? Just skip it or queue it.
                // For prefetch, we usually only care about the NEXT page, so we don't need a deep queue.
                console.log(`[Orchestrator] Busy with ${this.activeJob.id}. Skipping LOW priority prefetch ${jobId}`);
                return null;
            }
        }

        // 3. Create New Job
        const controller = new AbortController();
        const promise = this._runPipeline(bookId, pageIndex, pageBlob, controller.signal);

        this.activeJob = {
            id: jobId,
            bookId,
            pageIndex,
            priority,
            controller,
            promise
        };

        try {
            const result = await promise;
            return result;
        } finally {
            if (this.activeJob?.id === jobId) {
                this.activeJob = null;
            }
        }
    }

    /**
     * Internal pipeline execution
     */
    async _runPipeline(bookId, pageIndex, pageBlob, signal) {
        const pipeline = localStorage.getItem('acr_ai_pipeline') || 'local';
        let balloons = [];

        try {
            if (signal.aborted) throw new Error("Aborted");

            if (pipeline === 'local') {
                // LOCAL PATH
                const detectionResult = await detectionModule.detectBalloons(pageBlob);
                if (signal.aborted) throw new Error("Aborted");

                balloons = detectionResult.balloons;
                if (balloons.length === 0) return [];

                // OCR
                balloons = await ocrModule.extractText(pageBlob, balloons);
                if (signal.aborted) throw new Error("Aborted");

                // Translate
                await translateModule.init();
                balloons = await translateModule.translateBalloons(balloons);
                await translateModule.destroy();
            } else {
                // CLOUD HYBRID PATH
                const detectionResult = await detectionModule.detectBalloons(pageBlob);
                if (signal.aborted) throw new Error("Aborted");

                balloons = detectionResult.balloons;
                if (balloons.length === 0) return [];

                // Gemini
                balloons = await geminiService.translateBalloons(pageBlob, balloons);
            }

            if (signal.aborted) throw new Error("Aborted");

            // 4. Save to ACR Storage
            await acrStorage.setPageTranslation(bookId, pageIndex, {
                status: "translated",
                source: pipeline === 'local' ? "offline_v1" : "hybrid_v1",
                balloons: balloons,
                timestamp: new Date().toISOString()
            });

            console.log(`[Orchestrator] Completed: ${bookId}:${pageIndex}`);
            return balloons;

        } catch (err) {
            if (err.message === "Aborted") {
                console.log(`[Orchestrator] Job ${bookId}:${pageIndex} Aborted.`);
            } else {
                console.error(`[Orchestrator] Pipeline Error for ${bookId}:${pageIndex}:`, err);
            }
            throw err;
        }
    }

    /**
     * Cancel all active and pending jobs.
     */
    cancelAll() {
        if (this.activeJob) {
            this.activeJob.controller.abort();
            this.activeJob = null;
        }
    }
}

export const pageTranslationOrchestrator = new PageTranslationOrchestrator();
