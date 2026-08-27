# cristianbresadola.com

Sito pubblico di **Cristian Bresadola**: naturopata, riflessologo, massaggiatore
olistico e formatore. Prodotto da **NosLab S.a.s.**

HTML statico + Tailwind, con i contenuti dinamici (pubblicazioni, rubrica) letti da
Supabase tramite `supabase-js`. Nessun build step: quello che c'è nel repo è quello
che va online.

---

## ⚠️ Il push NON pubblica

**Misurato il 27 agosto 2026**, dopo che questo file per mesi ha sostenuto il
contrario. Il deploy pubblicato porta `deploy_source: api` e `commit_ref: null`,
cioè è un upload da riga di comando; e un `git push` su `main` fatto quel giorno
**non ha innescato nessun deploy**: l'id del deploy in produzione è rimasto quello
di prima. Chi si fida della riga vecchia pubblica per sbaglio, o peggio crede di
aver pubblicato e non l'ha fatto.

Ne segue la cosa che conta: **la produzione può essere PIÙ AVANTI di `origin/main`**,
e a un certo punto lo è stata di due commit. Lo stato di ciò che è online non si
deduce da git: si misura, con `curl` sul dominio o dal record del deploy su Netlify.

Si pubblica a mano, sempre:

```bash
netlify deploy --prod --dir=. --no-build --site=<site-id>
```

---

## Struttura

```
*.html                  le pagine del sito, una per file
cerchio-del-druido/     sezione dedicata
bussola.html            La Bussola dell'Anima (newsletter)
404.html                pagina non trovata: la serve Netlify da sola, senza
                        configurarla, e i suoi percorsi sono assoluti perché
                        può comparire sotto una cartella qualsiasi
styles.css              design system: variabili colore e tipografia
tailwind.css            utility
ildegarda-widget.js     widget di chat (vedi sotto)
netlify.toml            header di sicurezza, pretty URLs, cache, redirect 301
sitemap.xml             solo le pagine indicizzabili; i lastmod seguono la data
                        dell'ultimo commit che ha toccato il file
images/ favicons/       risorse statiche
```

La tipografia usa **due sole variabili** (`--display` e `--body`) con fallback
identici su tutte le pagine. Se aggiungi una pagina, riusale invece di ridichiarare
i font.

---

## Widget Ildegarda

`ildegarda-widget.js` è il widget di chat dell'assistente. È **attivo su 14 pagine**
(chi-sono, consulenze, contatti, cookie-policy, croce-maya, dove-ricevo, formazione,
grazie, idroterapia, ildegarda, index, privacy-policy, riflessologia-plantare,
rubrica), e assente sulle
altre. Il conteggio si rifà senza fidarsi di questa riga:

```bash
grep -rl --include="*.html" 'ildegarda-widget.js' . | wc -l
```

Per accenderlo su una pagina che ancora non ce l'ha basta una riga prima di
`</body>`:

```html
<script src="/ildegarda-widget.js" defer></script>
```

Si inietta in uno shadow root, quindi non interferisce con gli stili della pagina, e
chiede il consenso prima di inviare qualunque cosa. Il backend accetta chiamate solo
dai domini del sito.

---

## Sicurezza

`netlify.toml` imposta HSTS, CSP, anti-clickjacking e anti-MIME-sniffing. La CSP
elenca esplicitamente gli host consentiti: se aggiungi uno script o una chiamata
verso un dominio nuovo, va aggiunto lì, altrimenti il browser lo blocca.

Nessuna chiave o segreto in questo repo. La publishable key di Supabase presente nel
front-end è pubblica per design; tutto il resto vive nelle variabili d'ambiente delle
Edge Function.

---

*In Lak'ech · A Lak'en ·*
