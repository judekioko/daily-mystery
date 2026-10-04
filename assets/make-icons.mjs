// Renders assets/icon.svg to every PNG the web manifest and @capacitor/assets need.
import sharp from "sharp";
import fs from "node:fs";
const svg = fs.readFileSync("assets/icon.svg");
const png = (size, out) => sharp(svg, { density: 300 }).resize(size, size).png().toFile(out);
await png(1024, "assets/icon-only.png");
// Adaptive-icon foreground: transparent, artwork inside the central safe zone (Android crops the edges).
const art = svg.toString().replace(/<rect[^>]*\/>/, "");
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(Buffer.from(art), { density: 300 }).resize(640, 640).png().toBuffer(), gravity: "center" }])
  .png().toFile("assets/icon-foreground.png");
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#0d1117" } }).png().toFile("assets/icon-background.png");
await png(512, "public/icons/icon-512.png");
await png(192, "public/icons/icon-192.png");
await png(180, "public/icons/apple-touch-icon.png");
// Splash: icon centred on the app background.
await sharp({ create: { width: 2732, height: 2732, channels: 3, background: "#0d1117" } })
  .composite([{ input: await sharp(svg, { density: 300 }).resize(900, 900).png().toBuffer(), gravity: "center" }])
  .png().toFile("assets/splash.png");
await fs.promises.copyFile("assets/splash.png", "assets/splash-dark.png");
console.log("icons ok");
