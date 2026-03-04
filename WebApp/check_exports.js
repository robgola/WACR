
import * as transformers from '@huggingface/transformers';

console.log("Keys in transformers export:", Object.keys(transformers));

if (transformers.Florence2ForConditionalGeneration) {
    console.log("Florence2ForConditionalGeneration is available!");
} else {
    console.log("Florence2ForConditionalGeneration is NOT available.");
}
