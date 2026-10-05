# cristianbresadola.com

Sito pubblico di **Cristian Bresadola**: naturopata, riflessologo, massaggiatore
olistico e formatore. Prodotto da **NosLab S.a.s.**

HTML statico + Tailwind, con i contenuti dinamici (pubblicazioni, rubrica) letti da
Supabase tramite `supabase-js`. Nessun build step: quello che c'è nel repo è quello
che va online.

---

## ⚠️ Il push su `main` PUBBLICA (misurato il 5/10/2026)

Questa sezione diceva il contrario, ed era vero il 27/08/2026: allora il sito
non era collegato a GitHub e un push non innescava niente. Dopo, il sito
Netlify è stato collegato a `Faldrake/sito-cristianbresadola`, ramo `main`,
con le build attive. Il 5/10 i record dei deploy lo dicono senza dubbi: ogni
push su `main` ha prodotto un deploy col suo `commit_ref` (`9d23197`,
`d214354`), online in pochi secondi.

Quindi **si pubblica col push**, e basta:

1. si committano le pagine;
2. se sono state toccate pagine della sitemap, `python strumenti/aggiorna-sitemap.py --scrivi`
   (legge le date dalla storia di git, quindi DOPO il commit delle pagine) e
   si committa `sitemap.xml`;
3. `git push origin main`;
4. si controlla che sia online: `curl` sul dominio, o il record del deploy.

**Non usare più `netlify deploy --prod --dir=.`** Carica la cartella di lavoro
così com'è, compresi i file modificati e non committati, e poi il push
successivo la sovrascrive in silenzio (o viceversa): due canali che si
contendono la produzione, e vince l'ultimo che finisce. Il 5/10 è successo
due volte, per fortuna con lo stesso contenuto.

### Nota storica: il deploy a mano

⚠️ **Niente `--site=<id>`.** Fino al 28/08/2026 questa riga lo consigliava, e
con netlify-cli 26.0.1 non funziona: risponde `Project not found. Please rerun
"netlify link"`. Il flag esiste ancora nell'aiuto del comando, quindi il perche'
non e' chiaro e non lo si inventa qui. Quello che e' verificato e' che la
cartella e' **collegata** (`.netlify/state.json` porta
`a5d1f71e-2030-4d1d-b634-394490a9fad6`) e che senza `--site` la CLI usa quel
collegamento. `netlify status` deve rispondere `Current project:
cristianbresadola`: se risponde altro, **non pubblicare**, perche' senza il
flag l'errore non e' piu' «non parte» ma «parte verso il sito sbagliato».

⚠️ **Se il deploy muore su `UNABLE_TO_VERIFY_LEAF_SIGNATURE`** non e' Netlify:
e' l'antivirus di questa macchina che intercetta il TLS. Il guasto e'
intermittente e colpisce le POST grosse, mentre le chiamate piccole passano.
Riprovare due o tre volte prima di credergli; se insiste, `$env:NODE_OPTIONS =
'--use-system-ca'` e in ultima istanza sospendere la scansione HTTPS per il
tempo del deploy.

---

## Struttura

```
*.html                  le pagine del sito, una per file
cerchio-del-druido/     sezione dedicata
strumenti/              script di servizio, non fanno parte del sito
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
