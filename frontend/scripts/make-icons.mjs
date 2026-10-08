// Rasterise the Sea Dragon mark into the PNG icons used by the web manifest and iOS.
// Uses the Playwright Chromium that is already installed for the e2e tests (no extra deps).
//   npm run icons
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = await readFile(resolve(root, "public/brand/sea-dragon-mark.svg"), "utf8");
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const outDir = resolve(root, "public/icons");
await mkdir(outDir, { recursive: true });

// [file, size, background, mark size as a share of the canvas]
const targets = [
  ["icon-192.png", 192, null, 1],
  ["icon-512.png", 512, null, 1],
  ["maskable-512.png", 512, "#3245b7", 0.72], // keep the mark inside the maskable safe zone
  ["apple-touch-icon.png", 180, "#ffffff", 0.86], // iOS does not support transparency
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, size, bg, share] of targets) {
  const mark = Math.round(size * share);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg ?? "transparent"}">
    <img src="${dataUrl}" width="${mark}" height="${mark}" alt="" /></body></html>`);
  await page.waitForFunction(() => document.images[0]?.complete);
  await page.screenshot({ path: resolve(outDir, file), omitBackground: bg === null });
  console.log(`wrote public/icons/${file}`);
}
await browser.close();
