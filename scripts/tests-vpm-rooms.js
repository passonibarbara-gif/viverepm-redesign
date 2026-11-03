/* Run: node scripts/tests-vpm-rooms.js */
'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const moduleSource=fs.readFileSync(path.join(__dirname,'../vpm-rooms.js'),'utf8');
function harness(){
  const h={alerts:[],confirmed:0,submitted:0,saved:0,rendered:0,notifications:[],readers:[],permissions:new Set(['prenotazioni','listino','spese']),handlers:{}};
  h.p={id:'p',prezzoNotte:100,prenotazioni:[],vpmRooms:{units:[{id:'A',name:'Camera A',capacity:2},{id:'B',name:'Camera B',capacity:2}],rates:[],feeBasis:'',includeCleaning:false},notifiche:[]};
  class FormDataMock{constructor(f){this.values=f.values;}get(k){return this.values[k]??null;}}
  h.ctx={window:{},state:{view:'gestore',gestoreUnlocked:true,properties:[h.p]},document:{addEventListener:(event,fn)=>h.handlers[event]=fn},fmtCurrency:n=>'€'+n,getCliente:()=>({email:'owner@example.com'}),immobileConsentito:()=>true,haModulo:module=>h.permissions.has(module),renderCalendar:()=>'',basePriceForDate:p=>p.prezzoNotte,calcTotale:()=>({soggiornoBase:200,totale:210,totaleServizi:10}),submitBooking:()=>h.submitted++,updateBookingStatus:()=>h.confirmed++,setPrezzoSettimanale:()=>{throw Error('manager mutated owner tariff');},setNotteMinima:()=>{},uid:()=>Math.random()+'',saveData:async()=>{h.saved++;},render:()=>h.rendered++,FormData:FormDataMock,alert:m=>h.alerts.push(m),confirm:()=>true,addNotifica:(...args)=>{h.notifications.push(args);(args[0].notifiche||(args[0].notifiche=[])).push({text:args[1]});},FileReader:class{readAsDataURL(file){this.file=file;h.readers.push(this);}}};
  vm.createContext(h.ctx);vm.runInContext(moduleSource,h.ctx);
  h.makeForm=(kind,values)=>({dataset:{property:'p',vpmRoomForm:kind},values,controls:[{disabled:false}],querySelectorAll(){return this.controls;}});
  h.dispatchSubmit=async f=>h.handlers.submit({target:{closest:()=>f},preventDefault(){},stopImmediatePropagation(){}});
  h.submit=async(kind,values)=>h.dispatchSubmit(h.makeForm(kind,values));
  h.click=async el=>h.handlers.click({target:{closest:()=>el},preventDefault(){},stopImmediatePropagation(){}});
  return h;
}
(async()=>{
  const h=harness(),{ctx,p}=h;
  p.prenotazioni=[{id:'a',unitId:'A',stato:'confermata',checkin:'2026-12-01',checkout:'2026-12-04'}];
  function booking(id,unitId,checkin='2026-12-02',checkout='2026-12-03'){p.prenotazioni.push({id,unitId,checkin,checkout,stato:'richiesta'});}
  booking('b','B');ctx.updateBookingStatus('p','b','confermata');assert.equal(h.confirmed,1,'different room stays available');
  booking('c','A');ctx.updateBookingStatus('p','c','confermata');assert.equal(h.confirmed,1,'same room overlap rejected');
  booking('d','');ctx.updateBookingStatus('p','d','confermata');assert.equal(h.confirmed,1,'whole structure overlaps occupied room');
  p.prenotazioni=p.prenotazioni.filter(b=>b.id==='a');booking('e','A','2026-12-04','2026-12-05');ctx.updateBookingStatus('p','e','confermata');assert.equal(h.confirmed,2,'checkout is exclusive');
  p.prenotazioni=[{id:'whole',stato:'confermata',checkin:'2026-12-01',checkout:'2026-12-04'}];booking('f','B');ctx.updateBookingStatus('p','f','confermata');assert.equal(h.confirmed,2,'whole structure blocks each room');
  ctx.submitBooking('p',{checkin:'2027-01-01',checkout:'2027-01-02'});assert.equal(h.submitted,0,'guest cannot silently book whole B&B');
  h.permissions.delete('prenotazioni');ctx.updateBookingStatus('p','f','rifiutata');assert.equal(h.confirmed,2,'operator needs booking permission');assert(ctx.window.vpmRoomsRender(p,'gestore','camere').includes('Accesso non consentito'));h.permissions.add('prenotazioni');
  ctx.setPrezzoSettimanale('p','2026-W01',100);assert(!ctx.window.vpmRoomsRender(p,'gestore','tariffe').includes('data-vpm-room-form="rate"'),'manager price view read only');
  const b={vpmNightAmount:1000,vpmPortalCommission:150,vpmCleaning:50};assert.equal(ctx.window.vpmRoomFee(p,b),null);p.vpmRooms.feeBasis='lordo';assert.equal(ctx.window.vpmRoomFee(p,b),250);p.vpmRooms.feeBasis='netto-portale';assert.equal(ctx.window.vpmRoomFee(p,b),212.5);p.vpmRooms.includeCleaning=true;assert.equal(ctx.window.vpmRoomFee(p,b),225);assert.equal(ctx.window.vpmRoomFee(p,{...b,vpmNightAmount:NaN}),null);
  p.vpmRooms.rates=[{unitId:'',from:'2026-12-01',to:'2026-12-31',price:120,createdAt:'2026-11-02'}];assert.equal(ctx.window.vpmRoomCalculate(p,'','2026-12-01','2026-12-03').amount,240);assert.equal(ctx.calcTotale(p,'2026-12-01','2026-12-03').totale,250);assert.equal(ctx.window.vpmRoomCalculate(p,'','2026-02-30','2026-03-03'),null);
  await h.submit('unit',{name:'Bad',capacity:'Infinity'});assert.equal(h.saved,0);await h.submit('unit',{name:'Bad',capacity:'0'});assert.equal(h.saved,0);
  h.permissions.delete('spese');await h.submit('fee',{basis:'lordo',cleaning:'no'});assert.equal(h.saved,0);assert(ctx.window.vpmRoomsRender(p,'gestore','economia').includes('Accesso non consentito'));h.permissions.add('spese');
  ctx.state.view='proprietari';ctx.state.ownerAuth={email:'owner@example.com'};await h.submit('rate',{unitId:'A',from:'2027-01-01',to:'2027-01-05',price:'-1'});assert.equal(h.saved,0);await h.submit('rate',{unitId:'A',from:'2027-01-01',to:'2027-01-05',price:'150'});assert.equal(h.saved,1);assert.equal(h.notifications.length,1);assert(ctx.window.vpmRoomsRender(p,'proprietario','tariffe').includes('Salva tariffa'));
  ctx.state.ownerAuth.email='wrong@example.com';await h.submit('rate',{unitId:'A',from:'2027-01-01',to:'2027-01-05',price:'200'});assert.equal(h.saved,1,'owner cannot mutate another owner property');
  ctx.state.view='gestore';ctx.state.error='Database offline';const before=h.rendered;await h.submit('unit',{name:'Test',capacity:'2'});assert.equal(h.rendered,before,'failed persisted state does not proceed with success render');
  p.vpmRooms.units[0].name='<script>alert(1)</script>';assert(!ctx.window.vpmRoomsRender(p,'gestore','camere').includes('<script>'),'room labels are escaped');
  // Failed persistence must restore every module-owned field and retain the form for retry.
  for(const failure of ['false','state-error','throw']){
    const tx=harness(),before=JSON.stringify(tx.p),form=tx.makeForm('unit',{name:'Retry camera',capacity:'2'});
    tx.ctx.saveData=async options=>{assert.equal(options.renderOnError,false);tx.saved++;if(failure==='throw')throw Error('Offline');if(failure==='state-error'){tx.ctx.state.error='Offline';return undefined;}return false;};
    await tx.dispatchSubmit(form);assert.equal(JSON.stringify(tx.p),before);assert.equal(tx.rendered,0);assert.equal(form.values.name,'Retry camera');assert.equal(form.controls[0].disabled,false);assert.equal(form.dataset.vpmRoomBusy,undefined);assert(tx.alerts.length);
    tx.ctx.state.error=null;tx.ctx.saveData=async()=>true;await tx.dispatchSubmit(form);assert.equal(tx.p.vpmRooms.units.length,3);assert.equal(tx.rendered,1);
  }
  // A save in flight locks all mutations for the same property, including separate forms.
  const lock=harness();let finish;
  lock.ctx.saveData=()=>{lock.saved++;return new Promise(resolve=>finish=resolve);};
  const f=lock.makeForm('unit',{name:'Once',capacity:'2'}),first=lock.dispatchSubmit(f);
  await lock.submit('unit',{name:'Duplicate',capacity:'2'});assert.equal(lock.saved,1);assert.equal(lock.p.vpmRooms.units.length,3);assert(f.controls[0].disabled);
  finish(false);await first;assert.equal(lock.p.vpmRooms.units.length,2);assert.equal(lock.rendered,0);assert(!f.controls[0].disabled);
  // Rollback publication / receipt click mutations as well as submission mutations.
  const click=harness();click.p.vpmRooms.rates=[{id:'rate',unitId:'A',price:100}];let finishClick;
  click.ctx.saveData=()=>{click.saved++;return new Promise(resolve=>finishClick=resolve);};
  const button={tagName:'BUTTON',disabled:false,dataset:{property:'p',vpmRatePublished:'rate'}};
  const clickFirst=click.click(button);await click.click(button);assert.equal(click.saved,1);assert(button.disabled);
  finishClick(false);await clickFirst;assert.equal(click.p.vpmRooms.rates[0].portalUpdated,undefined);assert.equal(click.p.notifiche.length,0);assert(!button.disabled);assert.equal(click.rendered,0);
  // Invoice uploads lock before asynchronous file reads so duplicate uploads cannot race.
  const invoice=harness();invoice.p.prenotazioni=[{id:'b',nome:'Guest',stato:'confermata',totale:100}];
  const file={size:30,type:'application/pdf'},invoiceValues={bookingId:'b',number:'1',net:'25',vat:'0',beneficiary:'Vivere PM',iban:'IT60X0542811101000000123456',due:'2027-01-01',document:file};
  const invoiceFirst=invoice.submit('invoice',invoiceValues);await invoice.submit('invoice',invoiceValues);assert.equal(invoice.readers.length,1);assert.equal(invoice.saved,0);
  invoice.readers[0].result='data:application/pdf;base64,VEVTVA==';invoice.readers[0].onload();await invoiceFirst;assert.equal(invoice.saved,1);assert.equal(invoice.p.prenotazioni[0].vpmFeeInvoice.number,'1');
  const failedInvoice=harness();failedInvoice.p.prenotazioni=[{id:'b',nome:'Guest',stato:'confermata',totale:100}];failedInvoice.ctx.saveData=async()=>false;
  const failedUpload=failedInvoice.submit('invoice',invoiceValues);failedInvoice.readers[0].result='data:application/pdf;base64,VEVTVA==';failedInvoice.readers[0].onload();await failedUpload;assert.equal(failedInvoice.p.prenotazioni[0].vpmFeeInvoice,undefined);assert.equal(failedInvoice.p.notifiche.length,0);assert.equal(failedInvoice.rendered,0);
  // Partial owner payment confirmation cannot be submitted repeatedly while in verification.
  invoice.ctx.state.view='proprietari';invoice.ctx.state.ownerAuth={email:'owner@example.com'};invoice.p.prenotazioni[0].vpmFeeInvoice.status='pending';
  assert(!invoice.ctx.window.vpmRoomsRender(invoice.p,'proprietario','economia').includes('data-vpm-room-form="invoice-payment"'));
  console.log('PASS: false/error/throw rollback, retry without duplicate records, pending mutation locks, invoice upload races, click rollback and notification rollback.');
  console.log('PASS: room overlaps, checkout boundaries, operator permissions, owner rates, finite numeric/date validation, notifications, fee bases, save failure and HTML escaping.');
})().catch(err=>{console.error(err);process.exitCode=1;});
