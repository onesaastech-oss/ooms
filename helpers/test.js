import { Encrypt } from "./Encrypt.js";
import { Decrypt } from "./Decrypt.js";

import { generateKeyPairSync } from "crypto";
import fs from "fs";

const TestMe = () => {


    const plain = "This is SOURAV";
    console.log(`Plain text is ${plain}`);
    const encrypted = Encrypt(plain);

    console.log(`Encrypted data is ${encrypted.data}`);
    console.log(`Encrypted key is ${encrypted.key}`);

    const decrypted = Decrypt(encrypted.data, encrypted.key);
    console.log(`Decrypted ${decrypted}`);

    console.log("dd");

}

export { TestMe }