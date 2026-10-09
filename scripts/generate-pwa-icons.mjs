/**
 * Generates PWA PNG icons (192, 512, maskable 512) that rasterize the
 * approved SVG artwork in public/icons/icon.svg:
 *   - brand rounded square (#2563eb, rx 28/128)
 *   - white envelope (flap diamond + body polygon)
 *
 * Zero dependencies (node:zlib only). Run: node scripts/generate-pwa-icons.mjs
 * Output: public/icons/icon-192.png, icon-512.png, icon-512-maskable.png
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/* ---------- PNG encoding ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- geometry (from icon.svg) ---------- */
const BRAND = [0x25, 0x63, 0xeb, 255];
const WHITE = [255, 255, 255, 255];

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function render(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const s = size / 128;
  const radius = maskable ? 0 : 28 * s;
  const r2 = radius * radius;

  // Envelope polygons in 128-space (flap diamond + body approximation)
  const tx = 24, ty = 28;
  const diamond = [[40, 0], [0, 20], [40, 40], [80, 20]].map(([x, y]) => [tx + x, ty + y]);
  const body = [[8, 26], [8, 40], [40, 54], [72, 40], [72, 26], [40, 42]].map(([x, y]) => [tx + x, ty + y]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-rect mask
      let insideShape = true;
      if (radius > 0) {
        const cx = Math.min(Math.max(x + 0.5, radius), size - radius);
        const cy = Math.min(Math.max(y + 0.5, radius), size - radius);
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        insideShape = dx * dx + dy * dy <= r2;
      }
      if (!insideShape) {
        rgba[i + 3] = 0;
        continue;
      }
      const sx = (x + 0.5) / s;
      const sy = (y + 0.5) / s;
      const white = pointInPoly(sx, sy, diamond) || pointInPoly(sx, sy, body);
      const [r, g, b, a] = white ? WHITE : BRAND;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "icon-192.png"), render(192, { maskable: false }));
writeFileSync(join(OUT_DIR, "icon-512.png"), render(512, { maskable: false }));
writeFileSync(join(OUT_DIR, "icon-512-maskable.png"), render(512, { maskable: true }));
console.log("icons written:", OUT_DIR);
