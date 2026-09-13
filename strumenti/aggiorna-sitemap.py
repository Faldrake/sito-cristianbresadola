#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Aggiorna le date <lastmod> del sitemap prendendole dalla storia di git.

    python strumenti/aggiorna-sitemap.py            # mostra cosa cambierebbe
    python strumenti/aggiorna-sitemap.py --scrivi   # scrive davvero

PERCHE' ESISTE. Il 28/08/2026 quattordici lastmod su sedici dicevano «non
cambiata dal 9 agosto», mentre il giorno prima erano state toccate quattordici
pagine: il giorno dello studio passato da mercoledi' a martedi', e la Val di Sole
aggiunta. Cioe' proprio le cose che una persona cerca. A Google si stava dicendo
di non ripassare esattamente sulle pagine che erano cambiate.

Non e' un difetto di distrazione: e' che aggiornare a mano sedici date dopo ogni
modifica non lo fa nessuno, per sempre. Meglio una riga di comando.

DUE REGOLE, e sono il motivo per cui questo script e' corto:

 1. MAI ALL'INDIETRO. Se il sitemap dice una data piu' recente di quella dell'
    ultimo commit, si lascia stare. Una data spostata indietro e' una bugia
    nell'altro verso, e non c'e' ragione di dirla.

 2. NON INVENTA VOCI. Aggiorna solo le <url> che ci sono gia'. Aggiungere o
    togliere pagine dal sitemap e' una decisione, non un'operazione meccanica,
    e questo script non la prende.

    UNA decisione pero' e' stata presa, il 02/09/2026, e sta qui codificata:
    le 260 pagine del Kin del Cuore (kin/<tono>-<glifo>.html, generate da
    strumenti/genera-kin.mjs) entrano nel blocco KIN-DINAMICO, rigenerato a
    ogni corsa dai file che ESISTONO su disco in kin/. Non dal database e non
    da un elenco scritto a mano: se una pagina c'e' si indicizza, se sparisce
    esce dal sitemap da sola. L'indirizzo e' quello «pulito» (/kin/9-ix, senza
    .html), lo stesso del canonical e dell'og:url dentro la pagina: quando i
    due divergono, il primo a non essere creduto e' il nostro. Il lastmod e'
    l'ultimo commit del file, con la regola 1 che vale anche qui.

    IL CERCHIO DEL DRUIDO NON PASSA PIU' DA QUI (13/09/2026). Dal 30/08 questo
    script rigenerava anche un blocco CERCHIO-DINAMICO con gli articoli
    pubblicati, letti dal database. Ma un articolo esce da Arkana quando
    Cristian lo pubblica, e nel sitemap entrava solo se dopo qualcuno lanciava
    questo script: il blocco e' rimasto vuoto dal primo articolo (2/09) fino
    al 13/09. Adesso la vetrina del Cerchio e i suoi articoli stanno in
    /sitemap-cerchio.xml, che la funzione sul bordo
    netlify/edge-functions/sitemap-cerchio.ts scrive a ogni richiesta, ed e'
    dichiarata in robots.txt. Qui non vanno rimessi.

    Resta qui UNA cosa sola del Cerchio (revisione di A8, 13/09/2026): la data
    dell'ultimo commit di cerchio-del-druido/index.html. La funzione sa quando
    e' uscito l'ultimo articolo, ma non quando si e' toccata la vetrina (la
    descrizione, le schede statiche, le categorie): senza questa data il
    lastmod della vetrina tornava indietro di due giorni e poi non si muoveva
    piu'. Lo script la scrive nella costante VETRINA_FILE della funzione, con
    la regola 1: mai all'indietro.

Quando lanciarlo: prima di pubblicare, se sono state toccate delle pagine. Vedi
la sezione «Il push NON pubblica» del README.

