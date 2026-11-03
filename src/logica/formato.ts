// Numeri e date in formato italiano.

/**
 * Legge un numero scritto dall'utente: accetta sia "82,5" sia "82.5".
 * Restituisce null se il testo non è un numero valido.
 */
export function leggiNumero(testo: string): number | null {
  const pulito = testo.trim().replace(',', '.');
  if (pulito === '' || !/^\d*\.?\d*$/.test(pulito) || pulito === '.') return null;
  return Number(pulito);
}

// Separatore delle migliaia sempre presente ("1.250"): di default l'italiano
// lo omette sotto 10.000. Il tipo è allargato perché 'always' è recente.
const formatoNumero = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 2,
  useGrouping: 'always' as unknown as boolean,
});

/** 82.5 → "82,5"; 1250 → "1.250". */
export function numero(n: number): string {
  return formatoNumero.format(n);
}

/** Data locale in formato AAAA-MM-GG (non UTC: alle 23:30 è ancora oggi). */
export function dataLocale(d: Date = new Date()): string {
  const due = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

/** "2026-11-03" → "3 nov". */
export function dataBreve(data: string): string {
  const [a, m, g] = data.split('-').map(Number);
  return new Date(a, m - 1, g).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** "2026-11-03" → "lun 3 nov". */
export function dataConGiorno(data: string): string {
  const [a, m, g] = data.split('-').map(Number);
  return new Date(a, m - 1, g).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "2026-11-03" → "lunedì 3 novembre 2026". */
export function dataLunga(data: string): string {
  const [a, m, g] = data.split('-').map(Number);
  return new Date(a, m - 1, g).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Orario "18:05" da una data ISO. */
export function orario(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** Secondi →"42:05" oppure "1:02:05". */
export function durata(secondi: number): string {
  const s = Math.max(0, Math.floor(secondi));
  const due = (n: number) => String(n).padStart(2, '0');
  const ore = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  return ore > 0 ? `${ore}:${due(min)}:${due(s % 60)}` : `${min}:${due(s % 60)}`;
}

/**
 * Legge una durata scritta a mano: "45" (minuti), "45:30" (min:sec)
 * oppure "1:05:00" (ore:min:sec). Restituisce i secondi, o null se non valida.
 */
export function leggiTempo(testo: string): number | null {
  const parti = testo.trim().replace(/[.,]/g, ':').split(':');
  if (parti[0] === '' || parti.length > 3 || !parti.every((p) => /^\d+$/.test(p))) return null;
  const n = parti.map(Number);
  if (n.slice(1).some((x) => x > 59)) return null;
  if (n.length === 1) return n[0] * 60;
  if (n.length === 2) return n[0] * 60 + n[1];
  return n[0] * 3600 + n[1] * 60 + n[2];
}

/** Passo "5:30" (min:sec per km) → 330 secondi. Accetta anche "5.30" o "5,30". */
export function leggiPasso(testo: string): number | null {
  const m = testo.trim().match(/^(\d{1,2})[:.,'](\d{1,2})$/);
  if (!m || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 330 → "5:30". */
export function passo(secondiKm: number): string {
  const s = Math.round(secondiKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
