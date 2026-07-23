/*!
 * noslab-badge - firma "Sito realizzato da NosLab S.a.s."
 * Web component autonomo. Zero dipendenze, zero richieste di rete, ES2019.
 *
 * Uso:
 *   <script defer src="noslab-badge.js"></script>
 *   <noslab-badge></noslab-badge>
 *
 * Attributi:
 *   theme = "light" | "dark" | "auto"   (default: auto, segue prefers-color-scheme)
 *   size  = "sm" | "md"                 (default: md)
 *   lang  = "it" | "en"                 (default: lang del documento, altrimenti it)
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.document) return;
  if (!window.customElements || !window.HTMLElement) return;
  if (window.customElements.get('noslab-badge')) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var HREF = 'https://noslab.it';
  var VIEWBOX = '21.51 84.85 523.91 397.24';

  /* --- marchio NosLab: 3 path, dati originali --------------------------- */
  var D_BODY =
    'M 475.171875 283.394531 L 475.171875 411.800781 L 373.269531 411.800781 ' +
    'L 373.269531 283.394531 C 373.269531 233.851562 332.945312 193.578125 283.40625 193.578125 ' +
    'C 233.863281 193.578125 193.585938 233.851562 193.585938 283.394531 L 193.585938 475.164062 ' +
    'L 91.6875 475.164062 L 91.6875 283.394531 C 91.6875 177.515625 177.527344 91.679688 283.40625 91.679688 ' +
    'C 389.332031 91.679688 475.171875 177.515625 475.171875 283.394531';
  var D_DOT =
    'M 74.226562 475.164062 L 28.34375 475.164062 L 28.34375 429.28125 L 74.226562 429.28125 Z ' +
    'M 74.226562 475.164062';
  var D_BAR =
    'M 538.515625 429.300781 L 211.042969 429.300781 L 211.042969 475.179688 L 538.515625 475.179688 Z ' +
    'M 538.515625 429.300781';

  /* --- testi ------------------------------------------------------------ */
  var STRINGS = {
    it: {
      eyebrow: 'Sito realizzato da',
      name: 'NosLab S.a.s.',
      payoff: 'bottega digitale alpina',
      sr: '(si apre in una nuova scheda)'
    },
    en: {
      eyebrow: 'Website built by',
      name: 'NosLab S.a.s.',
      payoff: 'alpine digital workshop',
      sr: '(opens in a new tab)'
    }
  };

  /* --- CSS (isolato nel shadow root) ------------------------------------ */
  var CSS = [
    /* Il :host dichiara TUTTO cio' che e' ereditabile, perche' le proprieta' */
    /* ereditate attraversano il confine dello shadow DOM: sono l'unica via   */
    /* di contaminazione. Dentro lo shadow tree NON si usa mai `inherit` per  */
    /* il font: le dichiarazioni dell'albero esterno vincono su :host.        */
    ':host{',
    'display:inline-block;box-sizing:border-box;',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
    'font-size:16px;font-weight:400;font-style:normal;font-variant:normal;',
    'line-height:1.25;letter-spacing:normal;word-spacing:normal;',
    'text-transform:none;text-align:left;text-indent:0;text-shadow:none;',
    'white-space:normal;direction:ltr;',
    '-webkit-text-size-adjust:100%;-webkit-font-smoothing:antialiased;',
    'color:#202139;',
    /* palette chiara (default) */
    '--nslb-green:#87CF3B;',      /* grafica SVG: sempre verde ufficiale */
    '--nslb-hi:#436B1A;',         /* TESTO/anello: verde scurito su chiaro */
    '--nslb-fg:#202139;',
    '--nslb-muted:#55566d;',
    '--nslb-mark:#202139;',
    '--nslb-border:rgba(32,33,57,.16);',
    '--nslb-border-hi:rgba(67,107,26,.75);',
    '--nslb-bg-hi:rgba(67,107,26,.07);',
    /* dimensioni: md */
    '--nslb-mark-h:26px;--nslb-gap:10px;--nslb-pad:8px 12px;--nslb-radius:10px;',
    '--nslb-fs-eyebrow:9.5px;--nslb-fs-name:13px;--nslb-fs-payoff:11px;',
    '}',
    ':host([hidden]){display:none;}',

    /* dimensioni: sm */
    ':host([size="sm"]){',
    '--nslb-mark-h:20px;--nslb-gap:8px;--nslb-pad:6px 10px;--nslb-radius:8px;',
    '--nslb-fs-eyebrow:8.5px;--nslb-fs-name:11.5px;--nslb-fs-payoff:10px;',
    '}',

    /* palette scura: esplicita */
    ':host([theme="dark"]){',
    'color:#F4F2EC;',
    '--nslb-hi:#87CF3B;',
    '--nslb-fg:#F4F2EC;',
    '--nslb-muted:#b8b6c6;',
    '--nslb-mark:#F4F2EC;',
    '--nslb-border:rgba(244,242,236,.20);',
    '--nslb-border-hi:rgba(135,207,59,.85);',
    '--nslb-bg-hi:rgba(135,207,59,.13);',
    '}',
    /* palette scura: automatica (theme assente, "auto" o valore non valido) */
    '@media (prefers-color-scheme:dark){',
    ':host(:not([theme="light"]):not([theme="dark"])){',
    'color:#F4F2EC;',
    '--nslb-hi:#87CF3B;',
    '--nslb-fg:#F4F2EC;',
    '--nslb-muted:#b8b6c6;',
    '--nslb-mark:#F4F2EC;',
    '--nslb-border:rgba(244,242,236,.20);',
    '--nslb-border-hi:rgba(135,207,59,.85);',
    '--nslb-bg-hi:rgba(135,207,59,.13);',
    '}}',

    /* --- blocco ------------------------------------------------------- */
    '.nslb-link{',
    'position:relative;display:inline-flex;align-items:center;',
    'box-sizing:border-box;max-width:100%;',
    'margin:0;padding:var(--nslb-pad);',
    'border:1px solid var(--nslb-border);border-radius:var(--nslb-radius);',
    'background-color:transparent;background-image:none;',
    'color:var(--nslb-fg);text-decoration:none;',
    /* font dichiarato, MAI ereditato dal confine dello shadow DOM */
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;',
    'font-size:13px;font-weight:400;font-style:normal;',
    'line-height:1.25;letter-spacing:normal;text-transform:none;',
    'cursor:pointer;-webkit-tap-highlight-color:transparent;',
    'transition:transform .18s ease,border-color .18s ease,background-color .18s ease;',
    '}',

    '.nslb-mark{',
    'display:block;flex:0 0 auto;',
    'height:var(--nslb-mark-h);width:auto;max-width:none;',
    'margin:0 var(--nslb-gap) 0 0;',      /* niente gap: Safari < 14.1 */
    'opacity:.55;transition:opacity .18s ease;',
    '}',
    '.nslb-body{fill:var(--nslb-mark);}',
    '.nslb-accent{fill:var(--nslb-mark);transition:fill .18s ease;}',

    '.nslb-txt{display:flex;flex-direction:column;min-width:0;margin:0;padding:0;}',
    '.nslb-eyebrow{',
    'display:block;margin:0;padding:0;',
    'font-family:inherit;font-size:var(--nslb-fs-eyebrow);font-weight:600;font-style:normal;',
    'letter-spacing:.14em;text-transform:uppercase;line-height:1.15;',
    'color:var(--nslb-muted);',
    '}',
    '.nslb-name{',
    'display:block;margin:1px 0 0;padding:0;',
    'font-family:inherit;font-size:var(--nslb-fs-name);font-weight:600;font-style:normal;',
    'letter-spacing:.005em;line-height:1.2;color:var(--nslb-fg);',
    'transition:color .18s ease;',
    '}',
    '.nslb-payoff{',
    'display:block;margin:1px 0 0;padding:0;',
    'font-family:Georgia,"Times New Roman",Times,serif;font-style:italic;font-weight:400;',
    'font-size:var(--nslb-fs-payoff);line-height:1.25;letter-spacing:normal;',
    'color:var(--nslb-muted);',
    '}',

    /* testo per screen reader */
    '.nslb-sr{',
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;border:0;',
    'overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;',
    '}',

    /* --- stato attivo: hover ------------------------------------------ */
    '@media (hover:hover){',
    '.nslb-link:hover{',
    'transform:translateY(-2px);',
    'border-color:var(--nslb-border-hi);',
    'background-color:var(--nslb-bg-hi);',
    '}',
    '.nslb-link:hover .nslb-mark{opacity:1;}',
    '.nslb-link:hover .nslb-accent{fill:var(--nslb-green);}',
    '.nslb-link:hover .nslb-name{color:var(--nslb-hi);}',
    '}',

    /* --- stato attivo: focus da tastiera ------------------------------ */
    /* :focus come base (browser senza :focus-visible), poi si affina */
    '.nslb-link:focus{',
    'outline:2px solid var(--nslb-hi);outline-offset:3px;',
    'border-color:var(--nslb-border-hi);background-color:var(--nslb-bg-hi);',
    'transform:translateY(-2px);',
    '}',
    '.nslb-link:focus .nslb-mark{opacity:1;}',
    '.nslb-link:focus .nslb-accent{fill:var(--nslb-green);}',
    '.nslb-link:focus .nslb-name{color:var(--nslb-hi);}',
    /* se il browser conosce :focus-visible, il click col mouse non evidenzia */
    '.nslb-link:focus:not(:focus-visible){',
    'outline:none;border-color:var(--nslb-border);background-color:transparent;',
    'transform:none;',
    '}',
    '.nslb-link:focus:not(:focus-visible) .nslb-mark{opacity:.55;}',
    '.nslb-link:focus:not(:focus-visible) .nslb-accent{fill:var(--nslb-mark);}',
    '.nslb-link:focus:not(:focus-visible) .nslb-name{color:var(--nslb-fg);}',

    '.nslb-link:active{transform:translateY(0);}',

    /* --- accessibilita' motoria/visiva --------------------------------- */
    '@media (prefers-reduced-motion:reduce){',
    '.nslb-link,.nslb-mark,.nslb-accent,.nslb-name{transition:none;}',
    '.nslb-link:hover,.nslb-link:focus,.nslb-link:active{transform:none;}',
    '}',
    '@media (forced-colors:active){',
    '.nslb-link{border-color:CanvasText;}',
    '.nslb-body,.nslb-accent{fill:CanvasText;}',
    '.nslb-name,.nslb-eyebrow,.nslb-payoff{color:LinkText;}',
    '.nslb-mark{opacity:1;}',
    '.nslb-link:hover .nslb-accent,.nslb-link:focus .nslb-accent{fill:CanvasText;}',
    '.nslb-link:hover .nslb-name,.nslb-link:focus .nslb-name{color:LinkText;}',
    '}'
  ].join('');

  /* --- foglio di stile condiviso ---------------------------------------- */
  /* Constructable stylesheet quando disponibile: nessun elemento <style>    */
  /* inserito nel DOM, quindi compatibile anche con CSP senza 'unsafe-inline'*/
  /* per style-src. Fallback su <style> per i browser piu' vecchi.           */
  var sharedSheet;
  function getSheet() {
    if (sharedSheet !== undefined) return sharedSheet;
    sharedSheet = null;
    try {
      if (typeof CSSStyleSheet === 'function' && CSSStyleSheet.prototype.replaceSync) {
        var s = new CSSStyleSheet();
        s.replaceSync(CSS);
        sharedSheet = s;
      }
    } catch (e) {
      sharedSheet = null;
    }
    return sharedSheet;
  }

  /* --- helper DOM (niente innerHTML: ok anche con Trusted Types) --------- */
  function h(tag, cls, part) {
    var n = document.createElement(tag);
    if (cls) n.setAttribute('class', cls);
    if (part) n.setAttribute('part', part);
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    }
    return n;
  }
  function normLang(value) {
    if (!value) return null;
    var v = String(value).toLowerCase();
    if (v.indexOf('en') === 0) return 'en';
    if (v.indexOf('it') === 0) return 'it';
    return null;
  }

  /* --- il custom element ------------------------------------------------ */
  function NosLabBadge() {
    var self = Reflect.construct(HTMLElement, [], NosLabBadge);
    self._built = false;
    self._nodes = null;
    self._root = self.attachShadow({ mode: 'open' });
    return self;
  }
  NosLabBadge.prototype = Object.create(HTMLElement.prototype);
  NosLabBadge.prototype.constructor = NosLabBadge;
  Object.setPrototypeOf(NosLabBadge, HTMLElement);

  Object.defineProperty(NosLabBadge, 'observedAttributes', {
    get: function () { return ['lang']; }
  });

  NosLabBadge.prototype.connectedCallback = function () {
    this._build();
    this._applyLang();
  };

  NosLabBadge.prototype.attributeChangedCallback = function (name) {
    if (name === 'lang' && this._built) this._applyLang();
  };

  NosLabBadge.prototype._build = function () {
    if (this._built) return;
    this._built = true;

    var root = this._root;
    var sheet = getSheet();
    if (sheet && 'adoptedStyleSheets' in root) {
      root.adoptedStyleSheets = [sheet];
    } else {
      var style = document.createElement('style');
      style.textContent = CSS;
      root.appendChild(style);
    }

    var link = h('a', 'nslb-link', 'link');
    link.setAttribute('href', HREF);
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener');

    var mark = svg('svg', {
      'class': 'nslb-mark',
      part: 'mark',
      viewBox: VIEWBOX,
      xmlns: SVG_NS,
      'aria-hidden': 'true',
      focusable: 'false',
      role: 'presentation'
    });
    mark.appendChild(svg('path', { 'class': 'nslb-body', d: D_BODY }));
    mark.appendChild(svg('path', { 'class': 'nslb-accent', d: D_DOT }));
    mark.appendChild(svg('path', { 'class': 'nslb-accent', d: D_BAR }));

    var txt = h('span', 'nslb-txt');
    var eyebrow = h('span', 'nslb-eyebrow', 'eyebrow');
    var name = h('span', 'nslb-name', 'name');
    var payoff = h('span', 'nslb-payoff', 'payoff');
    txt.appendChild(eyebrow);
    txt.appendChild(name);
    txt.appendChild(payoff);

    var sr = h('span', 'nslb-sr');

    link.appendChild(mark);
    link.appendChild(txt);
    link.appendChild(sr);
    root.appendChild(link);

    /* NOTA: nessuno <slot> nel shadow root. Cosi' l'eventuale contenuto di
       fallback presente nel light DOM sparisce automaticamente appena il
       componente si registra, senza sfarfallio e senza doppioni. */

    this._nodes = {
      link: link, eyebrow: eyebrow, name: name, payoff: payoff, sr: sr
    };
  };

  NosLabBadge.prototype._applyLang = function () {
    var code =
      normLang(this.getAttribute('lang')) ||
      normLang(document.documentElement && document.documentElement.getAttribute('lang')) ||
      'it';
    var t = STRINGS[code];
    var n = this._nodes;
    if (!n) return;
    n.eyebrow.textContent = t.eyebrow;
    n.name.textContent = t.name;
    n.payoff.textContent = t.payoff;
    n.sr.textContent = ' ' + t.sr;
    /* NIENTE attributo title: duplicherebbe il nome accessibile gia' dato dal
       contenuto testuale e verrebbe letto due volte dagli screen reader. */
    n.link.setAttribute('lang', code);
  };

  window.customElements.define('noslab-badge', NosLabBadge);
})();
