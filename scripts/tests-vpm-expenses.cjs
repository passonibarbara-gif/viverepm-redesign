/* Run: node scripts/tests-vpm-expenses.cjs */
'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../vpm-expenses.js'),'utf8');
function harness(){
  const h={handlers:{},closed:0,alerts:[],permissions:new Set(['spese','interventi']),fail:false};
  const now=new Date();const due=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-28`;
  h.p={id:'p',nome:'Casa',clienteId:'c',spese:[{id:'s',categoria:'IMU <x>',importo:150,data:due,scadenza:due,stato:'approvata',iban:'IT123',paymentUrl:'javascript:alert(1)'}],manutenzioni:[{id:'m',stato:'completata',descrizione:'Rubinetto',fattura:{importo:100,scadenza:due,iban:'IT456',statoPagamento:'approvata'}}],notifiche:[]};
  const baseCalendar=`<div data-booking-cal-day="${due}">28</div>`;
  h.ctx={URL,location:{href:'https://example.test/'},document:{addEventListener(t,f){h.handlers[t]=f;}},FormData:class{constructor(form){this.values=form.values;}get(k){return this.values[k]??'';}},state:{properties:[h.p],view:'gestore',gestoreUnlocked:true,selectedId:'p',dossierTab:'spese',modal:{type:'expense',propId:'p'}},renderModalRaw:()=>'<old>',renderSpesaCard:()=>'',renderInterventoCard:()=>'<old-card>',raccogliEventiPortfolio:()=>[],renderCalendar:()=>baseCalendar,immobileConsentito:()=>true,haModulo:m=>h.permissions.has(m),getCliente:()=>({email:'owner@example.test'}),vpmOwnerProperty:()=>h.ctx.state.ownerAuth?.email==='owner@example.test'?h.p:null,fmtCurrency:x=>`€${x}`,fmtDate:x=>x,immobiliVisibili:()=>[h.p],uid:()=> 'new',logStoricoSpesa(e,t){e.storico.push({testo:t});},addNotifica(p,t){p.notifiche.push({testo:t});},saveData:async()=>{h.ctx.state.error=h.fail?'Save failed':null;return !h.fail;},closeModal:()=>{h.closed++;h.ctx.state.modal=null;},render(){},alert:m=>h.alerts.push(m),confirm:()=>true};
  vm.createContext(h.ctx);vm.runInContext(source,h.ctx);h.baseCalendar=baseCalendar;
  h.submit=async(values)=>{const submit={disabled:false};const form={dataset:{vpmFinanceForm:'expense',kind:'spesa',record:'',property:'p'},values,querySelector:q=>q==='[type=submit]'?submit:{files:[]}};await h.handlers.submit({target:{closest:()=>form},preventDefault(){},stopImmediatePropagation(){}});};
  return h;
}
(async()=>{
  const h=harness(),{ctx,p}=h;
  assert(ctx.renderModalRaw().includes('label for="vpm-finance-importo"'));
  let html=ctx.renderSpesaCard(p.spese[0],'proprietario');assert(html.includes('IMU &lt;x&gt;'));assert(!html.includes('javascript:'));assert(html.includes('Conferma bonifico effettuato'));
  p.spese[0].stato='da-verificare';assert(!ctx.renderSpesaCard(p.spese[0],'proprietario').includes('Conferma bonifico effettuato'));assert(ctx.renderSpesaCard(p.spese[0],'gestore').includes('Verifica e conferma pagamento'));
  assert.equal(ctx.raccogliEventiPortfolio().length,2);
  h.permissions.delete('spese');assert(ctx.renderInterventoCard(p.manutenzioni[0],p,'gestore').includes('Carica fattura'));assert.equal(ctx.renderSpesaCard(p.spese[0],'gestore'),'');assert(!ctx.renderCalendar([],0).includes('IMU'));
  h.permissions.add('spese');ctx.state.dossierTab='camere';assert.equal(ctx.renderCalendar([],0),h.baseCalendar);ctx.state.dossierTab='spese';assert(ctx.renderCalendar([],0).includes('Scadenze di pagamento del mese'));
  p.spese[0].scadenza='2020-01-01';assert(ctx.renderSpesaCard(p.spese[0],'proprietario').includes('Scaduta'));p.spese[0].stato='unknown';assert(ctx.renderSpesaCard(p.spese[0],'proprietario').includes('Stato da verificare'));assert(!ctx.renderSpesaCard(p.spese[0],'proprietario').includes('Conferma bonifico effettuato'));
  // Regression: a guest calendar must never reveal a previously selected manager property.
  ctx.state.view='ospiti';assert.equal(ctx.renderModalRaw(),'');assert.equal(ctx.renderCalendar([],0),h.baseCalendar);assert.equal(ctx.renderSpesaCard(p.spese[0],'gestore'),'');assert.equal(ctx.renderInterventoCard(p.manutenzioni[0],p,'gestore'),'');
  ctx.state.view='proprietari';ctx.state.ownerAuth={email:'stranger@example.test'};ctx.state.ownerPropId='p';assert.equal(ctx.renderCalendar([],0),h.baseCalendar);
  ctx.state.ownerAuth={email:'owner@example.test'};assert(ctx.renderCalendar([],0).includes('Scadenze di pagamento del mese'));
  ctx.state.view='gestore';ctx.state.gestoreUnlocked=false;assert.equal(ctx.renderCalendar([],0),h.baseCalendar);ctx.state.gestoreUnlocked=true;
  const values={categoria:'IMU',descrizione:'Tributo',data:'2026-11-02',scadenza:'2026-12-01',importo:'150',beneficiario:'Comune',iban:'IT123'};
  const count=p.spese.length;h.fail=true;await h.submit(values);assert.equal(h.closed,0);assert(ctx.state.modal);assert.equal(p.spese.length,count);assert.equal(p.notifiche.length,0);
  h.fail=false;await h.submit(values);assert.equal(h.closed,1);assert.equal(p.spese.length,count+1);
  p.spese[0].paymentUrl='';p.spese[0].stato='approvata';
  assert(ctx.renderSpesaCard(p.spese[0],'proprietario').includes('Paga · collegamento da attivare'));
  console.log('Expense regressions passed: role isolation, guest privacy, calendar separation, status labels, safe links, accessible fields and save rollback.');
})().catch(error=>{console.error(error);process.exitCode=1;});

