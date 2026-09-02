#!/usr/bin/env node
// ============================================================================
//  GENERA LE 260 PAGINE "KIN DEL CUORE" CONDIVISIBILI
//  Uso:
//    node strumenti/genera-kin.mjs                 → scrive kin/<slug>.html
//    node strumenti/genera-kin.mjs --og <cartella>  → in più converte le card
//                     kin-<n>.png (2400×1260) di <cartella> in kin/og/<slug>.jpg
//
//  PERCHÉ 260 PAGINE STATICHE. I crawler di Facebook, WhatsApp e LinkedIn non
//  eseguono JavaScript e non leggono i parametri dell'URL: l'anteprima di un
//  link condiviso è quella scritta nei meta OG della pagina, e basta. Per far
//  vedere IL kin di chi condivide serve un indirizzo per kin, con la sua
//  immagine. Il sito è statico su Netlify: questa è la strada pulita.
//
//  I DATI vengono dalla tabella bussola_anima_giorni, la stessa che alimenta
//  la Bussola e il calcolo su croce-maya.html, con la chiave pubblicabile che
//  le pagine usano già. Le grafie dei glifi sono quelle della tabella (Kimi,
//  Kawak, Chuwen, Ajaw...): coerenti col resto del sito pubblico.
//
//  NAV E FOOTER si prendono da croce-maya.html al momento della generazione,
//  con i link riscritti in forma assoluta (le pagine stanno in /kin/): così
//  quando il menu cambia basta rigenerare, e non c'è una seconda copia da
//  tenere allineata a mano.
//
//  LO SLUG (es. 9-ix, 13-akbal) è calcolato da tono + nome yucateco. La STESSA
//  funzione, parola per parola, vive in croce-maya.html per costruire il link
//  "Condividi": se cambi una, cambia anche l'altra.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = 'https://okasxfvoyihovohlaypz.supabase.co';
const SB_KEY = 'sb_publishable__JK1dgzDVfrFmMETc3z-sA_HjMiueOS';
const SITO = 'https://cristianbresadola.com';

const argv = process.argv.slice(2);
const ogDir = argv.includes('--og') ? argv[argv.indexOf('--og') + 1] : null;

// ---------------------------------------------------------------------------

/** Identico a slugKin() in croce-maya.html. */
function slugKin(tono, yucateco) {
  const nome = String(yucateco || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${tono}-${nome}`;
}

/** Il titolo poetico che va in pagina è la parte dopo il "·". */
function descrittore(titolo) {
  const i = (titolo || '').indexOf('·');
  let t = i >= 0 ? titolo.slice(i + 1).trim() : (titolo || '').trim();
  if (t && !/[.!?…]$/.test(t)) t += '.';
  return t;
}

/** Il testo viene dal database: non si interpreta mai come marcatura. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Riscrive i link relativi in assoluti: la pagina sta in /kin/. */
function assoluti(html) {
  return html
    .replace(/(href|src)="\.\//g, '$1="/')
    .replace(/(href|src)="(?!https?:|\/|#|mailto:|tel:|data:)/g, '$1="/');
}

function ritaglia(html, inizio, fine, etichetta) {
  const a = html.indexOf(inizio);
  const b = html.indexOf(fine, a);
  if (a === -1 || b === -1) throw new Error(`Non trovo ${etichetta} in croce-maya.html`);
  return html.slice(a, b + fine.length);
}

// ---------------------------------------------------------------------------
//  Pezzi condivisi del sito
// ---------------------------------------------------------------------------

const croceMaya = readFileSync(join(RADICE, 'croce-maya.html'), 'utf8');
// La nav e lo script che la fa funzionare (menu mobile, tendine) sono contigui.
const navHtml = assoluti(ritaglia(croceMaya, '<nav class="main-nav', '</script>', 'la nav'));
const footerHtml = assoluti(ritaglia(croceMaya, '<footer', '</footer>', 'il footer'));

// ---------------------------------------------------------------------------
//  Template della pagina
// ---------------------------------------------------------------------------

function pagina(k) {
  const slug = slugKin(k.tono, k.nome_glifo_yucateco);
  const url = `${SITO}/kin/${slug}`;
  const og = `${SITO}/kin/og/${slug}.jpg`;
  const nome = `${k.tono} ${k.nome_glifo_yucateco}`;
  const frase = descrittore(k.titolo_kin);
  const titoloPagina = `${nome} · Il mio Kin del Cuore`;
  const descrizione = `${frase} Uno dei cinque glifi della Croce Maya. Scopri gratis il tuo Kin di nascita dal calendario Tzolk'in.`;
  const meta = [k.nome_glifo_kiche, k.direzione, k.elemento, k.tono ? `Tono ${k.tono} ${k.nome_tono || ''}`.trim() : '']
    .filter(Boolean).join('  ·  ');
  const testo = String(k.testo_breve || '').trim();

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titoloPagina)} · Cristian Bresadola</title>
<meta name="description" content="${esc(descrizione)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="Cristian Bresadola">
<meta name="theme-color" content="#1B3A3E">

