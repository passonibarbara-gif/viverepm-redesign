# Vivere PM: gestione proprietari e B&B

Ramo di revisione `feature/gestione-proprietari-bnb`. Nessuna modifica o distribuzione su main.

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
```

I test verificano stati pagamento, errori salvataggio e ripristino, isolamento visitatore, permessi, sovrapposizioni camere, tariffe, calcolo compensi, ordini e deleghe.
