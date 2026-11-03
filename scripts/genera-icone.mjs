// Genera le icone PNG dell'app (bilanciere chiaro su fondo scuro) senza
// librerie esterne. Si lancia con: npm run icone
// Le icone finiscono in public/ e vengono copiate così come sono nella build.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const SFONDO = [0x0d, 0x0f, 0x12];
const SEGNO = [0xd6, 0xdd, 0xe6];

// Rettangoli del bilanciere su una griglia 100×100: [x1, y1, x2, y2].
const FORME = [
  [18, 48, 82, 52], // barra
  [28, 30, 34, 70], // disco grande sinistro
  [21, 37, 26, 63], // disco piccolo sinistro
  [66, 30, 72, 70], // disco grande destro
  [74, 37, 79, 63], // disco piccolo destro
];

// Copertura di un pixel: campioniamo 4×4 punti per avere bordi puliti.
function copertura(px, py, lato) {
  let dentro = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = ((px + (i + 0.5) / 4) / lato) * 100;
      const y = ((py + (j + 0.5) / 4) / lato) * 100;
      if (FORME.some(([x1, y1, x2, y2]) => x >= x1 && x < x2 && y >= y1 && y < y2)) dentro++;
    }
  }
  return dentro / 16;
}

// Tabella CRC32 richiesta dal formato PNG.
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function blocco(tipo, dati) {
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(dati.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dati]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([lunghezza, corpo, crc]);
}

function png(lato) {
  // Ogni riga inizia con il byte di filtro 0, poi i pixel RGB.
  const righe = Buffer.alloc(lato * (lato * 3 + 1));
  for (let y = 0; y < lato; y++) {
    const inizio = y * (lato * 3 + 1);
    for (let x = 0; x < lato; x++) {
      const a = copertura(x, y, lato);
      for (let c = 0; c < 3; c++) {
        righe[inizio + 1 + x * 3 + c] = Math.round(SFONDO[c] * (1 - a) + SEGNO[c] * a);
      }
    }
  }
  const intestazione = Buffer.alloc(13);
  intestazione.writeUInt32BE(lato, 0);
  intestazione.writeUInt32BE(lato, 4);
  intestazione[8] = 8; // 8 bit per canale
  intestazione[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco('IHDR', intestazione),
    blocco('IDAT', deflateSync(righe)),
    blocco('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/apple-touch-icon.png', png(180));
writeFileSync('public/icona-192.png', png(192));
writeFileSync('public/icona-512.png', png(512));

// Favicon vettoriale per il browser del Mac, con gli stessi rettangoli.
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const rettangoli = FORME.map(
  ([x1, y1, x2, y2]) => `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}"/>`,
).join('');
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${hex(SFONDO)}"/><g fill="${hex(SEGNO)}">${rettangoli}</g></svg>\n`,
);
console.log('Icone generate in public/');
