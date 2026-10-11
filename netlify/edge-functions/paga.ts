// ============================================================
// IL LINK DI PAGAMENTO CON IL NOME DI CRISTIAN (11/10/2026)
// ============================================================
// Cristian: «fai dei bei link magari con una bella og (che parta elegante
// anche da arkana)». Il link che Arkana manda non e' piu' quello di Stripe
// (checkout.stripe.com/c/pay/cs_live_... lungo due righe, con l'anteprima
// generica di Stripe) ma https://cristianbresadola.com/paga/<id>, dove <id>
// e' l'uuid della riga di pagamenti.
//
// COSA FA. Legge il pagamento con la chiave pubblicabile attraverso la sola
// porta aperta, la funzione public.link_di_pagamento (migrazione del
// 11/10/2026 nel repo ildegarda): servizio, descrizione, importo, stato,
// scadenza, modalita e, solo se il link e' ancora aperto, l'indirizzo di
// Stripe. Niente email e niente nome: la pagina non sa chi paga.
//
// PERCHE' NON UN 302. WhatsApp, Telegram, Facebook e gli altri disegnano
// l'anteprima leggendo l'HTML dell'indirizzo; un rinvio diretto a Stripe
// darebbe loro l'anteprima di Stripe, cioe' proprio quella che si voleva
// togliere. Quindi si risponde sempre 200 con una pagina vera, che porta i
// meta Open Graph del servizio e, per le persone, passa da sola alla cassa
// di Stripe dopo un istante (meta refresh e location.replace, con il
// bottone per chi li ha spenti).
//
// GLI STATI dicono solo il vero:
// - aperto: la pagina presenta il servizio e passa a Stripe;
// - pagato: grazie, nessuna cassa;
// - scaduto o annullato: il link non vale piu', se ne chiede un altro;
// - rimborsato: lo dice;
// - non trovato o id malformato: 404 con le stesse parole di un link rotto;
// - Supabase non risponde: 503, «riprova tra un momento». Non si inventa uno
//   stato che non si conosce.
// Un link di PROVA (modalita test) lo dichiara in cima, come fa Arkana.
//
// NIENTE CACHE (no-store): lo stesso indirizzo passa da aperto a pagato.
// NOINDEX: un link di pagamento non e' una pagina del sito.
import type { Config } from "@netlify/edge-functions";

const SB = "https://okasxfvoyihovohlaypz.supabase.co";
const CHIAVE = "sb_publishable__JK1dgzDVfrFmMETc3z-sA_HjMiueOS";
const SITO = "https://cristianbresadola.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Solo la cassa di Stripe: un indirizzo che non comincia cosi' non si apre,
// qualunque cosa ci sia scritta nella riga.
const CASSA_STRIPE = /^https:\/\/checkout\.stripe\.com\//;

// L'anteprima di ogni servizio del listino; quelle che mancano usano la
// generica. I file stanno in /images e si rifanno con strumenti/card-og-paga.html.
const OG: Record<string, string> = {
  croce_maya: "og-paga-croce-maya.jpg",
  sinastria: "og-paga-sinastria.jpg",
  miscela_bach: "og-paga-miscela.jpg",
  seduta: "og-paga-seduta.jpg",
  percorso: "og-paga-percorso.jpg",
};
const OG_GENERICA = "og-paga.jpg";

type Riga = {
  servizio: string;
  descrizione: string;
  importo_centesimi: number;
  stato: "creato" | "pagato" | "scaduto" | "annullato" | "rimborsato";
  scade_il: string;
  modalita: "test" | "live";
  url_pagamento: string | null;
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

function euro(centesimi: number): string {
  const intero = centesimi % 100 === 0;
  return new Intl.NumberFormat("it-IT", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: intero ? 0 : 2, maximumFractionDigits: 2,
  }).format(centesimi / 100);
}

function scadenza(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
}

async function leggi(id: string): Promise<Riga | null | "guasto"> {
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/link_di_pagamento`, {
      method: "POST",
      headers: { apikey: CHIAVE, Authorization: `Bearer ${CHIAVE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: id }),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return "guasto";
    const righe = (await r.json()) as Riga[];
    return righe[0] ?? null;
  } catch {
    return "guasto";
  }
}

