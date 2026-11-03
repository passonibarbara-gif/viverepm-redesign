/* Vivere PM: camere, tariffe del proprietario e compensi. Inject inside application scope. */
(function(){
  const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>fmtCurrency(Number(v)||0);
  const owner=()=>state.view==='proprietari'&&!!state.ownerAuth;
  const manager=()=>state.view==='gestore'&&!!state.gestoreUnlocked;
  function allowed(p,writeOwner=false,module){
    if(manager()) return !writeOwner&&immobileConsentito(p.id)&&(!module||haModulo(module));
    if(!owner()) return false;
    const c=getCliente(p);return !!c&&String(c.email||'').toLowerCase()===String(state.ownerAuth.email||'').toLowerCase();
  }
  const moduleFor=kind=>['unit','booking','assign','camere'].includes(kind)?'prenotazioni':['rate','tariffe','published'].includes(kind)?'listino':'spese';
  const validNumber=v=>v!==null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  const pendingProperties=new Set();
  const roomFeedback=new Map();
  const transactionKeys=['vpmRooms','prenotazioni','notifiche'];
  function snapshot(p){return Object.fromEntries(transactionKeys.map(key=>[key,{exists:Object.prototype.hasOwnProperty.call(p,key),value:p[key]===undefined?undefined:JSON.parse(JSON.stringify(p[key]))}]));}
  function restore(p,before){transactionKeys.forEach(key=>{if(before[key].exists)p[key]=before[key].value;else delete p[key];});}
  function showSaveError(target,message){
    if(target&&typeof target.querySelector==='function'&&typeof document.createElement==='function'){
      let box=target.querySelector('[data-vpm-room-error]');
      if(!box){box=document.createElement('div');box.dataset.vpmRoomError='';box.className='vpm-service-error';box.setAttribute('role','alert');target.appendChild(box);}
      box.textContent=message;
    }else alert(message);
  }
  async function mutate(p,target,operation){
    if(pendingProperties.has(p.id))return false;
    const before=snapshot(p),controls=target&&typeof target.querySelectorAll==='function'?Array.from(target.querySelectorAll('button[type=submit]')):target&&target.tagName==='BUTTON'?[target]:[];
    const previousDisabled=controls.map(button=>Boolean(button.disabled));
    pendingProperties.add(p.id);if(target?.dataset)target.dataset.vpmRoomBusy='true';controls.forEach(button=>{button.disabled=true;});
    try{
      const changed=await operation();
      if(changed!==true){restore(p,before);return false;}
      const result=await saveData({renderOnError:false});
      if(result===false||state.error)throw Error(state.error||'Salvataggio non riuscito. Riprova.');
      if(target?.dataset?.vpmRoomForm==='unit')roomFeedback.set(p.id,'Camera aggiunta e salvata. Puoi gestirla nell’elenco qui sotto.');
      render();
      if(target?.dataset?.vpmRoomForm==='unit'&&typeof document.querySelector==='function'){const list=document.querySelector('[data-vpm-room-list="'+String(p.id).replace(/["\\]/g,'')+'"]');if(list&&typeof list.scrollIntoView==='function')list.scrollIntoView({behavior:'smooth',block:'nearest'});}
      return true;
    }catch(err){
      restore(p,before);showSaveError(target,err?.message||'Salvataggio non riuscito. Riprova.');return false;
    }finally{
      pendingProperties.delete(p.id);if(target?.dataset)delete target.dataset.vpmRoomBusy;
      controls.forEach((button,index)=>{button.disabled=previousDisabled[index];});
    }
  }
  function notify(p,text,recipient,tab){if(typeof addNotifica==='function')addNotifica(p,text,recipient,tab);}
  function cfg(p){
    const raw=p.vpmRooms&&typeof p.vpmRooms==='object'&&!Array.isArray(p.vpmRooms)?p.vpmRooms:{};
    return {...raw,units:Array.isArray(raw.units)?raw.units.filter(u=>u&&typeof u==='object'&&u.id):[],rates:Array.isArray(raw.rates)?raw.rates.filter(r=>r&&typeof r==='object'):[],feeBasis:'lordo',includeCleaning:false};
  }
  function mutable(p){p.vpmRooms=cfg(p);return p.vpmRooms;}
  const units=p=>cfg(p).units;
  const active=b=>!['rifiutata','annullata','cancellata'].includes(b.stato);
  const overlap=(a,b)=>a.checkin<b.checkout&&a.checkout>b.checkin;
  function conflicts(p,b,unitId,ignore){
    return [...(p.prenotazioni||[]),...(typeof vpmOwnerBlockingBookings==='function'?vpmOwnerBlockingBookings(p):[])].some(x=>x.id!==ignore&&active(x)&&overlap(b,x)&&(!unitId||!x.unitId||x.unitId===unitId));
  }
  function field(label,name,type='text',value='',extra=''){return `<label class="field">${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
  function selectUnit(p,value='',name='unitId'){return `<label class="field">Unità<select name="${name}"><option value="">Intera struttura</option>${units(p).map(u=>`<option value="${esc(u.id)}" ${value===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>`;}
  function form(p,kind,content){return `<form data-vpm-room-form="${kind}" data-property="${esc(p.id)}" class="vpm-owner-form"><div class="field-row">${content}</div><button type="submit" class="btn-primary">${esc(({unit:"Aggiungi camera",rate:"Salva tariffa",booking:"Registra prenotazione",fee:"Salva accordo",invoice:"Carica fattura","invoice-payment":"Conferma bonifico effettuato","invoice-verify":"Conferma pagamento verificato","booking-finance":"Salva dettagli economici",settlement:"Salva rendiconto","settlement-transfer":"Registra bonifico eseguito"})[kind]||"Salva")}</button></form>`;}
  function rateFor(p,unitId,date){
    const rate=(cfg(p).rates||[]).filter(r=>r.unitId===unitId&&r.from<=date&&r.to>=date).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if(rate)return Number(rate.price);
    if(unitId){const u=units(p).find(u=>u.id===unitId);return Number(u?.basePrice)||0;}
    const custom=p.tariffePersonalizzate||{};if(custom[date]!==undefined)return Number(custom[date]);return basePriceForDate(p,new Date(date+'T12:00:00'));
  }
  function calculate(p,unitId,checkin,checkout){
    if(!validDate(checkin)||!validDate(checkout)||checkout<=checkin)return null;
    let amount=0,nights=0;for(let d=new Date(checkin+'T12:00:00Z');d<new Date(checkout+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1)){amount+=rateFor(p,unitId,d.toISOString().slice(0,10));if(++nights>730)return null;}
    return {amount:Math.round(amount*100)/100,nights};
  }
  function fee(p,b){
    const c=cfg(p);if(!['lordo','netto-portale'].includes(c.feeBasis))return null;
    if(!validNumber(b.vpmNightAmount)||!validNumber(b.vpmCleaning??0)||!validNumber(b.vpmRefund??0))return null;
    if(c.feeBasis==='netto-portale'&&!validNumber(b.vpmPortalCommission))return null;
    const base=Math.max(0,Number(b.vpmNightAmount)+(c.includeCleaning?Number(b.vpmCleaning||0):0)-(c.feeBasis==='netto-portale'?Number(b.vpmPortalCommission):0)-Number(b.vpmRefund||0));
    return Math.round(base*25)/100;
  }
  function invoicePanel(p,b,edit){
    const i=b.vpmFeeInvoice;
    const upload=edit&&!b.vpmSettlement?.transferAmount?form(p,'invoice',`<input type="hidden" name="bookingId" value="${esc(b.id)}">`+field('Fattura PDF','document','file','','accept="application/pdf" required')+field('Numero fattura','number','text','','required')+field('Imponibile fattura','net','number',fee(p,b)??'','min="0" step="0.01" required')+field('IVA in euro, inserire 0 se non applicata','vat','number','','min="0" step="0.01" required')+field('Beneficiario','beneficiary','text','','required')+field('IBAN','iban','text','','required')+field('Scadenza','due','date','','required')+'<p>Il totale fattura viene trattenuto nel rendiconto. Non aggiungere IVA automaticamente: il regime è da confermare.</p>'):'';
    if(!i)return `<h4>Fattura servizio Vivere PM</h4>${upload||'<p>Fattura non ancora caricata dal gestore.</p>'}`;
    return `<h4>Fattura ${esc(i.number)}</h4><p>Imponibile: ${money(i.net)} · IVA: ${money(i.vat)} · Totale: ${money(Number(i.net)+Number(i.vat))}</p><p>${esc(i.beneficiary)} · IBAN ${esc(i.iban)} · Scadenza ${esc(i.due)}</p><p>Compenso trattenuto nel rendiconto, nessun bonifico aggiuntivo richiesto. Stato pagamento storico: ${i.status==='paid'?'verificato dal gestore':i.status==='pending'?'bonifico dichiarato, da verificare':'da effettuare'}</p><a class="icon-btn" href="${esc(i.document)}" download="fattura-vivere-pm.pdf">Scarica fattura</a>${i.receipt?`<a class="icon-btn" href="${esc(i.receipt)}" download="contabile-bonifico">Scarica contabile</a>`:''}${false?form(p,'invoice-payment',`<input type="hidden" name="bookingId" value="${esc(b.id)}">`+field('Data bonifico','date','date','','required')+field('Contabile PDF o immagine','receipt','file','','accept="application/pdf,image/jpeg,image/png" required')):''}${edit&&i.status==='pending'?form(p,'invoice-verify',`<input type="hidden" name="bookingId" value="${esc(b.id)}"><p>Conferma solo dopo aver verificato l’accredito.</p>`):''}`;
  }
  const roundMoney=n=>Math.round((n+Number.EPSILON)*100)/100;
  function settlement(p,b){
    const amount=fee(p,b),v=b.vpmSettlement;
    if(amount===null||!v)return null;
    const invoice=b.vpmFeeInvoice;
    const compensation=invoice?roundMoney(Number(invoice.net)+Number(invoice.vat)):amount;
    const residual=roundMoney(v.received-compensation-v.cleaningCost-v.withholding-v.touristTax-v.deposit-v.otherCosts);
    return {compensation,residual,remaining:roundMoney(residual-(v.transferAmount||0))};
  }
  function settlementPanel(p,b,edit){
    const v=b.vpmSettlement||{},r=settlement(p,b);
    const fields=[['Incasso effettivo ricevuto da Vivere PM, già al netto delle commissioni trattenute dal portale','received'],['Costo pulizie da trattenere','cleaningCost'],['Ritenuta fiscale da accantonare, importo verificato','withholding'],['Imposta di soggiorno incassata da accantonare','touristTax'],['Cauzione da tenere separata','deposit'],['Altre spese autorizzate da trattenere','otherCosts']];
    const statuses=(name,value)=>`<label class="field">${name==='taxStatus'?'Versamento ritenuta':'Versamento imposta di soggiorno'}<select name="${name}">${[['pending','Da verificare / versare'],['paid','Versato'],['external','Già gestito dal portale'],['not-due','Non dovuto']].map(([key,label])=>`<option value="${key}" ${value===key?'selected':''}>${label}</option>`).join('')}</select></label>`;
    const statusText=key=>({'paid':'Versato','external':'Già gestito dal portale','not-due':'Non dovuto','pending':'Da verificare / versare'}[v[key]]||'Da verificare / versare');
    return `<article class="vpm-owner-form"><h3>${esc(b.nome)} · ${esc(b.checkin)}</h3><p>Totale prenotazione: ${money(b.totale)}. Compenso stimato: ${fee(p,b)===null?'Dati mancanti':money(fee(p,b))}.</p><p>Base compenso: ${cfg(p).feeBasis==='netto-portale'?'accordo precedente al netto del portale':'soggiorno lordo'}${cfg(p).includeCleaning?', pulizie incluse secondo accordo precedente':', pulizie separate escluse'}. ${edit?'Per applicare il nuovo accordo, conferma il 25% sul lordo qui sotto.':''}</p>${edit?form(p,'fee','<input type="hidden" name="basis" value="lordo"><input type="hidden" name="cleaning" value="no"><p>Conferma il 25% sul lordo, pulizie separate escluse. La modifica vale per le stime della struttura. Le fatture già caricate restano invariate.</p>'):''}${edit?form(p,'booking-finance',`<input type="hidden" name="bookingId" value="${esc(b.id)}">`+field('Importo del solo soggiorno lordo','night','number',b.vpmNightAmount??'','min="0" step="0.01" required')+field('Pulizie addebitate separatamente','cleaning','number',b.vpmCleaning??0,'min="0" step="0.01" required')+field('Commissioni portale, solo rendicontazione','portal','number',b.vpmPortalCommission??'','min="0" step="0.01" required')+field('Rimborso sul soggiorno, che riduce la base del compenso','refund','number',b.vpmRefund??0,'min="0" step="0.01" required')):''}${r?`<p>Incasso effettivo Vivere PM: ${money(v.received)}. Compenso ${b.vpmFeeInvoice?'da fattura':'stimato, IVA da definire'}: ${money(r.compensation)}.</p><p>Pulizie: ${money(v.cleaningCost)}. Ritenuta: ${money(v.withholding)}. Imposta di soggiorno: ${money(v.touristTax)}. Cauzione: ${money(v.deposit)}. Altre spese: ${money(v.otherCosts)}.</p><p><strong>Saldo previsto al proprietario: ${money(r.residual)}</strong>. ${r.residual<0?'Disavanzo da verificare.':''}</p><p>Ritenuta: ${statusText('taxStatus')}. Imposta di soggiorno: ${statusText('touristStatus')}.</p><p>Riferimento versamento ritenuta: ${esc(v.taxReference||'Non registrato')}. Riferimento versamento Comune: ${esc(v.touristReference||'Non registrato')}.</p><p>Bonifico eseguito: ${money(v.transferAmount||0)}. Data: ${esc(v.transferDate||'Non registrata')}. Riferimento: ${esc(v.transferReference||'Non registrato')}. Residuo: ${money(r.remaining)}.</p>${v.transferReceipt?`<a class="icon-btn" href="${esc(v.transferReceipt)}" download="contabile-saldo-proprietario">Scarica contabile saldo</a>`:''}`:'<p>Rendiconto da completare. Nessun incasso o pagamento confermato.</p>'}${edit?form(p,'settlement',`<input type="hidden" name="bookingId" value="${esc(b.id)}">`+fields.map(([label,key])=>field(label,key,'number',v[key]??'','min="0" step="0.01" required')).join('')+statuses('taxStatus',v.taxStatus)+field('Riferimento ricevuta versamento ritenuta / gestione portale','taxReference','text',v.taxReference||'')+statuses('touristStatus',v.touristStatus)+field('Riferimento ricevuta versamento Comune / gestione portale','touristReference','text',v.touristReference||'')+'<p>Le commissioni portale già sottratte dall’accredito non vengono detratte una seconda volta. Inserire zero per le imposte già trattenute dal portale. Indicare base e motivazione fiscale nelle note.</p>'+field('Note, base fiscale e spese autorizzate','notes','text',v.notes||'')):''}${v.notes?`<p>Note rendiconto: ${esc(v.notes)}</p>`:''}${edit&&r?form(p,'settlement-transfer',`<input type="hidden" name="bookingId" value="${esc(b.id)}">`+field('Importo totale del bonifico al proprietario','transferAmount','number',v.transferAmount||'','min="0.01" step="0.01" required')+field('Data bonifico eseguito','transferDate','date',v.transferDate||'','required')+field('Riferimento bonifico','transferReference','text',v.transferReference||'','required')+field('Contabile PDF o immagine','transferReceipt','file','','accept="application/pdf,image/jpeg,image/png" required')+'<p>Registra un bonifico realmente eseguito. Non avvia pagamenti bancari. La contabile viene conservata con il rendiconto e non può essere sovrascritta.</p>'):''}${invoicePanel(p,b,edit)}</article>`;
  }
  window.vpmSettlement=settlement;
  async function fileData(file){
    if(!file||!file.size)throw Error('Allega il documento.');
    if(file.size>5*1024*1024)throw Error('Il documento deve essere inferiore a 5 MB.');
    if(!['application/pdf','image/jpeg','image/png'].includes(file.type))throw Error('Carica PDF, JPG o PNG.');
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Impossibile leggere il documento.'));reader.readAsDataURL(file);});
  }
  window.vpmRoomFee=fee;
  window.vpmRoomCalculate=calculate;
  window.vpmRoomsRender=function(p,role,tab){
    if(!allowed(p,false,moduleFor(tab)))return '<p class="vpm-owner-empty">Accesso non consentito a questa sezione.</p>';
    const edit=role==='gestore'&&manager();const editRate=role!=='gestore'&&allowed(p,true);const c=cfg(p);
    if(tab==='camere')return `<div class="vpm-owner-section-intro"><div><strong>Struttura e camere</strong><small>Disponibilità, ospiti e prenotazioni distinti per camera. Una prenotazione dell'intera struttura occupa tutte le camere.</small></div></div>${roomFeedback.has(p.id)?`<p class="vpm-owner-hint" role="status">${esc(roomFeedback.get(p.id))}</p>`:''}${edit?form(p,'unit',field('Nome camera','name','text','','required maxlength="100"')+field('Ospiti massimi','capacity','number',2,'min="1" max="100" required')):''}<div data-vpm-room-list="${esc(p.id)}">${units(p).map(u=>`<article class="vpm-owner-form"><h3>${esc(u.name)}</h3><p>Capienza: ${esc(u.capacity)} ospiti · Prezzo base: ${money(u.basePrice)} / notte</p>${edit?`<button class="icon-btn" data-vpm-room-delete="${esc(u.id)}" data-property="${esc(p.id)}">Rimuovi camera</button>`:''}${renderCalendar((p.prenotazioni||[]).filter(b=>!b.unitId||b.unitId===u.id),state.calendarOffset||0)}</article>`).join('')||'<p class="vpm-owner-empty">Nessuna camera inserita. L’immobile viene gestito come unità intera.</p>'}</div><h3>Prenotazioni per unità</h3>${edit?form(p,'booking',field('Nome referente','name','text','','required')+selectUnit(p)+field('Arrivo','checkin','date','','required')+field('Partenza','checkout','date','','required')+field('Numero ospiti','guests','number',1,'min="1" required')+field('Importo soggiorno confermato dal proprietario','amount','number','','min="0" step="0.01" required')+'<p>Registra una prenotazione già ricevuta dal proprietario o dai suoi portali. Vivere PM registra gli incassi per conto del proprietario e rendiconta il saldo.</p>'):''}${(p.prenotazioni||[]).map(b=>`<article class="vpm-owner-block"><div><strong>${esc(b.nome)}</strong><small>${esc(units(p).find(u=>u.id===b.unitId)?.name||'Intera struttura')} · ${esc(b.checkin)} / ${esc(b.checkout)} · ${esc(b.stato)}</small></div>${edit?`<form data-vpm-room-form="assign" data-property="${esc(p.id)}"><input type="hidden" name="bookingId" value="${esc(b.id)}">${selectUnit(p,b.unitId||'')}<button class="icon-btn" type="submit">Assegna unità</button></form>`:''}</article>`).join('')}`;
    if(tab==='tariffe')return `<div class="vpm-owner-section-intro"><div><strong>Tariffe del proprietario</strong><small>Il proprietario decide i prezzi. Le modifiche non cambiano le prenotazioni già registrate e richiedono aggiornamento sui portali.</small></div></div>${editRate?form(p,'rate',selectUnit(p)+field('Valida dal','from','date','','required')+field('Valida fino al','to','date','','required')+field('Prezzo a notte','price','number','','min="0" step="0.01" required')):'<p class="vpm-owner-hint">Il gestore consulta le tariffe e conferma quando le ha riportate sui portali.</p>'}<p>Prezzo base dell’intero immobile: ${money(p.prezzoNotte)} / notte. Senza tariffa configurata il prezzo è zero.</p>${(c.rates||[]).slice().reverse().map(r=>`<article class="vpm-owner-block"><div><strong>${esc(units(p).find(u=>u.id===r.unitId)?.name||'Intero immobile')} · ${money(r.price)} / notte</strong><small>${esc(r.from)} / ${esc(r.to)} · ${r.portalUpdated?'Aggiornamento sui portali confermato dal gestore':'Da aggiornare sui portali'}</small></div>${edit&&!r.portalUpdated?`<button class="icon-btn" data-vpm-rate-published="${esc(r.id)}" data-property="${esc(p.id)}">Conferma aggiornamento portali</button>`:''}</article>`).join('')||'<p class="vpm-owner-empty">Nessuna tariffa per periodo inserita.</p>'}`;
    if(tab==='economia'){
      const bookings=(p.prenotazioni||[]).filter(active);
      return `<div class="vpm-owner-section-intro"><div><strong>Incassi, compensi e saldo al proprietario</strong><small>Vivere PM incassa per conto del proprietario e trattiene il 25% del soggiorno lordo. Pulizie separate, imposta di soggiorno e cauzioni sono escluse dal compenso. Regime fiscale e IVA da confermare.</small></div></div><p>Il rendiconto distingue importi previsti, incassi effettivi e bonifici eseguiti. I versamenti fiscali vengono registrati dal gestore, senza applicazione automatica di aliquote.</p>${bookings.map(b=>settlementPanel(p,b,edit)).join('')||'<p>Nessuna prenotazione attiva.</p>'}`;
    }return '';
  };
  document.addEventListener('submit',async e=>{
    const f=e.target.closest('[data-vpm-room-form]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();
    const p=state.properties.find(p=>p.id===f.dataset.property);if(!p){showSaveError(f,'Immobile non disponibile. Riapri la scheda e riprova.');return;}
    const kind=f.dataset.vpmRoomForm;if(!allowed(p,false,moduleFor(kind))||(kind==='unit'&&!manager())){showSaveError(f,'Non hai i permessi per questa operazione. Accedi come gestore con accesso alle prenotazioni di questo immobile.');return;}
    await mutate(p,f,async()=>{
      const d=new FormData(f),c=mutable(p);
      const numericFields={rate:['price'],unit:['capacity'],booking:['guests','amount'],'booking-finance':['night','cleaning','portal','refund'],invoice:['net','vat']}[kind]||[];
      if(numericFields.some(k=>!validNumber(d.get(k))))throw Error('Inserisci importi e quantità validi, finiti e non negativi.');
      const dateFields={rate:['from','to'],booking:['checkin','checkout'],invoice:['due'],'invoice-payment':['date']}[kind]||[];
      if(dateFields.some(k=>!validDate(String(d.get(k)||''))))throw Error('Inserisci date valide.');
      if(kind==='unit'&&(!Number.isInteger(Number(d.get('capacity')))||Number(d.get('capacity'))<1||Number(d.get('capacity'))>100||!String(d.get('name')||'').trim()))throw Error('Indica nome camera e capienza intera da 1 a 100.');
      if(kind==='booking'&&(!Number.isInteger(Number(d.get('guests')))||Number(d.get('guests'))<1||!String(d.get('name')||'').trim()))throw Error('Indica il referente e almeno un ospite.');
      if(['settlement','settlement-transfer'].includes(kind)){
        if(!manager())return false;
        const b=(p.prenotazioni||[]).find(b=>b.id===d.get('bookingId'));if(!b)return false;
        if(kind==='settlement'){
          if(b.vpmSettlement?.transferAmount)throw Error('Bonifico già registrato. Conserva il rendiconto associato al pagamento.');
          const v={};
          for(const key of ['received','cleaningCost','withholding','touristTax','deposit','otherCosts']){if(!validNumber(d.get(key)))throw Error('Completa tutti gli importi con valori non negativi.');v[key]=roundMoney(Number(d.get(key)));}
          for(const key of ['taxStatus','touristStatus']){v[key]=String(d.get(key)||'');if(!['pending','paid','external','not-due'].includes(v[key]))throw Error('Stato versamento non valido.');}
          for(const key of ['taxReference','touristReference','notes'])v[key]=String(d.get(key)||'').trim();
          if(['paid','external'].includes(v.taxStatus)&&!v.taxReference||['paid','external'].includes(v.touristStatus)&&!v.touristReference)throw Error('Indica il riferimento della ricevuta o della gestione del portale.');
          if(['external','not-due'].includes(v.taxStatus)&&v.withholding!==0||['external','not-due'].includes(v.touristStatus)&&v.touristTax!==0)throw Error('Non trattenere nuovamente imposte non dovute o già gestite dal portale.');
          b.vpmSettlement={...v,updatedAt:new Date().toISOString()};
          notify(p,'Rendiconto aggiornato: consulta incassi, trattenute e saldo previsto.','proprietario','economia');
        }else{
          const r=settlement(p,b),amount=Number(d.get('transferAmount'));
          if(b.vpmSettlement?.transferAmount)throw Error('Il bonifico è già registrato. Non sovrascrivere la contabile.');
          if(!r||!validNumber(d.get('transferAmount'))||amount<=0||amount>r.residual||!validDate(String(d.get('transferDate')||''))||!String(d.get('transferReference')||'').trim())throw Error('Verifica importo, saldo disponibile, data e riferimento bonifico.');
          const transferReceipt=await fileData(d.get('transferReceipt'));
          Object.assign(b.vpmSettlement,{transferAmount:roundMoney(amount),transferDate:String(d.get('transferDate')),transferReference:String(d.get('transferReference')).trim(),transferReceipt});
          notify(p,'Registrato bonifico del saldo al proprietario. Contabile disponibile nel rendiconto.','proprietario','economia');
        }
        return true;
      }
      if(['invoice','invoice-payment','invoice-verify'].includes(kind)){
        const b=(p.prenotazioni||[]).find(b=>b.id===d.get('bookingId'));if(!b)return false;
        if(kind==='invoice'&&manager()){
          if(b.vpmSettlement?.transferAmount)throw Error('Saldo già trasferito: conserva la fattura associata al rendiconto.');
          if(b.vpmFeeInvoice)throw Error('La fattura è già presente. Conservare lo storico prima di emettere una nuova fattura.');
          const iban=String(d.get('iban')).replace(/\s/g,'').toUpperCase();if(!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban))throw Error('Inserisci un IBAN valido.');
          if(!String(d.get('number')||'').trim()||!String(d.get('beneficiary')||'').trim())throw Error('Indica numero fattura e beneficiario.');
          const document=await fileData(d.get('document'));
          b.vpmFeeInvoice={number:String(d.get('number')),net:Number(d.get('net')),vat:Number(d.get('vat')),beneficiary:String(d.get('beneficiary')),iban,due:String(d.get('due')),document,status:'unpaid',createdAt:new Date().toISOString()};
          notify(p,'Nuova fattura Vivere PM '+b.vpmFeeInvoice.number+' da pagare entro '+b.vpmFeeInvoice.due+'.','proprietario','economia');
        }else if(kind==='invoice-payment'&&allowed(p,true)&&b.vpmFeeInvoice&&!['paid','pending'].includes(b.vpmFeeInvoice.status)){
          const receipt=await fileData(d.get('receipt'));Object.assign(b.vpmFeeInvoice,{receipt,paymentDate:String(d.get('date')),status:'pending'});notify(p,'Bonifico dichiarato per fattura Vivere PM '+b.vpmFeeInvoice.number+': verifica l’accredito.','gestore','economia');
        }else if(kind==='invoice-verify'&&manager()&&b.vpmFeeInvoice?.status==='pending'){
          b.vpmFeeInvoice.status='paid';b.vpmFeeInvoice.verifiedAt=new Date().toISOString();notify(p,'Pagamento della fattura Vivere PM '+b.vpmFeeInvoice.number+' verificato.','proprietario','economia');
        }else return false;
        return true;
      }
      if(kind==='rate'){
        if(!allowed(p,true))return false;
        if(String(d.get('to'))<String(d.get('from')))throw Error('La data finale deve seguire quella iniziale.');
        const unitId=String(d.get('unitId')||'');if(unitId&&!units(p).some(u=>u.id===unitId))return false;
        (c.rates||(c.rates=[])).push({id:uid(),unitId,from:String(d.get('from')),to:String(d.get('to')),price:Number(d.get('price')),createdAt:new Date().toISOString(),portalUpdated:false});notify(p,'Il proprietario ha aggiornato una tariffa: aggiorna Booking e Airbnb.','gestore','listino');
      }else{
        if(!manager())return false;
        if(kind==='unit') (c.units||(c.units=[])).push({id:uid(),name:String(d.get('name')).trim(),capacity:Number(d.get('capacity')),basePrice:0});
        else if(kind==='fee'){if((p.prenotazioni||[]).some(b=>b.vpmSettlement?.transferAmount))throw Error('Sono presenti saldi trasferiti: conserva l’accordo associato ai rendiconti.');if(!['lordo','netto-portale',''].includes(String(d.get('basis')||'')))return false;c.feeBasis=String(d.get('basis')||'');c.includeCleaning=d.get('cleaning')==='yes';}
        else if(kind==='booking-finance'){
          const b=(p.prenotazioni||[]).find(b=>b.id===d.get('bookingId'));if(!b)return false;
          if(b.vpmSettlement?.transferAmount)throw Error('Saldo già trasferito: conserva gli importi del rendiconto.');
          b.vpmNightAmount=Number(d.get('night'));b.vpmCleaning=Number(d.get('cleaning'));b.vpmPortalCommission=Number(d.get('portal'));b.vpmRefund=Number(d.get('refund'));
        }
        else if(kind==='booking'||kind==='assign'){
          const b=kind==='assign'?(p.prenotazioni||[]).find(b=>b.id===d.get('bookingId')):{id:uid(),nome:String(d.get('name')),checkin:String(d.get('checkin')),checkout:String(d.get('checkout')),adulti:Number(d.get('guests')),totale:Number(d.get('amount')),vpmNightAmount:Number(d.get('amount')),stato:'confermata',createdAt:new Date().toISOString()};if(!b)return false;
          const unitId=String(d.get('unitId')||'');const u=units(p).find(u=>u.id===unitId);if(unitId&&!u)return false;
          if(b.checkout<=b.checkin)throw Error('La partenza deve seguire l’arrivo.');
          if(u&&Number(b.adulti||1)+Number(b.bambini||0)>Number(u.capacity))throw Error('Il numero di ospiti supera la capienza della camera.');
          if(conflicts(p,b,unitId,b.id))throw Error('Le date si sovrappongono a una prenotazione o a un blocco della stessa unità o dell’intera struttura.');
          b.unitId=unitId;if(kind==='booking')(p.prenotazioni||(p.prenotazioni=[])).push(b);
        }else return false;
      }
      return true;
    });
  },true);
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-vpm-room-delete],[data-vpm-rate-published],[data-vpm-owner-received]');if(!el)return;
    e.preventDefault();e.stopImmediatePropagation();const p=state.properties.find(p=>p.id===el.dataset.property);if(!p||!allowed(p,false,el.dataset.vpmRoomDelete?'prenotazioni':el.dataset.vpmRatePublished?'listino':'spese'))return;
    await mutate(p,el,async()=>{
      const c=mutable(p);
      if(el.dataset.vpmRoomDelete&&manager()){
        if((p.prenotazioni||[]).some(b=>b.unitId===el.dataset.vpmRoomDelete))throw Error('La camera contiene prenotazioni. Conserva la camera per mantenere lo storico.');
        if(!confirm('Rimuovere questa camera e le sue tariffe?'))return false;
        c.units=units(p).filter(u=>u.id!==el.dataset.vpmRoomDelete);c.rates=(c.rates||[]).filter(r=>r.unitId!==el.dataset.vpmRoomDelete);
      }else if(el.dataset.vpmRatePublished&&manager()){
        const r=(c.rates||[]).find(r=>r.id===el.dataset.vpmRatePublished);if(!r||r.portalUpdated)return false;r.portalUpdated=true;r.portalUpdatedAt=new Date().toISOString();notify(p,'Il gestore ha confermato l’aggiornamento della tariffa sui portali.','proprietario','tariffe');
      }else if(el.dataset.vpmOwnerReceived&&allowed(p,true)){
        const b=(p.prenotazioni||[]).find(b=>b.id===el.dataset.vpmOwnerReceived);if(!b||b.vpmOwnerReceived)return false;b.vpmOwnerReceived=true;b.vpmOwnerReceivedAt=new Date().toISOString();
      }else return false;
      return true;
    });
  },true);
  const legacyCalc=calcTotale;
  calcTotale=function(p,checkin,checkout){const result=legacyCalc(p,checkin,checkout);if(!result)return result;const custom=(cfg(p).rates||[]).some(r=>!r.unitId);if(!custom)return result;const a=calculate(p,'',checkin,checkout);if(!a)return null;return {...result,soggiornoBase:a.amount,totale:a.amount+result.totaleServizi};};
  const legacyUpdate=updateBookingStatus;
  updateBookingStatus=function(propId,bookingId,status){const p=state.properties.find(p=>p.id===propId),b=p?.prenotazioni?.find(b=>b.id===bookingId);if(!p||!allowed(p,false,'prenotazioni'))return;if(p&&b&&status==='confermata'&&conflicts(p,b,b.unitId||'',b.id))return alert('Impossibile confermare: date occupate per questa unità.');return legacyUpdate(propId,bookingId,status);};
  const legacySubmit=submitBooking;
  submitBooking=function(propId,data){const p=state.properties.find(p=>p.id===propId);if(p&&units(p).length&&!data.unitId)return alert('Questa struttura prevede camere separate. Seleziona una camera tramite il portale del proprietario.');if(p&&conflicts(p,data,data.unitId||'',null))return alert('Le date selezionate non sono più disponibili.');return legacySubmit(propId,data);};
  const oldWeekly=setPrezzoSettimanale,oldMinimum=setNotteMinima;
  setPrezzoSettimanale=function(id,...args){const p=state.properties.find(p=>p.id===id);if(p&&allowed(p,true))return oldWeekly(id,...args);};
  setNotteMinima=function(id,...args){const p=state.properties.find(p=>p.id===id);if(p&&allowed(p,true))return oldMinimum(id,...args);};
})();