Questo file sta in un repo pubblico e non contiene niente di riservato: legge la
storia di git e riscrive un file che e' gia' servito a tutti.
"""

import io
import os
import re
import subprocess
import sys

# Gli indirizzi che non corrispondono a un file con lo stesso nome. (La
# vetrina del Cerchio del Druido non c'e' piu': sta in /sitemap-cerchio.xml.)
MAPPA = {
    'https://cristianbresadola.com/': 'index.html',
}

SITEMAP = 'sitemap.xml'

# La data del file della vetrina del Cerchio, che vive nella funzione sul bordo.
FUNZIONE_CERCHIO = 'netlify/edge-functions/sitemap-cerchio.ts'
FILE_VETRINA = 'cerchio-del-druido/index.html'
COSTANTE_VETRINA = re.compile(r'^const VETRINA_FILE = "(\d{4}-\d{2}-\d{2})";', re.M)

# Il blocco delle pagine del Kin del Cuore: comanda la cartella kin/ su disco.
CARTELLA_KIN = 'kin'
INIZIO_KIN = '  <!-- KIN-DINAMICO inizio: le pagine del Kin del Cuore, blocco rigenerato da strumenti/aggiorna-sitemap.py -->'
FINE_KIN = '  <!-- KIN-DINAMICO fine -->'


def pagine_kin():
    """Le pagine del Kin presenti su disco, [(slug, lastmod)], in ordine di nome."""
    if not os.path.isdir(CARTELLA_KIN):
        return []
    voci = []
    for nome in sorted(os.listdir(CARTELLA_KIN)):
        if not nome.endswith('.html'):
            continue
        percorso = CARTELLA_KIN + '/' + nome
        voci.append((nome[:-5], ultimo_commit(percorso)))
    return voci


def blocco_kin(voci):
    righe = [INIZIO_KIN]
    for slug, quando in voci:
        righe.append('  <url>')
        righe.append('    <loc>https://cristianbresadola.com/kin/%s</loc>' % slug)
        if quando:
            righe.append('    <lastmod>%s</lastmod>' % quando)
        righe.append('    <changefreq>yearly</changefreq>')
        righe.append('    <priority>0.5</priority>')
        righe.append('  </url>')
    righe.append(FINE_KIN)
    return '\n'.join(righe)


def aggiorna_kin(testo):
    """Sostituisce (o inserisce) il blocco KIN. Torna (testo, quante_voci)."""
    voci = pagine_kin()
    blocco = blocco_kin(voci)
    if INIZIO_KIN in testo and FINE_KIN in testo:
        vecchio = re.search(re.escape(INIZIO_KIN) + '.*?' + re.escape(FINE_KIN), testo, re.S).group(0)
        # Regola 1 anche qui: una voce che nel sitemap ha gia' una data piu'
        # avanti di git (non dovrebbe succedere, ma il file e' scritto a mano
        # da chiunque) non torna indietro.
        for slug, quando in voci:
            m = re.search(r'<loc>https://cristianbresadola\.com/kin/%s</loc>\s*<lastmod>([^<]+)</lastmod>' % re.escape(slug), vecchio)
            if m and quando and m.group(1)[:10] > quando:
                blocco = blocco.replace('/kin/%s</loc>\n    <lastmod>%s</lastmod>' % (slug, quando),
                                        '/kin/%s</loc>\n    <lastmod>%s</lastmod>' % (slug, m.group(1)))
        nuovo = testo.replace(vecchio, blocco)
    else:
        nuovo = testo.replace('</urlset>', blocco + '\n</urlset>')
    return nuovo, len(voci)


def aggiorna_vetrina_cerchio():
    """La costante VETRINA_FILE della funzione. Torna (testo, prima, dopo), o None se resta com'e'."""
    if not os.path.exists(FUNZIONE_CERCHIO):
        print('  ATTENZIONE  %s: non lo trovo, data della vetrina del Cerchio lasciata com\'era' % FUNZIONE_CERCHIO)
        return None
    testo = io.open(FUNZIONE_CERCHIO, encoding='utf-8', newline='').read()
    m = COSTANTE_VETRINA.search(testo)
    if not m:
        print('  ATTENZIONE  %s: non trovo la riga const VETRINA_FILE = "AAAA-MM-GG", data della vetrina lasciata com\'era' % FUNZIONE_CERCHIO)
        return None
    vera = ultimo_commit(FILE_VETRINA)
    scritta = m.group(1)
    if not vera or vera <= scritta:
        return None     # regola 1: mai all'indietro
    return testo[:m.start(1)] + vera + testo[m.end(1):], scritta, vera


def ultimo_commit(percorso):
    """La data dell'ultimo commit che ha toccato quel file, in formato ISO."""
    r = subprocess.run(
        ['git', 'log', '-1', '--format=%ad', '--date=short', '--', percorso],
        capture_output=True, text=True,
    )
    return r.stdout.strip()


