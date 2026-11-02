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
  async function persist(){try{await saveData();if(state.error)return false;render();return true;}catch(err){state.error='Salvataggio non riuscito: '+err.message;render();return false;}}
  function notify(p,text,recipient,tab){if(typeof addNotifica==='function')addNotifica(p,text,recipient,tab);}
  const cfg=p=>p.vpmRooms||{units:[],rates:[],feeBasis:'',includeCleaning:false};
  function mutable(p){if(!p.vpmRooms)p.vpmRooms={units:[],rates:[],feeBasis:'',includeCleaning:false};return p.vpmRooms;}
  const units=p=>cfg(p).units||[];
  const active=b=>!['rifiutata','annullata','cancellata'].includes(b.stato);
  const overlap=(a,b)=>a.checkin<b.checkout&&a.checkout>b.checkin;
  function conflicts(p,b,unitId,ignore){
    return [...(p.prenotazioni||[]),...(typeof vpmOwnerBlockingBookings==='function'?vpmOwnerBlockingBookings(p):[])].some(x=>x.id!==ignore&&active(x)&&overlap(b,x)&&(!unitId||!x.unitId||x.unitId===unitId));
  }
  function field(label,name,type='text',value='',extra=''){return `<label class="field">${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
  function selectUnit(p,value='',name='unitId'){return `<label class="field">Unità<select name="${name}"><option value="">Intera struttura</option>${units(p).map(u=>`<option value="${esc(u.id)}" ${value===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>`;}
  function form(p,kind,content){return `<form data-vpm-room-form="${kind}" data-property="${esc(p.id)}" class="vpm-owner-form"><div class="field-row">${content}</div><button type="submit" class="btn-primary">${esc(({unit:"Aggiungi camera",rate:"Salva tariffa",booking:"Registra prenotazione",fee:"Salva accordo",invoice:"Carica fattura","invoice-payment":"Conferma bonifico effettuato","invoice-verify":"Conferma pagamento verificato","booking-finance":"Salva dettagli economici"})[kind]||"Salva")}</button></form>`;}
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
    const upload=edit?form(p,'invoice',`<input type="hidden" name="bookingId" value="${esc(b.id)}">`+field('Fattura PDF','document','file','','accept="application/pdf" required')+field('Numero fattura','number','text','','required')+field('Imponibile fattura','net','number',fee(p,b)??'','min="0" step="0.01" required')+field('IVA in euro, inserire 0 se non applicata','vat','number','','min="0" step="0.01" required')+field('Beneficiario','beneficiary','text','','required')+field('IBAN','iban','text','','required')+field('Scadenza','due','date','','required')+'<p>Il totale da pagare corrisponde all’imponibile più l’IVA indicata in fattura.</p>'):'';
    if(!i)return `<h4>Fattura servizio Vivere PM</h4>${upload||'<p>Fattura non ancora caricata dal gestore.</p>'}`;
    return `<h4>Fattura ${esc(i.number)}</h4><p>Imponibile: ${money(i.net)} · IVA: ${money(i.vat)} · Totale: ${money(Number(i.net)+Number(i.vat))}</p><p>${esc(i.beneficiary)} · IBAN ${esc(i.iban)} · Scadenza ${esc(i.due)}</p><p>Pagamento: ${i.status==='paid'?'verificato dal gestore':i.status==='pending'?'bonifico dichiarato, da verificare':'da effettuare'}</p><a class="icon-btn" href="${esc(i.document)}" download="fattura-vivere-pm.pdf">Scarica fattura</a>${i.receipt?`<a class="icon-btn" href="${esc(i.receipt)}" download="contabile-bonifico">Scarica contabile</a>`:''}${!edit&&i.status!=='paid'?form(p,'invoice-payment',`<input type="hidden" name="bookingId" value="${esc(b.id)}">`+field('Data bonifico','date','date','','required')+field('Contabile PDF o immagine','receipt','file','','accept="application/pdf,image/jpeg,image/png" required')):''}${edit&&i.status==='pending'?form(p,'invoice-verify',`<input type="hidden" name="bookingId" value="${esc(b.id)}"><p>Conferma solo dopo aver verificato l’accredito.</p>`):''}`;
  }
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
    if(tab==='camere')return `<div class="vpm-owner-section-intro"><div><strong>Struttura e camere</strong><small>Disponibilità, ospiti e prenotazioni distinti per camera. Una prenotazione dell'intera struttura occupa tutte le camere.</small></div></div>${edit?form(p,'unit',field('Nome camera','name','text','','required maxlength="100"')+field('Ospiti massimi','capacity','number',2,'min="1" max="100" required')):''}<div>${units(p).map(u=>`<article class="vpm-owner-form"><h3>${esc(u.name)}</h3><p>Capienza: ${esc(u.capacity)} ospiti · Prezzo base: ${money(u.basePrice)} / notte</p>${edit?`<button class="icon-btn" data-vpm-room-delete="${esc(u.id)}" data-property="${esc(p.id)}">Rimuovi camera</button>`:''}${renderCalendar((p.prenotazioni||[]).filter(b=>!b.unitId||b.unitId===u.id),state.calendarOffset||0)}</article>`).join('')||'<p class="vpm-owner-empty">Nessuna camera inserita. L’immobile viene gestito come unità intera.</p>'}</div><h3>Prenotazioni per unità</h3>${edit?form(p,'booking',field('Nome referente','name','text','','required')+selectUnit(p)+field('Arrivo','checkin','date','','required')+field('Partenza','checkout','date','','required')+field('Numero ospiti','guests','number',1,'min="1" required')+field('Importo soggiorno confermato dal proprietario','amount','number','','min="0" step="0.01" required')+'<p>Registra una prenotazione già ricevuta dal proprietario o dai suoi portali. Gli incassi spettano al proprietario.</p>'):''}${(p.prenotazioni||[]).map(b=>`<article class="vpm-owner-block"><div><strong>${esc(b.nome)}</strong><small>${esc(units(p).find(u=>u.id===b.unitId)?.name||'Intera struttura')} · ${esc(b.checkin)} / ${esc(b.checkout)} · ${esc(b.stato)}</small></div>${edit?`<form data-vpm-room-form="assign" data-property="${esc(p.id)}"><input type="hidden" name="bookingId" value="${esc(b.id)}">${selectUnit(p,b.unitId||'')}<button class="icon-btn" type="submit">Assegna unità</button></form>`:''}</article>`).join('')}`;
    if(tab==='tariffe')return `<div class="vpm-owner-section-intro"><div><strong>Tariffe del proprietario</strong><small>Il proprietario decide i prezzi. Le modifiche non cambiano le prenotazioni già registrate e richiedono aggiornamento sui portali.</small></div></div>${editRate?form(p,'rate',selectUnit(p)+field('Valida dal','from','date','','required')+field('Valida fino al','to','date','','required')+field('Prezzo a notte','price','number','','min="0" step="0.01" required')):'<p class="vpm-owner-hint">Il gestore consulta le tariffe e conferma quando le ha riportate sui portali.</p>'}<p>Prezzo base dell’intero immobile: ${money(p.prezzoNotte)} / notte. Senza tariffa configurata il prezzo è zero.</p>${(c.rates||[]).slice().reverse().map(r=>`<article class="vpm-owner-block"><div><strong>${esc(units(p).find(u=>u.id===r.unitId)?.name||'Intero immobile')} · ${money(r.price)} / notte</strong><small>${esc(r.from)} / ${esc(r.to)} · ${r.portalUpdated?'Aggiornamento sui portali confermato dal gestore':'Da aggiornare sui portali'}</small></div>${edit&&!r.portalUpdated?`<button class="icon-btn" data-vpm-rate-published="${esc(r.id)}" data-property="${esc(p.id)}">Conferma aggiornamento portali</button>`:''}</article>`).join('')||'<p class="vpm-owner-empty">Nessuna tariffa per periodo inserita.</p>'}`;
    if(tab==='economia'){
      const bookings=(p.prenotazioni||[]).filter(active);const fees=bookings.map(b=>fee(p,b));const total=bookings.reduce((s,b)=>s+Number(b.totale||0),0);
      return `<div class="vpm-owner-section-intro"><div><strong>Incassi del proprietario e compensi Vivere PM</strong><small>Il proprietario riceve gli affitti. Vivere PM fattura al proprietario il servizio al 25%. Imposte e depositi restano voci separate.</small></div></div><div class="stat-row"><div class="stat-card"><div class="stat-label">Totali prenotazioni registrate</div><div class="stat-value">${money(total)}</div><small>Non costituiscono conferma di incasso</small></div><div class="stat-card"><div class="stat-label">Compenso Vivere PM stimato</div><div class="stat-value">${c.feeBasis&&fees.every(v=>v!==null)?money(fees.reduce((s,v)=>s+v,0)):'Da definire'}</div><small>25%, trattamento IVA da definire nel contratto</small></div></div>${edit?form(p,'fee',`<label class="field">Base concordata nel contratto<select name="basis" required><option value="">Da definire</option><option value="lordo" ${c.feeBasis==='lordo'?'selected':''}>Soggiorno prima delle commissioni del portale</option><option value="netto-portale" ${c.feeBasis==='netto-portale'?'selected':''}>Soggiorno dopo le commissioni del portale</option></select></label><label class="field">Pulizie<select name="cleaning"><option value="no">Escluse dal 25%</option><option value="yes" ${c.includeCleaning?'selected':''}>Incluse nel 25%</option></select></label><p>Compilare solo dopo aver concordato la base con il proprietario. Il calcolo non applica imposte automaticamente.</p>`):`<p>Base del 25%: ${c.feeBasis==='lordo'?'prima delle commissioni del portale':c.feeBasis==='netto-portale'?'dopo le commissioni del portale':'da concordare'}. Pulizie: ${c.includeCleaning?'incluse':'escluse'}.</p>`}${bookings.map(b=>`<article class="vpm-owner-form"><h3>${esc(b.nome)} · ${esc(b.checkin)}</h3><p>Totale prenotazione: ${money(b.totale)} · Compenso 25%: ${fee(p,b)===null?'dati o base mancanti':money(fee(p,b))}</p><p>Incasso proprietario: ${b.vpmOwnerReceived?'confermato dal proprietario':'da confermare dal proprietario'}</p>${owner()&&allowed(p,true)&&!b.vpmOwnerReceived?`<button class="icon-btn" data-vpm-owner-received="${esc(b.id)}" data-property="${esc(p.id)}">Conferma incasso ricevuto</button>`:''}${edit?form(p,'booking-finance',`<input type="hidden" name="bookingId" value="${esc(b.id)}">`+field('Importo del solo soggiorno','night','number',b.vpmNightAmount??'','min="0" step="0.01" required')+field('Pulizie','cleaning','number',b.vpmCleaning??0,'min="0" step="0.01" required')+field('Commissioni portale','portal','number',b.vpmPortalCommission??'','min="0" step="0.01" required')+field('Rimborso relativo alle voci nella base del 25%','refund','number',b.vpmRefund??0,'min="0" step="0.01" required')):''}${invoicePanel(p,b,edit)}</article>`).join('')}`;
    }return '';
  };
  document.addEventListener('submit',async e=>{
    const f=e.target.closest('[data-vpm-room-form]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();
    const p=state.properties.find(p=>p.id===f.dataset.property);if(!p||!allowed(p))return;
    const d=new FormData(f),kind=f.dataset.vpmRoomForm;if(!allowed(p,false,moduleFor(kind)))return;const c=mutable(p);
    const numericFields={rate:['price'],unit:['capacity'],booking:['guests','amount'],'booking-finance':['night','cleaning','portal','refund'],invoice:['net','vat']}[kind]||[];
    if(numericFields.some(k=>!validNumber(d.get(k))))return alert('Inserisci importi e quantità validi, finiti e non negativi.');
    const dateFields={rate:['from','to'],booking:['checkin','checkout'],invoice:['due'],'invoice-payment':['date']}[kind]||[];
    if(dateFields.some(k=>!validDate(String(d.get(k)||''))))return alert('Inserisci date valide.');
    if(kind==='unit'&&(!Number.isInteger(Number(d.get('capacity')))||Number(d.get('capacity'))<1||Number(d.get('capacity'))>100||!String(d.get('name')||'').trim()))return alert('Indica nome camera e capienza intera da 1 a 100.');
    if(kind==='booking'&&(!Number.isInteger(Number(d.get('guests')))||Number(d.get('guests'))<1||!String(d.get('name')||'').trim()))return alert('Indica il referente e almeno un ospite.');
    if(['invoice','invoice-payment','invoice-verify'].includes(kind)){
      const b=(p.prenotazioni||[]).find(b=>b.id===d.get('bookingId'));if(!b)return;
      try{
        if(kind==='invoice'&&manager()){
          if(b.vpmFeeInvoice)return alert('La fattura è già presente. Conservare lo storico prima di emettere una nuova fattura.');
          const iban=String(d.get('iban')).replace(/\s/g,'').toUpperCase();if(!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban))return alert('Inserisci un IBAN valido.');
          if(!String(d.get('number')||'').trim()||!String(d.get('beneficiary')||'').trim())return alert('Indica numero fattura e beneficiario.');
          b.vpmFeeInvoice={number:String(d.get('number')),net:Number(d.get('net')),vat:Number(d.get('vat')),beneficiary:String(d.get('beneficiary')),iban,due:String(d.get('due')),document:await fileData(d.get('document')),status:'unpaid',createdAt:new Date().toISOString()};
          notify(p,'Nuova fattura Vivere PM '+b.vpmFeeInvoice.number+' da pagare entro '+b.vpmFeeInvoice.due+'.','proprietario','economia');
        }else if(kind==='invoice-payment'&&allowed(p,true)&&b.vpmFeeInvoice&&b.vpmFeeInvoice.status!=='paid'){
          const receipt=await fileData(d.get('receipt'));Object.assign(b.vpmFeeInvoice,{receipt,paymentDate:String(d.get('date')),status:'pending'});notify(p,'Bonifico dichiarato per fattura Vivere PM '+b.vpmFeeInvoice.number+': verifica l’accredito.','gestore','economia');
        }else if(kind==='invoice-verify'&&manager()&&b.vpmFeeInvoice?.status==='pending'){
          b.vpmFeeInvoice.status='paid';b.vpmFeeInvoice.verifiedAt=new Date().toISOString();notify(p,'Pagamento della fattura Vivere PM '+b.vpmFeeInvoice.number+' verificato.','proprietario','economia');
        }else return;
        await persist();return;
      }catch(err){alert(err.message);return;}
    }
    if(kind==='rate'){
      if(!allowed(p,true))return;
      if(String(d.get('to'))<String(d.get('from')))return alert('La data finale deve seguire quella iniziale.');
      const unitId=String(d.get('unitId')||'');if(unitId&&!units(p).some(u=>u.id===unitId))return;
      (c.rates||(c.rates=[])).push({id:uid(),unitId,from:String(d.get('from')),to:String(d.get('to')),price:Number(d.get('price')),createdAt:new Date().toISOString(),portalUpdated:false});notify(p,'Il proprietario ha aggiornato una tariffa: aggiorna Booking e Airbnb.','gestore','listino');
    }else{
      if(!manager())return;
      if(kind==='unit') (c.units||(c.units=[])).push({id:uid(),name:String(d.get('name')).trim(),capacity:Number(d.get('capacity')),basePrice:0});
      if(kind==='fee'){if(!['lordo','netto-portale',''].includes(String(d.get('basis')||'')))return;c.feeBasis=String(d.get('basis')||'');c.includeCleaning=d.get('cleaning')==='yes';}
      if(kind==='booking-finance'){
        const b=(p.prenotazioni||[]).find(b=>b.id===d.get('bookingId'));if(!b)return;
        b.vpmNightAmount=Number(d.get('night'));b.vpmCleaning=Number(d.get('cleaning'));b.vpmPortalCommission=Number(d.get('portal'));b.vpmRefund=Number(d.get('refund'));
      }
      if(kind==='booking'||kind==='assign'){
        const b=kind==='assign'?(p.prenotazioni||[]).find(b=>b.id===d.get('bookingId')):{id:uid(),nome:String(d.get('name')),checkin:String(d.get('checkin')),checkout:String(d.get('checkout')),adulti:Number(d.get('guests')),totale:Number(d.get('amount')),vpmNightAmount:Number(d.get('amount')),stato:'confermata',createdAt:new Date().toISOString()};if(!b)return;
        const unitId=String(d.get('unitId')||'');const u=units(p).find(u=>u.id===unitId);if(unitId&&!u)return;
        if(b.checkout<=b.checkin)return alert('La partenza deve seguire l’arrivo.');
        if(u&&Number(b.adulti||1)+Number(b.bambini||0)>Number(u.capacity))return alert('Il numero di ospiti supera la capienza della camera.');
        if(conflicts(p,b,unitId,b.id))return alert('Le date si sovrappongono a una prenotazione o a un blocco della stessa unità o dell’intera struttura.');
        b.unitId=unitId;if(kind==='booking')(p.prenotazioni||(p.prenotazioni=[])).push(b);
      }
    }
    await persist();
  },true);
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-vpm-room-delete],[data-vpm-rate-published],[data-vpm-owner-received]');if(!el)return;
    e.preventDefault();e.stopImmediatePropagation();const p=state.properties.find(p=>p.id===el.dataset.property);if(!p||!allowed(p,false,el.dataset.vpmRoomDelete?'prenotazioni':el.dataset.vpmRatePublished?'listino':'spese'))return;const c=mutable(p);
    if(el.dataset.vpmRoomDelete&&manager()){
      if((p.prenotazioni||[]).some(b=>b.unitId===el.dataset.vpmRoomDelete))return alert('La camera contiene prenotazioni. Conserva la camera per mantenere lo storico.');
      if(!confirm('Rimuovere questa camera e le sue tariffe?'))return;c.units=units(p).filter(u=>u.id!==el.dataset.vpmRoomDelete);c.rates=(c.rates||[]).filter(r=>r.unitId!==el.dataset.vpmRoomDelete);
    }
    if(el.dataset.vpmRatePublished&&manager()){const r=(c.rates||[]).find(r=>r.id===el.dataset.vpmRatePublished);if(r){r.portalUpdated=true;r.portalUpdatedAt=new Date().toISOString();notify(p,'Il gestore ha confermato l’aggiornamento della tariffa sui portali.','proprietario','tariffe');}}
    if(el.dataset.vpmOwnerReceived&&allowed(p,true)){const b=(p.prenotazioni||[]).find(b=>b.id===el.dataset.vpmOwnerReceived);if(b){b.vpmOwnerReceived=true;b.vpmOwnerReceivedAt=new Date().toISOString();}}
    await persist();
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
