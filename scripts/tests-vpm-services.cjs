const vm=require('vm'),fs=require('fs'),assert=require('assert');
const handlers={},alerts=[];
const property={id:'p',clienteId:'c',nome:'<script>x</script>',prenotazioni:[{id:'b',nome:'Mario',checkin:'2026-11-02',checkout:'2026-11-03'}]};
const notifications=[];
const context={fmtDate:d=>String(d).slice(0,10),addNotifica:(p,...args)=>{notifications.push([p,...args]);(p.notifiche||(p.notifiche=[])).push({text:args[0],role:args[1],tab:args[2]});},window:{},document:{addEventListener:(event,fn)=>handlers[event]=fn},state:{view:'proprietari',ownerAuth:{email:'owner@test.it'},properties:[property]},getClienteByEmail:()=>({id:'c'}),getCliente:()=>({nome:'<img onerror=x>',email:'owner@test.it'}),saveData:async()=>{},render:()=>{},uid:()=>Math.random().toString(16).slice(2),alert:x=>alerts.push(x),confirm:()=>true,FormData:class{constructor(f){this.values=f.values}get(k){return this.values[k]}entries(){return Object.entries(this.values)[Symbol.iterator]()}},readFileAsDataUrl:async()=> 'data:application/pdf;base64,JVBERg=='};
vm.createContext(context);vm.runInContext(fs.readFileSync('vpm-services.js','utf8'),context);
const render=context.window.vpmServicesRender;
for(const tab of ['contratti','portali','ospiti','shop'])assert(render(property,'proprietario',tab).length>50);
assert(!render(property,'proprietario','portali').includes('<img onerror=x>'));
property.vpmServices={documents:[],portal:{},guests:{},orders:[],catalog:[{id:'prod',name:'Corredo',description:'Lenzuola',price:45.5,active:true}]};
const forms=[];
async function submit(action,values,options={}){
 const errors=[];const button={};const form={dataset:{serviceForm:action,serviceProperty:'p'},values,elements:options.elements||{},querySelector:selector=>selector==='[data-service-error]'?{set textContent(v){errors.push(v)}}:button,querySelectorAll:()=>[button],checkValidity:()=>true,reportValidity(){}};
 forms.push(form);await handlers.submit({submitter:{value:options.submitter||''},target:{closest:()=>form},preventDefault(){},stopImmediatePropagation(){}});return {form,errors};
}
const completePortal={entity:'Persona fisica',legalName:'Invio completo',taxId:'ABC',address:'Via Roma 1',email:'owner@test.it',phone:'12345',beneficiary:'Mario Rossi',iban:'IT60X0542811101000000123456',platforms:'Booking e Airbnb',bookingExisting:'No',airbnbExisting:'No',accommodation:'Casa',propertyAddress:'Sicilia'};

