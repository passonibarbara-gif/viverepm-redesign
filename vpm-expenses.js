/* Insert inside the application closure, before its initial render(). */
(function installExpenseFlows(){
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = v => {if(!String(v||'').trim())return '';try { const u=new URL(v,location.href); return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(_){return '';}};
  const attachment = a => a && /^data:(application\/pdf|image\/(png|jpeg|webp));base64,/.test(a.url||'') ? `<a class="link-btn" href="${esc(a.url)}" download="${esc(a.nome||'documento')}">Scarica ${esc(a.nome||'documento')}</a>` : '';
  const currentProp = () => {
    if(state.view==='proprietari')return vpmOwnerProperty();
    if(state.view!=='gestore'||!state.gestoreUnlocked)return null;
    const p=state.properties.find(p=>p.id===state.selectedId);
    return p&&(canManage(p)||canManage(p,'intervento'))?p:null;
  };
  const canManage = (p,kind='spesa') => state.view==='gestore' && state.gestoreUnlocked && immobileConsentito(p.id) && haModulo(kind==='intervento'?'interventi':'spese');
  const canOwn = p => state.view==='proprietari' && state.ownerAuth && String(getCliente(p)?.email||'').toLowerCase()===String(state.ownerAuth.email||'').toLowerCase();
  const dateToday = () => new Date().toLocaleDateString('sv-SE');
  const labels={'in-attesa':'In attesa di approvazione',approvata:'Da pagare','da-pagare':'Da pagare',scaduta:'Scaduta',rifiutata:'Rifiutata','da-verificare':'Pagamento dichiarato, da verificare','in-elaborazione':'Pagamento in elaborazione',pagata:'Pagata'};
  const paymentStatus = e => e.statoPagamento || e.stato || 'approvata';
  const overdue = e => /^\d{4}-\d{2}-\d{2}$/.test(e.scadenza||'') && e.scadenza<dateToday() && !['pagata','rifiutata'].includes(paymentStatus(e));
  const statusLabel = e => (labels[paymentStatus(e)] || 'Stato da verificare') + (overdue(e)&&paymentStatus(e)!=='scaduta'?' · Scaduta':'');
  const button = (action,p,id,text,kind='spesa') => `<button type="button" class="icon-btn" data-vpm-finance="${action}" data-property="${esc(p.id)}" data-record="${esc(id)}" data-kind="${kind}">${text}</button>`;
  const oldRaw = renderModalRaw;
  const persistChecked = async () => { const ok=await saveData(); if(ok===false||state.error)throw new Error(state.error||'Salvataggio non riuscito. Riprova.'); };
  const snapshot = p => JSON.parse(JSON.stringify(p));
  const restore = (p,backup) => { for(const key of Object.keys(p))delete p[key];Object.assign(p,backup); };
  const field = (label,name,type,value='',required=false) => `<div class="field"><label for="vpm-finance-${name}">${label}</label><input id="vpm-finance-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='number'?'min="0.01" step="0.01"':''}></div>`;
  renderModalRaw = function(){
    if(!state.modal || !['expense','vpmFattura','vpmBonifico'].includes(state.modal.type)) return oldRaw();
    const {type,editing,propId,context}=state.modal; const p=state.properties.find(x=>x.id===propId); if(!p)return '';
    let content='',title='',kind=context?.kind||'spesa',record=context?.record||editing?.id||'';
    if(type==='expense'||type==='vpmFattura'){
      if(!canManage(p,type==='vpmFattura'?'intervento':'spesa'))return '';
      const e=type==='expense'?(editing||{}):(p.manutenzioni||[]).find(m=>m.id===record)?.fattura||{};
      title=type==='expense'?'Spesa e scadenza':'Fattura intervento';
      content=field('Categoria','categoria','text',e.categoria||'',true)+field('Descrizione','descrizione','text',e.descrizione||e.nota||'')+field('Data documento','data','date',e.data||dateToday(),true)+field('Scadenza pagamento','scadenza','date',e.scadenza||'',true)+field('Importo (€)','importo','number',e.importo||'',true)+field('Beneficiario','beneficiario','text',e.beneficiario||'',true)+field('IBAN per bonifico','iban','text',e.iban||'',type==='vpmFattura')+field('Causale','causale','text',e.causale||'')+(type==='expense'?field('Link pagina del fornitore per il pagamento','paymentUrl','url',e.paymentUrl||''):'')+`<div class="field"><label for="vpm-finance-documento">${type==='expense'?'Bolletta o documento':'Fattura PDF o immagine'}</label><input id="vpm-finance-documento" name="documento" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" ${type==='vpmFattura'&&!e.documento?'required':''}></div>${attachment(e.documento)}<p class="vpm-owner-hint">Carica documenti fino a 5 MB. Il pagamento resta a carico del proprietario.</p>`;
    } else {
      if(!canOwn(p))return '';
      title='Conferma bonifico effettuato';
      content=field('Data del bonifico','dataPagamento','date',dateToday(),true)+field('Riferimento bonifico / TRN','riferimento','text','',true)+`<div class="field"><label for="vpm-finance-documento">Contabile del bonifico</label><input id="vpm-finance-documento" type="file" name="documento" accept="application/pdf,image/png,image/jpeg,image/webp" required></div><p>La conferma invia il pagamento al gestore per la verifica.</p>`;
    }
    return `<div class="overlay" data-close-overlay><div class="modal" data-stop><h2>${title}</h2><form data-vpm-finance-form="${type}" data-kind="${kind}" data-record="${esc(record)}" data-property="${esc(p.id)}">${content}<div class="modal-actions"><button type="button" class="btn-secondary" data-close>Annulla</button><button class="btn-primary" type="submit">${type==='vpmBonifico'?'Invia conferma':'Salva e comunica al proprietario'}</button></div></form></div></div>`;
  };
  function paymentPanel(e,p,role,id,kind){
    const status=paymentStatus(e);
    const payable=['approvata','da-pagare','scaduta'].includes(status);
    const url=safeUrl(e.paymentUrl||'');
    return `<div class="vpm-owner-form"><strong>${kind==='intervento'?'Pagamento fattura':'Pagamento spesa'}: ${esc(statusLabel(e))}</strong><p>Scadenza: ${e.scadenza?esc(fmtDate(e.scadenza)):'Da indicare'}</p><p>Beneficiario: ${esc(e.beneficiario||'Da indicare')}<br>IBAN: ${esc(e.iban||'Da indicare')}<br>Causale: ${esc(e.causale||'Da indicare')}</p>${attachment(e.documento)} ${attachment(e.contabile)} ${attachment(e.ricevuta)}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${role==='proprietario'&&payable?(kind==='intervento'?'':url?`<a class="btn-primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Paga</a>`:'<button class="icon-btn" disabled title="Il gestore deve configurare il collegamento al fornitore">Paga · collegamento da attivare</button>')+ (e.iban?button('declare',p,id,'Conferma bonifico effettuato',kind):''):''}${role==='gestore'&&canManage(p,kind)&&status==='da-verificare'?button('verify',p,id,'Verifica e conferma pagamento',kind)+button('reject',p,id,'Richiedi verifica al proprietario',kind):''}</div></div>`;
  }
  renderSpesaCard = function(e,role){
    const p=state.properties.find(p=>(p.spese||[]).some(x=>x===e||x.id===e.id)); if(!p||(!canOwn(p)&&!canManage(p)))return '';
    const status=e.stato||'in-attesa';
    return `<div class="intervento-card"><div class="intervento-titolo">${esc(e.categoria||'Spesa')} · ${fmtCurrency(e.importo)}</div><p>${esc(e.descrizione||'')} · ${esc(fmtDate(e.data))}</p>${role==='proprietario'&&status==='in-attesa'?`<button class="btn-approva" data-approva-spesa="${esc(e.id)}">APPROVA</button><button class="btn-rifiuta" data-rifiuta-spesa="${esc(e.id)}">RIFIUTA</button>`:''}${paymentPanel(e,p,role,e.id,'spesa')}${role==='gestore'&&canManage(p)?button('edit',p,e.id,'Modifica documento e scadenza'):''}</div>`;
  };
  const oldCard=renderInterventoCard;
  renderInterventoCard=function(m,p,role){if(!canOwn(p)&&!canManage(p,'intervento'))return '';return oldCard(m,p,role)+(m.stato==='completata'?`<div class="intervento-card"><h3>Fattura dell’intervento: ${esc(m.descrizione)}</h3>${role==='gestore'&&canManage(p,'intervento')?button('invoice',p,m.id,m.fattura?.documento?'Aggiorna fattura e bonifico':'Carica fattura e dati bonifico','intervento'):''}${m.fattura?paymentPanel({...m.fattura,statoPagamento:m.fattura.statoPagamento||'approvata'},p,role,m.id,'intervento'):'<p>Fattura in attesa di caricamento da parte del gestore.</p>'}</div>`:'');};
  const oldEvents=raccogliEventiPortfolio;
  raccogliEventiPortfolio=function(){return [...oldEvents(),...immobiliVisibili().flatMap(p=>[
    ...(p.spese||[]).filter(e=>e.scadenza&&!['pagata','rifiutata'].includes(e.stato)).map(e=>({data:e.scadenza,titolo:`Pagamento ${e.categoria||'spesa'}: ${fmtCurrency(e.importo)}`,immobile:p.nome,colore:'terracotta',propId:p.id,tab:'spese'})),
    ...(p.manutenzioni||[]).filter(m=>m.fattura?.scadenza&&m.fattura.statoPagamento!=='pagata').map(m=>({data:m.fattura.scadenza,titolo:`Fattura intervento: ${m.descrizione}`,immobile:p.nome,colore:'terracotta',propId:p.id,tab:'interventi'}))])].sort((a,b)=>a.data.localeCompare(b.data));};
  const oldCalendar=renderCalendar;
  renderCalendar=function(bookings,offset){
    let html=oldCalendar(bookings,offset); const p=currentProp(); if(!p)return html;
    const tab=state.view==='proprietari'?state.ownerDossierTab:state.dossierTab; if(tab==='camere')return html;
    const view=new Date();view.setDate(1);view.setMonth(view.getMonth()+offset);const prefix=`${view.getFullYear()}-${String(view.getMonth()+1).padStart(2,'0')}`;
    const items=[...((canOwn(p)||canManage(p))?p.spese||[]:[]).filter(e=>!['pagata','rifiutata'].includes(e.stato)).map(e=>({...e,kind:'spesa'})),...((canOwn(p)||canManage(p,'intervento'))?p.manutenzioni||[]:[]).filter(m=>m.fattura&&m.fattura.statoPagamento!=='pagata').map(m=>({...m.fattura,id:m.id,categoria:'Fattura intervento',kind:'intervento'}))].filter(e=>e.scadenza?.startsWith(prefix));
    items.forEach(e=>{const day=Number(e.scadenza.slice(-2));html=html.replace(new RegExp(`(data-booking-cal-day="${e.scadenza}">)${day}(<\\/div>)`),`$1${day}<span title="Scadenza di pagamento" style="display:block;color:#b45309;font-size:10px">€</span>$2`);});
    return html+`<section class="vpm-owner-form"><h3>Scadenze di pagamento del mese</h3>${items.length?items.sort((a,b)=>a.scadenza.localeCompare(b.scadenza)).map(e=>`<p>${esc(fmtDate(e.scadenza))} · ${esc(e.categoria||'Spesa')} · ${fmtCurrency(e.importo)} ${button('show',p,e.id,'Apri documento e pagamento',e.kind)}</p>`).join(''):'<p>Nessuna scadenza di pagamento nel mese.</p>'}</section>`;
  };
  document.addEventListener('click',async ev=>{
    const b=ev.target.closest('[data-vpm-finance]');if(!b)return;ev.preventDefault();ev.stopImmediatePropagation();
    const p=state.properties.find(p=>p.id===b.dataset.property);if(!p)return;const kind=b.dataset.kind||'spesa';const id=b.dataset.record;const m=kind==='intervento'?(p.manutenzioni||[]).find(m=>m.id===id):null;const e=kind==='intervento'?m?.fattura:(p.spese||[]).find(e=>e.id===id);const action=b.dataset.vpmFinance;
    if(action==='show'){if(!canManage(p,kind)&&!canOwn(p))return;if(state.view==='proprietari')state.ownerDossierTab=kind==='spesa'?'spese':'interventi';else state.dossierTab=kind==='spesa'?'spese':'interventi';state.mostraInterventiCompletati=true;render();return;}
    if(['edit','invoice','verify','reject'].includes(action)&&!canManage(p,kind))return;
    if(action==='edit')openModal('expense',e,p.id);
    if(action==='invoice')openModal('vpmFattura',null,p.id,{record:id,kind});
    if(action==='declare'&&canOwn(p)&&e&&e.iban&&['approvata','da-pagare','scaduta'].includes(paymentStatus(e)))openModal('vpmBonifico',null,p.id,{record:id,kind});
    if(['verify','reject'].includes(action)&&e&&(e.statoPagamento||e.stato)==='da-verificare'){
      if(!confirm(action==='verify'?'Confermi di aver verificato il pagamento al beneficiario?':'Richiedere una nuova conferma di pagamento al proprietario?'))return;
      const backup=snapshot(p);b.disabled=true;
      try{const status=action==='verify'?'pagata':'approvata';if(kind==='intervento')e.statoPagamento=status;else e.stato=status;
        e.verificatoIl=action==='verify'?new Date().toISOString():null;addNotifica(p,action==='verify'?'Pagamento verificato.':'Pagamento da ricontrollare. Contatta il gestore.','proprietario',kind==='spesa'?'spese':'interventi');await persistChecked();render();
      }catch(error){restore(p,backup);render();alert(error.message||'Impossibile salvare la verifica.');}

    }
  },true);
  document.addEventListener('submit',async ev=>{
    const form=ev.target.closest('[data-vpm-finance-form]');if(!form)return;ev.preventDefault();ev.stopImmediatePropagation();const p=state.properties.find(p=>p.id===form.dataset.property);if(!p)return;
    const type=form.dataset.vpmFinanceForm,kind=form.dataset.kind,id=form.dataset.record; if(type==='vpmBonifico'?!canOwn(p):!canManage(p,type==='vpmFattura'?'intervento':'spesa'))return;
    const submit=form.querySelector('[type=submit]');submit.disabled=true;const backup=snapshot(p);let mutated=false;
    try{
      const fd=new FormData(form);const file=form.querySelector('[type=file]')?.files[0];let doc;
      if(file){if(file.size>5*1024*1024||!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Carica un PDF o un’immagine PNG, JPEG o WebP fino a 5 MB.');doc={nome:file.name,url:await readFileAsDataUrl(file)};}
      if(type==='vpmBonifico'){
        const e=kind==='intervento'?(p.manutenzioni||[]).find(m=>m.id===id)?.fattura:(p.spese||[]).find(e=>e.id===id);if(!e)throw new Error('Documento non trovato.');
        if(!['approvata','da-pagare','scaduta'].includes(paymentStatus(e)))throw new Error('Questo pagamento non può essere confermato.');
        mutated=true;Object.assign(e,{contabile:doc,dataPagamento:fd.get('dataPagamento'),riferimento:fd.get('riferimento')});if(kind==='intervento')e.statoPagamento='da-verificare';else e.stato='da-verificare';
        addNotifica(p,'Bonifico dichiarato dal proprietario: verifica il pagamento.','gestore',kind==='spesa'?'spese':'interventi');await persistChecked();closeModal();render();
      }else{
        const data=Object.fromEntries(['categoria','descrizione','data','scadenza','beneficiario','iban','causale','paymentUrl'].map(k=>[k,String(fd.get(k)||'').trim()]));data.importo=Number(fd.get('importo'));if(!(data.importo>0))throw new Error('Inserisci un importo maggiore di zero.');if(data.paymentUrl&&!safeUrl(data.paymentUrl))throw new Error('Inserisci un collegamento HTTP o HTTPS valido.');if(doc)data.documento=doc;
        if(type==='expense'){
          const existing=id?(p.spese||[]).find(e=>e.id===id):null;if(id&&!existing)throw new Error('Spesa non trovata.');
          mutated=true;
          if(existing){Object.assign(existing,data);logStoricoSpesa(existing,'Documento e scadenza aggiornati dal gestore.');}
          else{const expense={id:uid(),stato:'in-attesa',ricevuta:null,storico:[],...data};logStoricoSpesa(expense,'Spesa registrata, in attesa di approvazione del proprietario.');(p.spese||(p.spese=[])).push(expense);addNotifica(p,'Nuova spesa da approvare: '+fmtCurrency(expense.importo)+'.','proprietario','spese');}
          await persistChecked();closeModal();render();
        }else{const m=p.manutenzioni.find(m=>m.id===id);if(!m||m.stato!=='completata')throw new Error('Completa prima l’intervento.');mutated=true;m.fattura={...m.fattura,...data,statoPagamento:'approvata'};addNotifica(p,'Fattura intervento disponibile, da pagare con bonifico.','proprietario','interventi');await persistChecked();closeModal();render();}
      }
    }catch(error){if(mutated){restore(p,backup);render();}alert(error.message||'Impossibile salvare.');submit.disabled=false;}
  },true);
})();
