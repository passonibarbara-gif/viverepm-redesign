/* Run: node scripts/tests-core-persistence.cjs. Uses production functions, without a live database. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8');
const core=source.slice(source.indexOf('function coreFormBusy('),source.indexOf('function deleteProperty('));
const cliente=source.slice(source.indexOf('function saveCliente('),source.indexOf('function deleteCliente('));
const clienteBinding=source.slice(source.indexOf("  const clienteForm = document.getElementById('clienteForm');"),source.indexOf("  document.querySelectorAll('[data-remove-documento]')"));
const settingsBinding=source.slice(source.indexOf("  const settingsForm = document.getElementById('settingsForm');"),source.indexOf('  const bookingForm ='));
let propBinding=source.slice(source.indexOf("    propForm.addEventListener('submit', async ev=>{"),source.indexOf('  const expenseForm ='));
propBinding=propBinding.slice(0,propBinding.lastIndexOf('\n  }'));
const clean=x=>JSON.parse(JSON.stringify(x));
function form(values={}){const handlers={};const button={disabled:false};const f={values,dataset:{},handlers,button,error:null,querySelectorAll:q=>q==='[type=submit]'?[button]:[],querySelector:q=>q==='[data-core-form-error]'?f.error:q==='input[name=documenti]'?{files:[]}:null,appendChild:x=>{f.error=x;},addEventListener:(t,fn)=>{handlers[t]=fn;}};return f;}
function harness(id,values={},editing=null){
 const f=form(values),h={closed:0,renders:0,saves:0,result:true,saveError:null,pending:null};
 const ctx={state:{properties:[{id:'p',nome:'Prima',clienteId:'c',spese:[],prenotazioni:[]}],clienti:[{id:'c',nome:'Proprietario',email:'owner@example.test'}],settings:{nomeAgenzia:'Prima',gestoreEmail:'admin@example.test',extra:'preservare'},modal:{editing},error:null},document:{getElementById:k=>k===id?f:null,createElement:()=>({dataset:{},setAttribute(){}})},FormData:class{constructor(x){this.values=x.values;}get(k){return this.values[k]??null;}getAll(k){const x=this.values[k];return Array.isArray(x)?x:[];}},uid:()=>`new-${++ctx.next}`,next:0,generaCodiceImmobile:()=> 'IMM-TEST',closeModal:()=>{h.closed++;ctx.state.modal=null;},render:()=>h.renders++,readAndCompressImage:async()=>'',saveData:async(options)=>{h.saves++;h.options=options;if(h.pending)await h.pending;ctx.state.error=h.saveError;return h.result;},saveSettingsData:async options=>ctx.saveData(options)};
 vm.createContext(ctx);vm.runInContext(core+'\n'+cliente,ctx);h.ctx=ctx;h.form=f;return h;
}
function bind(h,code){vm.runInContext(code,h.ctx);return ()=>h.form.handlers.submit({preventDefault(){}});}
(async()=>{
 // Failed creation leaves the property form and user-entered values intact, then retry creates exactly one row.
 const property=harness('propForm',{nome:'Valore digitato'});const original=clean(property.ctx.state.properties),modal=property.ctx.state.modal;
 property.result=false;assert.equal(await property.ctx.saveProperty({nome:'Nuova'},null),false);assert.deepEqual(clean(property.ctx.state.properties),original);assert.equal(property.ctx.state.modal,modal);assert.equal(property.form.values.nome,'Valore digitato');assert.equal(property.closed,0);assert.equal(property.form.button.disabled,false);assert(property.form.error.textContent.includes('Salvataggio non riuscito'));assert.equal(property.options.renderOnError,false);
 property.result=true;assert.equal(await property.ctx.saveProperty({nome:'Nuova'},null),true);assert.equal(property.ctx.state.properties.length,2);assert.equal(property.closed,1);
 // Failed edits roll back both the property and its modal editing reference.
 const edit=harness('propForm',{});edit.ctx.state.modal.editing=edit.ctx.state.properties[0];edit.result=false;await edit.ctx.saveProperty({nome:'Modificata'},'p');assert.equal(edit.ctx.state.properties[0].nome,'Prima');assert.equal(edit.ctx.state.modal.editing.nome,'Prima');
 // The submit handler rolls back the new owner too, so retries do not create duplicate clients.
 const withOwner=harness('propForm',{nome:'Nuova',tipo:'B&B',clienteNome:'Nuovo proprietario',clienteEmail:'new@example.test',clienteTelefono:'1'});withOwner.result=false;const submitProperty=bind(withOwner,"const propForm=document.getElementById('propForm');\n"+propBinding);await submitProperty();assert.equal(withOwner.ctx.state.properties.length,1);assert.equal(withOwner.ctx.state.clienti.length,1);assert(withOwner.ctx.state.modal);withOwner.result=true;await submitProperty();assert.equal(withOwner.ctx.state.properties.length,2);assert.equal(withOwner.ctx.state.clienti.length,2);
 // Client saves retain entered data on failure and block a second submission while pending.
 const client=harness('clienteForm',{nome:'Cliente nuovo',telefono:'1',email:'new@example.test'});const submitClient=bind(client,clienteBinding);client.result=false;await submitClient();assert.equal(client.ctx.state.clienti.length,1);assert.equal(client.closed,0);assert.equal(client.form.values.nome,'Cliente nuovo');assert.equal(client.form.button.disabled,false);
 let release;client.result=true;client.pending=new Promise(r=>release=r);const saving=submitClient();await submitClient();assert.equal(client.ctx.state.clienti.length,2);assert.equal(client.form.button.disabled,true);release();await saving;assert.equal(client.closed,1);assert.equal(client.ctx.state.clienti.length,2);
 // Settings survive a failed write; unrelated configuration fields are preserved on success.
 const settings=harness('settingsForm',{nomeAgenzia:'Nuovo nome',telefonoGestore:'123',impegnoServizio:'Servizio'});const submitSettings=bind(settings,settingsBinding);settings.result=false;await submitSettings();assert.equal(settings.ctx.state.settings.nomeAgenzia,'Prima');assert.equal(settings.closed,0);assert.equal(settings.form.values.nomeAgenzia,'Nuovo nome');settings.result=true;await submitSettings();assert.equal(settings.ctx.state.settings.nomeAgenzia,'Nuovo nome');assert.equal(settings.ctx.state.settings.extra,'preservare');assert.equal(settings.closed,1);
 // A response from an old form may not close a newer dialog opened meanwhile.
 const late=harness('settingsForm',{nomeAgenzia:'Nuovo'});let done;late.pending=new Promise(r=>done=r);const submitLate=bind(late,settingsBinding),oldSave=submitLate(),newModal={editing:{id:'other'}};late.ctx.state.modal=newModal;done();await oldSave;assert.equal(late.closed,0);assert.equal(late.ctx.state.modal,newModal);
 // Core persistence returns an explicit result and only re-renders failures when requested.
 const persistence=source.slice(source.indexOf('async function persistAll('),source.indexOf('function subscribeRealtime('));let renderCount=0,error=null;const pctx={SUPABASE_CONFIGURED:true,state:{properties:[],clienti:[],settings:{},operatori:[]},supabase:{from:()=>({update:()=>({eq:async()=>({error})})})},render:()=>renderCount++};vm.createContext(pctx);vm.runInContext(persistence,pctx);assert.equal(await pctx.saveData(),true);error={message:'Offline'};assert.equal(await pctx.saveData({renderOnError:false}),false);assert.equal(renderCount,0);assert.equal(await pctx.saveData(),false);assert.equal(renderCount,1);
 console.log('PASS: property/client/settings persistence, rollback, retry, duplicate-submit blocking, stale-dialog isolation and explicit save outcomes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
