// ============================================================
// La sitemap del Cerchio del Druido (13/09/2026)
// ============================================================
// Gli articoli si pubblicano da Arkana in qualsiasi momento, ma entravano
// in sitemap.xml solo se qualcuno, dopo, lanciava strumenti/aggiorna-sitemap.py
// sul proprio computer e rifaceva il deploy. E' il passaggio a mano che salta:
// il primo articolo e' uscito il 2/09 e il blocco del Cerchio e' rimasto vuoto
// fino al 13/09, quando gli articoli fuori erano ormai tre. Anche il lastmod
// della vetrina restava fermo quando ne usciva uno nuovo.
//
// Questa funzione scrive la sitemap a ogni richiesta, leggendo il database
// con la chiave pubblicabile (la stessa delle pagine: l'anonimo vede solo il
// pubblicato). Dentro: la vetrina, col lastmod dell'articolo toccato per
// ultimo o del suo file, se e' piu' recente (vedi VETRINA_FILE), e ogni
// articolo, con l'indirizzo nella stessa forma del canonical
// che scrive cerchio-og.ts e il lastmod preso da updated_at. robots.txt la
// dichiara accanto a sitemap.xml.
//
// SE SUPABASE NON RISPONDE, 503 con Retry-After, e MAI un elenco vuoto: una
// sitemap vuota direbbe a Google che gli articoli non ci sono piu', un 503
// dice solo di ripassare.
import type { Config } from "@netlify/edge-functions";

const SB = "https://okasxfvoyihovohlaypz.supabase.co";
const CHIAVE = "sb_publishable__JK1dgzDVfrFmMETc3z-sA_HjMiueOS";
const SITO = "https://cristianbresadola.com";
// Lo stesso controllo di cerchio-og.ts: uno slug che la pagina rimanderebbe
// alla vetrina non si elenca.
const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]{0,118}$/;

// L'ULTIMA MODIFICA DEL FILE DELLA VETRINA, cerchio-del-druido/index.html
// (revisione di A8, 13/09/2026). La vetrina non cambia solo quando esce un
// articolo: cambiano anche la sua descrizione, le schede statiche, le
// categorie, e quello lo sa solo git. Questa data la riscrive
// strumenti/aggiorna-sitemap.py dall'ultimo commit del file, come fa per le
// pagine di sitemap.xml e con la stessa regola: mai all'indietro. Non va
// toccata a mano; la riga deve restare in questa forma, perche' lo script la
// cerca cosi'.
const VETRINA_FILE = "2026-09-13";

type Voce = { slug: string | null; pubblicato_at: string | null; updated_at: string | null };

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Il lastmod in una forma che la sitemap accetta sempre (ISO, in UTC). Se il
// database non ha una data leggibile, la voce esce senza lastmod: meglio
// nessuna data che una inventata.
function quando(v: Voce): string {
  const d = new Date(v.updated_at || v.pubblicato_at || "");
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

// La piu' recente fra due date, confrontate come date e non come testo: una
// e' un giorno (AAAA-MM-GG), l'altra un istante. Quella illeggibile non conta.
function piuRecente(a: string, b: string): string {
  const ta = new Date(a).getTime(), tb = new Date(b).getTime();
  if (isNaN(ta)) return isNaN(tb) ? "" : b;
  if (isNaN(tb)) return a;
  return tb > ta ? b : a;
}

function nonAdesso(perche: string): Response {
  return new Response("La sitemap del Cerchio del Druido non e' disponibile in questo momento: il database non risponde.\n", {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "retry-after": "600",
      "cache-control": "no-store",
      "x-cerchio-sitemap": perche.replace(/[^\x20-\x7e]/g, "?").slice(0, 80),
    },
  });
}

function url(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return [
    "  <url>",
    `    <loc>${xml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n");
}

export default async (): Promise<Response> => {
  let righe: Voce[];
  try {
    const r = await fetch(`${SB}/rest/v1/articoli_cerchio`
      + "?select=slug,pubblicato_at,updated_at&order=pubblicato_at.desc&limit=1000", {
      headers: { apikey: CHIAVE }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return nonAdesso("http-" + r.status);
    const dati: unknown = await r.json();
    if (!Array.isArray(dati)) return nonAdesso("risposta-inattesa");
    righe = dati as Voce[];
  } catch (e) {
    return nonAdesso("errore:" + String((e as Error)?.message || e));
  }

  const articoli = righe.filter((v) => typeof v.slug === "string" && SLUG_VALIDO.test(v.slug));
  // La vetrina cambia quando esce o si corregge un articolo, e quando si
  // tocca il suo file: il suo lastmod e' il piu' recente fra l'articolo
  // toccato per ultimo e VETRINA_FILE. Contando solo gli articoli, il 13/09
  // tornava all'11/09, due giorni indietro rispetto a sitemap.xml, e nessuna
  // modifica alla vetrina l'avrebbe piu' spostato. Fra gli articoli le date
  // ISO in UTC si ordinano come testo.
  const ultimoArticolo = articoli.map(quando).filter(Boolean).sort().pop() || "";
  const ultima = piuRecente(ultimoArticolo, VETRINA_FILE);
  const voci = [
    url(SITO + "/cerchio-del-druido/", ultima, "weekly", "0.9"),
    ...articoli.map((v) => url(
      `${SITO}/cerchio-del-druido/articolo.html?slug=${encodeURIComponent(v.slug as string)}`,
      quando(v), "monthly", "0.6",
    )),
  ];
  const corpo = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + voci.join("\n") + "\n</urlset>\n";
  return new Response(corpo, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "x-cerchio-sitemap": String(articoli.length),
    },
  });
};

export const config: Config = {
  path: "/sitemap-cerchio.xml",
};
