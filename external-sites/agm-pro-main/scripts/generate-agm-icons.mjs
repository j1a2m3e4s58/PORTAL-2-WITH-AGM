import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svgPath = resolve(
  root,
  "src/frontend/public/assets/generated/agm-app-icon.svg",
);
const outDir = resolve(root, "src/frontend/public/assets/generated");

await mkdir(outDir, { recursive: true });

await sharp(svgPath).resize(192, 192).png().toFile(
  resolve(outDir, "icon-192-v3.dim_192x192.png"),
);

await sharp(svgPath).resize(512, 512).png().toFile(
  resolve(outDir, "icon-512-v3.dim_512x512.png"),
);

await sharp(svgPath).resize(180, 180).png().toFile(
  resolve(outDir, "apple-touch-icon-v3.png"),
);
