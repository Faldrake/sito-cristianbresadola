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
//
// L'ARTICOLO INTERO NELL'HTML (13/09/2026, voce A8 del piano SEO). Fin qui
// la funzione riscriveva solo la testa. A chi non esegue il JavaScript - i
// robot degli assistenti come ChatGPT, Perplexity e Claude, e Google finche'
// la pagina aspetta il suo turno di rendering - arrivava una cornice di 167
// parole, con l'h1 vuoto, nessun canonical e nessun dato strutturato. Adesso
// nell'HTML servito ci sono anche il titolo, la data, la copertina e i
// paragrafi, tutti passati da esc() e con le regole della pagina (riga vuota
// = paragrafo, «## » = sottotitolo), piu' il canonical e il BlogPosting. Lo
// script della pagina poi ridisegna le stesse cose sopra, senza raddoppiarle,
// e aggiunge la galleria (qui non si legge «immagini») e i tasti per
// condividere. Con il testo gia' nella pagina, l'articolo non si apre piu'
// in ritardo spingendo giu' tutto quello che gli sta sotto.
//
// GLI STATI DELLA RISPOSTA dicono solo quello che si sa:
// - slug assente o malformato: 301 verso la vetrina;
// - Supabase risponde e l'articolo non c'e' (zero righe): 404;
// - Supabase risponde con un errore, non risponde o va oltre i 4 secondi:
//   la pagina passa com'e', 200 e senza noindex. Un guasto di un minuto non
//   deve togliere dall'indice un articolo che esiste; ci riprova il browser.
//
// LA VETRINA (stessa data). Anche /cerchio-del-druido/, con o senza ?cat=,
// elencava gli articoli solo via JavaScript: nell'HTML grezzo non c'era
// nessun link verso di loro. Qui le schede si scrivono nel contenitore
// #cerchio-dal-database, che lo script della vetrina poi SOSTITUISCE.
//
// I PEZZI SI CERCANO PER ID, e mai su un <a>: il post-processing dei pretty
// URL di Netlify riscrive i link che finiscono in .html (attributi in ordine
// alfabetico, apici singoli) PRIMA che la pagina arrivi qui. MISURATO il
// 13/09/2026 confrontando l'HTML servito col file del repo: div, article,
// h1, span, img e aside arrivano identici, i link no.
import type { Config, Context } from "@netlify/edge-functions";

const SB = "https://okasxfvoyihovohlaypz.supabase.co";
const CHIAVE = "sb_publishable__JK1dgzDVfrFmMETc3z-sA_HjMiueOS";
const SITO = "https://cristianbresadola.com";
const OG_GENERICA = SITO + "/images/cerchio-og.png";
const VETRINA = "/cerchio-del-druido/";
// Lo stesso controllo sta in sitemap-cerchio.ts: un indirizzo che qui
// verrebbe rimandato alla vetrina, nella sitemap non si elenca.
const SLUG_VALIDO = /^[a-z0-9][a-z0-9-]{0,118}$/;
// Le foto si mostrano solo se stanno nel nostro progetto, come nella pagina.
const DAL_NOSTRO_SB = /^https:\/\/okasxfvoyihovohlaypz\.supabase\.co\//;

type Articolo = {
  titolo: string; occhiello: string | null; estratto: string | null;
  contenuto: string | null; copertina_url: string | null; pubblicato_at: string | null;
  updated_at?: string | null;
};
type Scheda = Articolo & { slug: string };

