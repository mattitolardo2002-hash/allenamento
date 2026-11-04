import type { Scheda, Sessione } from '../dati/tipi';
import { dataBreve, dataLocale } from './formato';
import { numeroGiorno } from './peso';

/**
 * La scheda che segue l'ultima fatta, nell'ordine dell'elenco (a rotazione).
 * Se un giorno ne scegli un'altra, la rotazione riparte da quella.
 */
export function prossimaScheda(schede: Scheda[], sessioni: Sessione[]): Scheda | undefined {
  const ultima = ultimaFatta(schede, sessioni);
  if (!ultima) return schede[0];
  const i = schede.findIndex((x) => x.id === ultima.schedaId);
  return schede[(i + 1) % schede.length];
}

/** L'ultimo allenamento fatto con una delle schede attuali. */
export function ultimaFatta(schede: Scheda[], sessioni: Sessione[]): Sessione | undefined {
  return [...sessioni]
    .sort((a, b) => b.fine.localeCompare(a.fine))
    .find((s) => schede.some((x) => x.id === s.schedaId));
}

/** L'ultima volta che è stata fatta una certa scheda. */
export function ultimaDellaScheda(schedaId: string, sessioni: Sessione[]): Sessione | undefined {
  return sessioni.filter((s) => s.schedaId === schedaId).sort((a, b) => b.fine.localeCompare(a.fine))[0];
}

/** Durata tipica (media delle ultime 5 volte, in minuti) di una scheda; null se mai fatta. */
export function durataTipica(schedaId: string, sessioni: Sessione[]): number | null {
  const ultime = sessioni
    .filter((s) => s.schedaId === schedaId && s.durataMin > 0)
    .sort((a, b) => b.fine.localeCompare(a.fine))
    .slice(0, 5);
  if (!ultime.length) return null;
  return Math.round(ultime.reduce((t, s) => t + s.durataMin, 0) / ultime.length / 5) * 5;
}

/** "oggi", "ieri", "6 giorni fa" oppure, oltre le due settimane, "3 ott". */
export function quandoFa(data: string): string {
  const giorni = numeroGiorno(dataLocale()) - numeroGiorno(data);
  if (giorni <= 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  if (giorni < 15) return `${giorni} giorni fa`;
  return `il ${dataBreve(data)}`;
}
