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

    UNA decisione pero' e' stata presa, il 30/08/2026, e sta qui codificata:
    gli articoli PUBBLICATI del Cerchio del Druido (tabella articoli_cerchio,
    letti col la chiave pubblicabile: solo cio' che il mondo gia' vede) entrano
    nel blocco marcato CERCHIO-DINAMICO, che questo script rigenera per intero
    a ogni corsa. Dentro il blocco comanda il database; fuori, le regole sopra.

    UNA SECONDA decisione, il 02/09/2026, per le 260 pagine del Kin del Cuore
    (kin/<tono>-<glifo>.html, generate da strumenti/genera-kin.mjs): entrano
    nel blocco KIN-DINAMICO, rigenerato a ogni corsa dai file che ESISTONO su
    disco in kin/. Non dal database e non da un elenco scritto a mano: se una
    pagina c'e' si indicizza, se sparisce esce dal sitemap da sola. L'indirizzo
    e' quello «pulito» (/kin/9-ix, senza .html), lo stesso del canonical e
    dell'og:url dentro la pagina: quando i due divergono, il primo a non essere
    creduto e' il nostro. Il lastmod e' l'ultimo commit del file, con la regola
    1 che vale anche qui.

Quando lanciarlo: prima di pubblicare, se sono state toccate delle pagine. Vedi
la sezione «Il push NON pubblica» del README.

Questo file sta in un repo pubblico e non contiene niente di riservato: legge la
storia di git e riscrive un file che e' gia' servito a tutti.
"""

import io
import json
import os
import re
import subprocess
import sys
import urllib.request

# Gli indirizzi che non corrispondono a un file con lo stesso nome.
MAPPA = {
    'https://cristianbresadola.com/': 'index.html',
    'https://cristianbresadola.com/cerchio-del-druido/': 'cerchio-del-druido/index.html',
}

SITEMAP = 'sitemap.xml'

# Il blocco degli articoli del Cerchio, rigenerato a ogni corsa. La chiave e'
# quella PUBBLICABILE (sta gia' in ogni pagina del sito) e la RLS fa vedere
# all'anonimo solo il pubblicato: il sitemap non puo' dire piu' del sito.
SB_URL = 'https://okasxfvoyihovohlaypz.supabase.co'
SB_KEY = 'sb_publishable__JK1dgzDVfrFmMETc3z-sA_HjMiueOS'
INIZIO_CERCHIO = '  <!-- CERCHIO-DINAMICO inizio: blocco rigenerato da strumenti/aggiorna-sitemap.py -->'
FINE_CERCHIO = '  <!-- CERCHIO-DINAMICO fine -->'

# Il blocco delle pagine del Kin del Cuore: comanda la cartella kin/ su disco.
CARTELLA_KIN = 'kin'
INIZIO_KIN = '  <!-- KIN-DINAMICO inizio: le pagine del Kin del Cuore, blocco rigenerato da strumenti/aggiorna-sitemap.py -->'
FINE_KIN = '  <!-- KIN-DINAMICO fine -->'


def articoli_cerchio():
    """Gli articoli pubblicati, [(slug, data)], o None se il database tace.

    Doppia strada di proposito: urllib prima, curl poi. Su questo PC Norton
    si mette in mezzo al TLS e Python non si fida del suo certificato
    (errore intermittente, storia nota); curl usa il magazzino certificati
    di Windows e passa. Meglio due strade che un sitemap muto.
    """
    url = (SB_URL + '/rest/v1/articoli_cerchio'
           + '?select=slug,pubblicato_at,updated_at&order=pubblicato_at.desc&limit=200')
    grezzo = None
    try:
        richiesta = urllib.request.Request(url, headers={'apikey': SB_KEY})
        with urllib.request.urlopen(richiesta, timeout=15) as r:
            grezzo = r.read().decode('utf-8')
    except Exception as e:
        try:
            esito = subprocess.run(
                ['curl', '-s', '--max-time', '15', '-H', 'apikey: ' + SB_KEY, url],
                capture_output=True, text=True, timeout=25,
            )
            if esito.returncode == 0 and esito.stdout.strip():
                grezzo = esito.stdout
        except Exception:
            pass
        if grezzo is None:
            print('  ATTENZIONE  il database non risponde (%s): blocco Cerchio lasciato com\'era' % e)
            return None
    try:
        righe = json.loads(grezzo)
    except Exception:
        print('  ATTENZIONE  risposta del database illeggibile: blocco Cerchio lasciato com\'era')
        return None
    voci = []
    for a in righe:
        quando = (a.get('updated_at') or a.get('pubblicato_at') or '')[:10]
        if a.get('slug'):
            voci.append((a['slug'], quando))
    return voci


def blocco_cerchio(voci):
    righe = [INIZIO_CERCHIO]
    for slug, quando in voci:
        righe.append('  <url>')
        righe.append('    <loc>https://cristianbresadola.com/cerchio-del-druido/articolo.html?slug=%s</loc>'
                     % urllib.request.quote(slug, safe=''))
        if quando:
            righe.append('    <lastmod>%s</lastmod>' % quando)
        righe.append('    <changefreq>monthly</changefreq>')
        righe.append('    <priority>0.6</priority>')
        righe.append('  </url>')
    righe.append(FINE_CERCHIO)
    return '\n'.join(righe)


def aggiorna_cerchio(testo):
    """Sostituisce (o inserisce) il blocco marcato. Torna (testo, quante_voci|None)."""
    voci = articoli_cerchio()
    if voci is None:
        return testo, None
    blocco = blocco_cerchio(voci)
    if INIZIO_CERCHIO in testo and FINE_CERCHIO in testo:
        nuovo = re.sub(re.escape(INIZIO_CERCHIO) + '.*?' + re.escape(FINE_CERCHIO),
                       blocco.replace('\\', '\\\\'), testo, flags=re.S)
    else:
        nuovo = testo.replace('</urlset>', blocco + '\n</urlset>')
    return nuovo, len(voci)


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
        # Le voci del blocco Cerchio non sono file: le governa il database,
        # nel passaggio dedicato qui sotto.
        if 'articolo.html?slug=' in indirizzo:
            continue
        # Idem per le pagine del Kin: l'indirizzo e' pulito (senza .html) e
        # il blocco si rigenera per intero dalla cartella, piu' sotto.
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

    # Il blocco del Cerchio: la verita' la dice il database.
    nuovo, voci_cerchio = aggiorna_cerchio(nuovo)
    if voci_cerchio is not None:
        print('Articoli del Cerchio nel blocco dinamico: %d' % voci_cerchio)

    # Il blocco del Kin: la verita' la dice la cartella kin/.
    nuovo, voci_kin = aggiorna_kin(nuovo)
    print('Pagine del Kin del Cuore nel blocco dinamico: %d' % voci_kin)

    if not cambi and nuovo == testo:
        print('Tutte le date sono gia\' allineate e il blocco Cerchio non cambia. Niente da fare.')
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
