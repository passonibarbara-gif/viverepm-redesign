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
  function documents(p,manager) {
    const ds = data(p).documents || [];
    return `<h2>Contratto e deleghe</h2>${note('Contratti e deleghe sono condivisi con il gestore. Il caricamento di un file non equivale a una firma digitale. Il gestore verifica la copia sottoscritta.')} ${manager ? form(p,'document-add', field('Titolo','title','','text',true)+select('Tipo','kind',['Contratto di servizio','Delega portali','Delega comunicazioni ospiti','Altro'])+field('Scadenza facoltativa','expiry','','date')+upload('Documento da sottoscrivere')+button('Carica documento')) : ''}
    ${ds.length ? ds.map(d=>`<section class="vpm-owner-form"><h3>${esc(d.title)}</h3><p>${esc(d.kind)} · Versione ${Number(d.version)||1} · ${esc(d.status)}${d.expiry?' · Scadenza '+esc(d.expiry):''}</p>${fileLink(d.file,'Scarica originale')} ${fileLink(d.signedFile,'Scarica copia sottoscritta')}${!manager ? form(p,'document-sign',`<input type="hidden" name="id" value="${esc(d.id)}">${upload('Carica copia sottoscritta')}${button('Invia copia al gestore')}`) : form(p,'document-status',`<input type="hidden" name="id" value="${esc(d.id)}">${select('Verifica documento','status',['Da firmare','Copia ricevuta, da verificare','Firmato verificato','Da correggere'],d.status)}${button('Aggiorna verifica')}`)}</section>`).join('') : empty('Il gestore non ha ancora caricato contratti o deleghe.')}`;
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
  function currentPortalDelegation(s){const docs=(s.documents||[]).filter(d=>d.kind==='Delega portali');return docs.length>0&&signed(docs[docs.length-1]);}
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
    const body = select('Intestatario account','entity',['Persona fisica','Società'],v.entity)+field('Nome e cognome o ragione sociale','legalName',v.legalName||c.nome,'text',true)+field('Codice fiscale / identificativo fiscale','taxId',v.taxId,'text',true)+field('Partita IVA, se applicabile','vat',v.vat)+field('Nome rappresentante, se società','representative',v.representative)+field('Indirizzo intestatario','address',v.address,'text',true)+field('Email del proprietario per gli account','email',v.email||c.email,'email',true)+field('Telefono','phone',v.phone||c.telefono,'tel',true)+field('Beneficiario degli incassi','beneficiary',v.beneficiary,'text',true)+field('IBAN beneficiario','iban',v.iban,'text',true)+select('Portali da attivare','platforms',['Booking e Airbnb','Booking','Airbnb'],v.platforms)+select('Account Booking esistente','bookingExisting',['No','Sì'],v.bookingExisting)+field('Email account Booking / link annuncio','bookingAccount',v.bookingAccount)+select('Account Airbnb esistente','airbnbExisting',['No','Sì'],v.airbnbExisting)+field('Email account Airbnb / link annuncio','airbnbAccount',v.airbnbAccount)+field('Nome struttura','accommodation',v.accommodation||p.nome,'text',true)+field('Indirizzo struttura','propertyAddress',v.propertyAddress||p.indirizzo,'text',true)+field('CIN / CIR / altri codici struttura','registration',v.registration)+field('Camere e posti letto','capacity',v.capacity)+field('Note per il gestore','notes',v.notes);
    return `<h2>Booking e Airbnb</h2><p>Stato pratica: <strong>${esc(v.status||'Bozza')}</strong></p>${portalNotice(p)}${requestThreads(p,manager)}${note('Il proprietario decide i prezzi e riceve gli incassi sul proprio conto. Il gestore prepara l’inserimento dei dati. Le verifiche e le conferme richieste dai portali devono essere completate dal titolare. Non inserire password.')}<p>Delega portali: ${delegation?'copia sottoscritta verificata':'da completare in Contratto e deleghe'}</p>${manager ? `<div class="vpm-owner-form">${['legalName','taxId','vat','representative','address','email','phone','beneficiary','iban','platforms','bookingExisting','bookingAccount','airbnbExisting','airbnbAccount','accommodation','propertyAddress','registration','capacity','notes'].map(k=>`<p><strong>${esc({legalName:'Intestatario',taxId:'Codice fiscale',vat:'Partita IVA',representative:'Rappresentante',address:'Indirizzo',email:'Email',phone:'Telefono',beneficiary:'Beneficiario',iban:'IBAN',platforms:'Portali',bookingExisting:'Booking esistente',bookingAccount:'Account Booking',airbnbExisting:'Airbnb esistente',airbnbAccount:'Account Airbnb',accommodation:'Struttura',propertyAddress:'Indirizzo struttura',registration:'Codici struttura',capacity:'Capienza',notes:'Note'}[k])}:</strong> ${esc(v[k]||'Da compilare')}</p>`).join('')}${fileLink(v.identityFile,'Documento identità')} ${fileLink(v.companyFile,'Documento società')}</div>`+form(p,'portal-status',select('Stato pratica','status',portalStatuses,v.status||'Bozza')+field('Attività richiesta al proprietario','managerNotes',v.managerNotes)+button('Aggiorna pratica')) : form(p,'portal-save',`<div class="field-row">${body}</div>${upload('Documento identità intestatario o rappresentante, se richiesto','identityFile',false)}${fileLink(v.identityFile,'Documento identità caricato')}${upload('Visura o documento società, se applicabile','companyFile',false)}${fileLink(v.companyFile,'Documento società caricato')}${note('Puoi salvare una bozza anche se mancano dei dati. Quando hai completato i campi richiesti, invia la richiesta al gestore. La delega verrà completata prima dell’attivazione degli annunci.')}<div class="vpm-service-buttons"><button class="btn-secondary" type="submit" name="portalSubmit" value="draft">Salva bozza</button><button class="btn-primary" type="submit" name="portalSubmit" value="send">Invia richiesta al gestore</button></div>`)}${v.managerNotes?`<div class="vpm-owner-empty">Richiesta del gestore: ${esc(v.managerNotes)}</div>`:''}${!delegation&&!manager?form(p,'delegation-request','<p>Richiedi al gestore il documento di delega per Booking e Airbnb.</p>'+(v.delegationRequested?'<div class="vpm-service-feedback" role="status">Richiesta inviata al gestore il '+esc(fmtDate(v.delegationRequested))+'. Troverai il documento nella sezione Contratto e deleghe appena il gestore lo avrà caricato.</div><button class="btn-secondary" type="button" disabled>Richiesta già inviata</button>':button('Richiedi invio delega'))):''}`;
  }
  function guests(p,manager) {
    const gs=data(p).guests||{}, bookings=p.prenotazioni||[];
    const delegation=(data(p).documents||[]).some(d=>d.kind==='Delega comunicazioni ospiti'&&signed(d));
    return `<h2>Ospiti e adempimenti</h2>${note('I dati sono collegati alla prenotazione. Questa schermata prepara e registra il lavoro manuale, senza trasmissioni automatiche alle autorità. Raccogli solo i dati necessari agli adempimenti applicabili.')}<p>Delega comunicazioni ospiti: ${delegation?'verificata':'da completare in Contratto e deleghe'}</p>${bookings.length ? bookings.filter(b=>b.stato!=='rifiutata').map(b=>{const group=gs[b.id]||{people:[],status:'Da preparare'};return `<section class="vpm-owner-form"><h3>${esc(b.nome||'Prenotazione')} · ${esc(b.checkin)} / ${esc(b.checkout)}</h3><p>Adempimenti: ${esc(group.status)}</p>${(group.people||[]).map(g=>`<div class="vpm-owner-doc"><div><strong>${esc(g.firstName)} ${esc(g.lastName)}</strong><small>${esc(g.nationality)} · Nato/a ${esc(g.birthDate)} a ${esc(g.birthPlace)} · ${esc(g.documentType)} ${esc(g.documentNumber)}</small></div><button type="button" class="icon-btn" data-service-action="guest-remove" data-service-property="${esc(p.id)}" data-booking="${esc(b.id)}" data-id="${esc(g.id)}">Rimuovi</button></div>`).join('')}${form(p,'guest-add',`<input type="hidden" name="booking" value="${esc(b.id)}"><h4>Aggiungi ospite effettivo</h4><div class="field-row">${field('Nome','firstName','','text',true)}${field('Cognome','lastName','','text',true)}${field('Data di nascita','birthDate','','date',true)}${field('Luogo di nascita','birthPlace','','text',true)}${field('Cittadinanza','nationality','','text',true)}${select('Tipo documento','documentType',['Carta di identità','Passaporto','Altro'])}${field('Numero documento','documentNumber','','text',true)}${field('Autorità / luogo rilascio','issuedBy')}</div>${button('Aggiungi ospite')}`)}${manager?form(p,'guest-status',`<input type="hidden" name="booking" value="${esc(b.id)}">${select('Stato adempimenti','status',['Da preparare','Dati incompleti','Pronti per trasmissione','Trasmessi manualmente'],group.status)}${field('Riferimento / note trasmissione','reference',group.reference)}${upload('Ricevuta trasmissione facoltativa','receipt',false)}${fileLink(group.receipt,'Scarica ricevuta')}${button('Aggiorna adempimenti')}`):''}</section>`;}).join(''):empty('Non ci sono prenotazioni. Aggiungi prima una prenotazione per registrare gli ospiti.')}`;
  }
  function shop(p,manager) {
    const s=data(p),catalog=s.catalog||[],orders=s.orders||[];
    return `<h2>Shop e servizi</h2>${note('Acquista prodotti e pacchetti per il tuo immobile. Gli ordini con prezzo da definire richiedono un preventivo. Nessun pagamento viene eseguito da questa schermata.')} ${manager?form(p,'catalog-add',field('Nome prodotto o pacchetto','name','','text',true)+field('Contenuto e quantità incluse','description','','text',true)+select('Tipo fornitura','kind',['Acquisto corredo','Servizio con ricambio e lavaggio','Altro servizio'])+field('Prezzo totale EUR, imposte incluse. Vuoto = su preventivo','price','','number')+button('Aggiungi al catalogo')):''}${catalog.length?catalog.filter(x=>manager||x.active!==false).map(item=>`<section class="vpm-owner-form"><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><p>${esc(item.kind)} · ${item.price===null?'Su preventivo':money(item.price)}</p>${manager?`<button type="button" class="icon-btn" data-service-action="catalog-toggle" data-service-property="${esc(p.id)}" data-id="${esc(item.id)}">${item.active===false?'Rendi disponibile':'Sospendi acquisti'}</button>`:form(p,'order-add',`<input type="hidden" name="product" value="${esc(item.id)}">${field('Quantità pacchetti','quantity','1','number',true)}${field('Camera o destinazione','room')}${field('Note consegna','notes')}<label><input type="checkbox" name="confirm" required> Confermo la richiesta per questo immobile${item.price===null?' e richiedo un preventivo':''}.</label>${button(item.price===null?'Richiedi preventivo':'Invia ordine')}`)}</section>`).join(''):empty('Il catalogo sarà pubblicato dal gestore. Sono previsti corredi con lenzuola e asciugamani e pacchetti di servizio.')}<h3>I tuoi ordini</h3>${orders.length?orders.slice().reverse().map(o=>`<section class="vpm-owner-form"><h4>${esc(o.name)}</h4><p>${Number(o.quantity)} pacchetti · ${o.total===null?'Preventivo da definire':money(o.total)} · ${esc(o.status)}</p><p>${esc(o.room||'Intero immobile')} ${esc(o.notes)}</p><p>Pagamento: ${esc(o.paymentStatus||'Da definire')}</p>${fileLink(o.invoice,'Scarica fattura')}${manager?form(p,'order-status',`<input type="hidden" name="id" value="${esc(o.id)}">${select('Stato ordine','status',['Richiesta preventivo','Ordine ricevuto','Preventivo inviato','In lavorazione','Consegnato / eseguito','Annullato'],o.status)}${select('Stato pagamento verificato','paymentStatus',['Da definire','Da pagare','Pagato verificato'],o.paymentStatus||'Da definire')}${upload('Fattura facoltativa','invoice',false)}${button('Aggiorna ordine')}`):''}</section>`).join(''):empty('Nessun ordine registrato.')}`;
  }
  window.vpmServicesPending = function(p,role) {
    const s=data(p), manager=role==='gestore', items=[];
    (s.documents||[]).forEach(d=>{
      if(manager && d.status==='Copia ricevuta, da verificare') items.push({tab:'contratti',title:'Verifica copia sottoscritta: '+d.title});
      if(!manager && ['Da firmare','Da correggere'].includes(d.status)) items.push({tab:'contratti',title:'Documento da sottoscrivere: '+d.title});
    });
    const portal=s.portal||{};
    (portal.requests||[]).forEach(r=>{
      if(manager&&r.status==='risposta-inviata')items.push({tab:'portali',title:'Verifica risposta: '+r.title,requestId:r.id,status:r.status});
      if(!manager&&['aperta','da-integrare'].includes(r.status))items.push({tab:'portali',title:(r.status==='da-integrare'?'Integra risposta: ':'Rispondi alla richiesta: ')+r.title,requestId:r.id,status:r.status});
    });
    if(manager && portal.delegationRequested && !(s.documents||[]).some(d=>d.kind==='Delega portali')) items.push({tab:'portali',title:'Invia delega Booking e Airbnb'});
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
    if(!p) return '';
    const manager=role==='gestore';
    return ({contratti:documents,portali:portals,ospiti:guests,shop})[tab]?.(p,manager)||'';
  };
  document.addEventListener('submit',async event=>{
    const f=event.target.closest('[data-service-form]'); if(!f)return;
    event.preventDefault(); event.stopImmediatePropagation();
    const p=state.properties.find(p=>p.id===f.dataset.serviceProperty);if(!p)return;
    const action=f.dataset.serviceForm,manager=['document-add','document-status','portal-status','guest-status','catalog-add','order-status','portal-request-add','portal-request-review','portal-request-from-note'].includes(action);
    const actionModule=action.startsWith('guest-')?'prenotazioni':/^(catalog|order)-/.test(action)?'spese':null;
    if(!can(p,manager,actionModule)){alert('Accesso non consentito.');return;}
    if(['portal-request-reply','portal-save','delegation-request','document-sign'].includes(action)&&state.view!=='proprietari'){alert('Questa azione spetta al proprietario.');return;}
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
      if(action==='document-add') { const file=await fileFrom(f.elements.document,true);const same=s.documents.filter(d=>d.kind===get('kind'));s.documents.push({id:uid(),title:get('title'),kind:get('kind'),expiry:get('expiry'),version:same.length+1,status:'Da firmare',file,createdAt:new Date().toISOString()}); }
      else if(action==='document-sign'){const d=s.documents.find(d=>d.id===get('id'));if(!d)throw Error('Documento non trovato.');d.signedFile=await fileFrom(f.elements.document,true);d.status='Copia ricevuta, da verificare';d.signedUploadedAt=new Date().toISOString();}
      else if(action==='document-status'){const d=s.documents.find(d=>d.id===get('id'));if(!d)throw Error('Documento non trovato.');if(get('status')==='Firmato verificato'&&!d.signedFile)throw Error('Occorre prima la copia sottoscritta.');d.status=get('status');}
      else if(action==='delegation-request'){if(s.portal.delegationRequested){portalFeedback[p.id]='La richiesta di delega è già stata inviata al gestore.';render();return;}s.portal.delegationRequested=new Date().toISOString();}
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
        if(['Attivazione in corso',...terminalStatuses].includes(status)&&!currentPortalDelegation(s))throw Error('Verifica prima la copia sottoscritta della delega portali corrente, non scaduta.');
        if(terminalStatuses.includes(status)){
          if((s.portal.requests||[]).some(r=>r.required!==false&&r.status!=='completata'))throw Error('Completa prima tutte le richieste obbligatorie e verifica le risposte del proprietario.');
          const missing=portalMissing(s.portal);if(missing.length)throw Error('Completa prima i dati obbligatori della pratica: '+missing.join(', ')+'.');
        }
        s.portal.status=status;s.portal.managerNotes=get('managerNotes');
        if(status==='Azione richiesta al proprietario'){requestFromNote(s.portal,s.portal.managerNotes);automaticPortalState(s.portal);}
      }
      else if(action==='guest-add') {if(!(p.prenotazioni||[]).some(b=>b.id===get('booking')))throw Error('Prenotazione non trovata.');if(get('birthDate')>new Date().toISOString().slice(0,10))throw Error('La data di nascita non può essere futura.');const g=s.guests[get('booking')]||(s.guests[get('booking')]={people:[],status:'Da preparare'});g.people.push({id:uid(),firstName:get('firstName'),lastName:get('lastName'),birthDate:get('birthDate'),birthPlace:get('birthPlace'),nationality:get('nationality'),documentType:get('documentType'),documentNumber:get('documentNumber'),issuedBy:get('issuedBy')});g.status='Da preparare';}
      else if(action==='guest-status'){const g=s.guests[get('booking')];if(!g||!g.people.length)throw Error('Inserisci prima i dati degli ospiti.');if(['Pronti per trasmissione','Trasmessi manualmente'].includes(get('status'))&&!s.documents.some(d=>d.kind==='Delega comunicazioni ospiti'&&signed(d)))throw Error('Verifica prima la delega comunicazioni ospiti.');if(get('status')==='Trasmessi manualmente'&&!get('reference'))throw Error('Inserisci un riferimento della trasmissione.');const receipt=await fileFrom(f.elements.receipt,false);Object.assign(g,{status:get('status'),reference:get('reference'),...(receipt?{receipt}:{})});}
      else if(action==='catalog-add'){const price=get('price')===''?null:Number(get('price'));if(price!==null&&(!Number.isFinite(price)||price<0))throw Error('Inserisci un prezzo valido.');s.catalog.push({id:uid(),name:get('name'),description:get('description'),kind:get('kind'),price,active:true});}
      else if(action==='order-add'){const product=s.catalog.find(x=>x.id===get('product')&&x.active!==false),q=Number(get('quantity'));if(!product||!Number.isInteger(q)||q<1||q>100)throw Error('Scegli una quantità tra 1 e 100.');s.orders.push({id:uid(),productId:product.id,name:product.name,description:product.description,quantity:q,unitPrice:product.price,total:product.price===null?null:Math.round(product.price*q*100)/100,room:get('room'),notes:get('notes'),status:product.price===null?'Richiesta preventivo':'Ordine ricevuto',paymentStatus:'Da definire',createdAt:new Date().toISOString()});}
      else if(action==='order-status'){const o=s.orders.find(o=>o.id===get('id'));if(!o)throw Error('Ordine non trovato.');const invoice=await fileFrom(f.elements.invoice,false);Object.assign(o,{status:get('status'),paymentStatus:get('paymentStatus'),...(invoice?{invoice}:{})});}
      if(typeof addNotifica==='function') {
        const notifications={
          'document-add':['Nuovo documento da sottoscrivere: '+get('title'),'proprietario','contratti'],
          'document-sign':['Copia sottoscritta ricevuta, da verificare.','gestore','contratti'],
          'delegation-request':['Richiesta invio delega Booking e Airbnb.','gestore','portali'],
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
      const saved=await saveData();if(saved===false||state.error)throw Error(state.error||'Salvataggio non riuscito. Riprova.');
      portalFeedbackRole[p.id]=state.view;
      if(action==='portal-request-from-note')portalFeedback[p.id]='Nota trasformata in richiesta obbligatoria. Il proprietario può ora inviare la risposta.';
      if(action==='portal-request-add')portalFeedback[p.id]='Richiesta inviata al proprietario. La trovi nello storico della pratica.';
      if(action==='portal-request-reply')portalFeedback[p.id]='Risposta inviata al gestore. Rimane disponibile nello storico ed è in attesa di verifica.';
      if(action==='portal-request-review')portalFeedback[p.id]=(event.submitter?.value||get('review'))==='accept'?'Risposta accettata. Richiesta completata.':'Integrazione richiesta al proprietario. Il motivo è visibile nello storico.';
      if(action==='portal-status')portalFeedback[p.id]='Pratica aggiornata. Stato: '+s.portal.status+'. Il proprietario trova un avviso nella propria area.';
      if(action==='portal-save')portalFeedback[p.id]=sending?'Richiesta inviata al gestore. Puoi seguire lo stato della pratica in questa sezione.':'Bozza salvata. Puoi completare i dati e inviare la richiesta in un secondo momento.';
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
    const s=ensure(p);
    if(action==='guest-remove'){if(!confirm('Rimuovere i dati di questo ospite?'))return;const g=s.guests[b.dataset.booking];if(g){g.people=g.people.filter(g=>g.id!==b.dataset.id);g.status='Da preparare';}}
    if(action==='catalog-toggle'){const item=s.catalog.find(x=>x.id===b.dataset.id);if(item)item.active=item.active===false;}
    await saveData();if(state.error){alert(state.error);return;}render();
  },true);
})();
