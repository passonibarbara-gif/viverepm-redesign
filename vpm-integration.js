/* Navigation integration, read-only legacy prices and isolated review data. */
function vpmNewTabAllowed(tab){
  const modules={camere:'prenotazioni',tariffe:'listino',economia:'spese',contratti:'anagrafica',portali:'anagrafica',ospiti:'prenotazioni',shop:'spese'};
  return Object.hasOwn(modules,tab)&&(state.view==='proprietari'||modules[tab]==='anagrafica'||haModulo(modules[tab]));
}
function vpmRenderNewTab(p,role,tab){
  return ['camere','tariffe','economia'].includes(tab)?window.vpmRoomsRender(p,role,tab):window.vpmServicesRender(p,role,tab);
}
const vpmOriginalSpese=renderSpese;
renderSpese=function(p,role){
  return `<div class="vpm-owner-section-intro orange"><div><strong>Spese e scadenze</strong><small>Il proprietario paga le proprie spese. I bonifici dichiarati attendono la verifica del gestore.</small></div></div>${renderCalendar([],state.calendarOffset)}${role==='gestore'?'<button class="add-inline" data-action="new-expense">+ Carica bolletta o altra spesa</button>':''}${vpmOriginalSpese(p,role)}`;
};
const vpmLegacyRaw=renderModalRaw;
renderModalRaw=function(){
  const html=vpmLegacyRaw();
  if(state.modal?.type!=='property')return html;
  const box=document.createElement('div');box.innerHTML=html;
  box.querySelectorAll('[name="prezzoNotte"],[name="percentualeProprietario"]').forEach(el=>{
    const field=el.closest('.field')||el.parentElement;
    field.innerHTML='<p class="vpm-owner-hint">Le tariffe vengono decise dal proprietario nella sezione Tariffe. Incassi diretti al proprietario, compenso Vivere PM 25% secondo la base concordata.</p>';
  });
  return box.innerHTML;
};
// Clarify payer/recipient in legacy booking labels and reporting.
const vpmLegacyBookings=renderPrenotazioni;
renderPrenotazioni=function(p){return vpmLegacyBookings(p).replaceAll('Segna pagamento ricevuto','Registra incasso ricevuto dal proprietario').replaceAll('✓ pagamento ricevuto','✓ incasso del proprietario registrato');};
const vpmLegacyFinance=renderContabilitaPortfolio;
renderContabilitaPortfolio=function(){return '<div class="vpm-owner-empty" style="margin:16px">Movimenti degli immobili dei proprietari. Per compensi e fatture Vivere PM, apri la sezione Incassi e compensi del singolo immobile.</div>'+vpmLegacyFinance();};
// Old agency payout PDFs are replaced with an explicit reservation and fee report.
scaricaReport=function(p){
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=[['Immobile','Prenotazione','Arrivo','Partenza','Totale prenotazione EUR','Incasso proprietario','Compenso Vivere PM 25% EUR'],...(p.prenotazioni||[]).map(b=>[p.nome,b.nome,b.checkin,b.checkout,b.totale||0,b.vpmOwnerReceived?'Confermato':'Da confermare',window.vpmRoomFee(p,b)??'Base o dati da definire'])];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='viverepm-riepilogo.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
// Reservation booking never lets the manager overwrite the owner's period tariffs.
const vpmLegacySaveProperty=saveProperty;
saveProperty=function(data,id){
  const existing=state.properties.find(p=>p.id===id);
  if(state.view==='gestore')data={...data,prezzoNotte:existing?.prezzoNotte||0};
  return vpmLegacySaveProperty(data,id);
};
// The existing public booking wizard manages whole properties only. Room inventory
// is managed in the dedicated room calendar and through the owner's portals.
const vpmLegacyAvailable=propertyAvailableForDates;
propertyAvailableForDates=function(p,...args){if(p.vpmRooms?.units?.length)return false;return vpmLegacyAvailable(p,...args);};
const vpmLegacyRender=render;
render=function(){
  vpmLegacyRender();
  if(!VPM_DEMO)return;
  const root=document.getElementById('root');if(!root)return;
  const banner=document.createElement('div');banner.className='vpm-review-banner';
  banner.innerHTML='<span>ANTEPRIMA DI PROVA · dati locali dimostrativi</span><div><button type="button" data-vpm-review="gestore">Area gestore</button><button type="button" data-vpm-review="proprietari">Area proprietario</button><button type="button" data-vpm-review="reset">Ripristina prova</button></div>';
  root.prepend(banner);
};
if(VPM_DEMO){
  const demoKey='viverepm-review-20261102';
  const seed=()=>({clienti:[{id:'review-owner',nome:'Proprietario dimostrativo',email:'proprietario@example.test',telefono:'',indirizzo:'Sicilia'}],settings:{nomeAgenzia:'Vivere PM',gestoreEmail:'gestore@example.test',telefonoGestore:''},operatori:[],properties:[{id:'review-home',clienteId:'review-owner',nome:'Casa del Mediterraneo',tipo:'B&B',indirizzo:'Sicilia, Italia',catasto:'IMM-DEMO',disponibilePrenotazioni:true,prezzoNotte:0,capacitaAdulti:6,capacitaBambini:0,animaliAmmessi:false,foto:[],spese:[],manutenzioni:[],prenotazioni:[],tariffePersonalizzate:{},prezziSettimanali:{},notteMinima:1,servizi:[],controlli:[],periodicitaControlli:2,listinoServizi:[],messaggi:[],notifiche:[],vpmRooms:{units:[{id:'camera-sole',name:'Camera Sole',capacity:2,basePrice:0},{id:'camera-mare',name:'Camera Mare',capacity:2,basePrice:0}],rates:[],feeBasis:'',includeCleaning:false}}]});
  function useDemo(data){Object.assign(state,data,{loading:false,notConfigured:false,libError:false,error:null,gestoreUnlocked:true,gestoreRole:'admin',gestoreAuthUser:'gestore@example.test',ownerAuth:{email:'proprietario@example.test'},ownerPropId:'review-home',selectedId:'review-home',dossierTab:'camere'});}
  loadData=async function(){let data;try{data=JSON.parse(localStorage.getItem(demoKey)||'null');}catch(_){}useDemo(data||seed());render();};
  persistAll=async function(options={}){try{localStorage.setItem(demoKey,JSON.stringify({properties:state.properties,clienti:state.clienti,settings:state.settings,operatori:state.operatori}));state.error=null;return true;}catch(error){state.error='Salvataggio anteprima non riuscito: '+error.message;if(options.renderOnError!==false)render();return false;}};
  subscribeRealtime=function(){};
  checkAuthSession=async function(){};
  logoutOwner=async function(){state.view='gestore';render();};
  signOutGestore=async function(){state.view='proprietari';render();};
  document.addEventListener('click',event=>{const b=event.target.closest('[data-vpm-review]');if(!b)return;event.preventDefault();if(b.dataset.vpmReview==='reset'){if(!confirm('Ripristinare tutti i dati dimostrativi?'))return;localStorage.removeItem(demoKey);useDemo(seed());}else{state.view=b.dataset.vpmReview;state.selectedId='review-home';state.ownerPropId='review-home';state.modal=null;}render();},true);
}
function vpmPendingHtml(p,role){
  const summary=window.vpmServicesPending(p,role);const items=[...summary.items].filter(item=>role==='proprietario'||vpmNewTabAllowed(item.tab));
  (role==='proprietario'||haModulo('spese')?p.spese||[]:[]).filter(e=>!['pagata','rifiutata'].includes(e.stato)).forEach(e=>items.push({tab:'spese',title:(e.stato==='da-verificare'?'Verifica pagamento: ':'Spesa in attesa: ')+(e.categoria||e.descrizione||'Documento')}));
  (role==='proprietario'||haModulo('spese')?p.prenotazioni||[]:[]).filter(b=>b.vpmFeeInvoice&&b.vpmFeeInvoice.status!=='paid').forEach(b=>items.push({tab:'economia',title:'Fattura Vivere PM: '+(b.nome||'Prenotazione')}));
  if(!items.length)return '';
  return '<section class="vpm-owner-form"><h3>Attività da completare ('+items.length+')</h3><div style="display:flex;gap:8px;flex-wrap:wrap">'+items.slice(0,12).map(item=>'<button type="button" class="icon-btn" '+(role==='proprietario'?'data-owner-tab':'data-dossier-tab')+'="'+vpmOwnerEscape(item.tab)+'">'+vpmOwnerEscape(item.title)+'</button>').join('')+'</div></section>';
}
const vpmFeeEvents=raccogliEventiPortfolio;
raccogliEventiPortfolio=function(){
  return [...vpmFeeEvents(),...immobiliVisibili().filter(p=>haModulo('spese')).flatMap(p=>(p.prenotazioni||[]).filter(b=>b.vpmFeeInvoice?.due&&b.vpmFeeInvoice.status!=='paid').map(b=>({data:b.vpmFeeInvoice.due,titolo:'Fattura Vivere PM: '+b.nome,immobile:p.nome,colore:'terracotta',propId:p.id,tab:'economia'})))].sort((a,b)=>a.data.localeCompare(b.data));
};
const vpmFeeCalendar=renderCalendar;
renderCalendar=function(bookings,offset){
  let html=vpmFeeCalendar(bookings,offset);
  const p=state.view==='proprietari'?vpmOwnerProperty():state.view==='gestore'&&state.gestoreUnlocked&&haModulo('spese')?immobiliVisibili().find(x=>x.id===state.selectedId):null;
  const tab=state.view==='proprietari'?state.ownerDossierTab:state.dossierTab;
  if(!p||tab==='camere')return html;
  const view=new Date();view.setDate(1);view.setMonth(view.getMonth()+offset);const prefix=view.getFullYear()+'-'+String(view.getMonth()+1).padStart(2,'0');
  const invoices=(p.prenotazioni||[]).filter(b=>b.vpmFeeInvoice?.due?.startsWith(prefix)&&b.vpmFeeInvoice.status!=='paid');
  if(!invoices.length)return html;
  html+='<section class="vpm-owner-form"><h3>Fatture Vivere PM in scadenza</h3>'+invoices.map(b=>'<p>'+fmtDate(b.vpmFeeInvoice.due)+' · '+vpmOwnerEscape(b.nome)+' · '+fmtCurrency(Number(b.vpmFeeInvoice.net)+Number(b.vpmFeeInvoice.vat))+' <button class="icon-btn" '+(state.view==='proprietari'?'data-owner-tab':'data-dossier-tab')+'="economia">Apri fattura</button></p>').join('')+'</section>';
  return html;
};
/* Manager-wide entry points for structures and owner portal requests. */
let vpmPortalHubFilter='pending';
function vpmPortalRequested(p){const x=p.vpmServices?.portal;return !!x&&(!!x.requests?.length||!!x.delegationRequested||!!x.submittedAt||!!x.status&&x.status!=='Bozza');}
function vpmPortalPending(p){const x=p.vpmServices?.portal||{};return vpmPortalRequested(p)&&(!['Annuncio attivo','Pratica completata'].includes(x.status)||(x.requests||[]).some(r=>r.required!==false&&r.status!=='completata'));}
function vpmPortalRequestCounts(x){const rs=x.requests||[];return {waiting:rs.filter(r=>['aperta','da-integrare'].includes(r.status)).length,review:rs.filter(r=>r.status==='risposta-inviata').length,complete:rs.filter(r=>r.status==='completata').length};}
function vpmBnbProperties(){return immobiliVisibili().filter(p=>['B&B','Affittacamere'].includes(p.tipo)||p.vpmRooms?.units?.length);}
function vpmRenderBnbHub(){
  if(!haModulo('prenotazioni'))return '<div class="portal-shell">Non hai accesso alla gestione delle camere.</div>';
  const props=vpmBnbProperties(),rooms=props.reduce((n,p)=>n+(p.vpmRooms?.units?.length||0),0),bookings=props.reduce((n,p)=>n+(p.prenotazioni||[]).filter(b=>!['rifiutata','annullata','cancellata'].includes(b.stato)).length,0);
  return vpmPortfolioShell('STRUTTURE','B&B e camere','Gestisci ogni struttura e le sue camere, con calendari e prenotazioni separati.',[['ti-building',props.length,'Strutture'],['ti-bed',rooms,'Camere'],['ti-calendar-event',bookings,'Prenotazioni registrate']],`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">${isAdmin()?'<button type="button" class="btn-primary" data-vpm-new-bnb>+ Nuovo B&B / affittacamere</button>':''}<button class="icon-btn" data-nav="immobili">Tutti gli immobili</button></div><section class="vpm-portfolio-panel"><div class="vpm-portfolio-heading"><h2>Le tue strutture</h2></div><div class="vpm-portfolio-list">${props.map(p=>`<article class="vpm-portfolio-row"><span class="vpm-portfolio-avatar"><i class="ti ti-bed"></i></span><div class="vpm-portfolio-row-main"><h3>${vpmOwnerEscape(p.nome)}</h3><p>${vpmOwnerEscape(p.indirizzo||'')} · ${vpmOwnerEscape(getCliente(p)?.nome||'Proprietario da associare')}</p><small>${p.vpmRooms?.units?.length||0} camere · ${vpmOwnerEscape(p.tipo)}</small></div><button data-vpm-open-tab="${vpmOwnerEscape(p.id)}::camere">Gestisci camere e calendario</button><button data-vpm-open-tab="${vpmOwnerEscape(p.id)}::portali">Booking e Airbnb</button></article>`).join('')||'<p class="vpm-portfolio-empty">Nessun B&B ancora presente. Crea una struttura oppure modifica il tipo di un immobile esistente in B&B o Affittacamere, poi aggiungi le camere.</p>'}</div></section>`);
}
function vpmRenderPortalHub(){
  const all=immobiliVisibili(),pending=all.filter(vpmPortalPending),requested=all.filter(vpmPortalRequested),active=all.filter(p=>p.vpmServices?.portal?.status==='Annuncio attivo'),completed=all.filter(p=>vpmPortalRequested(p)&&!vpmPortalPending(p));
  const waiting=all.reduce((n,p)=>n+vpmPortalRequestCounts(p.vpmServices?.portal||{}).waiting,0),review=all.reduce((n,p)=>n+vpmPortalRequestCounts(p.vpmServices?.portal||{}).review,0);
  const shown=vpmPortalHubFilter==='all'?all:vpmPortalHubFilter==='active'?active:vpmPortalHubFilter==='completed'?completed:pending;
  return vpmPortfolioShell('COLLEGAMENTI','Richieste Booking/Airbnb','Qui ricevi le richieste dei proprietari, prepari le deleghe e segui l’attivazione degli annunci.',[['ti-inbox',pending.length,'Pratiche aperte'],['ti-user-question',waiting,'Risposte attese'],['ti-file-check',review,'Risposte da verificare'],['ti-circle-check',completed.length,'Pratiche concluse']],`<div class="vpm-portfolio-filters"><button data-vpm-portal-filter="pending" class="${vpmPortalHubFilter==='pending'?'active':''}">Da gestire (${pending.length})</button><button data-vpm-portal-filter="active" class="${vpmPortalHubFilter==='active'?'active':''}">Annunci attivi (${active.length})</button><button data-vpm-portal-filter="completed" class="${vpmPortalHubFilter==='completed'?'active':''}">Concluse (${completed.length})</button><button data-vpm-portal-filter="all" class="${vpmPortalHubFilter==='all'?'active':''}">Tutti gli immobili (${all.length})</button></div><section class="vpm-portfolio-panel"><div class="vpm-portfolio-heading"><h2>Pratiche dei proprietari</h2></div><div class="vpm-portfolio-list">${shown.map(p=>{const x=p.vpmServices?.portal||{},docs=p.vpmServices?.documents||[],signed=docs.some(d=>d.kind==='Delega portali'&&d.signedFile&&d.status==='Firmato verificato'&&(!d.expiry||d.expiry>=new Date().toISOString().slice(0,10)));return `<article class="vpm-portfolio-row"><span class="vpm-portfolio-avatar"><i class="ti ti-world"></i></span><div class="vpm-portfolio-row-main"><h3>${vpmOwnerEscape(p.nome)}</h3><p>${vpmOwnerEscape(getCliente(p)?.nome||'Proprietario da associare')} · ${vpmOwnerEscape(x.status||(x.delegationRequested?'Invio delega richiesto':'Nessuna richiesta inviata'))}</p><small>${x.delegationRequested?'Invio delega richiesto il '+fmtDate(x.delegationRequested):'Delega non richiesta'} · ${signed?'Delega verificata':'Delega da completare'}</small>${x.managerNotes?'<small>'+vpmOwnerEscape(x.managerNotes)+'</small>':''}${x.requests?.length?'<small class="vpm-portal-request-summary">'+vpmPortalRequestCounts(x).waiting+' risposte attese · '+vpmPortalRequestCounts(x).review+' da verificare · '+vpmPortalRequestCounts(x).complete+' completate</small>':''}</div><button data-vpm-open-tab="${vpmOwnerEscape(p.id)}::portali">Apri dati e pratica</button><button data-vpm-open-tab="${vpmOwnerEscape(p.id)}::contratti">Contratto e deleghe</button></article>`;}).join('')||'<p class="vpm-portfolio-empty">Non ci sono richieste in questa sezione. Il proprietario può inviarle da Booking e Airbnb, con “Richiedi invio delega” oppure inviando i dati al gestore. Per preparare una pratica usa “Tutti gli immobili”.</p>'}</div></section>`);
}
const vpmHubSidebar=renderSidebar;
renderSidebar=function(){
  const count=immobiliVisibili().filter(vpmPortalPending).length;
  const menu=`${haModulo('prenotazioni')?`<button type="button" class="nav-item vpm-hub-nav ${state.vistaGestore==='bnb-hub'&&!state.selectedId?'active':''}" data-vpm-hub="bnb-hub"><span class="nav-icon"><i class="ti ti-bed"></i></span>B&B e camere <span class="vpm-nav-count">${vpmBnbProperties().length}</span></button>`:''}<button type="button" class="nav-item vpm-hub-nav ${state.vistaGestore==='portali-hub'&&!state.selectedId?'active':''}" data-vpm-hub="portali-hub"><span class="nav-icon"><i class="ti ti-world"></i></span>Richieste Booking/Airbnb ${count?'<span class="nav-badge">'+count+'</span>':''}</button>`;
  return vpmHubSidebar().replace('<div class="vpm-sidebar-quick">',menu+'<div class="vpm-sidebar-quick">');
};
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-vpm-hub],[data-vpm-portal-filter],[data-vpm-new-bnb]');if(!target||state.view!=='gestore'||!state.gestoreUnlocked)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(target.hasAttribute('data-vpm-new-bnb')){if(isAdmin())openModal('property',null,null,{bnb:true});return;}
  if(target.dataset.vpmPortalFilter){if(!['pending','all','active','completed'].includes(target.dataset.vpmPortalFilter))return;vpmPortalHubFilter=target.dataset.vpmPortalFilter;}
  else{if(!['bnb-hub','portali-hub'].includes(target.dataset.vpmHub)||target.dataset.vpmHub==='bnb-hub'&&!haModulo('prenotazioni'))return;state.vistaGestore=target.dataset.vpmHub;}
  state.selectedId=null;state.selectedClienteId=null;state.modal=null;render();
},true);
