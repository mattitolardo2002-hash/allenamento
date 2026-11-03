import type { Pesata } from '../dati/tipi';

/** Numero del giorno (giorni dal 1970) di una data AAAA-MM-GG: comodo per le differenze. */
export function numeroGiorno(data: string): number {
  const [a, m, g] = data.split('-').map(Number);
  return Math.round(Date.UTC(a, m - 1, g) / 86_400_000);
}

export interface PuntoMedia {
  data: string;
  media: number;
}

/**
 * Media mobile a 7 giorni: per ogni giorno con una pesata, la media delle
 * pesate di quel giorno e dei 6 precedenti (i giorni senza pesata non contano).
 * Le pesate devono essere ordinate per data crescente.
 */
export function mediaMobile(pesate: Pesata[]): PuntoMedia[] {
  return pesate.map((p, i) => {
    const giorno = numeroGiorno(p.data);
    let somma = 0;
    let quante = 0;
    for (let j = i; j >= 0 && giorno - numeroGiorno(pesate[j].data) < 7; j--) {
      somma += pesate[j].kg;
      quante++;
    }
    return { data: p.data, media: somma / quante };
  });
}

/**
 * Statistiche in alto nella sezione Peso:
 * ultima pesata, media degli ultimi 7 giorni e variazione rispetto
 * alla media di una settimana prima.
 */
export function statistichePeso(pesate: Pesata[]) {
  if (!pesate.length) return null;
  const medie = mediaMobile(pesate);
  const ultima = pesate[pesate.length - 1];
  const mediaAttuale = medie[medie.length - 1].media;
  // La media di riferimento è l'ultima calcolata ad almeno 7 giorni prima,
  // purché non più vecchia di 2 settimane (altrimenti il confronto non ha senso).
  const limite = numeroGiorno(ultima.data) - 7;
  const precedente = [...medie]
    .reverse()
    .find((m) => numeroGiorno(m.data) <= limite && numeroGiorno(m.data) > limite - 7);
  return {
    ultima,
    media: mediaAttuale,
    variazione: precedente ? mediaAttuale - precedente.media : null,
  };
}
