/*
 * Mappa a caricamento su richiesta.
 *
 * L'iframe di Google Maps non viene inserito nel documento finché la persona
 * non lo chiede esplicitamente. Prima, l'iframe stava nel markup statico e si
 * caricava al rendering della pagina: l'indirizzo IP finiva a Google e i suoi
 * cookie venivano installati senza che nessuno avesse scelto nulla.
 *
 * Il consenso NON viene ricordato di proposito: memorizzarlo richiederebbe a
 * sua volta uno storage soggetto a consenso, e la mappa si carica in un clic.
 */
(function () {
  'use strict';

  function caricaMappa(contenitore) {
    var src = contenitore.getAttribute('data-mappa-src');
    if (!src) return;

    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.minHeight = contenitore.style.minHeight || '360px';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.allowFullscreen = true;
    iframe.title = contenitore.getAttribute('data-mappa-titolo') || 'Mappa dello studio';

    contenitore.replaceWith(iframe);
  }

  document.addEventListener('click', function (e) {
    var bottone = e.target.closest ? e.target.closest('.mappa-consenso-btn') : null;
    if (!bottone) return;
    var contenitore = bottone.closest('.mappa-consenso');
    if (contenitore) caricaMappa(contenitore);
  });
})();
