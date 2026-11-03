/* Administrative CIN/CIR register. No submission to public authorities is performed here. */
let vpmCodesFilter='pending';
const vpmCodeFeedback=new Map();
const vpmCodeStates=['Da avviare','Documenti mancanti','In preparazione','Presentata al Comune','Integrazione richiesta','CIR rilasciato','CIN richiesto','Completata'];
const vpmCodeProfiles={'':'Da definire',lt:'Locazione turistica non imprenditoriale',business:'Locazione turistica imprenditoriale',bnb:'B&B',rooms:'Affittacamere',cav:'Casa e appartamenti per vacanze'};
const vpmCodeLinks={
 faq:'https://www.ministeroturismo.gov.it/faq-banca-dati-strutture-ricettive-bdsr/',
 bdsr:'https://bdsr.ministeroturismo.gov.it/',
 cir:'https://osservatorioturistico.regione.sicilia.it/',
 suap:'https://www.impresainungiorno.gov.it/',
 law:'https://w3.ars.sicilia.it/lex/L_2025_006.htm',
 requirements:'https://www.regione.sicilia.it/istituzioni/servizi-informativi/decreti-e-direttive/2104-25062025-0',
 update:'https://www.comune.malfa.me.it/novita/avvisi/locazioni-turistiche-affitti-brevi-nuove-disposizioni-regionali-e-modulistica/',
 formB:'https://www.comune.malfa.me.it/media/kb2hwwef/allegato-b-24_06_2026_260624_152352-pdf-6a3be6fc42f7c.pdf',
 sciaPage:'https://www.regione.sicilia.it/istituzioni/servizi-informativi/decreti-e-direttive/servizio-3-osservatorio-turistico-sport-135',
 scia:'https://acireale-api.municipiumapp.it/s3/23/allegati/modello-locazione-breve-turistica.pdf',
 local:'https://www.comune.raccuja.me.it/it/page/locazioni-brevi-e-turistiche-procedura-per-la-richiesta-del-cir',
 police:'https://alloggiatiweb.poliziadistato.it/PortaleAlloggiati/'
};
const vpmCodeTasks=[
 ['profile','Definire titolare, tipologia e forma di esercizio','Distinguere locazione da struttura ricettiva. Verificare il titolo di disponibilità e l’incarico del gestore.'],
 ['local','Confermare Comune, Regione e procedimento','Chiedere al SUAP il canale vigente, la modulistica e gli allegati per il caso concreto.'],
 ['identity','Preparare identità e incarico','Documento e codice fiscale del titolare; rappresentanza e procura se necessarie. Non raccogliere password SPID/CIE.'],
 ['technical','Verificare immobile e documentazione tecnica','Dati e planimetria catastali, disponibilità, abitabilità/agibilità o SCA; documenti impianti applicabili, con verifica del tecnico.'],
 ['safety','Verificare sicurezza prima della dichiarazione','Locazioni: estintori e rilevatori secondo art. 13-ter e FAQ, con eventuali esenzioni motivate. Strutture ricettive: requisiti propri.'],
 ['submit','Presentare comunicazione o SCIA applicabile','Procedimento comunale e adempimenti regionali; conservare modulo firmato, allegati, protocollo e ricevute.'],
 ['cir','Ottenere CIR e verificare l’anagrafica regionale','Seguire Turist@t e le istruzioni dell’ufficio competente. Una ricevuta di invio non equivale al rilascio del CIR.'],
 ['bdsr','Richiedere CIN nella BDSR','Identità digitale o modalità per delegato/non titolare previste dalla BDSR; verificare dati, catasto e dichiarazioni. Segnalare struttura mancante se necessario.'],
 ['certificate','Conservare rilascio e aggiornare i codici','Registrare codici ufficiali, date e attestazione scaricata. Nessuna generazione automatica del CIN nella piattaforma.'],
 ['display','Esporre codici e aggiornare gli annunci','Esposizione esterna del CIN nel rispetto dei vincoli; CIN su tutti gli annunci e obblighi regionali sul CIR.'],
 ['other','Verificare gli ulteriori adempimenti prima dell’ospitalità','Alloggiati Web, flussi Turist@t, imposta di soggiorno comunale, privacy e obblighi fiscali. Il CIN non li sostituisce.']
];
function vpmCodeCan(p){return state.view==='gestore'&&state.gestoreUnlocked&&immobileConsentito(p.id);}
function vpmCodePending(p){return !!(p.cinToRequest||p.cirToRequest||p.vpmCodes&&p.vpmCodes.status!=='Completata');}
function vpmCodeGuide(){
 const link=(key,label)=>`<a class="icon-btn" href="${vpmCodeLinks[key]}" target="_blank" rel="noopener noreferrer">${label}</a>`;
 return `<section class="vpm-owner-form"><h2>Percorso e moduli ufficiali</h2><p>Verifica fonti: 3 novembre 2026. Percorso regionale predisposto per la Sicilia. Per altre Regioni la procedura va verificata prima dell’invio.</p><details open><summary>1. Inquadramento e Comune</summary><p>Per locazioni turistiche e strutture ricettive i procedimenti differiscono. Appartamento o villa descrivono l’immobile, non il regime amministrativo. Il B&B e l’affittacamere richiedono la disciplina e gli eventuali adempimenti di classificazione propri. Confermare al SUAP la pratica applicabile, gli allegati, i diritti e il canale di invio.</p>${link('suap','Cerca SUAP')}${link('law','Legge regionale 6/2025')}${link('requirements','Requisiti e classificazione')}</details><details><summary>2. Modulistica Sicilia aggiornata</summary><p>Per le locazioni consultare il modello standardizzato approvato con D.A. 3314 del 1 ottobre 2026. L’Allegato B è stato aggiornato con D.A. 1920 del 24 giugno 2026. Verificare con l’ufficio quali modelli occorrono nella specifica pratica. Non applicare questi modelli alle aperture di B&B o affittacamere senza verifica del relativo procedimento.</p>${link('sciaPage','Decreto e modello ottobre 2026')}${link('scia','Apri modello ottobre 2026, copia Comune Acireale')}${link('update','D.A. 1920/2026 e Allegato B')}${link('formB','Apri Allegato B giugno 2026')}<p>Le copie comunali riproducono i modelli regionali. Non costituiscono conferma dei requisiti di un altro Comune.</p></details><details><summary>3. Fascicolo documentale da verificare</summary><p>Predisporre dati del titolare, codice fiscale, documento se richiesto, titolo sull’immobile e procura per chi presenta. Raccogliere identificativi e planimetria catastali, agibilità/abitabilità o SCA, documentazione di sicurezza e degli impianti effettivamente presenti, dichiarazioni richieste dal modello vigente e ricevute degli eventuali diritti. Il tecnico e il SUAP confermano quali certificazioni o asseverazioni servono. Per strutture ricettive verificare anche classificazione, relazione tecnica, planimetrie, requisiti di categoria, assicurazione e adempimenti sanitari eventualmente applicabili.</p><p>In condominio verificare le dichiarazioni richieste dal modello vigente. Conservare la versione firmata inviata e le ricevute. Non usare l’elenco del vecchio modulo 2025 come elenco obbligatorio universale.</p>${link('formB','Controlla gli allegati nel modello aggiornato')}${link('local','Esempio di istruttoria, solo Comune Raccuja')}</details><details><summary>4. CIR regionale, poi CIN nazionale</summary><p>Dopo gli adempimenti territoriali seguire la registrazione regionale e il rilascio CIR. Accedere alla BDSR per il CIN, verificare i dati e rendere le dichiarazioni richieste. I moduli CIN e le modalità di delega si trovano nel servizio online e nel suo manuale. Per dati mancanti seguire la segnalazione BDSR. L’invio della pratica non equivale al rilascio dei codici.</p>${link('cir','Turist@t Sicilia')}${link('bdsr','BDSR, istanza CIN e manuali')}${link('faq','FAQ Ministero, requisiti e deleghe')}</details><details><summary>5. Chiusura e adempimenti collegati</summary><p>Archiviare attestazione CIN, aggiornare gli annunci e verificare l’esposizione dei codici. Predisporre Alloggiati Web, statistiche regionali e gestione dell’imposta di soggiorno secondo il Comune. La rimozione della sezione ospiti dalla piattaforma non elimina gli obblighi esterni.</p>${link('police','Alloggiati Web')}${link('cir','Flussi turistici Sicilia')}</details><details><summary>6. Pratiche preesistenti e scadenze</summary><p>Per le locazioni interessate dalla disciplina transitoria 2026, il termine del 30 giugno per l’Allegato B è trascorso. L’integrazione tecnica entro il 30 dicembre 2026 riguarda le condizioni previste dal D.A. 1920/2026, non una proroga generale delle nuove aperture. Verificare ricevute e ammissibilità con l’ufficio competente. Registrare soltanto la scadenza applicabile alla pratica.</p>${link('update','Decreto e documentazione transitoria')}</details></section>`;
}
function vpmRenderCodesHub(){
 if(state.view!=='gestore'||!state.gestoreUnlocked)return '';
 const all=immobiliVisibili(),pending=all.filter(vpmCodePending),props=vpmCodesFilter==='all'?all:pending,e=vpmOwnerEscape;
 const field=(label,name,value='',type='text')=>`<label class="field">${label}<input name="${name}" type="${type}" value="${e(value)}" ${type==='date'?'':'maxlength="1000"'}></label>`;
 return vpmPortfolioShell('PRATICHE','CIN e CIR da richiedere','Segui i codici degli immobili, i documenti e le attività ancora da completare.',[['ti-files',pending.length,'Pratiche aperte'],['ti-home',all.length,'Immobili']],`<div class="vpm-portfolio-filters"><button data-code-filter="pending">Da gestire (${pending.length})</button><button data-code-filter="all">Tutti gli immobili (${all.length})</button></div><p>Seleziona “Da richiedere” nella modifica dell’immobile per inserirlo in questo elenco. Per codici mancanti non ancora segnalati usa “Tutti gli immobili”.</p>${vpmCodeGuide()}${props.map(p=>{const c=p.vpmCodes||{},docs=c.documents||[];return `<details class="vpm-owner-form" ${vpmCodeFeedback.has(p.id)?'open':''}><summary><strong>${e(p.nome)}</strong> · ${e(c.status||'Da avviare')} · CIN ${e(p.cin||'mancante')} · CIR ${e(p.cir||'mancante')}</summary><p role="status">${e(vpmCodeFeedback.get(p.id)||'')}</p><p>${e(getCliente(p)?.nome||'Proprietario da associare')} · ${e(p.indirizzo||'')}</p><form data-code-form="${e(p.id)}"><div class="field-row">${field('Regione','region',c.region||'Sicilia')}${field('Comune competente','municipality',c.municipality||'')}<label class="field">Tipologia amministrativa<select name="profile">${Object.entries(vpmCodeProfiles).map(([k,v])=>`<option value="${k}" ${c.profile===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="field">Stato pratica<select name="status">${vpmCodeStates.map(v=>`<option ${v===(c.status||'Da avviare')?'selected':''}>${v}</option>`).join('')}</select></label>${field('CIR ufficiale rilasciato','cir',p.cir||'')}${field('CIN ufficiale rilasciato','cin',p.cin||'')}${field('Scadenza applicabile, se verificata','due',c.due||'','date')}${field('Responsabile della pratica','assignee',c.assignee||'')}${field('Protocollo Comune / ricevuta','protocol',c.protocol||'')}${field('Data presentazione','submitted',c.submitted||'','date')}${field('Data rilascio CIR','cirDate',c.cirDate||'','date')}${field('Data rilascio CIN','cinDate',c.cinDate||'','date')}${field('Riferimento attestazione CIN','certificate',c.certificate||'')}</div><p>Per ogni voce: “Verificato” significa controllo manuale. “Non applicabile” richiede una motivazione nelle note.</p>${vpmCodeTasks.map(([id,title,help])=>`<label class="field"><strong>${title}</strong><small>${help}</small><select name="task_${id}">${[['pending','Da fare'],['done','Verificato'],['na','Non applicabile, motivare']].map(([k,t])=>`<option value="${k}" ${c.tasks?.[id]===k?'selected':''}>${t}</option>`).join('')}</select></label>`).join('')}<label class="field">Note, integrazioni e motivazioni<textarea name="notes" maxlength="5000">${e(c.notes||'')}</textarea></label><label class="field">Documento o ricevuta, facoltativo (PDF/JPG/PNG/WEBP, massimo 5 MB)<input type="file" name="attachment" accept="application/pdf,image/jpeg,image/png,image/webp"></label>${field('Descrizione allegato','attachmentTitle','')}<button type="submit" class="btn-primary">Salva pratica</button><div data-code-status role="status" aria-live="polite"></div></form>${vpmCodeRequests(p,true)}<h3>Documenti della pratica</h3>${docs.map(d=>`<p>${e(d.title)} · ${e(d.name)} ${/^data:(application\/pdf|image\/(jpeg|png|webp));base64,/.test(d.url||'')?`<a class="icon-btn" href="${e(d.url)}" download="${e(d.name)}">Scarica</a>`:''}</p>`).join('')||'<p>Nessun allegato salvato.</p>'}<button class="icon-btn" data-vpm-open-tab="${e(p.id)}::anagrafica">Apri immobile</button><button class="icon-btn" data-vpm-open-tab="${e(p.id)}::contratti">Contratto e incarichi</button></details>`;}).join('')||'<p class="vpm-owner-empty">Nessuna pratica segnalata da richiedere.</p>'}`);
}
function vpmValidateCodeData(d){
 if(!vpmCodeStates.includes(d.status)||!Object.hasOwn(vpmCodeProfiles,d.profile))throw Error('Seleziona stato e tipologia validi.');
 if(!d.region||!d.municipality)throw Error('Indica Regione e Comune competente.');
 for(const key of ['due','submitted','cirDate','cinDate'])if(d[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(d[key])||Number.isNaN(Date.parse(d[key]))||new Date(d[key]).toISOString().slice(0,10)!==d[key]))throw Error('Inserisci date valide.');
 if(Object.values(d.tasks).some(v=>!['pending','done','na'].includes(v)))throw Error('Stato attività non valido.');
 if(Object.values(d.tasks).includes('na')&&!d.notes)throw Error('Motiva nelle note le attività non applicabili.');
 if(['CIR rilasciato','CIN richiesto','Completata'].includes(d.status)&&!d.cir)throw Error('Registra il CIR prima di avanzare la pratica.');
 if(['Presentata al Comune','CIR rilasciato','CIN richiesto','Completata'].includes(d.status)&&!d.protocol)throw Error('Indica il protocollo o la ricevuta di presentazione.');
 if(d.status==='Completata'&&(!d.profile||!d.cin||!d.cinDate||!d.cirDate||!d.certificate||Object.values(d.tasks).some(v=>v==='pending')))throw Error('Per completare servono codici, date, attestazione e verifica di tutte le attività.');
}
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-code-filter]');if(!el||state.view!=='gestore'||!state.gestoreUnlocked)return;
 if(!['pending','all'].includes(el.dataset.codeFilter))return;event.preventDefault();event.stopImmediatePropagation();vpmCodesFilter=el.dataset.codeFilter;render();
},true);
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-code-form]');if(!form)return;event.preventDefault();event.stopImmediatePropagation();
 const p=state.properties.find(p=>p.id===form.dataset.codeForm),status=form.querySelector('[data-code-status]');
 if(!p||!vpmCodeCan(p)){status.textContent='Accesso non consentito.';return;}
 if(form.dataset.saving==='true'||vpmCodeLocks.has(p.id))return;
 const before=JSON.parse(JSON.stringify(p)),fd=new FormData(form),get=k=>String(fd.get(k)||'').trim(),buttons=[...form.querySelectorAll('button[type=submit]')];
 form.dataset.saving='true';vpmCodeLocks.add(p.id);buttons.forEach(b=>b.disabled=true);status.textContent='Salvataggio della pratica in corso…';
 try{
  const data=Object.fromEntries(['region','municipality','profile','status','cin','cir','due','assignee','protocol','submitted','cirDate','cinDate','certificate','notes'].map(k=>[k,get(k)]));data.tasks=Object.fromEntries(vpmCodeTasks.map(([id])=>[id,get('task_'+id)]));vpmValidateCodeData(data);if(data.status==='Completata'&&(p.vpmCodes?.requests||[]).some(r=>r.required&&r.status!=='accepted'))throw Error('Prima accetta tutte le risposte obbligatorie del proprietario.');
  const documents=[...(p.vpmCodes?.documents||[])],file=fd.get('attachment');
  if(file?.size){if(file.size>5*1024*1024||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Allega PDF o immagini supportate, massimo 5 MB.');status.textContent='Caricamento allegato: '+file.name+'…';documents.push({id:uid(),name:file.name,title:get('attachmentTitle')||file.name,url:await readFileAsDataUrl(file),createdAt:new Date().toISOString()});}
  p.cin=data.cin;p.cir=data.cir;p.cinToRequest=!p.cin;p.cirToRequest=!p.cir;p.vpmCodes={...p.vpmCodes,...data,documents,updatedAt:new Date().toISOString()};
  const result=await saveData({renderOnError:false});if(result===false||state.error)throw Error(state.error||'Salvataggio non riuscito.');
  vpmCodeFeedback.set(p.id,'Pratica e allegati salvati.');status.textContent='Pratica e allegati salvati.';form.dataset.saving='false';render();
 }catch(error){Object.keys(p).forEach(k=>delete p[k]);Object.assign(p,before);status.textContent=(error.message||'Salvataggio non riuscito.')+' I dati nel modulo restano disponibili per riprovare.';}
 finally{vpmCodeLocks.delete(p.id);form.dataset.saving='false';buttons.forEach(b=>b.disabled=false);}
},true);
// Owner collaboration is limited to answering manager requests.
function vpmCodeOwner(p){
 if(state.view!=='proprietari'||!state.ownerAuth)return false;
 const client=getCliente(p);return !!client&&String(client.email||'').toLowerCase()===String(state.ownerAuth.email||'').toLowerCase();
}
function vpmCodeRequests(p,manager){
 const e=vpmOwnerEscape,requests=p.vpmCodes?.requests||[],label={open:'Da rispondere',answered:'Risposta inviata',integrate:'Da integrare',accepted:'Completata'};
 const form=(action,body)=>`<form class="vpm-owner-form" data-code-request="${action}" data-property="${e(p.id)}">${body}<div data-code-feedback role="status" aria-live="polite"></div></form>`;
 return `<section><p role="status">${e(vpmCodeFeedback.get(p.id)||'')}</p><h3>Richieste al proprietario</h3><p>${requests.filter(r=>['open','integrate'].includes(r.status)).length} risposte attese · ${requests.filter(r=>r.status==='answered').length} da verificare</p>${manager?form('create','<label class="field">Documento o informazione richiesta<input name="title" maxlength="200" required></label><label class="field">Dettagli<textarea name="message" maxlength="3000" required></textarea></label><label class="field">Scadenza risposta<input type="date" name="due"></label><label><input type="checkbox" name="fileRequired" checked> Richiedi un allegato</label><label><input type="checkbox" name="required" checked> Obbligatoria per chiudere la pratica</label><button type="submit" class="btn-primary">Invia richiesta al proprietario</button>'):''}${requests.map(r=>`<article class="vpm-owner-form"><h4>${e(r.title)} · ${label[r.status]||e(r.status)}</h4><p>${e(r.message)}</p><p>${r.required?'Obbligatoria':'Facoltativa'}${r.due?' · Scadenza '+e(r.due):''}${r.fileRequired?' · Allegato richiesto':''}</p>${(r.history||[]).map(h=>`<div class="vpm-owner-block"><div><strong>${e(h.actor==='manager'?'Gestore':'Proprietario')} · ${e(fmtDate(h.at))}</strong><p>${e(h.text)}</p>${h.file&&/^data:(application\/pdf|image\/(jpeg|png|webp));base64,/.test(h.file.url||'')?`<a class="icon-btn" href="${e(h.file.url)}" download="${e(h.file.name)}">Scarica ${e(h.file.name)}</a>`:''}</div></div>`).join('')}${!manager&&['open','integrate'].includes(r.status)?form('reply',`<input type="hidden" name="requestId" value="${e(r.id)}"><label class="field">La tua risposta<textarea name="message" maxlength="3000" required></textarea></label><label class="field">Documento PDF o immagine, massimo 5 MB<input type="file" name="attachment" accept="application/pdf,image/jpeg,image/png,image/webp" ${r.fileRequired?'required':''}></label><button type="submit" class="btn-primary">Invia risposta al gestore</button>`):''}${manager&&r.status==='answered'?form('review',`<input type="hidden" name="requestId" value="${e(r.id)}"><label class="field">Esito<select name="decision"><option value="accepted">Accetta risposta</option><option value="integrate">Richiedi integrazione</option></select></label><label class="field">Motivazione o nota<textarea name="message" maxlength="3000"></textarea></label><button type="submit" class="btn-primary">Conferma verifica</button>`):''}</article>`).join('')||'<p>Nessuna richiesta inviata.</p>'}</section>`;
}
function vpmRenderCodesProperty(p,role){
 const manager=role==='gestore';if(!(manager?vpmCodeCan(p):vpmCodeOwner(p)))return '<p>Accesso non consentito.</p>';
 return `<div class="vpm-owner-section-intro"><div><strong>Pratica CIN e CIR</strong><small>Il gestore cura la pratica e aggiorna gli stati. Il proprietario risponde alle richieste.</small></div></div><p>CIN: ${vpmOwnerEscape(p.cin||'Non ancora registrato')} · CIR: ${vpmOwnerEscape(p.cir||'Non ancora registrato')} · Stato: ${vpmOwnerEscape(p.vpmCodes?.status||'Da avviare')}</p>${manager?'<button class="btn-primary" data-vpm-hub="codes-hub">Apri registro pratiche</button>':''}${vpmCodeRequests(p,manager)}`;
}
const vpmCodesServicePending=window.vpmServicesPending;
window.vpmServicesPending=function(p,role){
 const result=vpmCodesServicePending(p,role),requests=p.vpmCodes?.requests||[];
 for(const r of requests){if(role==='gestore'&&r.status==='answered')result.items.push({tab:'codes',title:'Verifica documento CIN/CIR: '+r.title});else if(role!=='gestore'&&['open','integrate'].includes(r.status))result.items.push({tab:'codes',title:'Rispondi per CIN/CIR: '+r.title});}
 result.count=result.items.length;return result;
};
const vpmCodeLocks=new Set();
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-code-request]');if(!form)return;event.preventDefault();event.stopImmediatePropagation();
 const p=state.properties.find(p=>p.id===form.dataset.property),feedback=form.querySelector('[data-code-feedback]'),action=form.dataset.codeRequest;
 if(!p||!(action==='reply'?vpmCodeOwner(p):vpmCodeCan(p))){feedback.textContent='Accesso non consentito.';return;}
 if(vpmCodeLocks.has(p.id))return;
 const previous=JSON.parse(JSON.stringify(p)),fd=new FormData(form),get=k=>String(fd.get(k)||'').trim(),buttons=[...form.querySelectorAll('button[type=submit]')];
 vpmCodeLocks.add(p.id);buttons.forEach(b=>b.disabled=true);feedback.textContent='Invio in corso…';
 try{
  const data=p.vpmCodes||(p.vpmCodes={status:'Da avviare'}),requests=data.requests||(data.requests=[]),now=new Date().toISOString();
  if(action==='create'){
   if(!get('title')||!get('message'))throw Error('Indica titolo e dettagli della richiesta.');
   if(get('due')&&(!/^\d{4}-\d{2}-\d{2}$/.test(get('due'))||Number.isNaN(Date.parse(get('due')))||new Date(get('due')).toISOString().slice(0,10)!==get('due')))throw Error('Scadenza non valida.');
   requests.push({id:uid(),title:get('title'),message:get('message'),due:get('due'),required:fd.get('required')==='on',fileRequired:fd.get('fileRequired')==='on',status:'open',history:[{actor:'manager',text:get('message'),at:now}]});
   if(data.status==='Completata')data.status='Documenti mancanti';
   addNotifica(p,'Richiesta CIN/CIR: '+get('title'),'proprietario','codes');
  }else{
   const r=requests.find(r=>r.id===get('requestId'));if(!r)throw Error('Richiesta non disponibile.');
   if(action==='reply'){
    if(!['open','integrate'].includes(r.status))throw Error('Questa richiesta non attende una risposta.');
    if(!get('message'))throw Error('Inserisci una risposta.');
    const file=fd.get('attachment');let attachment;
    if(r.fileRequired&&!file?.size)throw Error('Allega il documento richiesto.');
    if(file?.size){if(file.size>5*1024*1024||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Allega PDF o immagini supportate, massimo 5 MB.');feedback.textContent='Caricamento del documento: '+file.name+'…';attachment={name:file.name,url:await readFileAsDataUrl(file)};}
    r.history.push({actor:'owner',text:get('message'),...(attachment?{file:attachment}:{}),at:now});r.status='answered';addNotifica(p,'Risposta CIN/CIR da verificare: '+r.title,'gestore','codes');
   }else if(action==='review'){
    if(r.status!=='answered'||!['accepted','integrate'].includes(get('decision')))throw Error('La risposta non è disponibile per questa verifica.');
    if(get('decision')==='integrate'&&!get('message'))throw Error('Spiega quale integrazione serve.');
    r.status=get('decision');r.history.push({actor:'manager',text:get('message')||(r.status==='accepted'?'Risposta accettata.':''),at:now});addNotifica(p,r.status==='accepted'?'Documento CIN/CIR accettato: '+r.title:'Integra documento CIN/CIR: '+r.title,'proprietario','codes');
   }else throw Error('Operazione non valida.');
  }
  const result=await saveData({renderOnError:false});if(result===false||state.error)throw Error(state.error||'Invio non riuscito.');
  vpmCodeFeedback.set(p.id,action==='create'?'Richiesta inviata al proprietario.':action==='reply'?'Risposta e allegati inviati al gestore.':'Verifica salvata.');render();
 }catch(error){Object.keys(p).forEach(k=>delete p[k]);Object.assign(p,previous);feedback.textContent=error.message||'Invio non riuscito. Riprova.';}
 finally{vpmCodeLocks.delete(p.id);buttons.forEach(b=>b.disabled=false);}
},true);