(async()=>{
 await submit('order-add',{product:'prod',quantity:'2',room:'Camera 1',notes:'',confirm:'on'});
 assert.equal(property.vpmServices.orders[0].total,91);assert.equal(notifications.length,1);assert.equal(context.window.vpmServicesPending(property,'gestore').count,1);
 await submit('order-add',{product:'prod',quantity:'-1'});assert.equal(property.vpmServices.orders.length,1);
 await submit('catalog-add',{name:'Not allowed',description:'test',price:'1'});assert.equal(property.vpmServices.catalog.length,1);
 await submit('guest-add',{booking:'missing',birthDate:'2000-01-01'});assert.equal(Object.keys(property.vpmServices.guests).length,0);
 await submit('guest-add',{booking:'b',firstName:'Mario',lastName:'Rossi',birthDate:'2000-01-01',birthPlace:'Roma',nationality:'Italiana',documentType:'Passaporto',documentNumber:'AB12'});
 assert.equal(property.vpmServices.guests.b.people.length,1);
 context.state.view='gestore';context.state.gestoreUnlocked=true;context.haModulo=()=>false;await submit('catalog-add',{name:'Blocked',description:'x',price:'1'});assert.equal(property.vpmServices.catalog.length,1);context.haModulo=()=>true;
 await submit('portal-status',{status:'Attivazione in corso'});assert.notEqual(property.vpmServices.portal.status,'Attivazione in corso');
 await submit('guest-status',{booking:'b',status:'Trasmessi manualmente',reference:'R1'});assert.notEqual(property.vpmServices.guests.b.status,'Trasmessi manualmente');
 context.state.view='proprietari';
 await submit('portal-save',{legalName:'Bozza parziale',iban:''});
 assert.equal(property.vpmServices.portal.legalName,'Bozza parziale');
 assert.equal(property.vpmServices.portal.status,'Bozza');
 assert(render(property,'proprietario','portali').includes('Bozza salvata'));
 await submit('portal-save',{send:'yes',legalName:'Dati da correggere',iban:'INVALID'});
 assert.equal(property.vpmServices.portal.legalName,'Bozza parziale');
 await submit('portal-save',{...completePortal,send:'yes'});
 assert.equal(property.vpmServices.portal.status,'Dati inviati al gestore');
 assert(property.vpmServices.portal.submittedAt);
 assert(render(property,'proprietario','portali').includes('Richiesta inviata al gestore'));
 const count=notifications.length;
 await submit('delegation-request',{});await submit('delegation-request',{});
 assert.equal(notifications.length,count+1);
 assert(render(property,'proprietario','portali').includes('Richiesta già inviata'));
 context.saveData=async()=>false;
 await submit('portal-save',{legalName:'Non salvare',iban:''});
 assert.equal(property.vpmServices.portal.legalName,'Invio completo');
 context.saveData=async()=>true;context.state.error=null;context.state.view='gestore';
 await submit('portal-status',{status:'Azione richiesta al proprietario',managerNotes:'Mancano i dati'});
 assert.equal(property.vpmServices.portal.status,'In attesa del proprietario');
 assert.equal(property.vpmServices.portal.managerNotes,'Mancano i dati');
 assert(render(property,'gestore','portali').includes('Pratica aggiornata'));
 assert(render(property,'proprietario','portali').includes('Mancano i dati'));
 assert(notifications.some(n=>n[1].includes('Aggiornamento pratica')&&n[2]==='proprietario'));

 // Legacy notes become an answerable request, without duplicate open requests.
 assert.equal(property.vpmServices.portal.requests.length,1);
 await submit('portal-status',{status:'Azione richiesta al proprietario',managerNotes:'Mancano i dati'});
 assert.equal(property.vpmServices.portal.requests.length,1);
 const legacyId=property.vpmServices.portal.requests[0].id;
 context.state.view='proprietari';await submit('portal-request-reply',{requestId:legacyId,response:'Dati integrati'});
 context.state.view='gestore';await submit('portal-request-review',{requestId:legacyId,review:'accept'});
 assert.equal(property.vpmServices.portal.requests[0].status,'completata');
 property.vpmServices.portal.managerNotes='Una nota precedente';
 assert(render(property,'gestore','portali').includes('Trasforma la nota in richiesta'));
 await submit('portal-request-from-note',{});
 assert.equal(property.vpmServices.portal.requests.length,2);
 assert.equal(property.vpmServices.portal.requests[1].details,'Una nota precedente');
 // Isolate the subsequent lifecycle fixture while retaining its base portal data.
 property.vpmServices.portal.requests=[];property.vpmServices.portal.managerNotes='';
 // Structured portal request lifecycle and terminal gates.
 const portal=()=>property.vpmServices.portal;
 const requests=()=>portal().requests||[];
 context.state.view='proprietari';
 await submit('portal-request-add',{requestType:'dati',title:'Forbidden',details:'Owner cannot create',required:'yes'});
 assert.equal(requests().length,0,'Owner cannot create manager requests');
 context.state.view='gestore';
 await submit('portal-request-add',{requestType:'dati',title:'Dati mancanti',details:'Indica il codice',required:'yes',deadline:'2026-12-01'});
 assert.equal(requests().length,1);const id=requests()[0].id;
 assert.equal(requests()[0].status,'aperta');assert.equal(portal().status,'In attesa del proprietario');
 assert(context.window.vpmServicesPending(property,'proprietario').items.some(i=>i.requestId===id));
 let html=render(property,'gestore','portali');assert(html.indexOf('Richieste e risposte')<html.indexOf('Intestatario:'));
 await submit('portal-request-reply',{requestId:id,response:'Manager cannot impersonate owner'});
 assert.equal(requests()[0].status,'aperta');
 context.state.view='proprietari';
 await submit('portal-request-review',{requestId:id,review:'accept'});
 assert.equal(requests()[0].status,'aperta');
 await submit('portal-request-reply',{requestId:id,response:'Primo dato'});
 assert.equal(requests()[0].status,'risposta-inviata');assert.equal(portal().status,'Risposte da verificare');
 const replyCount=requests()[0].replies.length;
 await submit('portal-request-reply',{requestId:id,response:'Duplicate'});assert.equal(requests()[0].replies.length,replyCount);
 assert(context.window.vpmServicesPending(property,'gestore').items.some(i=>i.requestId===id));
 context.state.view='gestore';
 const noReason=await submit('portal-request-review',{requestId:id,review:'return'});assert(noReason.errors.length);assert.equal(requests()[0].status,'risposta-inviata');
 await submit('portal-request-review',{requestId:id,review:'return',reason:'Serve il codice completo'});
 assert.equal(requests()[0].status,'da-integrare');assert.equal(portal().status,'In attesa del proprietario');
 context.state.view='proprietari';
 await submit('portal-request-reply',{requestId:id,response:'Dato completo'});
 assert.equal(requests()[0].replies.length,2);assert.equal(requests()[0].replies[0].text,'Primo dato');
 context.state.view='gestore';
 property.vpmServices.documents.push({kind:'Delega portali',status:'Firmato verificato',signedFile:{url:'data:application/pdf;base64,JVBERg=='}});
 const blocked=await submit('portal-status',{status:'Pratica completata'});assert(blocked.errors.length);assert.notEqual(portal().status,'Pratica completata');
 await submit('portal-request-review',{requestId:id,review:'accept',reason:'Verificato'});
 assert.equal(requests()[0].status,'completata');assert.equal(portal().status,'Verifiche del gestore');assert.equal(requests()[0].history.length,5);
 // Missing account data blocks completion even after all requests are accepted.
 delete portal().email;
 await submit('portal-status',{status:'Pratica completata'});assert.notEqual(portal().status,'Pratica completata');portal().email=completePortal.email;
 await submit('portal-status',{status:'Pratica completata'});assert.equal(portal().status,'Pratica completata');
 // A newer unverified delegation supersedes an old verified copy.
 property.vpmServices.documents.push({kind:'Delega portali',status:'Da firmare'});
 await submit('portal-status',{status:'Annuncio attivo'});assert.equal(portal().status,'Pratica completata');
 property.vpmServices.documents.pop();
 property.vpmServices.documents[0].expiry='2000-01-01';
 await submit('portal-status',{status:'Annuncio attivo'});assert.equal(portal().status,'Pratica completata');
 delete property.vpmServices.documents[0].expiry;
 const priorCount=requests().length;
 await submit('portal-request-add',{requestType:'dati',title:'Data invalida',details:'Test',required:'yes',deadline:'2026-02-31'});
 assert.equal(requests().length,priorCount);
 // Required signature and document replies must include attachments. Old replies are immutable history.
 for(const type of ['firma','documento']){
   await submit('portal-request-add',{requestType:type,title:'Invia '+type,details:'Allega il documento richiesto',required:'yes'});
   const requestId=requests()[requests().length-1].id;
   context.state.view='proprietari';await submit('portal-request-reply',{requestId,response:'Solo testo'});
   assert.equal(requests().find(r=>r.id===requestId).status,'aperta');
   const file={name:'firma.pdf',type:'application/pdf',size:50};
   await submit('portal-request-reply',{requestId,response:'Prima copia'},{elements:{responseFile:{files:[file]}}});
   assert(requests().find(r=>r.id===requestId).replies[0].attachment.url);
   context.state.view='gestore';await submit('portal-request-review',{requestId,review:'return',reason:'Ricarica copia leggibile'});
   context.state.view='proprietari';await submit('portal-request-reply',{requestId,response:'Seconda copia'},{elements:{responseFile:{files:[{...file,name:'seconda.pdf'}]}}});
   const request=requests().find(r=>r.id===requestId);assert.equal(request.replies.length,2);assert.equal(request.replies[0].attachment.name,'firma.pdf');assert.equal(request.replies[1].attachment.name,'seconda.pdf');
   context.state.view='gestore';await submit('portal-request-review',{requestId,review:'accept'});
 }
 // A confirmation request needs an explicit owner confirmation.
 await submit('portal-request-add',{requestType:'conferma',title:'Conferma',details:'Conferma attività',required:'yes'});
 const confirmationId=requests()[requests().length-1].id;
 context.state.view='proprietari';
 await submit('portal-request-reply',{requestId:confirmationId,response:'Non confermato'});
 assert.equal(requests().find(r=>r.id===confirmationId).status,'aperta');
 const originalClient=context.getClienteByEmail;context.getClienteByEmail=()=>({id:'stranger'});
 await submit('portal-request-reply',{requestId:confirmationId,confirmed:'yes'});
 assert.equal(requests().find(r=>r.id===confirmationId).status,'aperta');context.getClienteByEmail=originalClient;
 await submit('portal-request-reply',{requestId:confirmationId,confirmed:'yes'});
 assert.equal(requests().find(r=>r.id===confirmationId).status,'risposta-inviata');
 context.state.view='gestore';await submit('portal-request-review',{requestId:confirmationId,review:'accept'});
 assert.equal(requests().find(r=>r.id===confirmationId).status,'completata');
 // A forged review status without a response cannot be accepted.
 requests().push({id:'forged',type:'dati',required:true,status:'risposta-inviata',replies:[],history:[]});
 await submit('portal-request-review',{requestId:'forged',review:'accept'});
 assert.equal(requests().find(r=>r.id==='forged').status,'risposta-inviata');portal().requests=requests().filter(r=>r.id!=='forged');
 // Failed save rolls back request state, audit records and notification records.
 const before=JSON.stringify(property.vpmServices),noticeCount=(property.notifiche||[]).length;
 context.saveData=async()=>false;
 const failed=await submit('portal-request-add',{requestType:'conferma',title:'Rollback',details:'Conferma',required:'yes'});
 assert.equal(JSON.stringify(property.vpmServices),before);assert.equal((property.notifiche||[]).length,noticeCount);assert(failed.errors.length);assert.equal(failed.form.dataset.busy,'false');
 context.saveData=async()=>true;
 // Double clicks on the same in-flight form create one request.
 let release;context.saveData=()=>new Promise(resolve=>release=resolve);
 const pending=submit('portal-request-add',{requestType:'conferma',title:'Una sola',details:'Conferma',required:'yes'});
 await Promise.resolve();await Promise.resolve();const busyForm=forms[forms.length-1],countBefore=requests().length;
 await handlers.submit({target:{closest:()=>busyForm},preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(requests().length,countBefore);release(true);await pending;context.saveData=async()=>true;
 console.log('PASS: structured create/reply/return/reply/accept, required completion gates, current delegation, attachments/history, roles, rollback and duplicate submit');
 console.log('PASS: portal partial drafts, send validation, feedback, duplicate delegation guard and failed-save rollback');
 console.log('PASS: renders, escapes, order totals/quantity, role guards, booking link and delegation gates');
})().catch(e=>{console.error(e);process.exit(1)});
