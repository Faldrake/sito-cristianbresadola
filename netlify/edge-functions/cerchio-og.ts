// ============================================================
// L'anteprima di un articolo del Cerchio del Druido (2/09/2026)
// ============================================================
// La pagina articolo.html e' una sola e si riempie nel browser leggendo
// articoli_cerchio: chi la condivide su Facebook, LinkedIn o WhatsApp
// riceveva un'anteprima generica, senza titolo ne' foto, perche' quei
// robot leggono l'HTML e non eseguono il JavaScript. Questa funzione gira
// sul bordo di Netlify, PRIMA che la pagina parta: legge l'articolo con la
// chiave pubblicabile (la stessa della pagina, l'anonimo vede solo il
// pubblicato) e riscrive il titolo, la descrizione e i meta Open Graph.
// Se lo slug manca, l'articolo non c'e' o Supabase non risponde in tempo,
// la pagina passa com'e': l'anteprima generica e' meglio di un errore.
import type { Config, Context } from "@netlify/edge-functions";

const SB = "https://okasxfvoyihovohlaypz.supabase.co";
const CHIAVE = "sb_publishable__JK1dgzDVfrFmMETc3z-sA_HjMiueOS";
const SITO = "https://cristianbresadola.com";
const OG_GENERICA = SITO + "/images/cerchio-og.png";

type Articolo = {
  titolo: string; occhiello: string | null; estratto: string | null;
  contenuto: string | null; copertina_url: string | null; pubblicato_at: string | null;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default async (request: Request, context: Context) => {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  const pagina = await context.next();
  if (!/^[a-z0-9][a-z0-9-]{0,118}$/.test(slug)) return pagina;

  let a: Articolo | null = null;
  try {
    const r = await fetch(
      `${SB}/rest/v1/articoli_cerchio?slug=eq.${encodeURIComponent(slug)}`
      + "&select=titolo,occhiello,estratto,contenuto,copertina_url,pubblicato_at&limit=1",
      { headers: { apikey: CHIAVE }, signal: AbortSignal.timeout(4000) },
    );
    if (r.ok) a = ((await r.json()) as Articolo[])[0] ?? null;
  } catch {
    a = null;
  }
  if (!a || !a.titolo) return pagina;

  const titolo = `${a.titolo} · Il Cerchio del Druido · Cristian Bresadola`;
  const descrizione = (a.estratto || (a.contenuto || "").replace(/\s+/g, " ").slice(0, 200) || "Un articolo del Cerchio del Druido, la rubrica di Cristian Bresadola, naturopata in Trentino.").slice(0, 300);
  const immagine = a.copertina_url && a.copertina_url.startsWith(SB + "/storage/v1/object/public/")
    ? a.copertina_url : OG_GENERICA;
  const url = `${SITO}/cerchio-del-druido/articolo.html?slug=${encodeURIComponent(slug)}`;
  const meta = [
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Cristian Bresadola">`,
    `<meta property="og:locale" content="it_IT">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(a.titolo)}">`,
    `<meta property="og:description" content="${esc(descrizione)}">`,
    `<meta property="og:image" content="${esc(immagine)}">`,
    a.pubblicato_at ? `<meta property="article:published_time" content="${esc(a.pubblicato_at)}">` : "",
    a.occhiello ? `<meta property="article:section" content="${esc(a.occhiello)}">` : "",
    `<meta property="article:author" content="Cristian Bresadola">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(a.titolo)}">`,
    `<meta name="twitter:description" content="${esc(descrizione)}">`,
    `<meta name="twitter:image" content="${esc(immagine)}">`,
  ].filter(Boolean).join("\n");

  return new HTMLRewriter()
    .on("title", { element(e) { e.setInnerContent(titolo); } })
    .on('meta[name="description"]', { element(e) { e.setAttribute("content", descrizione); } })
    .on("head", { element(e) { e.append(meta, { html: true }); } })
    .transform(pagina);
};

export const config: Config = {
  path: ["/cerchio-del-druido/articolo.html", "/cerchio-del-druido/articolo"],
};