<link rel="icon" type="image/x-icon" href="/favicons/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
<link rel="manifest" href="/favicons/site.webmanifest">

<!-- OPEN GRAPH: è QUESTO che i social mostrano quando il link viene condiviso -->
<meta property="og:type" content="website">
<meta property="og:locale" content="it_IT">
<meta property="og:site_name" content="Cristian Bresadola · Naturopata">
<meta property="og:title" content="${esc(titoloPagina)}">
<meta property="og:description" content="${esc(descrizione)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:secure_url" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${esc(nome)}: ${esc(frase)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titoloPagina)}">
<meta name="twitter:description" content="${esc(descrizione)}">
<meta name="twitter:image" content="${og}">
<meta name="twitter:image:alt" content="${esc(nome)}: ${esc(frase)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/tailwind.css">
<link rel="stylesheet" href="/styles.css">
<script defer src="https://cloud.umami.is/script.js" data-website-id="69393e29-836e-41c0-9526-8824b2312fd8" data-exclude-search="true"></script>

<style>
  /* La card del kin, stessa grammatica dell'immagine OG: portale scuro,
     glifo luminoso, titolo poetico. */
  .kc-hero{position:relative;overflow:hidden;background:
    radial-gradient(680px 560px at 72% 40%, rgba(45,81,57,.5), transparent 60%),
    linear-gradient(158deg,#1B3A3E 0%,#12282B 82%)}
  .kc-shaft{position:absolute;top:-8%;left:74%;width:240px;height:130%;transform:translateX(-50%) rotate(6deg);
    background:linear-gradient(to bottom,rgba(229,152,86,.22),rgba(219,231,236,.05) 42%,transparent 72%);
    filter:blur(20px);opacity:.75;pointer-events:none}
  .kc-griglia{display:grid;gap:2.5rem;align-items:center}
  @media(min-width:900px){.kc-griglia{grid-template-columns:1.2fr 1fr;gap:3rem}}
  .kc-portale{position:relative;width:min(330px,80vw);aspect-ratio:1;border-radius:50%;margin:0 auto;overflow:hidden;
    display:grid;place-items:center;
    background:radial-gradient(circle at 50% 42%,#16332F 0%,#0C1F22 66%,#08181A 100%);
    box-shadow:0 0 0 2px rgba(229,152,86,.75),0 0 0 11px rgba(18,40,43,.7),0 24px 70px rgba(0,0,0,.45),inset 0 0 60px rgba(0,0,0,.45)}
  .kc-portale::before{content:'';position:absolute;inset:18px;border-radius:50%;border:1px solid rgba(219,231,236,.12)}
  .kc-portale img{width:72%;height:72%;object-fit:contain;filter:invert(1) brightness(1.4);mix-blend-mode:screen}
  .kc-kin{font-family:var(--display);font-weight:330;font-size:clamp(4rem,10vw,7rem);line-height:.9;letter-spacing:-.01em}
  .kc-kin em{font-style:italic;color:var(--salt)}
  .kc-frase{font-family:var(--display);font-style:italic;font-weight:330;font-size:clamp(1.5rem,3vw,2.15rem);line-height:1.22;
    position:relative;padding-left:1.25rem;max-width:32ch}
  .kc-frase::before{content:'';position:absolute;left:0;top:.3rem;bottom:.3rem;width:3px;background:var(--salt);border-radius:3px}
  .kc-form{display:flex;flex-direction:column;gap:.75rem}
  @media(min-width:560px){.kc-form{flex-direction:row;align-items:stretch}.kc-form .kc-campo{flex:1}}
  .kc-campo{background:rgba(238,243,246,.08);border:1px solid rgba(238,243,246,.3);color:var(--ivory);padding:.9rem 1.1rem;
    font-family:var(--body);font-size:1rem;border-radius:3px;color-scheme:dark}
  .kc-campo:focus{outline:none;border-color:var(--salt)}
  .kc-alba{display:flex;align-items:center;gap:.6rem;font-size:.9rem;opacity:.85;cursor:pointer}
  .kc-alba input{accent-color:var(--salt);width:1rem;height:1rem}
  .kc-share{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
  .kc-share button,.kc-share a{font-family:var(--body);font-size:.85rem;letter-spacing:.04em;padding:.6rem 1.1rem;border-radius:100px;
    border:1px solid rgba(229,152,86,.6);color:var(--salt);background:transparent;cursor:pointer;text-decoration:none}
  .kc-share button:hover,.kc-share a:hover{background:rgba(229,152,86,.12)}
  .kc-copiato{font-size:.85rem;opacity:.8}
</style>
</head>
<body class="bg-ivory">

${navHtml}

<main>
<section class="kc-hero pt-32 pb-16 lg:pt-44 lg:pb-24 text-ivory on-dark">
  <div class="kc-shaft" aria-hidden="true"></div>
  <div class="max-w-7xl mx-auto px-6 lg:px-12 relative">
    <div class="kc-griglia">
      <div>
        <p class="eyebrow text-salt mb-5">Kin del Cuore &middot; Calendario maya Tzolk&rsquo;in</p>
        <h1 class="kc-kin mb-3">${esc(String(k.tono))} <em>${esc(k.nome_glifo_yucateco)}</em></h1>
        <p class="text-sm tracking-wide opacity-75 mb-8">${esc(meta)}</p>
        <p class="kc-frase mb-8">${esc(frase)}</p>
        ${testo ? `<p class="text-[15px] leading-relaxed opacity-85 max-w-xl mb-8">${esc(testo)}</p>` : ''}
        <p class="text-sm opacity-80 max-w-xl mb-6"><strong class="font-medium text-ivory">Uno dei cinque glifi</strong> della Croce Maya. Gli altri quattro, e cosa si dicono fra loro, sono nella lettura completa.</p>
        <div class="kc-share" id="kc-share">
          <button type="button" id="kc-condividi">Condividi questo Kin</button>
          <a id="kc-wa" href="https://wa.me/?text=${encodeURIComponent(`${nome}: ${frase} Scopri gratis il tuo Kin di nascita → ${url}`)}" target="_blank" rel="noopener">WhatsApp</a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a>
          <span class="kc-copiato" id="kc-copiato" hidden>Link copiato.</span>
        </div>
      </div>
      <div>
        <div class="kc-portale">
          ${k.immagine_glifo_url ? `<img src="${esc(k.immagine_glifo_url)}" alt="Glifo maya ${esc(k.nome_glifo_yucateco)}" width="300" height="300" loading="eager" decoding="async">` : ''}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- L'INVITO: è per questo che la pagina esiste. Chi arriva da un link
     condiviso vede il kin di un amico e ora può calcolare il PROPRIO. -->
<section class="py-20 lg:py-28 bg-petrol-dark text-ivory on-dark relative overflow-hidden">
  <div class="max-w-3xl mx-auto px-6 lg:px-12 text-center">
    <p class="eyebrow text-salt mb-4">E il tuo? &middot; Gratuito</p>
    <h2 class="display-title text-3xl md:text-4xl mb-4">Scopri il tuo <span class="display-italic text-salt">Kin di nascita.</span></h2>
    <p class="text-sm opacity-80 mb-8 max-w-xl mx-auto">Metti la tua data di nascita: te lo calcolo subito, senza chiederti niente. Nel conteggio maya il giorno comincia all&rsquo;alba, per questo c&rsquo;&egrave; la spunta delle 7:00.</p>
    <!-- Stessi nomi dei campi della home (nato, alba): croce-maya.html li
         legge dall'URL e calcola. Funziona anche senza JavaScript. -->
    <form class="max-w-xl mx-auto" action="/croce-maya.html#kin-cuore" method="get">
      <div class="kc-form">
        <input type="date" name="nato" required min="1900-01-01" max="2035-12-31" class="kc-campo" aria-label="La tua data di nascita" autocomplete="bday">
        <button type="submit" class="btn-primary whitespace-nowrap justify-center">Calcola il mio Kin
          <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </button>
      </div>
      <label class="kc-alba justify-center mt-4"><input type="checkbox" name="alba" value="1"><span>Sono nato/a prima delle 7:00 del mattino</span></label>
    </form>
    <p class="mt-10 text-sm opacity-70">Vuoi tutta la Croce, con i cinque glifi e il loro dialogo? <a href="/croce-maya.html" class="text-salt underline">La lettura completa</a>.</p>
  </div>
</section>
</main>

${footerHtml}

<script defer src="/noslab-badge.js"></script>
<script src="/ildegarda-widget.js" defer></script>
<script>
(function(){
  'use strict';
  var url =${JSON.stringify(url)};
  var testo = ${JSON.stringify(`${nome}: ${frase} Scopri gratis il tuo Kin di nascita.`)};
  var btn = document.getElementById('kc-condividi');
  var ok = document.getElementById('kc-copiato');
  if (!btn) return;
  btn.addEventListener('click', async function(){
    if (navigator.share) {
      try { await navigator.share({ title: document.title, text: testo, url: url }); return; } catch (e) { /* annullato */ }
    }
    try { await navigator.clipboard.writeText(url); ok.hidden = false; setTimeout(function(){ ok.hidden = true; }, 2500); }
    catch (e) { window.prompt('Copia il link:', url); }
  });
})();
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
//  Esecuzione
// ---------------------------------------------------------------------------

const r = await fetch(SB_URL + '/rest/v1/bussola_anima_giorni?select=numero_kin,tono,nome_tono,nome_glifo_yucateco,nome_glifo_kiche,direzione,elemento,titolo_kin,testo_breve,immagine_glifo_url&order=numero_kin.asc&limit=260',
  { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Accept: 'application/json' } });
if (!r.ok) throw new Error('Supabase ha risposto ' + r.status);
const righe = await r.json();
if (righe.length !== 260) throw new Error(`Attese 260 righe, ricevute ${righe.length}`);

const dirKin = join(RADICE, 'kin');
const dirOg = join(dirKin, 'og');
mkdirSync(dirOg, { recursive: true });

const slugs = new Set();
let ogFatte = 0, ogMancanti = [];
for (const k of righe) {
  const slug = slugKin(k.tono, k.nome_glifo_yucateco);
  if (slugs.has(slug)) throw new Error(`Slug duplicato: ${slug}`);
  slugs.add(slug);
  writeFileSync(join(dirKin, `${slug}.html`), pagina(k), 'utf8');

  if (ogDir) {
    const src = join(ogDir, `kin-${k.numero_kin}.png`);
    const out = join(dirOg, `${slug}.jpg`);
    if (existsSync(src)) {
      // sips è di macOS: ridimensiona a 1200 di larghezza e comprime in JPEG.
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '--resampleWidth', '1200', src, '--out', out], { stdio: 'ignore' });
      ogFatte++;
    } else ogMancanti.push(k.numero_kin);
  }
}

console.log(`  ${righe.length} pagine scritte in kin/`);
if (ogDir) {
  console.log(`  ${ogFatte} immagini OG scritte in kin/og/` + (ogMancanti.length ? `  (MANCANTI: ${ogMancanti.join(', ')})` : ''));
}