def main():
    scrivi = '--scrivi' in sys.argv

    if not os.path.exists(SITEMAP):
        print('Non trovo %s. Lanciarlo dalla radice del repo.' % SITEMAP)
        return 1

    # newline='' per non toccare le fini riga: questo repo e' CRLF.
    testo = io.open(SITEMAP, encoding='utf-8', newline='').read()
    nuovo = testo
    cambi, saltate, mancanti = [], [], []

    for blocco in re.findall(r'<url>.*?</url>', testo, re.S):
        loc = re.search(r'<loc>([^<]+)</loc>', blocco)
        lastmod = re.search(r'<lastmod>([^<]+)</lastmod>', blocco)
        if not loc or not lastmod:
            continue

        indirizzo = loc.group(1)
        # Le pagine del Kin non si guardano una per una: l'indirizzo e' pulito
        # (senza .html) e il blocco si rigenera per intero dalla cartella,
        # piu' sotto.
        if 'cristianbresadola.com/kin/' in indirizzo:
            continue
        percorso = MAPPA.get(indirizzo) or indirizzo.replace('https://cristianbresadola.com/', '')

        if not os.path.exists(percorso):
            mancanti.append((indirizzo, percorso))
            continue

        vera = ultimo_commit(percorso)
        scritta = lastmod.group(1)[:10]

        if not vera:
            mancanti.append((indirizzo, percorso + ' (mai committato)'))
            continue
        if vera <= scritta:
            saltate.append((percorso, scritta))     # regola 1: mai all'indietro
            continue

        nuovo = nuovo.replace(
            blocco,
            blocco.replace('<lastmod>%s</lastmod>' % lastmod.group(1),
                           '<lastmod>%s</lastmod>' % vera),
        )
        cambi.append((percorso, scritta, vera))

    for indirizzo, percorso in mancanti:
        print('  ATTENZIONE  %s -> %s: non lo trovo, lasciata com\'era' % (indirizzo, percorso))

    # Il blocco del Kin: la verita' la dice la cartella kin/.
    nuovo, voci_kin = aggiorna_kin(nuovo)
    print('Pagine del Kin del Cuore nel blocco dinamico: %d' % voci_kin)

    # La vetrina del Cerchio: la sua data sta nella funzione sul bordo.
    vetrina = aggiorna_vetrina_cerchio()
    if vetrina:
        cambi.append((FILE_VETRINA + ' (in sitemap-cerchio.ts)', vetrina[1], vetrina[2]))

    if not cambi and nuovo == testo:
        print('Tutte le date sono gia\' allineate e il blocco Kin non cambia. Niente da fare.')
        return 0

    print('Date da aggiornare: %d' % len(cambi))
    for percorso, prima, dopo in cambi:
        print('  %-58s %s -> %s' % (percorso, prima, dopo))
    if saltate:
        print('Gia\' aggiornate o piu\' avanti (lasciate stare): %d' % len(saltate))

    if not scrivi:
        print('\nNiente e\' stato scritto. Rilancia con --scrivi per applicare.')
        return 0

    scritti = []
    if nuovo != testo:
        io.open(SITEMAP, 'w', encoding='utf-8', newline='').write(nuovo)
        scritti.append(SITEMAP)
    if vetrina:
        io.open(FUNZIONE_CERCHIO, 'w', encoding='utf-8', newline='').write(vetrina[0])
        scritti.append(FUNZIONE_CERCHIO)
    # Il vecchio messaggio diceva «il push NON pubblica»: e' superato. Il
    # push su main pubblica il sito, quindi il sitemap va online col push.
    print('\n%s aggiornato. Resta il commit: il push su main pubblica il sito.' % ' e '.join(scritti))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
