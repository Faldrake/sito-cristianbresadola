# cristianbresadola.com

Sito pubblico di **Cristian Bresadola** — naturopata, riflessologo, massaggiatore
olistico e formatore. Prodotto da **NosLab S.a.s.**

HTML statico + Tailwind, con i contenuti dinamici (pubblicazioni, rubrica) letti da
Supabase tramite `supabase-js`. Nessun build step: quello che c'è nel repo è quello
che va online.

---

## ⚠️ Il push pubblica

Il repo è collegato a Netlify con il **deploy automatico attivo** su `main`.
**Ogni `git push` va in produzione**, senza altri passaggi.

Prima di pushare conviene verificare che il deploy pubblicato corrisponda all'ultimo
commit: se qualcosa è stato pubblicato a mano e non è in git, una ricostruzione da
repo lo farebbe sparire.

Deploy manuale, se serve:

```bash
netlify deploy --prod --dir=. --no-build --site=<site-id>
```

---

## Struttura

```
*.html                  le pagine del sito, una per file
cerchio-del-druido/     sezione dedicata
bussola.html            La Bussola dell'Anima (newsletter)
styles.css              design system: variabili colore e tipografia
tailwind.css            utility
ildegarda-widget.js     widget di chat (vedi sotto)
netlify.toml            header di sicurezza, pretty URLs, cache
images/ favicons/       risorse statiche
```

La tipografia usa **due sole variabili** — `--display` e `--body` — con fallback
identici su tutte le pagine. Se aggiungi una pagina, riusale invece di ridichiarare
i font.

---

## Widget Ildegarda

`ildegarda-widget.js` è il widget di chat dell'assistente. È **presente ma non
attivo**: nessuna pagina lo include ancora. Per accenderlo su una pagina basta una
riga prima di `</body>`:

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
