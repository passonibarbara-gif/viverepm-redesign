/* Run: node scripts/tests-vpm-rooms.js */
'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const moduleSource=fs.readFileSync(path.join(__dirname,'../vpm-rooms.js'),'utf8');
function harness(){
  const h={alerts:[],confirmed:0,submitted:0,saved:0,rendered:0,notifications:[],permissions:new Set(['prenotazioni','listino','spese']),handlers:{}};
  h.p={id:'p',prezzoNotte:100,prenotazioni:[],vpmRooms:{units:[{id:'A',name:'Camera A',capacity:2},{id:'B',name:'Camera B',capacity:2}],rates:[],feeBasis:'',includeCleaning:false}};
  class FormDataMock{constructor(f){this.values=f.values;}get(k){return this.values[k]??null;}}
  h.ctx={window:{},state:{view:'gestore',gestoreUnlocked:true,properties:[h.p]},document:{addEventListener:(event,fn)=>h.handlers[event]=fn},fmtCurrency:n=>'€'+n,getCliente:()=>({email:'owner@example.com'}),immobileConsentito:()=>true,haModulo:module=>h.permissions.has(module),renderCalendar:()=>'',basePriceForDate:p=>p.prezzoNotte,calcTotale:()=>({soggiornoBase:200,totale:210,totaleServizi:10}),submitBooking:()=>h.submitted++,updateBookingStatus:()=>h.confirmed++,setPrezzoSettimanale:()=>{throw Error('manager mutated owner tariff');},setNotteMinima:()=>{},uid:()=>Math.random()+'',saveData:async()=>{h.saved++;},render:()=>h.rendered++,FormData:FormDataMock,alert:m=>h.alerts.push(m),confirm:()=>true,addNotifica:(...args)=>h.notifications.push(args)};
  vm.createContext(h.ctx);vm.runInContext(moduleSource,h.ctx);
  h.submit=async(kind,values)=>{const f={dataset:{property:'p',vpmRoomForm:kind},values};await h.handlers.submit({target:{closest:()=>f},preventDefault(){},stopImmediatePropagation(){}});};
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
  console.log('PASS: room overlaps, checkout boundaries, operator permissions, owner rates, finite numeric/date validation, notifications, fee bases, save failure and HTML escaping.');
})().catch(err=>{console.error(err);process.exitCode=1;});
