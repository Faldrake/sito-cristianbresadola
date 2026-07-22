/* ============================================================
 * Widget Ildegarda · v1
 * ============================================================
 * Assistente AI di Cristian Bresadola, prodotta da NosLab S.a.s.
 *
 * Inserimento: <script src="/ildegarda-widget.js" defer></script>
 * Nessuna dipendenza, nessuna chiave: la Edge Function ildegarda-chat
 * ha verify_jwt = false ed e' chiamabile senza autenticazione.
 *
 * NOTA CORS: la funzione accetta solo cristianbresadola.com e
 * www.cristianbresadola.com. Da localhost o da un deploy preview
 * risponde 403 origin_non_consentita: e' atteso, non e' un bug del widget.
 *
 * Il markup vive in uno shadow root: gli stili del sito non lo toccano
 * e lui non tocca quelli del sito.
 * ============================================================ */

(function () {
  'use strict';

  if (window.__ildegardaWidget) return;
  window.__ildegardaWidget = true;

  var ENDPOINT = 'https://okasxfvoyihovohlaypz.supabase.co/functions/v1/ildegarda-chat';
  var ENDPOINT_HANDOFF = 'https://okasxfvoyihovohlaypz.supabase.co/functions/v1/ildegarda-handoff';
  var STORAGE = 'https://okasxfvoyihovohlaypz.supabase.co/storage/v1/object/public/assets/ildegarda/';
  var AVATAR = STORAGE + 'ildegarda-avatar.webp';
  var SFONDO = STORAGE + 'ildegarda-sfondo-pannello.webp';

  var K_SESSION = 'ildegarda_session_id';
  var K_CONSENSO = 'ildegarda_consenso';

  // Nota di apertura, non è Ildegarda che parla.
  //
  // Qui prima c'era il saluto in 4 step della sezione 3 del system prompt,
  // mostrato staticamente. Sembrava gratis, ma produceva una presentazione
  // doppia: il saluto statico non entra nello storico che il backend
  // ricostruisce dal database, quindi per il modello il primo messaggio
  // dell'utente resta il primo turno e lui si presenta di nuovo.
  // Meglio lasciare che sia Ildegarda ad aprire, con parole sue, nella sua
  // prima risposta vera.
  var APERTURA = 'Scrivi la tua domanda: Ildegarda ti risponde qui.';

  function leggi(chiave) {
    try { return window.localStorage.getItem(chiave); } catch (e) { return null; }
  }
  function scrivi(chiave, valore) {
    try { window.localStorage.setItem(chiave, valore); } catch (e) { /* storage negato */ }
  }

  function sessionId() {
    var id = leggi(K_SESSION);
    if (id) return id;
    if (window.crypto && window.crypto.randomUUID) {
      id = window.crypto.randomUUID();
    } else {
      id = 'sid-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
    scrivi(K_SESSION, id);
    return id;
  }

  var CSS = [
    ':host { all: initial; }',
    '*, *::before, *::after { box-sizing: border-box; }',
    ':host {',
    '  --petrol: #1B3A3E; --petrol-dark: #12282B; --ivory: #EEF3F6;',
    '  --frost: #DBE7EC; --charcoal: #2A2A2A; --charcoal-soft: #4A4A4A;',
    '  --salt-glow: #E59856; --sage: #8A9B86;',
    '  --display: \'Fraunces\',\'Iowan Old Style\',Georgia,serif;',
    '  --body: \'DM Sans\',system-ui,-apple-system,\'Segoe UI\',sans-serif;',
    '  position: fixed; left: 0; bottom: 0; z-index: 2147483000;',
    '  font-family: var(--body);',
    '}',

    /* bolla */
    '.bolla {',
    '  position: fixed; left: 24px; bottom: 24px;',
    '  width: 60px; height: 60px; border-radius: 50%;',
    '  border: 1px solid rgba(255,255,255,.35); padding: 0; margin: 0;',
    '  background: var(--petrol); cursor: pointer; overflow: hidden;',
    '  box-shadow: 0 6px 24px rgba(27,58,62,.32);',
    '  transition: transform .22s ease, box-shadow .22s ease;',
    '}',
    '.bolla:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(27,58,62,.42); }',
    '.bolla:focus-visible { outline: 2px solid var(--salt-glow); outline-offset: 3px; }',
    '.bolla img { width: 100%; height: 100%; object-fit: cover; display: block; }',
    '.bolla[hidden] { display: none; }',

    /* pannello */
    '.pannello {',
    '  position: fixed; left: 24px; bottom: 24px;',
    '  width: 380px; max-width: calc(100vw - 32px);',
    '  height: 560px; max-height: calc(100vh - 48px);',
    // dvh segue l'area davvero visibile: serve al telefono in orizzontale, che
    // essendo largo piu' di 600px non ricade nella regola mobile qui sotto.
    // I browser che non lo conoscono ignorano la riga e tengono quella sopra.
    '  max-height: calc(100dvh - 48px);',
    '  display: flex; flex-direction: column; overflow: hidden;',
    '  background: var(--ivory); border-radius: 14px;',
    '  border: 1px solid rgba(27,58,62,.14);',
    '  box-shadow: 0 18px 60px rgba(18,40,43,.28);',
    '  opacity: 0; transform: translateY(12px) scale(.98);',
    '  transition: opacity .2s ease, transform .2s ease;',
    '}',
    '.pannello[hidden] { display: none; }',
    '.pannello.aperto { opacity: 1; transform: none; }',

    '.testata {',
    '  display: flex; align-items: center; gap: 11px;',
    '  padding: 14px 14px 14px 16px; background: var(--petrol); color: #fff;',
    '}',
    '.testata img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex: none; }',
    '.titoli { flex: 1; min-width: 0; }',
    '.titoli strong {',
    '  display: block; font-family: var(--display); font-weight: 600;',
    '  font-size: 17px; letter-spacing: .01em;',
    '}',
    '.titoli span {',
    '  display: block; font-size: 11.5px; opacity: .82; margin-top: 1px;',
    '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '}',
    '.chiudi {',
    '  flex: none; width: 30px; height: 30px; border-radius: 50%;',
    '  border: 0; background: rgba(255,255,255,.12); color: #fff;',
    '  cursor: pointer; font-size: 17px; line-height: 1; padding: 0;',
    '}',
    '.chiudi:hover { background: rgba(255,255,255,.22); }',
    '.chiudi:focus-visible { outline: 2px solid var(--salt-glow); outline-offset: 2px; }',

    '.corpo {',
    '  flex: 1; overflow-y: auto; padding: 16px 14px; position: relative;',
    '  display: flex; flex-direction: column; gap: 10px;',
    '  background-color: var(--ivory);',
    // senza questo, arrivati in fondo alla chat su mobile si trascina la pagina sotto
    '  overscroll-behavior: contain;',
    '}',
    '.corpo::before {',
    '  content: \'\'; position: absolute; inset: 0; pointer-events: none;',
    '  background-image: var(--sfondo); background-size: cover;',
    '  background-position: center; opacity: .07;',
    '}',
    '.riga { position: relative; display: flex; }',
    '.riga.mia { justify-content: flex-end; }',
    '.bolla-msg {',
    '  max-width: 84%; padding: 10px 13px; border-radius: 12px;',
    '  font-size: 14.5px; line-height: 1.55; white-space: pre-wrap;',
    '  overflow-wrap: anywhere;',
    '}',
    '.riga.sua .bolla-msg {',
    '  background: #fff; color: var(--charcoal);',
    '  border: 1px solid rgba(27,58,62,.12); border-bottom-left-radius: 4px;',
    '}',
    '.riga.mia .bolla-msg {',
    '  background: var(--petrol); color: #fff; border-bottom-right-radius: 4px;',
    '}',
    '.riga.avviso .bolla-msg {',
    '  background: var(--frost); color: var(--charcoal-soft);',
    '  border: 1px solid rgba(27,58,62,.14); font-size: 13.5px; max-width: 100%;',
    '}',

    '.pensa { position: relative; display: flex; gap: 4px; padding: 4px 2px; }',
    '.pensa span {',
    '  width: 6px; height: 6px; border-radius: 50%; background: var(--sage);',
    '  animation: batti 1.1s infinite ease-in-out;',
    '}',
    '.pensa span:nth-child(2) { animation-delay: .16s; }',
    '.pensa span:nth-child(3) { animation-delay: .32s; }',
    '@keyframes batti { 0%,80%,100% { opacity:.3; } 40% { opacity:1; } }',

    /* consenso */
    '.consenso {',
    '  position: relative; margin: 0; padding: 14px;',
    '  background: #fff; border: 1px solid rgba(27,58,62,.14); border-radius: 12px;',
    '  font-size: 13.5px; line-height: 1.6; color: var(--charcoal-soft);',
    '}',
    '.consenso p { margin: 0 0 10px; }',
    '.consenso a { color: var(--petrol); text-decoration: underline; }',
    '.consenso button {',
    '  width: 100%; padding: 9px 14px; border: 0; border-radius: 8px;',
    '  background: var(--petrol); color: #fff; font-family: var(--body);',
    '  font-size: 14px; cursor: pointer;',
    '}',
    '.consenso button:hover { background: var(--petrol-dark); }',
    '.consenso button:focus-visible { outline: 2px solid var(--salt-glow); outline-offset: 2px; }',

    /* modulo per farsi ricontattare */
    '.modulo { position: relative; }',
    '.modulo label {',
    '  display: block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase;',
    '  color: var(--charcoal-soft); margin: 0 0 3px;',
    '}',
    '.modulo input, .modulo textarea {',
    '  width: 100%; padding: 8px 10px; margin-bottom: 9px;',
    '  border: 1px solid rgba(27,58,62,.2); border-radius: 7px;',
    '  font-family: var(--body); font-size: 15px; color: var(--charcoal); background: #fff;',
    '}',
    '.modulo textarea { resize: vertical; min-height: 58px; line-height: 1.45; }',
    '.modulo input:focus, .modulo textarea:focus { outline: none; border-color: var(--petrol); }',
    // La riga del consenso e' un <label> come le etichette dei campi, ma non
    // deve ereditarne il maiuscoletto: un consenso GDPR va letto, non gridato.
    '.modulo .consenso-riga {',
    '  display: flex; gap: 8px; align-items: flex-start;',
    '  text-transform: none; letter-spacing: normal;',
    '  font-size: 13.5px; line-height: 1.5; color: var(--charcoal);',
    '  margin: 4px 0 12px; cursor: pointer;',
    '}',
    '.modulo .consenso-riga input { width: auto; margin: 2px 0 0; flex: none; }',
    '.modulo .riga-bottoni { display: flex; gap: 8px; align-items: stretch; }',
    '.modulo .riga-bottoni button {',
    '  width: auto; padding: 10px 14px; border: 0; border-radius: 8px;',
    '  font-family: var(--body); font-size: 14px; line-height: 1.2; cursor: pointer;',
    '}',
    '.modulo .conferma { flex: 1 1 auto; background: var(--petrol); color: #fff; }',
    '.modulo .conferma:hover:not(:disabled) { background: var(--petrol-dark); }',
    '.modulo .conferma:disabled { opacity: .45; cursor: default; }',
    '.modulo .annulla { flex: 0 0 auto; background: transparent; color: var(--charcoal-soft); }',
    '.modulo .errore { color: #8B3A3A; font-size: 13px; margin: 0 0 8px; display: none; }',

    '.invito {',
    '  display: block; width: 100%; text-align: left; padding: 9px 12px;',
    '  border: 0; border-top: 1px solid rgba(27,58,62,.12); background: #fff;',
    '  font-family: var(--body); font-size: 13px; color: var(--petrol);',
    '  cursor: pointer; text-decoration: underline; text-underline-offset: 2px;',
    '}',
    '.invito:hover { background: var(--frost); }',
    '.invito[hidden] { display: none; }',

    '.piede { border-top: 1px solid rgba(27,58,62,.12); background: #fff; }',
    '.campo { display: flex; align-items: flex-end; gap: 8px; padding: 10px 10px 8px; }',
    '.campo textarea {',
    '  flex: 1; resize: none; border: 1px solid rgba(27,58,62,.2); border-radius: 9px;',
    '  padding: 9px 11px; font-family: var(--body); font-size: 14.5px;',
    '  line-height: 1.45; max-height: 110px; color: var(--charcoal); background: #fff;',
    '}',
    '.campo textarea:focus { outline: none; border-color: var(--petrol); }',
    '.campo textarea:disabled { background: #F4F7F9; color: var(--charcoal-soft); }',
    '.invia {',
    '  flex: none; width: 38px; height: 38px; border-radius: 9px; border: 0;',
    '  background: var(--petrol); color: #fff; cursor: pointer; padding: 0;',
    '  display: flex; align-items: center; justify-content: center;',
    '}',
    '.invia:hover:not(:disabled) { background: var(--petrol-dark); }',
    '.invia:disabled { opacity: .4; cursor: default; }',
    '.invia:focus-visible { outline: 2px solid var(--salt-glow); outline-offset: 2px; }',
    '.invia svg { width: 17px; height: 17px; display: block; }',
    '.nota {',
    '  padding: 0 12px 10px; margin: 0; font-size: 11px; line-height: 1.45;',
    '  color: var(--charcoal-soft); opacity: .85;',
    '}',

    // Su mobile niente vh: su telefono 100vh vale l'altezza CON la barra degli
    // indirizzi nascosta, quindi e' piu' alto dell'area visibile. Ancorato in
    // basso, il pannello sbordava dall'alto e sembrava gigante. Fissando sia
    // top sia bottom e' il browser a calcolare l'altezza, e segue l'area reale.
    '@media (max-width: 600px) {',
    '  .bolla { left: 16px; bottom: 16px; width: 54px; height: 54px; }',
    // Ripiego se visualViewport non c'e': pannello ancorato in basso che
    // occupa poco meno di tre quarti dello schermo, non tutto. Le misure
    // esatte le mette comunque il JS.
    '  .pannello {',
    '    left: 8px; right: 8px; top: auto; bottom: 8px;',
    '    width: auto; height: 72dvh; max-height: calc(100dvh - 16px);',
    '    border-radius: 12px;',
    '  }',
    // Safari su iPhone ingrandisce da solo la pagina quando il cursore entra in
    // un campo con testo sotto i 16px. Lo zoom scala tutto e spinge la testata
    // fuori dallo schermo. 16px esatti lo disinnescano: e' l'unica ragione per
    // cui qui la misura e' diversa dal resto.
    '  .campo textarea { font-size: 16px; }',
    // stessa ragione: anche i campi del modulo devono stare a 16px, o iOS zooma
    '  .modulo input, .modulo textarea { font-size: 16px; }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  .bolla, .pannello { transition: none; }',
    '  .pensa span { animation: none; opacity: .7; }',
    '}'
  ].join('\n');

  function costruisci() {
    var host = document.createElement('div');
    host.id = 'ildegarda-widget';
    var root = host.attachShadow({ mode: 'open' });

    var stile = document.createElement('style');
    stile.textContent = CSS;
    root.appendChild(stile);

    var wrap = document.createElement('div');
    wrap.innerHTML = [
      '<button class="bolla" type="button" aria-label="Apri la chat con Ildegarda">',
      '  <img alt="" src="' + AVATAR + '" width="60" height="60">',
      '</button>',
      '<section class="pannello" role="dialog" aria-modal="false" aria-label="Chat con Ildegarda" hidden>',
      '  <header class="testata">',
      '    <img alt="" src="' + AVATAR + '" width="38" height="38">',
      '    <span class="titoli">',
      '      <strong>Ildegarda</strong>',
      '      <span>Assistente AI di Cristian Bresadola</span>',
      '    </span>',
      '    <button class="chiudi" type="button" aria-label="Chiudi la chat">&#215;</button>',
      '  </header>',
      '  <div class="corpo" role="log" aria-live="polite" aria-relevant="additions"></div>',
      '  <div class="piede">',
      '    <button class="invito" type="button">Vuoi che Cristian ti ricontatti?</button>',
      '    <div class="campo">',
      '      <textarea rows="1" placeholder="Scrivi il tuo messaggio" aria-label="Il tuo messaggio"></textarea>',
      '      <button class="invia" type="button" aria-label="Invia il messaggio" disabled>',
      '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"',
      '             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '          <path d="M4 12h15M13 6l6 6-6 6"></path>',
      '        </svg>',
      '      </button>',
      '    </div>',
      '    <p class="nota">Ildegarda non sostituisce il parere medico. In caso di patologie, terapie in corso o gravidanza, senti il tuo medico.</p>',
      '  </div>',
      '</section>'
    ].join('\n');

    while (wrap.firstChild) root.appendChild(wrap.firstChild);
    document.body.appendChild(host);
    return root;
  }

  var root = costruisci();
  var bolla = root.querySelector('.bolla');
  var pannello = root.querySelector('.pannello');
  var chiudi = root.querySelector('.chiudi');
  var corpo = root.querySelector('.corpo');
  var testo = root.querySelector('textarea');
  var invia = root.querySelector('.invia');

  corpo.style.setProperty('--sfondo', 'url("' + SFONDO + '")');

  var inAttesa = false;
  var avviato = false;

  // ---- Adattamento all'area visibile reale (mobile) ----
  //
  // Su iPhone il viewport di layout non si restringe quando compare la
  // tastiera, e con la barra degli indirizzi visibile e' piu' alto di quel che
  // si vede. Un pannello ancorato con il solo CSS finisce quindi fuori dallo
  // schermo, di solito verso l'alto: sparisce la testata.
  //
  // visualViewport riporta l'area davvero visibile, tastiera compresa. Su
  // mobile posizioniamo il pannello con quei numeri; su desktop lasciamo fare
  // al CSS, togliendo gli stili inline.
  function suMobile() {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  function adattaAlViewport() {
    var vv = window.visualViewport;
    if (!vv || pannello.hidden) return;

    if (!suMobile()) {
      pannello.style.removeProperty('top');
      pannello.style.removeProperty('height');
      pannello.style.removeProperty('bottom');
      return;
    }

    // Il pannello non prende tutto lo schermo: sarebbe invadente e coprirebbe
    // il sito. Sta ancorato in basso e ne occupa poco meno di tre quarti,
    // lasciando vedere la pagina sopra.
    // Eccezione: quando l'area visibile e' gia' piccola perche' c'e' la
    // tastiera, lasciarne fuori un quarto non servirebbe a niente — la pagina
    // sotto non e' comunque raggiungibile — e la chat diventerebbe illeggibile.
    // In quel caso si prende tutto lo spazio disponibile.
    var margine = 8;
    var disponibile = vv.height - margine * 2;
    var altezza = vv.height < 520 ? disponibile : Math.round(vv.height * 0.72);
    altezza = Math.max(260, Math.min(altezza, disponibile));

    pannello.style.height = altezza + 'px';
    pannello.style.top = Math.round(vv.offsetTop + vv.height - altezza - margine) + 'px';
    pannello.style.bottom = 'auto';
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adattaAlViewport);
    window.visualViewport.addEventListener('scroll', adattaAlViewport);
  }
  window.addEventListener('orientationchange', function () {
    window.setTimeout(adattaAlViewport, 250);
  });

  function aggiungi(tipo, contenuto) {
    var riga = document.createElement('div');
    riga.className = 'riga ' + tipo;
    var b = document.createElement('div');
    b.className = 'bolla-msg';
    b.textContent = contenuto;
    riga.appendChild(b);
    corpo.appendChild(riga);
    corpo.scrollTop = corpo.scrollHeight;
    return riga;
  }

  function mostraPensa() {
    var riga = document.createElement('div');
    riga.className = 'riga sua';
    riga.innerHTML = '<div class="bolla-msg"><span class="pensa"><span></span><span></span><span></span></span></div>';
    corpo.appendChild(riga);
    corpo.scrollTop = corpo.scrollHeight;
    return riga;
  }

  // Consenso esplicito prima che qualunque dato finisca nel database.
  function chiediConsenso() {
    var box = document.createElement('div');
    box.className = 'consenso';
    box.innerHTML = [
      '<p>Prima di cominciare: le conversazioni con Ildegarda vengono conservate per ',
      'poter dare continuità allo scambio, e cancellate dopo 90 giorni dall’ultima ',
      'attività. Titolari del trattamento sono Cristian Bresadola e NosLab S.a.s. ',
      'Dettagli nella <a href="/privacy-policy" target="_blank" rel="noopener">privacy policy</a>.</p>',
      '<p>Non scrivere qui dati che non vuoi vengano conservati.</p>',
      '<button type="button">Ho capito, cominciamo</button>'
    ].join('');
    corpo.appendChild(box);
    box.querySelector('button').addEventListener('click', function () {
      scrivi(K_CONSENSO, new Date().toISOString());
      box.remove();
      abilita();
      aggiungi('avviso', APERTURA);
      testo.focus();
    });
    corpo.scrollTop = corpo.scrollHeight;
  }

  function abilita() {
    testo.disabled = false;
    aggiornaInvia();
  }

  function aggiornaInvia() {
    invia.disabled = inAttesa || testo.disabled || testo.value.trim() === '';
  }

  function apri() {
    pannello.hidden = false;
    bolla.hidden = true;
    adattaAlViewport();
    // forza il reflow perche' la transizione parta dallo stato iniziale
    void pannello.offsetWidth;
    pannello.classList.add('aperto');

    if (!avviato) {
      avviato = true;
      if (leggi(K_CONSENSO)) {
        abilita();
        aggiungi('avviso', APERTURA);
      } else {
        testo.disabled = true;
        aggiornaInvia();
        chiediConsenso();
      }
    }
    if (!testo.disabled) testo.focus();
  }

  function chiudiPannello() {
    pannello.classList.remove('aperto');
    window.setTimeout(function () {
      pannello.hidden = true;
      pannello.style.removeProperty('top');
      pannello.style.removeProperty('height');
      pannello.style.removeProperty('bottom');
      bolla.hidden = false;
      bolla.focus();
    }, 200);
  }

  function spedisci() {
    var messaggio = testo.value.trim();
    if (!messaggio || inAttesa) return;

    aggiungi('mia', messaggio);
    testo.value = '';
    testo.style.height = 'auto';
    inAttesa = true;
    aggiornaInvia();
    var attesa = mostraPensa();

    window.fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId(), message: messaggio })
    })
      .then(function (res) {
        return res.json().then(function (dati) { return { ok: res.ok, dati: dati }; });
      })
      .then(function (esito) {
        attesa.remove();
        if (esito.ok && esito.dati && esito.dati.reply) {
          aggiungi('sua', esito.dati.reply);
        } else {
          var codice = esito.dati && esito.dati.error;
          if (codice === 'origin_non_consentita') {
            console.warn('[Ildegarda] Origin non in allowlist: la chat risponde solo da cristianbresadola.com.');
          } else if (codice) {
            console.warn('[Ildegarda] La funzione ha risposto:', codice);
          }
          aggiungi('avviso', 'Non riesco a risponderti in questo momento. Se ti va, riprova ' +
            'fra poco, oppure scrivi a Cristian dalla pagina Contatti.');
        }
      })
      .catch(function (err) {
        attesa.remove();
        console.warn('[Ildegarda] Chiamata fallita:', err);
        aggiungi('avviso', 'La connessione non è riuscita. Controlla la rete e riprova, ' +
          'oppure scrivi a Cristian dalla pagina Contatti.');
      })
      .then(function () {
        inAttesa = false;
        aggiornaInvia();
        if (!testo.disabled) testo.focus();
      });
  }

  // ---- Passaggio di consegne a Cristian ----
  //
  // Il consenso non si deduce da quello che scrive Ildegarda: lo dà la persona
  // con un gesto suo, spuntando la casella e inviando il modulo. Per un
  // consenso su dati di salute l'inequivocabile vale più dell'elegante.
  var invito = root.querySelector('.invito');
  var moduloAperto = false;

  function apriModuloHandoff() {
    if (moduloAperto) return;
    moduloAperto = true;
    invito.hidden = true;

    var box = document.createElement('div');
    box.className = 'consenso modulo';
    box.innerHTML = [
      '<p style="margin-bottom:10px">Lascia un recapito: Cristian ti ricontatta di persona. ',
      'Quello che ci siamo detti qui gli arriva insieme al messaggio.</p>',
      '<p class="errore"></p>',
      '<label for="ho-nome">Come ti chiami</label>',
      '<input id="ho-nome" autocomplete="name">',
      '<label for="ho-recapito">Email o telefono</label>',
      '<input id="ho-recapito" autocomplete="email">',
      '<label for="ho-messaggio">Vuoi aggiungere qualcosa? (facoltativo)</label>',
      '<textarea id="ho-messaggio"></textarea>',
      '<label class="consenso-riga">',
      '  <input type="checkbox" id="ho-consenso">',
      '  <span>Acconsento a passare il mio nome, il mio recapito e questa conversazione ',
      '  a Cristian Bresadola, perché mi ricontatti.</span>',
      '</label>',
      '<div class="riga-bottoni">',
      '  <button type="button" class="conferma">Invia a Cristian</button>',
      '  <button type="button" class="annulla">Annulla</button>',
      '</div>'
    ].join('');
    corpo.appendChild(box);
    corpo.scrollTop = corpo.scrollHeight;
    box.querySelector('#ho-nome').focus();

    var errore = box.querySelector('.errore');
    var conferma = box.querySelector('.conferma');

    function chiudiModulo() {
      box.remove();
      moduloAperto = false;
      invito.hidden = false;
    }

    box.querySelector('.annulla').addEventListener('click', chiudiModulo);

    conferma.addEventListener('click', function () {
      var nome = box.querySelector('#ho-nome').value.trim();
      var recapito = box.querySelector('#ho-recapito').value.trim();
      var messaggio = box.querySelector('#ho-messaggio').value.trim();
      var consenso = box.querySelector('#ho-consenso').checked;

      function segnala(testo) {
        errore.textContent = testo;
        errore.style.display = 'block';
      }
      if (!nome || !recapito) { segnala('Servono il nome e un recapito.'); return; }
      if (!consenso) { segnala('Senza il tuo consenso non posso passare nulla a Cristian.'); return; }

      errore.style.display = 'none';
      conferma.disabled = true;
      conferma.textContent = 'Invio...';

      window.fetch(ENDPOINT_HANDOFF, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId(), nome: nome, recapito: recapito,
          messaggio: messaggio, consenso: true
        })
      })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
        .then(function (esito) {
          if (esito.ok && esito.d && esito.d.ok) {
            chiudiModulo();
            aggiungi('avviso', 'Fatto: ho passato il tuo recapito a Cristian. Ti ricontatta lui, ' +
              'appena può. Se nel frattempo ti viene in mente altro, scrivimi pure qui.');
          } else {
            conferma.disabled = false;
            conferma.textContent = 'Invia a Cristian';
            segnala('Non sono riuscita a inviare. Riprova fra poco, oppure scrivi a Cristian dalla pagina Contatti.');
          }
        })
        .catch(function (err) {
          console.warn('[Ildegarda] handoff fallito:', err);
          conferma.disabled = false;
          conferma.textContent = 'Invia a Cristian';
          segnala('La connessione non è riuscita. Riprova, oppure scrivi dalla pagina Contatti.');
        });
    });
  }

  invito.addEventListener('click', apriModuloHandoff);

  bolla.addEventListener('click', apri);
  chiudi.addEventListener('click', chiudiPannello);
  invia.addEventListener('click', spedisci);

  testo.addEventListener('input', function () {
    testo.style.height = 'auto';
    testo.style.height = Math.min(testo.scrollHeight, 110) + 'px';
    aggiornaInvia();
  });

  testo.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      spedisci();
    }
  });

  root.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !pannello.hidden) chiudiPannello();
  });
})();
