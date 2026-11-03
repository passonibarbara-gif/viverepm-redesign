/* Shared owner/manager services. Integrations remain manual until configured. */
(function () {
  'use strict';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n).toLocaleString('it-IT', {style:'currency',currency:'EUR'});
  const defaultCatalog = () => [{id:'corredo-casa',name:'Corredo casa',description:'Lenzuola e asciugamani. Quantità e misure da concordare per il tuo immobile.',kind:'Acquisto corredo',price:null,active:true}];
  const data = p => p.vpmServices || {documents:[],portal:{},guests:{},orders:[],catalog:defaultCatalog()};
  function ensure(p) {
    p.vpmServices = Object.assign({documents:[],portal:{},guests:{},orders:[],catalog:defaultCatalog()}, p.vpmServices || {});
    return p.vpmServices;
  }
  function can(p, manager, module) {
    if (state.view === 'gestore') return !!state.gestoreUnlocked && (!module || typeof haModulo!=='function' || haModulo(module)) && (typeof immobileConsentito !== 'function' || immobileConsentito(p.id));
    if (manager || state.view !== 'proprietari' || !state.ownerAuth) return false;
    const c = getClienteByEmail(state.ownerAuth.email);
    return !!c && p.clienteId === c.id;
  }
  const field = (label,name,value='',type='text',required=false) => `<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'step="any" min="0"':''} ${required?'required':''}></label>`;
  const select = (label,name,values,value='') => `<label class="field">${esc(label)}<select name="${name}">${values.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
  const form = (p,action,body) => `<form ${action==='portal-save'?'novalidate':''} class="vpm-owner-form vpm-service-form" data-service-form="${action}" data-service-property="${esc(p.id)}">${body}</form>`;
  const button = label => `<button class="btn-primary" type="submit">${label}</button>`;
  const empty = text => `<div class="vpm-owner-empty">${text}</div>`;
  const note = text => `<p class="vpm-owner-hint">${text}</p>`;
  function fileLink(file,label) {
    if(!file || !/^data:(application\/pdf|image\/(png|jpeg));base64,[A-Za-z0-9+/=]+$/.test(file.url || '')) return '';
    return `<a class="icon-btn" href="${esc(file.url)}" download="${esc(file.name)}">${label || 'Scarica documento'}</a>`;
  }
  async function fileFrom(input,required) {
    const f = input && input.files && input.files[0];
    if(!f){ if(required) throw Error('Seleziona un documento.'); return null; }
    if(!['application/pdf','image/png','image/jpeg'].includes(f.type) || f.size > 5*1024*1024) throw Error('Carica un PDF, JPG o PNG fino a 5 MB.');
    return {name:f.name,url:await readFileAsDataUrl(f),type:f.type,size:f.size};
  }
  function upload(label,name='document',required=true) {
    return `<label class="field">${label}<input type="file" name="${name}" accept="application/pdf,image/png,image/jpeg" ${required?'required':''}></label>`;
  }
  function signed(d) { return !!d.signedFile && d.status === 'Firmato verificato' && (!d.expiry || d.expiry >= new Date().toISOString().slice(0,10)); }
  const scopeNames={portali:'Booking e Airbnb',comunicazioni:'Comunicazioni ospiti'};
  const scopeKinds={portali:'Delega portali',comunicazioni:'Delega comunicazioni ospiti'};
  function latestKind(s,kind){return (s.documents||[]).filter(d=>d.kind===kind).slice(-1)[0];}
  function authorization(s,scope){
    const contract=latestKind(s,'Contratto di servizio'),delegation=latestKind(s,scopeKinds[scope]);
    const current=d=>d&&(!d.expiry||d.expiry>=new Date().toISOString().slice(0,10));
    if(contract&&signed(contract)&&Array.isArray(contract.scopes)&&contract.scopes.includes(scope)&&delegation&&current(delegation)&&delegation.file&&delegation.status==='Allegato contrattuale verificato'&&(contract.delegationRefs||[]).includes(delegation.id))return true;
    return !!delegation&&signed(delegation);
  }
  function documents(p,manager) {
    const s=data(p),ds=s.documents||[],contract=latestKind(s,'Contratto di servizio');
    const scopes=Object.entries(scopeNames).map(([key,label])=>`<label><input type="checkbox" name="scope_${key}" value="yes"> ${esc(label)}</label>`).join('');
    const refs=ds.filter(d=>Object.values(scopeKinds).includes(d.kind)).map(d=>`<label><input type="checkbox" name="ref_${esc(d.id)}" value="yes"> ${esc(d.title)} · ${esc(d.kind)} · v${Number(d.version)||1}</label>`).join('');
    return `<h2>Contratto e deleghe</h2>${note('Il contratto di servizio richiama le deleghe per i servizi selezionati. Il proprietario richiede il servizio e invia la copia sottoscritta del contratto. Il gestore carica gli allegati e verifica la documentazione. Il caricamento non equivale a firma digitale.')}${manager?form(p,'document-add',field('Titolo','title','','text',true)+select('Tipo','kind',['Contratto di servizio','Delega portali','Delega comunicazioni ospiti','Altro'])+field('Scadenza facoltativa','expiry','','date')+`<fieldset><legend>Servizi autorizzati dal contratto</legend>${scopes}</fieldset><fieldset><legend>Deleghe richiamate nel contratto</legend>${refs||'<p>Carica prima le deleghe da richiamare.</p>'}</fieldset>`+upload('Contratto o allegato')+button('Carica documento')):''}
    ${ds.length?ds.map(d=>`<section class="vpm-owner-form"><h3>${esc(d.title)}</h3><p>${esc(d.kind)} · Versione ${Number(d.version)||1} · ${esc(d.status)}${d.expiry?' · Scadenza '+esc(d.expiry):''}</p>${d.kind==='Contratto di servizio'?`<p>Servizi richiamati: ${(d.scopes||[]).map(x=>esc(scopeNames[x]||x)).join(', ')||'Nessun servizio specificato'}</p><p>Deleghe allegate: ${(d.delegationRefs||[]).map(id=>{const ref=ds.find(x=>x.id===id);return ref?fileLink(ref.file,esc(ref.title))||esc(ref.title):'Allegato non disponibile';}).join(' · ')||'Nessun allegato richiamato'}</p>`:''}${fileLink(d.file,'Scarica originale')} ${fileLink(d.signedFile,'Scarica copia sottoscritta')}${(d.signedHistory||[]).length?'<details><summary>Copie sottoscritte precedenti</summary>'+d.signedHistory.map(h=>'<p>'+esc(fmtDate(h.uploadedAt||''))+' · '+esc(h.status||'')+' '+fileLink(h.file,'Scarica copia precedente')+'</p>').join('')+'</details>':''}${!manager&&d===contract?form(p,'document-sign',`<input type="hidden" name="id" value="${esc(d.id)}">${upload('Carica copia sottoscritta del contratto')}${button('Invia contratto al gestore')}`):''}${manager&&d.kind==='Contratto di servizio'?form(p,'document-metadata',`<input type="hidden" name="id" value="${esc(d.id)}"><fieldset><legend>Modifica servizi richiamati</legend>${Object.entries(scopeNames).map(([key,label])=>`<label><input type="checkbox" name="scope_${key}" value="yes" ${(d.scopes||[]).includes(key)?'checked':''}> ${esc(label)}</label>`).join('')}</fieldset><fieldset><legend>Modifica deleghe richiamate</legend>${ds.filter(x=>Object.values(scopeKinds).includes(x.kind)).map(x=>`<label><input type="checkbox" name="ref_${esc(x.id)}" value="yes" ${(d.delegationRefs||[]).includes(x.id)?'checked':''}> ${esc(x.title)} · ${esc(x.kind)} · v${Number(x.version)||1}</label>`).join('')||'<p>Carica prima gli allegati.</p>'}</fieldset>${note('Questi riferimenti registrano solo i servizi e gli allegati già presenti nel documento caricato. Se cambiano il contenuto o le autorizzazioni, carica una nuova versione da sottoscrivere. La modifica dei riferimenti non modifica il documento e richiede una nuova verifica.')}${button('Salva collegamenti del contratto')}`):''}${manager?form(p,'document-status',`<input type="hidden" name="id" value="${esc(d.id)}">${select('Verifica documento','status',['Da firmare','Copia ricevuta, da verificare','Firmato verificato','Allegato contrattuale verificato','Da correggere'],d.status)}${button('Aggiorna verifica')}`):''}</section>`).join(''):empty('Il gestore non ha ancora caricato il contratto e i relativi allegati.')}`;
  }
  const portalFeedback = {};
  const portalFeedbackRole = {};
  const portalNotice = p => portalFeedback[p.id] && portalFeedbackRole[p.id]===state.view ? `<div class="vpm-service-feedback" role="status">${esc(portalFeedback[p.id])}</div>` : '';
  function portalError(form,message){
    let box=form.querySelector('[data-service-error]');
    if(!box){box=document.createElement('div');box.dataset.serviceError='';box.className='vpm-service-error';box.setAttribute('role','alert');form.appendChild(box);}
    box.textContent=message;
  }
  const portalStatuses = ['Bozza','Dati inviati al gestore','Dati mancanti','In attesa del proprietario','Risposte da verificare','Verifiche del gestore','Attivazione in corso','Azione richiesta al proprietario','Annuncio attivo','Pratica completata'];
  const requestTypes=['dati','documento','firma','conferma'];
  const requestLabels={aperta:'Da rispondere','risposta-inviata':'Risposta da verificare','da-integrare':'Da integrare',completata:'Completata'};
  const terminalStatuses=['Annuncio attivo','Pratica completata'];
  function currentPortalDelegation(s){return authorization(s,'portali');}
  function portalMissing(v){
    const required=['entity','legalName','taxId','address','email','phone','beneficiary','iban','platforms','accommodation','propertyAddress'];
    const missing=required.filter(k=>!String(v[k]||'').trim());
    if(v.entity==='Società'&&!String(v.representative||'').trim())missing.push('representative');
    if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))missing.push('email valida');
    if(v.iban&&!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v.iban))missing.push('IBAN valido');
    if(!['Persona fisica','Società'].includes(v.entity))missing.push('tipo intestatario');
    if(!['Booking e Airbnb','Booking','Airbnb'].includes(v.platforms))missing.push('portali');
    for(const platform of ['booking','airbnb'])if(v.platforms==='Booking e Airbnb'||v.platforms?.toLowerCase()===platform){if(!['Sì','No'].includes(v[platform+'Existing']))missing.push('account esistente '+platform);if(v[platform+'Existing']==='Sì'&&!String(v[platform+'Account']||'').trim())missing.push('account '+platform);}
    return [...new Set(missing)];
  }
  function automaticPortalState(v){
    const requests=v.requests||[];
    if(requests.some(r=>r.status==='risposta-inviata'))v.status='Risposte da verificare';
    else if(requests.some(r=>['aperta','da-integrare'].includes(r.status)))v.status='In attesa del proprietario';
    else if(requests.length)v.status='Verifiche del gestore';
  }
  function requestFromNote(v,text){
    const requests=v.requests||(v.requests=[]);
    const existing=requests.find(r=>r.details===text&&r.required!==false&&r.status!=='completata');
    if(existing)return existing;
    const at=new Date().toISOString(),request={id:uid(),type:'dati',title:'Integrazione richiesta dal gestore',details:text,deadline:'',required:true,status:'aperta',createdAt:at,replies:[],history:[{id:uid(),actor:'gestore',at,text:'Richiesta inviata: '+text}]};
    requests.push(request);return request;
  }
  function requestThreads(p,manager){
    const requests=data(p).portal?.requests||[];
    const legacyNote=data(p).portal?.managerNotes||'';
    const legacy=manager&&legacyNote&&!requests.some(r=>r.details===legacyNote)?form(p,'portal-request-from-note','<p>La precedente nota del gestore non ha ancora una risposta tracciata. Trasformala in una richiesta obbligatoria per consentire al proprietario di rispondere.</p>'+button('Trasforma la nota in richiesta')):'';
    const create=manager?form(p,'portal-request-add',select('Tipo richiesta','requestType',requestTypes)+field('Titolo richiesta','title','','text',true)+field('Istruzioni per il proprietario','details','','text',true)+field('Scadenza facoltativa','deadline','','date')+'<label><input type="checkbox" name="required" value="yes" checked> Richiesta obbligatoria per completare la pratica</label>'+upload('Documento da consultare o sottoscrivere, facoltativo','requestFile',false)+button('Invia richiesta al proprietario')):'';
    return `<section class="vpm-request-thread"><h3>Richieste e risposte della pratica</h3>${note('Gestore e proprietario seguono qui ogni richiesta, le risposte e le verifiche. Le copie precedenti restano nello storico.')}<div class="vpm-request-grid">${requests.length?requests.map(r=>`<article class="vpm-request-card ${r.deadline&&r.deadline<new Date().toISOString().slice(0,10)&&r.status!=='completata'?'is-overdue':''}"><h4>${esc(r.title)}</h4><span class="vpm-request-status ${esc(r.status)}">${esc(requestLabels[r.status]||r.status)}</span><p>${esc(r.type)} · ${r.required!==false?'Obbligatoria':'Facoltativa'}${r.deadline?' · Scadenza '+esc(fmtDate(r.deadline))+(r.deadline<new Date().toISOString().slice(0,10)&&r.status!=='completata'?' · Scaduta':''):''}</p><p>${esc(r.details)}</p>${fileLink(r.file,'Scarica documento della richiesta')}<div class="vpm-request-history">${(r.history||[]).map(h=>`<div><strong>${h.actor==='gestore'?'Gestore':'Proprietario'} · ${esc(fmtDate(h.at))}</strong><p>${esc(h.text)}</p>${fileLink(h.attachment,'Scarica allegato storico')}</div>`).join('')}</div>${!manager&&['aperta','da-integrare'].includes(r.status)?form(p,'portal-request-reply',`<input type="hidden" name="requestId" value="${esc(r.id)}">${field('La tua risposta','response','','text',r.type==='dati')}${upload(r.type==='firma'?'Copia sottoscritta':r.type==='documento'?'Documento richiesto':'Allegato facoltativo','responseFile',['firma','documento'].includes(r.type))}${r.type==='conferma'?'<label><input type="checkbox" name="confirmed" value="yes" required> Confermo di aver completato quanto richiesto.</label>':''}${button('Invia risposta al gestore')}`):''}${manager&&r.status==='risposta-inviata'?form(p,'portal-request-review',`<input type="hidden" name="requestId" value="${esc(r.id)}">${field('Esito della verifica / motivo di integrazione','reason')}<div class="vpm-request-actions"><button class="btn-primary" type="submit" name="review" value="accept">Accetta e completa richiesta</button><button class="btn-secondary" type="submit" name="review" value="return">Richiedi integrazione</button></div>`):''}</article>`).join(''):empty('Non ci sono richieste aperte per questa pratica.')}</div>${legacy}${create}</section>`;
  }
  function portals(p,manager) {
    const v = data(p).portal || {}, c = getCliente(p) || {};
    const delegation = currentPortalDelegation(data(p));
    const body = select('Intestatario account','entity',['Persona fisica','Società'],v.entity)+field('Nome e cognome o ragione sociale','legalName',v.legalName||c.nome,'text',true)+field('Codice fiscale / identificativo fiscale','taxId',v.taxId||c.codiceFiscale||c.cf,'text',true)+field('Partita IVA, se applicabile','vat',v.vat||c.partitaIva)+field('Nome rappresentante, se società','representative',v.representative)+field('Indirizzo intestatario','address',v.address||c.indirizzo,'text',true)+field('Email del proprietario per gli account','email',v.email||c.email,'email',true)+field('Telefono','phone',v.phone||c.telefono,'tel',true)+field('Beneficiario degli incassi','beneficiary',v.beneficiary||c.nome,'text',true)+field('IBAN beneficiario','iban',v.iban,'text',true)+select('Portali da attivare','platforms',['Booking e Airbnb','Booking','Airbnb'],v.platforms)+select('Account Booking esistente','bookingExisting',['No','Sì'],v.bookingExisting)+field('Email account Booking / link annuncio','bookingAccount',v.bookingAccount)+select('Account Airbnb esistente','airbnbExisting',['No','Sì'],v.airbnbExisting)+field('Email account Airbnb / link annuncio','airbnbAccount',v.airbnbAccount)+field('Nome struttura','accommodation',v.accommodation||p.nome,'text',true)+field('Indirizzo struttura','propertyAddress',v.propertyAddress||p.indirizzo,'text',true)+field('CIN / CIR / altri codici struttura','registration',v.registration)+field('Camere e posti letto','capacity',v.capacity)+field('Note per il gestore','notes',v.notes);
    const requestForm=!manager?form(p,'portal-service-request',select('Servizio richiesto','platforms',['Booking e Airbnb','Booking','Airbnb'],v.platforms)+field('Nota facoltativa per il gestore','notes',v.notes)+note('Il gestore prepara i dati per l’attivazione. Le deleghe sono richiamate dal contratto di servizio. Puoi richiedere il servizio anche prima della sottoscrizione del contratto.')+button(v.submittedAt?'Aggiorna richiesta servizio':'Richiedi servizio')):'';
    return `<h2>Booking e Airbnb</h2><p>Stato pratica: <strong>${esc(v.status||'Servizio non richiesto')}</strong></p>${portalNotice(p)}${requestForm}${requestThreads(p,manager)}${note('Il proprietario decide i prezzi e riceve gli incassi sul proprio conto. Il gestore inserisce i dati e segue l’attivazione. Non inserire password.')}<p>Autorizzazione servizio: ${delegation?'verificata':'in attesa del contratto e delle deleghe richiamate'}</p>${manager?form(p,'portal-save',`<h3>Dati operativi a cura del gestore</h3><div class="field-row">${body}</div>${upload('Documento identità, se necessario','identityFile',false)}${fileLink(v.identityFile,'Documento identità caricato')}${upload('Documento società, se necessario','companyFile',false)}${fileLink(v.companyFile,'Documento società caricato')}${button('Salva dati operativi')}`)+form(p,'portal-status',select('Stato pratica','status',portalStatuses,v.status||'Bozza')+field('Attività richiesta al proprietario','managerNotes',v.managerNotes)+button('Aggiorna pratica')):''}${v.managerNotes?`<div class="vpm-owner-empty">Richiesta del gestore: ${esc(v.managerNotes)}</div>`:''}`;
  }

  function guests(p,manager) {
    const gs=data(p).guests||{}, bookings=p.prenotazioni||[];
    const delegation=authorization(data(p),'comunicazioni');
    if(!manager)return '';
    return `<h2>Ospiti e adempimenti</h2>${note('I dati sono collegati alla prenotazione. Questa schermata prepara e registra il lavoro manuale, senza trasmissioni automatiche alle autorità. Raccogli solo i dati necessari agli adempimenti applicabili.')}<p>Autorizzazione comunicazioni ospiti: ${delegation?'verificata':'in attesa del contratto e delle deleghe richiamate'}</p>${bookings.length ? bookings.filter(b=>b.stato!=='rifiutata').map(b=>{const group=gs[b.id]||{people:[],status:'Da preparare'};return `<section class="vpm-owner-form"><h3>${esc(b.nome||'Prenotazione')} · ${esc(b.checkin)} / ${esc(b.checkout)}</h3><p>Adempimenti: ${esc(group.status)}</p>${(group.people||[]).map(g=>`<div class="vpm-owner-doc"><div><strong>${esc(g.firstName)} ${esc(g.lastName)}</strong><small>${esc(g.nationality)} · Nato/a ${esc(g.birthDate)} a ${esc(g.birthPlace)} · ${esc(g.documentType)} ${esc(g.documentNumber)}</small></div><button type="button" class="icon-btn" data-service-action="guest-remove" data-service-property="${esc(p.id)}" data-booking="${esc(b.id)}" data-id="${esc(g.id)}">Rimuovi</button></div>`).join('')}${form(p,'guest-add',`<input type="hidden" name="booking" value="${esc(b.id)}"><h4>Aggiungi ospite effettivo</h4><div class="field-row">${field('Nome','firstName','','text',true)}${field('Cognome','lastName','','text',true)}${field('Data di nascita','birthDate','','date',true)}${field('Luogo di nascita','birthPlace','','text',true)}${field('Cittadinanza','nationality','','text',true)}${select('Tipo documento','documentType',['Carta di identità','Passaporto','Altro'])}${field('Numero documento','documentNumber','','text',true)}${field('Autorità / luogo rilascio','issuedBy')}</div>${button('Aggiungi ospite')}`)}${manager?form(p,'guest-status',`<input type="hidden" name="booking" value="${esc(b.id)}">${select('Stato adempimenti','status',['Da preparare','Dati incompleti','Pronti per trasmissione','Trasmessi manualmente'],group.status)}${field('Riferimento / note trasmissione','reference',group.reference)}${upload('Ricevuta trasmissione facoltativa','receipt',false)}${fileLink(group.receipt,'Scarica ricevuta')}${button('Aggiorna adempimenti')}`):''}</section>`;}).join(''):empty('Non ci sono prenotazioni. Aggiungi prima una prenotazione per registrare gli ospiti.')}`;
  }
  function shop(p,manager) {
    const s=data(p),catalog=s.catalog||[],orders=s.orders||[];
    return `<h2>Shop e servizi</h2>${note('Acquista prodotti e pacchetti per il tuo immobile. Gli ordini con prezzo da definire richiedono un preventivo. Nessun pagamento viene eseguito da questa schermata.')} ${manager?form(p,'catalog-add',field('Nome prodotto o pacchetto','name','','text',true)+field('Contenuto e quantità incluse','description','','text',true)+select('Tipo fornitura','kind',['Acquisto corredo','Servizio con ricambio e lavaggio','Altro servizio'])+field('Prezzo totale EUR, imposte incluse. Vuoto = su preventivo','price','','number')+button('Aggiungi al catalogo')):''}${catalog.length?catalog.filter(x=>manager||x.active!==false).map(item=>`<section class="vpm-owner-form"><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><p>${esc(item.kind)} · ${item.price===null?'Su preventivo':money(item.price)}</p>${manager?`<button type="button" class="icon-btn" data-service-action="catalog-toggle" data-service-property="${esc(p.id)}" data-id="${esc(item.id)}">${item.active===false?'Rendi disponibile':'Sospendi acquisti'}</button>`:form(p,'order-add',`<input type="hidden" name="product" value="${esc(item.id)}">${field('Quantità pacchetti','quantity','1','number',true)}${field('Camera o destinazione','room')}${field('Note consegna','notes')}<label><input type="checkbox" name="confirm" required> Confermo la richiesta per questo immobile${item.price===null?' e richiedo un preventivo':''}.</label>${button(item.price===null?'Richiedi preventivo':'Invia ordine')}`)}</section>`).join(''):empty('Il catalogo sarà pubblicato dal gestore. Sono previsti corredi con lenzuola e asciugamani e pacchetti di servizio.')}<h3>I tuoi ordini</h3>${orders.length?orders.slice().reverse().map(o=>`<section class="vpm-owner-form"><h4>${esc(o.name)}</h4><p>${Number(o.quantity)} pacchetti · ${o.total===null?'Preventivo da definire':money(o.total)} · ${esc(o.status)}</p><p>${esc(o.room||'Intero immobile')} ${esc(o.notes)}</p><p>Pagamento: ${esc(o.paymentStatus||'Da definire')}</p>${fileLink(o.invoice,'Scarica fattura')}${manager?form(p,'order-status',`<input type="hidden" name="id" value="${esc(o.id)}">${select('Stato ordine','status',['Richiesta preventivo','Ordine ricevuto','Preventivo inviato','In lavorazione','Consegnato / eseguito','Annullato'],o.status)}${select('Stato pagamento verificato','paymentStatus',['Da definire','Da pagare','Pagato verificato'],o.paymentStatus||'Da definire')}${upload('Fattura facoltativa','invoice',false)}${button('Aggiorna ordine')}`):''}</section>`).join(''):empty('Nessun ordine registrato.')}`;
  }
  window.vpmServicesPending = function(p,role) {
    const s=data(p), manager=role==='gestore', items=[];
    (s.documents||[]).forEach(d=>{
      if(manager && ['Copia ricevuta, da verificare','Da verificare'].includes(d.status)) items.push({tab:'contratti',title:'Verifica copia sottoscritta: '+d.title});
      if(!manager && d.kind==='Contratto di servizio'&&d===latestKind(s,'Contratto di servizio')&&['Da firmare','Da correggere'].includes(d.status)) items.push({tab:'contratti',title:'Documento da sottoscrivere: '+d.title});
    });
    const portal=s.portal||{};
    (portal.requests||[]).forEach(r=>{
      if(manager&&r.status==='risposta-inviata')items.push({tab:'portali',title:'Verifica risposta: '+r.title,requestId:r.id,status:r.status});
      if(!manager&&['aperta','da-integrare'].includes(r.status))items.push({tab:'portali',title:(r.status==='da-integrare'?'Integra risposta: ':'Rispondi alla richiesta: ')+r.title,requestId:r.id,status:r.status});
    });
    if(manager && ['Dati inviati al gestore','Attivazione in corso','Verifiche del gestore'].includes(portal.status)) items.push({tab:'portali',title:'Pratica portali: '+portal.status});
    if(!manager && ['Dati mancanti','Azione richiesta al proprietario'].includes(portal.status)) items.push({tab:'portali',title:'Completa pratica portali'});
    (s.orders||[]).forEach(o=>{
      if(manager && !['Consegnato / eseguito','Annullato'].includes(o.status)) items.push({tab:'shop',title:'Ordine da gestire: '+o.name});
      if(!manager && o.status!=='Annullato' && o.paymentStatus==='Da pagare') items.push({tab:'shop',title:'Pagamento ordine: '+o.name});
    });
    if(manager) Object.entries(s.guests||{}).forEach(([id,g])=>{
      if(g.status!=='Trasmessi manualmente' && (p.prenotazioni||[]).some(b=>b.id===id&&b.stato!=='rifiutata')) items.push({tab:'ospiti',title:'Adempimenti ospiti da completare'});
    });
    return {count:items.length,title:'Attività servizi',items};
  };
  window.vpmServicesRender = function(p,role,tab) {
    if(!p || (tab==='ospiti'&&role!=='gestore')) return '';
    const manager=role==='gestore';
    return ({contratti:documents,portali:portals,ospiti:guests,shop})[tab]?.(p,manager)||'';
  };
  document.addEventListener('submit',async event=>{
    const f=event.target.closest('[data-service-form]'); if(!f)return;
    event.preventDefault(); event.stopImmediatePropagation();
    const p=state.properties.find(p=>p.id===f.dataset.serviceProperty);if(!p)return;
    const action=f.dataset.serviceForm,manager=['document-add','document-status','document-metadata','portal-save','portal-status','guest-status','catalog-add','order-status','portal-request-add','portal-request-review','portal-request-from-note'].includes(action);
    if(action==='guest-service-request'||(action.startsWith('guest-')&&state.view!=='gestore')){alert('Funzione riservata al gestore.');return;}
    const actionModule=action.startsWith('guest-')?'prenotazioni':/^(catalog|order)-/.test(action)?'spese':null;
    if(!can(p,manager,actionModule)){alert('Accesso non consentito.');return;}
    if(['portal-request-reply','portal-service-request','guest-service-request','delegation-request','document-sign'].includes(action)&&state.view!=='proprietari'){alert('Questa azione spetta al proprietario.');return;}
    if(f.dataset.busy==='true')return;
    const fd=new FormData(f),get=k=>String(fd.get(k)||'').trim();
    const sending=action==='portal-save'&&(event.submitter?.value==='send'||get('send')==='yes');
    if(sending&&typeof f.checkValidity==='function'&&!f.checkValidity()){
      portalError(f,'Completa i campi obbligatori evidenziati prima di inviare la richiesta. Per conservare i dati parziali usa Salva bozza.');
      f.reportValidity();return;
    }
    const previousServices=p.vpmServices?JSON.parse(JSON.stringify(p.vpmServices)):null;
    const previousNotifications=JSON.parse(JSON.stringify(p.notifiche||[]));
    const s=ensure(p),b=f.querySelector('[type=submit]');
    const submitButtons=Array.from(f.querySelectorAll?f.querySelectorAll('[type=submit]'):b?[b]:[]);
    f.dataset.busy='true';submitButtons.forEach(button=>button.disabled=true);
    try{
      if(action==='document-add') { const file=await fileFrom(f.elements.document,true);if(!get('title')||!['Contratto di servizio','Delega portali','Delega comunicazioni ospiti','Altro'].includes(get('kind')))throw Error('Indica titolo e tipo documento validi.');const same=s.documents.filter(d=>d.kind===get('kind'));const scopes=Object.keys(scopeNames).filter(k=>get('scope_'+k)==='yes'),delegationRefs=s.documents.filter(d=>get('ref_'+d.id)==='yes'&&Object.values(scopeKinds).includes(d.kind)).map(d=>d.id);s.documents.push({id:uid(),title:get('title'),kind:get('kind'),expiry:get('expiry'),version:same.length+1,status:get('kind')==='Contratto di servizio'?'Da firmare':'Da verificare',file,scopes:get('kind')==='Contratto di servizio'?scopes:[],delegationRefs:get('kind')==='Contratto di servizio'?delegationRefs:[],createdAt:new Date().toISOString()}); }
      else if(action==='document-metadata'){
        const d=s.documents.find(d=>d.id===get('id'));if(!d||d.kind!=='Contratto di servizio')throw Error('Contratto non trovato.');
        const scopes=Object.keys(scopeNames).filter(k=>get('scope_'+k)==='yes'),delegationRefs=s.documents.filter(x=>Object.values(scopeKinds).includes(x.kind)&&get('ref_'+x.id)==='yes').map(x=>x.id);
        if(JSON.stringify(scopes)!==JSON.stringify(d.scopes||[])||JSON.stringify(delegationRefs)!==JSON.stringify(d.delegationRefs||[])){
          (d.metadataHistory||(d.metadataHistory=[])).push({at:new Date().toISOString(),scopes:d.scopes||[],delegationRefs:d.delegationRefs||[],status:d.status});
          d.scopes=scopes;d.delegationRefs=delegationRefs;d.status=d.signedFile?'Copia ricevuta, da verificare':'Da firmare';delete d.verifiedAt;
        }
      }
      else if(action==='document-sign'){const d=s.documents.find(d=>d.id===get('id'));if(!d)throw Error('Documento non trovato.');if(d.kind!=='Contratto di servizio'||d!==latestKind(s,'Contratto di servizio'))throw Error('Invia solo la copia del contratto di servizio corrente. Le deleghe sono allegate dal gestore.');if(d.signedFile)(d.signedHistory||(d.signedHistory=[])).push({file:d.signedFile,uploadedAt:d.signedUploadedAt,status:d.status});d.signedFile=await fileFrom(f.elements.document,true);d.status='Copia ricevuta, da verificare';d.signedUploadedAt=new Date().toISOString();}
      else if(action==='document-status'){const d=s.documents.find(d=>d.id===get('id'));if(!d)throw Error('Documento non trovato.');if(get('status')==='Firmato verificato'&&!d.signedFile)throw Error('Occorre prima la copia sottoscritta.');if(!['Da firmare','Copia ricevuta, da verificare','Firmato verificato','Allegato contrattuale verificato','Da correggere'].includes(get('status')))throw Error('Stato documento non valido.');if(get('status')==='Allegato contrattuale verificato'&&(!Object.values(scopeKinds).includes(d.kind)||!d.file))throw Error('Verifica un allegato di delega con documento caricato.');d.status=get('status');d.verifiedAt=new Date().toISOString();}
      else if(action==='delegation-request'){throw Error('Richiedi il servizio. Il gestore prepara il contratto con le deleghe richiamate.');}
      else if(action==='portal-service-request'){
        if(!['Booking e Airbnb','Booking','Airbnb'].includes(get('platforms')))throw Error('Seleziona il servizio richiesto.');
        const changed=s.portal.platforms&&s.portal.platforms!==get('platforms');const at=new Date().toISOString();(s.portal.serviceHistory||(s.portal.serviceHistory=[])).push({at,platforms:get('platforms'),notes:get('notes'),actor:'proprietario'});s.portal.platforms=get('platforms');s.portal.notes=get('notes');s.portal.submittedAt=s.portal.submittedAt||at;s.portal.updatedAt=at;if(!s.portal.status||s.portal.status==='Bozza')s.portal.status='Dati inviati al gestore';else if(changed&&['Attivazione in corso',...terminalStatuses].includes(s.portal.status))s.portal.status='Verifiche del gestore';
      }
      else if(action==='portal-request-from-note'){
        if(!String(s.portal.managerNotes||'').trim())throw Error('Non ci sono note da trasformare.');
        requestFromNote(s.portal,s.portal.managerNotes.trim());automaticPortalState(s.portal);
      }
      else if(action==='portal-request-add'){
        if(!requestTypes.includes(get('requestType'))||!get('title')||!get('details'))throw Error('Indica tipo, titolo e istruzioni della richiesta.');
        const deadline=get('deadline');if(deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||Number.isNaN(Date.parse(deadline+'T12:00:00Z'))||new Date(deadline+'T12:00:00Z').toISOString().slice(0,10)!==deadline))throw Error('Inserisci una scadenza valida.');
        const attachment=await fileFrom(f.elements.requestFile,false),at=new Date().toISOString();
        const request={id:uid(),type:get('requestType'),title:get('title'),details:get('details'),deadline:get('deadline'),required:get('required')==='yes',status:'aperta',createdAt:at,replies:[],history:[{id:uid(),actor:'gestore',at,text:'Richiesta inviata: '+get('details'),attachment}]};
        if(attachment)request.file=attachment;
        (s.portal.requests||(s.portal.requests=[])).push(request);automaticPortalState(s.portal);
      }
      else if(action==='portal-request-reply'){
        const request=(s.portal.requests||[]).find(r=>r.id===get('requestId'));if(!request)throw Error('Richiesta non trovata.');
        if(!['aperta','da-integrare'].includes(request.status))throw Error('La risposta è già in verifica o la richiesta è completata.');
        const attachment=await fileFrom(f.elements.responseFile,['documento','firma'].includes(request.type));
        if(request.type==='dati'&&!get('response'))throw Error('Scrivi i dati richiesti nella risposta.');
        if(request.type==='conferma'&&get('confirmed')!=='yes')throw Error('Conferma di aver completato l’attività richiesta.');
        if(!get('response')&&!attachment&&get('confirmed')!=='yes')throw Error('Inserisci una risposta o un allegato.');
        const reply={id:uid(),actor:'proprietario',at:new Date().toISOString(),text:get('response')||(request.type==='conferma'?'Attività confermata dal proprietario.':'Documento inviato dal proprietario.'),attachment,confirmed:get('confirmed')==='yes'};
        (request.replies||(request.replies=[])).push(reply);(request.history||(request.history=[])).push({...reply});request.latestResponseId=reply.id;request.status='risposta-inviata';automaticPortalState(s.portal);
      }
      else if(action==='portal-request-review'){
        const request=(s.portal.requests||[]).find(r=>r.id===get('requestId'));if(!request||request.status!=='risposta-inviata')throw Error('Non ci sono risposte in attesa di verifica per questa richiesta.');
        if(!(request.replies||[]).some(reply=>reply.id===request.latestResponseId))throw Error('La risposta da verificare non è disponibile. Richiedi al proprietario di inviarla nuovamente.');
        const decision=event.submitter?.value||get('review');if(!['accept','return'].includes(decision))throw Error('Scegli se accettare o richiedere un’integrazione.');
        if(decision==='return'&&!get('reason'))throw Error('Indica il motivo e cosa deve integrare il proprietario.');
        request.status=decision==='accept'?'completata':'da-integrare';
        (request.history||(request.history=[])).push({id:uid(),actor:'gestore',at:new Date().toISOString(),text:(decision==='accept'?'Risposta accettata. Richiesta completata.':'Integrazione richiesta: ')+get('reason'),responseId:request.latestResponseId});
        automaticPortalState(s.portal);
      }
      else if(action==='portal-save'){
        if(sending&&get('entity')==='Società'&&!get('representative'))throw Error('Indica il rappresentante della società.');
        const identityFile=await fileFrom(f.elements.identityFile,false),companyFile=await fileFrom(f.elements.companyFile,false);
        if(identityFile)s.portal.identityFile=identityFile;if(companyFile)s.portal.companyFile=companyFile;
        const iban=get('iban').replace(/\s/g,'').toUpperCase();if(sending&&!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban))throw Error('Controlla il formato IBAN.');
        for(const [k,v]of fd.entries())if(typeof v==='string'&&['entity','legalName','taxId','vat','representative','address','email','phone','beneficiary','iban','platforms','bookingExisting','bookingAccount','airbnbExisting','airbnbAccount','accommodation','propertyAddress','registration','capacity','notes'].includes(k))s.portal[k]=v.trim();s.portal.iban=iban;s.portal.status=sending?'Dati inviati al gestore':s.portal.submittedAt?s.portal.status||'Dati inviati al gestore':'Bozza';s.portal.updatedAt=new Date().toISOString();if(sending&&portalMissing(s.portal).length)throw Error('Completa i dati obbligatori: '+portalMissing(s.portal).join(', ')+'.');if(sending)s.portal.submittedAt=new Date().toISOString();if((s.portal.requests||[]).length)automaticPortalState(s.portal);
      }
      else if(action==='portal-status'){
        const status=get('status');if(!portalStatuses.includes(status))throw Error('Seleziona uno stato valido.');
        if(status==='Azione richiesta al proprietario'&&!get('managerNotes'))throw Error('Indica quale attività deve completare il proprietario.');
        if(['Attivazione in corso',...terminalStatuses].includes(status)&&!currentPortalDelegation(s))throw Error('Verifica prima il contratto corrente sottoscritto con il servizio portali e la delega richiamata, oppure una delega autonoma verificata e non scaduta.');
        if(terminalStatuses.includes(status)){
          if((s.portal.requests||[]).some(r=>r.required!==false&&r.status!=='completata'))throw Error('Completa prima tutte le richieste obbligatorie e verifica le risposte del proprietario.');
          const missing=portalMissing(s.portal);if(missing.length)throw Error('Completa prima i dati obbligatori della pratica: '+missing.join(', ')+'.');
        }
        s.portal.status=status;s.portal.managerNotes=get('managerNotes');
        if(status==='Azione richiesta al proprietario'){requestFromNote(s.portal,s.portal.managerNotes);automaticPortalState(s.portal);}
      }
      else if(action==='guest-add') {if(!(p.prenotazioni||[]).some(b=>b.id===get('booking')))throw Error('Prenotazione non trovata.');if(get('birthDate')>new Date().toISOString().slice(0,10))throw Error('La data di nascita non può essere futura.');const g=s.guests[get('booking')]||(s.guests[get('booking')]={people:[],status:'Da preparare'});g.people.push({id:uid(),firstName:get('firstName'),lastName:get('lastName'),birthDate:get('birthDate'),birthPlace:get('birthPlace'),nationality:get('nationality'),documentType:get('documentType'),documentNumber:get('documentNumber'),issuedBy:get('issuedBy')});g.status='Da preparare';}
      else if(action==='guest-status'){const g=s.guests[get('booking')];if(!g||!g.people.length)throw Error('Inserisci prima i dati degli ospiti.');if(['Pronti per trasmissione','Trasmessi manualmente'].includes(get('status'))&&!authorization(s,'comunicazioni'))throw Error('Verifica prima il contratto corrente con servizio comunicazioni ospiti e relativa delega richiamata.');if(get('status')==='Trasmessi manualmente'&&!get('reference'))throw Error('Inserisci un riferimento della trasmissione.');const receipt=await fileFrom(f.elements.receipt,false);Object.assign(g,{status:get('status'),reference:get('reference'),...(receipt?{receipt}:{})});}
      else if(action==='catalog-add'){const price=get('price')===''?null:Number(get('price'));if(price!==null&&(!Number.isFinite(price)||price<0))throw Error('Inserisci un prezzo valido.');s.catalog.push({id:uid(),name:get('name'),description:get('description'),kind:get('kind'),price,active:true});}
      else if(action==='order-add'){const product=s.catalog.find(x=>x.id===get('product')&&x.active!==false),q=Number(get('quantity'));if(!product||!Number.isInteger(q)||q<1||q>100)throw Error('Scegli una quantità tra 1 e 100.');s.orders.push({id:uid(),productId:product.id,name:product.name,description:product.description,quantity:q,unitPrice:product.price,total:product.price===null?null:Math.round(product.price*q*100)/100,room:get('room'),notes:get('notes'),status:product.price===null?'Richiesta preventivo':'Ordine ricevuto',paymentStatus:'Da definire',createdAt:new Date().toISOString()});}
      else if(action==='order-status'){const o=s.orders.find(o=>o.id===get('id'));if(!o)throw Error('Ordine non trovato.');const invoice=await fileFrom(f.elements.invoice,false);Object.assign(o,{status:get('status'),paymentStatus:get('paymentStatus'),...(invoice?{invoice}:{})});}
      if(typeof addNotifica==='function') {
        const notifications={
          'document-add':[(get('kind')==='Contratto di servizio'?'Nuovo contratto da sottoscrivere: ':'Nuovo allegato contrattuale disponibile: ')+get('title'),'proprietario','contratti'],
          'document-sign':['Copia sottoscritta ricevuta, da verificare.','gestore','contratti'],
          'document-metadata':['Collegamenti del contratto aggiornati dal gestore.','proprietario','contratti'],
          'portal-service-request':['Richiesta servizio Booking e Airbnb dal proprietario.','gestore','portali'],
          'portal-request-from-note':['Nuova richiesta di integrazione per la pratica Booking e Airbnb.','proprietario','portali'],
          'portal-request-add':['Nuova richiesta per la pratica Booking e Airbnb: '+get('title'),'proprietario','portali'],
          'portal-request-reply':['Risposta del proprietario ricevuta, da verificare.','gestore','portali'],
          'portal-request-review':['Verifica della tua risposta aggiornata. Consulta la richiesta nella pratica Booking e Airbnb.','proprietario','portali'],
          'order-add':['Nuovo ordine servizi del proprietario.','gestore','shop'],
          'portal-status':['Aggiornamento pratica Booking e Airbnb: '+get('status'),'proprietario','portali'],
          'order-status':['Aggiornamento ordine servizi: '+get('status'),'proprietario','shop']
        };
        if(action==='portal-save'&&sending) notifications[action]=['Dati Booking e Airbnb inviati dal proprietario.','gestore','portali'];
        const n=notifications[action]; if(n) addNotifica(p,n[0],n[1],n[2]);
      }
      const saved=await saveData({renderOnError:false});if(saved===false||state.error)throw Error(state.error||'Salvataggio non riuscito. Riprova.');
      portalFeedbackRole[p.id]=state.view;
      if(action==='portal-request-from-note')portalFeedback[p.id]='Nota trasformata in richiesta obbligatoria. Il proprietario può ora inviare la risposta.';
      if(action==='portal-request-add')portalFeedback[p.id]='Richiesta inviata al proprietario. La trovi nello storico della pratica.';
      if(action==='portal-request-reply')portalFeedback[p.id]='Risposta inviata al gestore. Rimane disponibile nello storico ed è in attesa di verifica.';
      if(action==='portal-request-review')portalFeedback[p.id]=(event.submitter?.value||get('review'))==='accept'?'Risposta accettata. Richiesta completata.':'Integrazione richiesta al proprietario. Il motivo è visibile nello storico.';
      if(action==='portal-status')portalFeedback[p.id]='Pratica aggiornata. Stato: '+s.portal.status+'. Il proprietario trova un avviso nella propria area.';
      if(action==='portal-save')portalFeedback[p.id]='Dati operativi salvati dal gestore.';
      if(action==='portal-service-request')portalFeedback[p.id]='Richiesta servizio inviata al gestore. Segui lo stato e rispondi alle eventuali richieste in questa sezione.';
      render();
    }catch(error){
      if(previousServices)p.vpmServices=previousServices;else delete p.vpmServices;
      p.notifiche=previousNotifications;f.dataset.busy='false';submitButtons.forEach(button=>button.disabled=false);
      if(action.startsWith('portal-')||action==='delegation-request')portalError(f,error.message||'Operazione non riuscita. Riprova.');
      else alert(error.message||'Operazione non riuscita.');
    }
  },true);
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-service-action]');if(!b)return;
    event.preventDefault();event.stopImmediatePropagation();
    const p=state.properties.find(p=>p.id===b.dataset.serviceProperty),action=b.dataset.serviceAction;if(!p||!can(p,action==='catalog-toggle',action==='catalog-toggle'?'spese':'prenotazioni'))return;
    if(action==='guest-remove'&&state.view!=='gestore')return;
    const s=ensure(p);
    if(action==='guest-remove'){if(!confirm('Rimuovere i dati di questo ospite?'))return;const g=s.guests[b.dataset.booking];if(g){g.people=g.people.filter(g=>g.id!==b.dataset.id);g.status='Da preparare';}}
    if(action==='catalog-toggle'){const item=s.catalog.find(x=>x.id===b.dataset.id);if(item)item.active=item.active===false;}
    await saveData();if(state.error){alert(state.error);return;}render();
  },true);
})();
