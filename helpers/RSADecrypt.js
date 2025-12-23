import crypto from "crypto";
import { PRIVATE_KEY } from "./RSAKeys.js";

function RSADecrypt(encryptedData) {
    if (!PRIVATE_KEY) {
        console.warn('RSA private key not available, treating as plain text');
        return encryptedData; // Return as-is if no decryption available
    }

    try {
        // If it's not an object with data/key, treat as plain text
        if (typeof encryptedData !== 'object' || !encryptedData.data || !encryptedData.key) {
            return encryptedData;
        }

        const { data, key } = encryptedData;
        
        // ✅ Decrypt AES key with RSA private key
        const aesKey = crypto.privateDecrypt(
            {
                key: PRIVATE_KEY,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            Buffer.from(key, "base64")
        );

        // ✅ AES decryption (ECB)
        const decipher = crypto.createDecipheriv("aes-128-ecb", aesKey, null);
        let decryptedData = decipher.update(data, "base64", "utf8");
        decryptedData += decipher.final("utf8");

        return JSON.parse(decryptedData);
    } catch (error) {
        console.error('Error decrypting data:', error);
        // Fallback to returning the original data
        return encryptedData;
    }
}

export { RSADecrypt };
