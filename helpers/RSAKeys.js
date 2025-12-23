import fs from "fs";

let PUBLIC_KEY, PRIVATE_KEY;

try {
  PUBLIC_KEY = fs.readFileSync("./public.pem", "utf8");
  PRIVATE_KEY = fs.readFileSync("./private.pem", "utf8");
} catch (error) {
  console.warn('RSA keys not found. Email password encryption will not work until keys are generated.');
  console.warn('Run: openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem');
  PUBLIC_KEY = null;
  PRIVATE_KEY = null;
}

export { PUBLIC_KEY, PRIVATE_KEY }