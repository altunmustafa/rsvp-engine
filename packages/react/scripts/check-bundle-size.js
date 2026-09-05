import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const bundle = readFileSync(new URL("../dist/index.js", import.meta.url));
const bytes = gzipSync(bundle).byteLength;

console.log(`Gzipped ESM bundle: ${bytes} bytes (measurement only).`);
