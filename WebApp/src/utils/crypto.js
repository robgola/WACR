// Simple obfuscation to prevent plain-text storage
// Not military-grade encryption, but prevents casual snooping.

const SALT = "KomgaAntigravitySalt_v1";

export const encrypt = (text) => {
    if (!text) return "";
    try {
        // XOR with Salt + Base64
        let result = "";
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length));
        }
        return btoa(result);
    } catch (e) {
        console.error("Encryption failed", e);
        return "";
    }
};

export const decrypt = (text) => {
    if (!text) return "";
    try {
        const decoded = atob(text);
        let result = "";
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length));
        }
        return result;
    } catch (e) {
        console.error("Decryption failed", e);
        return "";
    }
};
