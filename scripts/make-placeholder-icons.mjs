/**
 * 아이콘 플레이스홀더 생성기.
 * Figma 디자인 전 임시 아이콘. 16/48/128 단색 PNG.
 *
 * 실행: node scripts/make-placeholder-icons.mjs
 * 접근: Node 내장 zlib + 수동 PNG chunk 작성 (외부 의존성 없음).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';

const sizes = [16, 48, 128];
const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i;
    for (let j = 0; j < 8; j++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[i] = v >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makePng(size, rgb) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      row[1 + x * 3 + 0] = rgb[0];
      row[1 + x * 3 + 1] = rgb[1];
      row[1 + x * 3 + 2] = rgb[2];
    }
    rows.push(row);
  }
  const idatRaw = Buffer.concat(rows);
  const idat = zlib.deflateSync(idatRaw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CreatorRadar용 색상: 에메랄드 그린 (#10B981) — X Reply Booster의 블루와 구분.
const rgb = [16, 185, 129];
for (const s of sizes) {
  const p = new URL(`./${s}.png`, outDir);
  writeFileSync(p, makePng(s, rgb));
  console.log('wrote', p.pathname, '(', s, 'px )');
}
