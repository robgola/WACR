import { prebuiltAppConfig } from '@mlc-ai/web-llm';

const modelRecord = prebuiltAppConfig.model_list.find(m => m.model_id === 'Llama-3.2-1B-Instruct-q4f16_1-MLC');
console.log(JSON.stringify(modelRecord, null, 2));