type Pagina = {
  stato: number;
  titolo: string;          // <title> e og:title
  descrizione: string;     // meta description e og:description
  immagine: string;        // nome del file in /images
  occhiello: string;
  intestazione: string;
  importo?: string;
  testo: string;
  cassa?: string;          // indirizzo di Stripe, solo per un link aperto
  prova?: boolean;
  url: string;
};

function disegna(p: Pagina): string {
  const og = `${SITO}/images/${p.immagine}`;
  const passa = p.cassa
    ? `<meta http-equiv="refresh" content="2;url=${esc(p.cassa)}">`
    : "";
  const script = p.cassa
    ? `<script>setTimeout(function(){location.replace(${JSON.stringify(p.cassa)})},1200)</script>`
    : "";
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.titolo)}</title>
<meta name="description" content="${esc(p.descrizione)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#1B3A3E">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cristian Bresadola · Naturopata">
<meta property="og:locale" content="it_IT">
<meta property="og:title" content="${esc(p.titolo)}">
<meta property="og:description" content="${esc(p.descrizione)}">
<meta property="og:url" content="${esc(p.url)}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(p.intestazione)} · Cristian Bresadola, naturopata">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.titolo)}">
<meta name="twitter:description" content="${esc(p.descrizione)}">
<meta name="twitter:image" content="${og}">
${passa}
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{--petrol:#1B3A3E;--petrol-dark:#12282B;--forest:#2D5139;--salt:#E59856;
        --ivory:#EEF3F6;--frost:#DBE7EC;--display:'Fraunces',Georgia,serif;--body:'DM Sans',system-ui,sans-serif}
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100%}
  body{min-height:100vh;display:grid;place-items:center;padding:1.5rem;font-family:var(--body);color:var(--ivory);
       background:radial-gradient(700px 520px at 70% 30%,rgba(45,81,57,.55),transparent 62%),
                  linear-gradient(158deg,var(--petrol) 0%,var(--petrol-dark) 85%)}
  .carta{width:100%;max-width:30rem;text-align:center}
  .marchio{display:inline-flex;align-items:center;gap:.6rem;color:var(--ivory);text-decoration:none;margin-bottom:2.25rem}
  .marchio img{width:2.25rem;height:2.25rem;border-radius:50%;box-shadow:0 0 0 1px rgba(229,152,86,.6)}
  .marchio span{font-family:var(--display);font-size:1.05rem}
  .prova{display:inline-block;margin:0 0 1.5rem;padding:.35rem .8rem;border-radius:.4rem;background:#B4433A;color:#fff;
         font-size:.8rem;letter-spacing:.06em;text-transform:uppercase}
  .occhiello{margin:0 0 .9rem;font-size:.75rem;letter-spacing:.24em;text-transform:uppercase;color:var(--salt)}
  h1{margin:0;font-family:var(--display);font-weight:400;font-size:clamp(2rem,8vw,2.75rem);line-height:1.12}
  .importo{margin:1rem 0 0;font-family:var(--display);font-style:italic;font-size:1.6rem;color:var(--salt)}
  .filo{width:3rem;height:1px;background:var(--salt);margin:1.6rem auto;opacity:.8}
  .testo{margin:0 auto 2rem;max-width:26rem;line-height:1.65;color:var(--frost);font-size:1rem}
  .bottone{display:inline-block;padding:.95rem 1.8rem;border-radius:999px;background:var(--salt);color:var(--petrol-dark);
           font-weight:500;text-decoration:none;font-size:1rem}
  .nota{margin:1.6rem 0 0;font-size:.8rem;line-height:1.6;color:rgba(219,231,236,.7)}
  .firma{margin:2.4rem 0 0;font-family:var(--display);font-style:italic;font-size:.9rem;color:rgba(229,152,86,.85)}
