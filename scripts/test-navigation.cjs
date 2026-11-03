/* Run from repository root: node scripts/test-navigation.cjs */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function attachHandlers(){'),html.indexOf('// VPM MODULES START'));
function element(attrs={}){const handlers={};return {attrs,handlers,dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),addEventListener(type,fn){(handlers[type]||(handlers[type]=[])).push(fn);},getAttribute:name=>attrs[name],hasAttribute:name=>Object.hasOwn(attrs,name),classList:{add(){},remove(){},contains(){return false}},style:{},click(){for(const fn of handlers.click||[])fn({preventDefault(){},stopPropagation(){}});}};}
const map=new Map(),documentListeners=[],modals=[];
function pair(selector,attrs){const xs=[element(attrs),element(attrs)];map.set(selector,xs);return xs;}
const clients=pair('[data-action="new-cliente"]',{'data-action':'new-cliente'});
const edits=pair('[data-action="edit-property"]',{'data-action':'edit-property'});
const properties=pair('[data-action="new-property"]',{'data-action':'new-property'});
const settings=pair('[data-action="open-settings"]',{'data-action':'open-settings'});
const bookings=pair('[data-nav-prenotazioni]',{'data-nav-prenotazioni':''});
const calendarClose=pair('[data-booking-cal-day-close]',{'data-booking-cal-day-close':''});
const ownerTabs=pair('[data-owner-tab]',{'data-owner-tab':'portali'});
const dossierTabs=pair('[data-dossier-tab]',{'data-dossier-tab':'camere'});
const propertyTabs=pair('[data-vpm-open-tab]',{'data-vpm-open-tab':'p::portali'});
const root={contains:()=>true};
const ctx={window:{__notifOutsideBound:true},document:{querySelectorAll:q=>map.get(q)||[],querySelector:q=>(map.get(q)||[])[0]||null,getElementById:id=>id==='root'?root:null,addEventListener:(type,fn)=>documentListeners.push({type,fn})},state:{properties:[{id:'p'}],selectedId:null,selectedClienteId:null,vistaGestore:'overview',settings:{},calendarSelectedDay:'2026-11-03'},isAdmin:()=>true,haModulo:()=>true,immobileConsentito:()=>true,immobiliVisibili:()=>[{id:'p'}],vpmRememberRecent(){},calcolaAlertImmobile:()=>({}),segnaMessaggiLetti(){},segnaMessaggiBookingLetti(){},openModal:(...a)=>modals.push(a),render(){ctx.renderCount++;},renderCount:0};
vm.createContext(ctx);vm.runInContext(source,ctx);ctx.attachHandlers();
for(const [name,buttons]of Object.entries({clients,properties,edits,settings,bookings,ownerTabs,dossierTabs,propertyTabs,calendarClose})){
  assert(buttons.every(b=>(b.handlers.click||[]).length===1),`${name}: every repeated control must receive one click listener`);
}
ctx.state.selectedId='p';for(const b of edits)b.click();assert.equal(modals.filter(x=>x[0]==='property').length,2);modals.length=0;
for(const b of clients)b.click();assert.equal(modals.filter(x=>x[0]==='cliente').length,2);
for(const b of properties)b.click();assert.equal(modals.filter(x=>x[0]==='property').length,2);
for(const b of settings)b.click();assert.equal(modals.filter(x=>x[0]==='settings').length,2);
for(const b of bookings){ctx.state.selectedId='p';b.click();assert.equal(ctx.state.selectedId,null);assert.equal(ctx.state.vistaGestore,'tutte-prenotazioni');}
for(const b of ownerTabs){b.click();assert.equal(ctx.state.ownerDossierTab,'portali');}
for(const b of dossierTabs){b.click();assert.equal(ctx.state.dossierTab,'camere');}
for(const b of propertyTabs){b.click();assert.equal(ctx.state.selectedId,'p');assert.equal(ctx.state.dossierTab,'portali');}
for(const b of calendarClose){ctx.state.calendarSelectedDay='2026-11-03';b.click();assert.equal(ctx.state.calendarSelectedDay,null);}
// The sidebar uses one capture listener across repeated render/bind passes.
const sidebarCount=documentListeners.filter(x=>x.type==='click').length;ctx.attachHandlers();assert.equal(documentListeners.filter(x=>x.type==='click').length,sidebarCount);
const node=element({'data-nav':'overview'});const evt={target:{closest:selector=>selector==='[data-nav]'?node:null},preventDefault(){},stopPropagation(){}};documentListeners.find(x=>x.type==='click').fn(evt);assert.equal(ctx.state.selectedId,null);assert.equal(ctx.state.vistaGestore,'overview');
console.log('PASS: repeated dashboard/sidebar actions, owner/manager tabs, property links, calendar close buttons and delegated sidebar binding.');
