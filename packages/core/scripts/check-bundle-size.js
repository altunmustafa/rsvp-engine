import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const bundle = readFileSync(new URL("../dist/index.js", import.meta.url));
const bytes = gzipSync(bundle).byteLength;
const budget = 5 * 1024;

if (bytes >= budget) {
  throw new Error(`Gzipped ESM bundle is ${bytes} bytes; budget is strictly below ${budget}.`);
}

console.log(`Gzipped ESM bundle: ${bytes} bytes (< ${budget}).`);