// GLI ARTICOLI CHE HANNO CAMBIATO INDIRIZZO (13/09/2026). «L'acqua d'autunno»
// e' uscito l'11/09 con uno slug nato da una bozza con un altro titolo («la
// caverna», «il pipistrello»: parole che nel testo non compaiono mai), e
// tagliato a 80 caratteri. Cristian ha scelto di rinominarlo (decisione B9 del
// piano SEO) prima che entrasse nella sitemap. Chi ha il link vecchio - un
// post, un messaggio, una condivisione - arriva lo stesso: qui si risponde
// 301 verso il nome nuovo PRIMA di leggere il database, conservando gli altri
// parametri dell'indirizzo (fbclid e simili). Un rimando per ogni nome
// abbandonato; i nomi vecchi non vanno riusati per un articolo nuovo.
const RINOMINATI: Record<string, string> = {
  "la-caverna-prima-della-parola-il-pipistrello-il-silenzio-fertile-e-i-bus-delle-a":
    "acqua-d-autunno-idroterapia-ritmi-e-cammino-maya",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Una lettura dal database finisce in due modi che NON si confondono: le
// righe (anche zero, ed e' una risposta) oppure un errore (risposta non ok,
// timeout, eccezione). La versione del 2/09 li mescolava: un 429 o un 503 di
// Supabase finiva nel ramo «non trovato», e dargli un 404 avrebbe portato
// fino al bordo proprio il guasto passeggero che non deve togliere pagine.
type Lettura<T> = { righe: T[] } | { errore: string };

async function leggi<T>(query: string): Promise<Lettura<T>> {
  try {
    const r = await fetch(`${SB}/rest/v1/articoli_cerchio?${query}`, {
      headers: { apikey: CHIAVE }, signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return { errore: "http-" + r.status };
    const dati: unknown = await r.json();
    return Array.isArray(dati) ? { righe: dati as T[] } : { errore: "risposta-inattesa" };
  } catch (e) {
    return { errore: String((e as Error)?.message || e) };
  }
}

// La risposta di context.next() ha le intestazioni immutabili: se ne fa
// una copia scrivibile. E la riscrittura e' su testo, non con HTMLRewriter,
// che sul bordo di Netlify non e' un globale (lo e' su Cloudflare): la
// prima versione, che lo dava per scontato, rispondeva 500 a ogni articolo.
// Quando il corpo cambia, l'etag del file statico non lo descrive piu': un
// 304 costruito su di lui farebbe tenere a chi rilegge il testo vecchio.
function risposta(originale: Response, corpo: BodyInit | null, stato: number, perche: string, cambiata: boolean): Response {
  const h = new Headers(originale.headers);
  h.delete("content-length");
  h.delete("content-encoding");
  if (cambiata) {
    h.delete("etag");
    h.delete("accept-ranges");
  }
  // Solo caratteri stampabili: il messaggio di un errore puo' contenere di
  // tutto, e un'intestazione non valida farebbe cadere la risposta intera.
  h.set("x-cerchio-og", perche.replace(/[^\x20-\x7e]/g, "?").slice(0, 80));
  return new Response(corpo, { status: stato, headers: h });
}
const passa = (originale: Response, perche: string) =>
  risposta(originale, originale.body, originale.status, perche, false);
const eUnaPagina = (r: Response) =>
  r.status === 200 && (r.headers.get("content-type") || "").includes("text/html");

// Un 301 con la sua intestazione di diagnosi (Response.redirect le ha immutabili).
function rimanda(verso: string, perche: string): Response {
  return new Response(null, { status: 301, headers: { location: verso, "x-cerchio-og": perche } });
}

// Le stesse regole dello script della pagina, perche' le due versioni del
// testo devono coincidere: la data e' quella dello studio (Europe/Rome), non
// quella del fuso di chi legge; la lettura conta 200 parole al minuto.
function dataItaliana(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });
}
function minutiLettura(contenuto: string | null): string {
  const parole = (contenuto || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(parole / 200)) + " min di lettura";
}
function corpoHtml(contenuto: string | null): string {
  const blocchi: string[] = [];
  for (const blocco of (contenuto || "").split(/\n\s*\n/)) {
    const testo = blocco.trim();
    if (!testo) continue;
    blocchi.push(testo.startsWith("## ")
      ? `<h2>${esc(testo.slice(3).trim())}</h2>`
      : `<p>${esc(testo.replace(/\n/g, " "))}</p>`);
  }
  return blocchi.join("\n");
}
// Lo slug della categoria, uguale a quello della barra della vetrina.
function slugCat(s: string | null): string {
  return String(s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// I pezzi di articolo.html. I primi sei sono indispensabili: se il modello
// cambia e uno non si trova piu', il corpo resta allo script della pagina
// come prima, e si riscrive solo la testa. Meglio un h1 riempito dal
// JavaScript che un articolo acceso a meta'.
const ATTESA = /<div id="articolo-attesa"([^>]*)>/;
const ARTICOLO_NASCOSTO = /<article id="articolo" hidden>/;
const TITOLO_H1 = /(<h1\b[^>]*\bid="art-titolo"[^>]*>)<\/h1>/;
const DATA = /(<span id="art-data">)<\/span>/;
const LETTURA = /(<span id="art-lettura">)<\/span>/;
const CORPO = /(<div id="art-corpo">)<\/div>/;
const OCCHIELLO = /(<p\b[^>]*\bid="art-occhiello"[^>]*>)[^<]*<\/p>/;
const CORNICE = /(<div\b[^>]*\bid="art-copertina-cornice"[^>]*?)\s+hidden>/;
const COPERTINA = /<img id="art-copertina" src="" alt="">/;
const INVITO = /(<aside\b[^>]*\bid="art-invito-miscela"[^>]*?)\s+hidden>/;
const ATTESA_INTERA = /(<div id="articolo-attesa"[^>]*>)[^<]*<\/div>/;
const CONTENITORE = /(<div\b[^>]*\bid="cerchio-dal-database"[^>]*>)<\/div>/;

// Le sostituzioni passano sempre da una funzione, mai da una stringa: nella
// stringa di sostituzione «$&» e «$'» hanno un significato, e un titolo che
// li contenesse ricopierebbe pezzi della pagina nel posto sbagliato.
function riempiArticolo(html: string, a: Articolo): string | null {
  if (![ATTESA, ARTICOLO_NASCOSTO, TITOLO_H1, DATA, LETTURA, CORPO].every((re) => re.test(html))) return null;
  html = html
    .replace(ATTESA, (_m, attributi: string) => `<div id="articolo-attesa"${attributi} hidden>`)
    .replace(ARTICOLO_NASCOSTO, () => `<article id="articolo">`)
    .replace(TITOLO_H1, (_m, apre: string) => apre + esc(a.titolo) + "</h1>")
    .replace(DATA, (_m, apre: string) => apre + esc(dataItaliana(a.pubblicato_at)) + "</span>")
    .replace(LETTURA, (_m, apre: string) => apre + minutiLettura(a.contenuto) + "</span>")
    .replace(CORPO, (_m, apre: string) => apre + corpoHtml(a.contenuto) + "</div>");
  if (a.occhiello) html = html.replace(OCCHIELLO, (_m, apre: string) => apre + esc(a.occhiello as string) + "</p>");
  // La copertina e' l'immagine piu' grande della pagina: arrivando gia'
  // nell'HTML, il browser la chiede subito invece che dopo la lettura.
  if (a.copertina_url && DAL_NOSTRO_SB.test(a.copertina_url) && COPERTINA.test(html)) {
    const src = a.copertina_url;
    html = html
      .replace(CORNICE, (_m, apre: string) => apre + ">")
      .replace(COPERTINA, () => `<img id="art-copertina" src="${esc(src)}" alt="${esc(a.titolo)}">`);
  }
  // L'invito alla miscela: la stessa regola dello script (occhiello «Fiori di
  // Bach», senza badare a maiuscole e spazi). Nel riquadro nessun dato del
  // database: si toglie solo hidden.
  if (typeof a.occhiello === "string" && a.occhiello.trim().toLowerCase() === "fiori di bach") {
    html = html.replace(INVITO, (_m, apre: string) => apre + ">");
  }
  return html;
}

// La pagina di un articolo che non c'e': lo stesso messaggio che scrive lo
// script della pagina, gia' nell'HTML, sotto un 404 vero.
function paginaAssente(html: string): string {
  return html.replace(ATTESA_INTERA, (_m, apre: string) => apre
    + "<p>Articolo non trovato: forse è stato spostato.</p>"
    + `<a href="./" class="articolo-ritorno">← Torna al Cerchio del Druido</a></div>`);
}

async function articolo(indirizzo: URL, context: Context): Promise<Response> {
  const slug = indirizzo.searchParams.get("slug") || "";
  if (Object.hasOwn(RINOMINATI, slug)) {
    indirizzo.searchParams.set("slug", RINOMINATI[slug]);
    return Response.redirect(indirizzo.toString(), 301);
  }
  // Senza slug, o con uno che non puo' esistere, la pagina non ha niente
  // da mostrare: fino al 13/09 rispondeva 200 con «Questo indirizzo non
  // porta a nessun articolo», una pagina vuota che per Google era un
  // soft 404. La strada giusta e' la vetrina.
  if (!SLUG_VALIDO.test(slug)) return rimanda(new URL(VETRINA, indirizzo).toString(), "senza-slug");

  // La pagina e l'articolo si chiedono insieme: l'attesa e' la piu' lunga
  // delle due, non la loro somma.
  const [originale, lettura] = await Promise.all([
    context.next(),
    leggi<Articolo>(`slug=eq.${encodeURIComponent(slug)}`
      + "&select=titolo,occhiello,estratto,contenuto,copertina_url,pubblicato_at,updated_at&limit=1"),
  ]);
  if (!eUnaPagina(originale)) return passa(originale, "pagina-" + originale.status);
  if ("errore" in lettura) return passa(originale, "errore:" + lettura.errore);

  let html = await originale.text();
  if (lettura.righe.length === 0) return risposta(originale, paginaAssente(html), 404, "non-trovato", true);
  const a = lettura.righe[0];
  if (!a || typeof a.titolo !== "string" || !a.titolo) return risposta(originale, html, originale.status, "senza-titolo", false);

  const titolo = `${a.titolo} · Cristian Bresadola`;
  const dalDatabase = (a.estratto || (a.contenuto || "").replace(/\s+/g, " ").slice(0, 200)).slice(0, 300);
  const descrizione = dalDatabase || "Un articolo del Cerchio del Druido, la rubrica di Cristian Bresadola, naturopata in Trentino.";
  const copertina = a.copertina_url && a.copertina_url.startsWith(SB + "/storage/v1/object/public/")
    ? a.copertina_url : null;
  const immagine = copertina || OG_GENERICA;
  const url = `${SITO}/cerchio-del-druido/articolo.html?slug=${encodeURIComponent(slug)}`;

  // Il BlogPosting, solo con dati del database: nessuna data, immagine o
  // descrizione che il database non abbia. L'autore porta name e url oltre
  // all'@id, perche' la persona e' definita per intero in un'altra pagina
  // (chi-sono.html). Niente publisher: e' la decisione B16, ancora aperta.
  const persona = { "@type": "Person", "@id": SITO + "/#person", name: "Cristian Bresadola", url: SITO + "/chi-sono.html" };
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting", "@id": url + "#articolo", mainEntityOfPage: url, url,
        headline: a.titolo, inLanguage: "it-IT",
        ...(dalDatabase ? { description: dalDatabase } : {}),
        ...(copertina ? { image: [copertina] } : {}),
        ...(a.pubblicato_at ? { datePublished: a.pubblicato_at } : {}),
        ...((a.updated_at || a.pubblicato_at) ? { dateModified: a.updated_at || a.pubblicato_at } : {}),
        ...(a.occhiello ? { articleSection: a.occhiello } : {}),
        author: persona,
        isPartOf: { "@type": "Blog", "@id": SITO + "/cerchio-del-druido/#blog", name: "Il Cerchio del Druido", url: SITO + "/cerchio-del-druido/" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITO + "/" },
          { "@type": "ListItem", position: 2, name: "Il Cerchio del Druido", item: SITO + "/cerchio-del-druido/" },
          { "@type": "ListItem", position: 3, name: a.titolo, item: url },
        ],
      },
    ],
  };

  const testa = [
    // Il canonical nella stessa forma di og:url: lo script della pagina lo
    // ritrova e lo riusa, invece di aggiungerne un secondo.
    `<link rel="canonical" href="${esc(url)}">`,
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
    // Dentro <script> il «<» diventa \u003c: un «</script>» scritto in un
    // titolo chiuderebbe il blocco, e il resto finirebbe nella pagina.
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
  ].filter(Boolean).join("\n");

  html = html
    .replace(/<link rel="canonical"[^>]*>\s*/gi, () => "")
    .replace(/<title>[^<]*<\/title>/i, () => `<title>${esc(titolo)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/i, () => `<meta name="description" content="${esc(descrizione)}">`)
    .replace(/<\/head>/i, () => testa + "\n</head>");
  const piena = riempiArticolo(html, a);
  return risposta(originale, piena ?? html, originale.status, piena ? "riscritta" : "riscritta-solo-testa", true);
}

// Una scheda della vetrina, la stessa che costruisce lo script della pagina.
function scheda(a: Scheda): string {
  const figura = a.copertina_url && DAL_NOSTRO_SB.test(a.copertina_url)
    ? `<img src="${esc(a.copertina_url)}" alt="${esc(a.titolo)}" loading="lazy">`
    : `<div class="cerchio-card__image-placeholder">Il Cerchio del Druido</div>`;
  const estratto = a.estratto
    || (a.contenuto || "").replace(/^## .*$/gm, "").replace(/\s+/g, " ").trim().slice(0, 160);
  return `<a class="cerchio-card" href="./articolo.html?slug=${esc(encodeURIComponent(a.slug))}">`
    + `<div class="cerchio-card__image">${figura}</div>`
    + `<div class="cerchio-card__body">`
    + `<div class="cerchio-card__cat">${esc(a.occhiello || "Note del Druido")}</div>`
    + `<h2 class="cerchio-card__title">${esc(a.titolo)}</h2>`
    + `<p class="cerchio-card__excerpt">${esc(estratto)}</p>`
    + `<div class="cerchio-card__meta"><span>${esc(dataItaliana(a.pubblicato_at))}</span>`
    + `<span class="cerchio-card__meta-dot"></span><span>${minutiLettura(a.contenuto)}</span></div>`
    + `</div></a>`;
}

async function vetrina(indirizzo: URL, context: Context): Promise<Response> {
  // Il filtro ?cat= e' lo stesso dello script: qui si scrivono solo le
  // schede della categoria scelta, cosi' lo script, sostituendole, non ne
  // toglie nessuna sotto gli occhi di chi legge.
  const catScelta = indirizzo.searchParams.get("cat") || "";
  const [originale, lettura] = await Promise.all([
    context.next(),
    leggi<Scheda>("select=slug,titolo,occhiello,estratto,contenuto,copertina_url,pubblicato_at"
      + "&order=pubblicato_at.desc&limit=60"),
  ]);
  if (!eUnaPagina(originale)) return passa(originale, "vetrina-pagina-" + originale.status);
  if ("errore" in lettura) return passa(originale, "vetrina-errore:" + lettura.errore);

  const html = await originale.text();
  if (!CONTENITORE.test(html)) return risposta(originale, html, originale.status, "vetrina-senza-contenitore", false);
  const schede = lettura.righe
    .filter((a) => typeof a.slug === "string" && a.slug !== "" && typeof a.titolo === "string" && a.titolo !== "")
    .filter((a) => !catScelta || slugCat(a.occhiello) === catScelta);
  const piena = html.replace(CONTENITORE, (_m, apre: string) => apre + schede.map(scheda).join("\n") + "</div>");
  return risposta(originale, piena, originale.status, "vetrina:" + schede.length, true);
}

export default async (request: Request, context: Context) => {
  const indirizzo = new URL(request.url);
  if (indirizzo.pathname === VETRINA || indirizzo.pathname === VETRINA + "index.html") {
    return vetrina(indirizzo, context);
  }
  return articolo(indirizzo, context);
};

export const config: Config = {
  path: [
    "/cerchio-del-druido/articolo.html", "/cerchio-del-druido/articolo",
    "/cerchio-del-druido/", "/cerchio-del-druido/index.html",
  ],
  // Se qualcosa qui dentro si rompe senza essere previsto, la pagina passa
  // com'e', come nel caso di Supabase che non risponde: mai un 500.
  onError: "bypass",
};
