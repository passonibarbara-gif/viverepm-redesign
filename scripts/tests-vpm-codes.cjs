'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('vpm-codes.js','utf8');
const p={id:'p',nome:'Casa',clienteId:'c',notifiche:[],cinToRequest:true},handlers={},ctx={window:{vpmServicesPending:()=>({items:[],count:0})},state:{view:'gestore',gestoreUnlocked:true,properties:[p]},document:{addEventListener:(kind,fn)=>(handlers[kind]??=[]).push(fn)},immobileConsentito:()=>true,getCliente:()=>({email:'owner@example.test'}),immobiliVisibili:()=>[p],vpmOwnerEscape:s=>String(s??'').replaceAll('<','&lt;'),vpmPortfolioShell:(...args)=>args.at(-1),fmtDate:x=>x,uid:()=>String(++ctx.ids),ids:0,addNotifica:(p,text)=>p.notifiche.push(text),render:()=>ctx.renders++,renders:0,saveData:async()=>true,readFileAsDataUrl:async()=> 'data:application/pdf;base64,AA==',FormData:class{constructor(f){this.f=f;}get(k){return this.f.values[k]??null;}}};
vm.createContext(ctx);vm.runInContext(source,ctx);
function form(kind,values,request=true){return {dataset:request?{codeRequest:kind,property:'p'}:{codeForm:'p'},values,feedback:{textContent:''},buttons:[{disabled:false}],querySelector(){return this.feedback;},querySelectorAll(){return this.buttons;}};}
async function submit(f,request=true){for(const handler of handlers.submit)await handler({target:{closest:s=>s===(request?'[data-code-request]':'[data-code-form]')?f:null},preventDefault(){},stopImmediatePropagation(){}});}
(async()=>{
 assert(ctx.vpmCodePending(p));assert(ctx.vpmRenderCodesHub().includes('CIN e CIR')||ctx.vpmRenderCodesHub().includes('Da gestire'));
 await submit(form('create',{title:'Visura',message:'Allega visura aggiornata',fileRequired:'on',required:'on'}));
 const id=p.vpmCodes.requests[0].id;assert.equal(p.vpmCodes.requests[0].status,'open');
 ctx.state.view='proprietari';ctx.state.ownerAuth={email:'owner@example.test'};
 let reply=form('reply',{requestId:id,message:'Ecco il documento'});await submit(reply);assert(reply.feedback.textContent.includes('Allega'));assert.equal(p.vpmCodes.requests[0].status,'open');
 reply=form('reply',{requestId:id,message:'Ecco',attachment:{name:'visura.pdf',size:20,type:'application/pdf'}});await submit(reply);assert.equal(p.vpmCodes.requests[0].status,'answered');
 ctx.state.view='gestore';assert.equal(ctx.window.vpmServicesPending(p,'gestore').items[0].tab,'codes');
 const review=form('review',{requestId:id,decision:'integrate',message:''});await submit(review);assert.equal(p.vpmCodes.requests[0].status,'answered');assert(review.feedback.textContent.includes('Spiega'));
 review.values.message='Manca una pagina';await submit(review);assert.equal(p.vpmCodes.requests[0].status,'integrate');
 ctx.state.view='proprietari';await submit(reply);assert.equal(p.vpmCodes.requests[0].status,'answered');
 ctx.state.ownerAuth.email='other@example.test';const before=JSON.stringify(p);await submit(reply);assert.equal(JSON.stringify(p),before,'another owner cannot reply');
 ctx.state.ownerAuth.email='owner@example.test';await submit(form('create',{title:'Bad',message:'Bad'}));assert.equal(JSON.stringify(p),before,'owner cannot create manager requests');
 ctx.state.view='gestore';await submit(form('review',{requestId:id,decision:'accepted'}));assert.equal(p.vpmCodes.requests[0].status,'accepted');assert.equal(p.vpmCodes.requests[0].history.length,5);
 const tasks=Object.fromEntries(vm.runInContext('vpmCodeTasks.map(([id])=>["task_"+id,"done"])',ctx));
 const values={...tasks,region:'Sicilia',municipality:'Palermo',profile:'lt',status:'Completata',cin:'IT-TEST',cir:'CIR-TEST',cinDate:'2026-11-03',cirDate:'2026-11-02',protocol:'COMUNE123',certificate:'PDF123'};
 await submit(form('',values,false),false);assert.equal(p.vpmCodes.status,'Completata');assert.equal(p.vpmCodes.requests.length,1,'saving case preserves conversations');assert(!p.cinToRequest);assert(!ctx.vpmCodePending(p));
 await submit(form('create',{title:'Nuova integrazione',message:'Serve documento',required:'on'}));assert.equal(p.vpmCodes.status,'Documenti mancanti');
 const close=form('',values,false);await submit(close,false);assert(close.feedback.textContent.includes('obbligatorie'));assert.equal(p.vpmCodes.status,'Documenti mancanti');
 ctx.saveData=async()=>false;const original=JSON.stringify(p);await submit(form('create',{title:'Failed',message:'No'}));assert.equal(JSON.stringify(p),original,'failure rolls back request and notification');
 const invalid=form('',{...values,cinDate:'2026-02-30'},false);await submit(invalid,false);assert(invalid.feedback.textContent.includes('date valide'));
 assert(ctx.vpmRenderCodesProperty(p,'gestore').includes('Richieste al proprietario'));
 console.log('PASS: code register, manager/owner request lifecycle, files, role isolation, history preservation, closure gates and save rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