</style>
${script}
</head>
<body>
<main class="carta">
  <a class="marchio" href="${SITO}/"><img src="/images/logo-96.jpg" alt="" width="36" height="36"><span>Cristian Bresadola</span></a>
  ${p.prova ? '<p class="prova">Link di prova · non addebita nulla</p>' : ""}
  <p class="occhiello">${esc(p.occhiello)}</p>
  <h1>${esc(p.intestazione)}</h1>
  ${p.importo ? `<p class="importo">${esc(p.importo)}</p>` : ""}
  <div class="filo" aria-hidden="true"></div>
  <p class="testo">${p.testo}</p>
  ${p.cassa ? `<a class="bottone" href="${esc(p.cassa)}">Vai al pagamento sicuro</a>
  <p class="nota">Il pagamento con carta passa da Stripe. Incassa NosLab S.a.s., la mia società:<br>è il nome che vedrai sull'estratto conto.</p>` : ""}
  <p class="firma">In Lak'ech · A Lak'en</p>
</main>
</body>
</html>`;
}

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const id = url.pathname.replace(/^\/paga\/?/, "").replace(/\/$/, "");
  const indirizzo = `${SITO}/paga/${id}`;
  const intestazioni = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };

  const rotto: Pagina = {
    stato: 404, titolo: "Link di pagamento · Cristian Bresadola",
    descrizione: "Questo link di pagamento non esiste più. Scrivimi e te ne mando uno nuovo.",
    immagine: OG_GENERICA, occhiello: "Link di pagamento", intestazione: "Questo link non c'è",
    testo: "Forse è stato copiato a metà, o è stato sostituito da uno più recente. Scrivimi e te ne mando uno nuovo.",
    url: indirizzo,
  };
  if (!UUID.test(id)) return new Response(disegna(rotto), { status: 404, headers: intestazioni });

  const riga = await leggi(id.toLowerCase());
  if (riga === "guasto") {
    return new Response(disegna({
      ...rotto, stato: 503, intestazione: "Un momento",
      testo: "Non riesco a leggere il link proprio adesso. Riprova tra qualche istante.",
    }), { status: 503, headers: { ...intestazioni, "Retry-After": "30" } });
  }
  if (riga === null) return new Response(disegna(rotto), { status: 404, headers: intestazioni });

  const immagine = OG[riga.servizio] ?? OG_GENERICA;
  const importo = euro(riga.importo_centesimi);
  const base = {
    stato: 200, immagine, url: indirizzo, prova: riga.modalita === "test",
    intestazione: riga.descrizione, importo,
    titolo: `${riga.descrizione} · ${importo}`,
  };

  let pagina: Pagina;
  const cassa = riga.url_pagamento && CASSA_STRIPE.test(riga.url_pagamento) ? riga.url_pagamento : undefined;
  if (riga.stato === "creato" && cassa) {
    pagina = {
      ...base, cassa, occhiello: "Pagamento con carta",
      descrizione: `Pagamento sicuro con carta per ${riga.descrizione}. Cristian Bresadola, naturopata.`,
      testo: `Ti porto alla pagina sicura di Stripe. Il link vale fino a ${esc(scadenza(riga.scade_il))}.`,
    };
  } else if (riga.stato === "pagato") {
    pagina = {
      ...base, occhiello: "Pagamento ricevuto",
      descrizione: "Questo pagamento è già stato fatto. Grazie.",
      testo: "Questo link è già stato pagato: non serve fare altro. Grazie di cuore.",
    };
  } else if (riga.stato === "rimborsato") {
    pagina = {
      ...base, occhiello: "Pagamento rimborsato",
      descrizione: "Questo pagamento è stato rimborsato.",
      testo: "Questo pagamento è stato rimborsato. Se hai domande, rispondi pure al mio messaggio.",
    };
  } else {
    pagina = {
      ...base, occhiello: "Link non più valido",
      descrizione: "Questo link di pagamento è scaduto. Scrivimi e te ne mando uno nuovo.",
      testo: "Questo link è scaduto o è stato sostituito. Scrivimi e te ne mando uno nuovo: ci vuole un attimo.",
    };
  }
  return new Response(disegna(pagina), { status: pagina.stato, headers: intestazioni });
};

export const config: Config = {
  path: "/paga/*",
};
