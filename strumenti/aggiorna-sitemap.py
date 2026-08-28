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

# Gli indirizzi che non corrispondono a un file con lo stesso nome.
MAPPA = {
    'https://cristianbresadola.com/': 'index.html',
    'https://cristianbresadola.com/cerchio-del-druido/': 'cerchio-del-druido/index.html',
}

SITEMAP = 'sitemap.xml'


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

    if not cambi:
        print('Tutte le date sono gia\' allineate all\'ultimo commit. Niente da fare.')
        return 0

    print('Date da aggiornare: %d' % len(cambi))
    for percorso, prima, dopo in cambi:
        print('  %-58s %s -> %s' % (percorso, prima, dopo))
    if saltate:
        print('Gia\' aggiornate o piu\' avanti (lasciate stare): %d' % len(saltate))

    if not scrivi:
        print('\nNiente e\' stato scritto. Rilancia con --scrivi per applicare.')
        return 0

    io.open(SITEMAP, 'w', encoding='utf-8', newline='').write(nuovo)
    print('\n%s aggiornato. Ricordarsi che il push NON pubblica: serve il deploy.' % SITEMAP)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
