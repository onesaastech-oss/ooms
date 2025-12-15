import CryptoJS from "crypto-js";

const Decrypt = (data, key) => {
    const bytes = CryptoJS.AES.decrypt(data, key);
    const decrypt = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

    return decrypt;
}



export { Decrypt };