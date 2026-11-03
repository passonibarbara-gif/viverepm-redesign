# Vivere PM: gestione proprietari e B&B

Versione di lavoro di Vivere PM pubblicata su main e GitHub Pages, su autorizzazione della proprietaria del progetto.

## Funzioni

- Proprietario: tariffe per periodo per immobile/camera, aggiornamenti sui portali espliciti, incassi diretti confermati separatamente dai totali prenotazione.
- Gestore: camere con calendari separati, registrazione di prenotazioni ricevute sui canali del proprietario, assegnazione camere e prevenzione sovrapposizioni, incluse prenotazioni dell'intera struttura.
- Bollette/spese: documento, beneficiario, scadenza, bonifico e collegamento facoltativo al fornitore. Apertura del fornitore non equivale a pagamento eseguito. Contabile del proprietario e successiva verifica del gestore.
- Interventi: preventivo e autorizzazione esistenti preservati. Dopo completamento, fattura e pagamento bonifico con verifica.
- Economia: compenso 25%, base lordo/netto portale e inclusione pulizie da concordare. Nessuna scelta contrattuale presunta. Fattura caricata dal gestore con imponibile e IVA indicati esplicitamente, contabile proprietario e verifica pagamento.
- Contratto/deleghe: originali, versioni, copie sottoscritte, verifica del gestore e scadenze. Nessuna firma elettronica simulata.
- Portali: raccolta dati intestatario, struttura, beneficiario, IBAN, account esistenti e documenti. Richiesta delega e stati della pratica. Nessuna registrazione automatica o richiesta password.
- Ospiti: più persone per prenotazione, dati per adempimenti, delega verificata e stato di trasmissione manuale.
- Shop: catalogo configurabile con corredi lenzuola/asciugamani, prodotti o servizi con lavaggio, quantità, ordini/preventivi, fatture e stato di esecuzione. Prezzi inizialmente non inventati.
- Attività pendenti e notifiche per entrambi i ruoli. Scadenze di bollette, interventi e fatture del 25% nei calendari.

## Richieste e risposte della pratica

Il gestore apre una richiesta di dati, documento, firma o conferma dalla scheda Booking e Airbnb. Ogni richiesta ha istruzioni, eventuale scadenza e obbligatorietà. Il proprietario risponde nella stessa scheda. Il gestore accetta la risposta oppure richiede un’integrazione motivata. Lo storico conserva messaggi e allegati precedenti.

Gli stati della richiesta sono Da rispondere, Risposta da verificare, Da integrare e Completata. La pratica passa per In attesa del proprietario, Risposte da verificare e Verifiche del gestore. Annuncio attivo e Pratica completata richiedono le risposte obbligatorie accettate, i dati principali completi e la delega corrente verificata e non scaduta. Una risposta o un caricamento non costituisce trasmissione automatica al portale.

Le vecchie note del gestore possono essere trasformate in richieste alle quali il proprietario può rispondere. Le richieste e le risposte pendenti sono riepilogate nell’area Richieste Booking/Airbnb del gestore.

## Prova isolata

Servire la cartella con un server statico e aprire `index.html?demo=1`. L'anteprima usa esclusivamente record dimostrativi nel browser, senza inizializzare Supabase. I pulsanti in alto cambiano ruolo e ripristinano i dati. Non caricare dati personali reali nella prova.

La modalità ordinaria mantiene la configurazione Supabase esistente. I nuovi dati si trovano in `property.vpmRooms`, `property.vpmServices`, `spese` e `manutenzioni`. Nessuna migrazione automatica dei movimenti o delle prenotazioni esistenti. Le prenotazioni storiche richiedono la compilazione delle componenti economiche prima del calcolo del compenso.

## Ambito e collegamenti da completare

Questa modifica realizza i percorsi applicativi nel gestionale esistente. I collegamenti con fornitore pagamenti, Booking/Airbnb, sistemi delle autorità, firma elettronica e fatturazione fiscale non sono inclusi. Il gestore carica documenti e registra attività effettivamente svolte. Per le spese è possibile configurare il collegamento HTTPS al fornitore scelto.

Il modello di autorizzazione del database esistente (record condiviso `app_data`) non è riprogettato da questa modifica. Prima dell'utilizzo operativo con documenti identificativi, IBAN e dati degli ospiti occorre verificare e adeguare le policy Supabase e la separazione server dei dati tra proprietari, gestori e visitatori. I controlli nell'interfaccia non sostituiscono RLS lato database. Non distribuire questi nuovi dati su un endpoint pubblico.

La qualificazione giuridica del servizio e il contratto devono essere verificati separatamente. Il software non certifica l'assenza di intermediazione.

La vecchia procedura pubblica di prenotazione diretta rimane per immobili interi. Le strutture con camere vengono gestite nei calendari dedicati e sui canali del proprietario. I precedenti link di pagamento del soggiorno non vengono più proposti nel percorso pubblico.

## Sorgenti e verifiche

Il progetto originale è un singolo HTML con una closure privata. I moduli `vpm-*.js` vengono incorporati nella stessa closure da `python scripts/integrate-vpm.py`. Dopo modifiche ai moduli rigenerare index.html e verificare:

```
python scripts/integrate-vpm.py
python scripts/check-vpm.py
node scripts/tests-vpm-expenses.cjs
node scripts/tests-vpm-services.cjs
node scripts/tests-vpm-rooms.js
node scripts/test-navigation.cjs
node scripts/tests-core-persistence.cjs
```

I test verificano stati pagamento, errori salvataggio e ripristino, isolamento visitatore, permessi, sovrapposizioni camere, tariffe, calcolo compensi, ordini e deleghe.
