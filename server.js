/*
 * MONITOR TÁCTICA — Módulo Gestión Financiera (backend)
 * Sirve el front-end y expone /api/chat: el chatbot.
 *
 * SEGURIDAD: la llave y endpoint de IA se leen desde variables de entorno.
 * NUNCA se escriben en el código ni se envían al navegador. Los datos financieros
 * (data.json) viven aquí, en el servidor; a la IA solo viaja la PREGUNTA del
 * usuario, el catálogo de funciones y el RESULTADO ya calculado localmente.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const ENT = ['TACTICA', 'C&A'], SOCIOS = ['RCM','REP','CTC','RCM-REP','SIN RM'], SOCIOS_REALES = ['RCM','REP','CTC'];
const UF = 40661.48;

const g = (d,e)=>d[e]||{};
const clients = ()=>{const s=new Set();ENT.forEach(e=>Object.keys(g(DATA.income,e)).forEach(c=>s.add(c)));return[...s];};
const incM = (c,m)=>ENT.reduce((a,e)=>a+((g(DATA.income,e)[c]||{})[m]||0),0);
const costM = (c,m)=>ENT.reduce((a,e)=>a+((g(DATA.cost,e)[c]||{})[m]||0),0);
const officeM = m=>ENT.reduce((a,e)=>a+(g(DATA.office,e)[m]||0),0);
const costAllM = m=>ENT.reduce((a,e)=>a+(g(DATA.costAll,e)[m]||0),0);
const lastN = n=>DATA.months.slice(-n);
const sumInc = (c,ms)=>ms.reduce((a,m)=>a+incM(c,m),0);
const CLP = n=>'$'+Math.round(n).toLocaleString('es-CL');
const findClient = q=>{const t=(q||'').toUpperCase();return clients().find(c=>t.includes(c.toUpperCase().split(' ')[0])&&c.split(' ')[0].length>2)||clients().find(c=>t.includes(c.toUpperCase()));};
const cAndAAdvanceM = m=>incM('ACCIONA (C&A)',m)+incM('HIDROMAULE (C&A)',m);
const cAndAAdvance = ms=>ms.reduce((a,m)=>a+cAndAAdvanceM(m),0);
const cAndARunRate = ()=>375*UF;
const retiroSocioPeriod = (rm,ms)=>rm==='RCM' ? ms.reduce((a,m)=>a+(DATA.months.includes(m)?cAndAAdvanceM(m):cAndARunRate()),0) : 0;

function contribution(ms){
  const cls=clients().map(c=>{const ing=sumInc(c,ms),co=ms.reduce((a,m)=>a+costM(c,m),0);return{rm:DATA.rm[c]||'SIN RM',ing,margen:ing+co};});
  const totM=cls.reduce((a,r)=>a+r.margen,0),offAbs=-ms.reduce((a,m)=>a+officeM(m),0),f=totM>0?offAbs/totM:0;
  return SOCIOS.map(rm=>{const grp=cls.filter(r=>r.rm===rm);const ing=grp.reduce((a,r)=>a+r.ing,0);const mg=grp.reduce((a,r)=>a+r.margen,0);
    const fee=ing*0.20, contrib=mg*f, rep=mg-contrib-fee; return{rm,ing,contrib,fee,repartir:rep,total:fee+rep};});
}
function futureMonths(){
  const last=DATA.months[DATA.months.length-1].split('-').map(Number);
  const out=[];let y=last[0],mo=last[1];
  while(!(y===2026&&mo>=12)){mo++;if(mo>12){mo=1;y++;}out.push(`${y}-${String(mo).padStart(2,'0')}`);if(y>2026)break;}
  return out;
}
function splitOwners(rm){
  if(rm==='RCM-REP') return [{rm:'RCM',w:.5},{rm:'REP',w:.5}];
  if(SOCIOS_REALES.includes(rm)) return [{rm,w:1}];
  return [];
}
function projectedContributionBySocio(){
  const l3=lastN(3);
  const projClient=c=>sumInc(c,l3)/3;
  const rows=clients().map(c=>({rm:DATA.rm[c]||'SIN RM',ing:projClient(c),margen:projClient(c)}));
  const totM=rows.reduce((a,r)=>a+r.margen,0);
  const exp=-(l3.reduce((a,m)=>a+officeM(m)+costAllM(m),0))/3;
  const factor=totM>0?exp/totM:0;
  return SOCIOS.map(rm=>{
    const grp=rows.filter(r=>r.rm===rm), ing=grp.reduce((a,r)=>a+r.ing,0), margen=grp.reduce((a,r)=>a+r.margen,0);
    const fee=ing*.20, contrib=margen*factor, repartir=margen-contrib-fee;
    return {rm,ing,contrib,fee,repartir,total:fee+repartir};
  });
}
function blankSocio(rm){return{rm,ing:0,contrib:0,fee:0,repartir:0,total:0};}
function addAllocated(acc,row,w){
  ['ing','contrib','fee','repartir','total'].forEach(k=>acc[k]+=(row[k]||0)*w);
}
function allocatedSocioRows(ms){
  const acc=Object.fromEntries(SOCIOS_REALES.map(rm=>[rm,blankSocio(rm)]));
  contribution(ms).forEach(row=>splitOwners(row.rm).forEach(o=>addAllocated(acc[o.rm],row,o.w)));
  return SOCIOS_REALES.map(rm=>acc[rm]);
}
function allocatedProjectionRows(){
  const acc=Object.fromEntries(SOCIOS_REALES.map(rm=>[rm,blankSocio(rm)]));
  projectedContributionBySocio().forEach(row=>splitOwners(row.rm).forEach(o=>addAllocated(acc[o.rm],row,o.w)));
  return SOCIOS_REALES.map(rm=>acc[rm]);
}
function contributionForMonth(m, rm){
  const rows = DATA.months.includes(m) ? allocatedSocioRows([m]) : allocatedProjectionRows();
  return (rows.find(r=>r.rm===rm)||blankSocio(rm)).total;
}

const RETIROS_REALES=[
  {socio:'RCM',fecha:'2023-12-31',monto:22800000,detalle:'RC diciembre'},
  {socio:'RCM',fecha:'2024-06-07',monto:19747590,detalle:'Nómina retiros socios'},
  {socio:'RCM',fecha:'2024-08-29',monto:28500020,detalle:'Nómina socios'},
  {socio:'RCM',fecha:'2025-02-17',monto:32244735,detalle:'Comisiones febrero 2025'},
  {socio:'RCM',fecha:'2025-12-04',monto:15000000,detalle:'Comisiones diciembre 2025'},
  {socio:'RCM',fecha:'2026-03-18',monto:49956136,detalle:'Comisión marzo Rodrigo Castillo'},
  {socio:'CTC',fecha:'2024-01-02',monto:4140000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-02-01',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-03-05',monto:3570000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-04-04',monto:3570000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-06-07',monto:10000000,detalle:'Nómina retiros socios'},
  {socio:'CTC',fecha:'2024-06-19',monto:10017813,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-06-24',monto:3200000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-07-15',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-08-06',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-08-29',monto:14000000,detalle:'Nómina socios'},
  {socio:'CTC',fecha:'2024-10-03',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-11-06',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2024-12-05',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-01-02',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-01-21',monto:5000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-01-22',monto:5000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-02-03',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-02-17',monto:7000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-02-18',monto:2000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-03-04',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-05-02',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-06-02',monto:3000000,detalle:'Retiro socio'},
  {socio:'CTC',fecha:'2025-08-11',monto:15000000,detalle:'Adelanto'},
  {socio:'CTC',fecha:'2025-12-04',monto:15000000,detalle:'Comisiones diciembre 2025'},
  {socio:'CTC',fecha:'2026-03-18',monto:3500000,detalle:'Adelanto comisión Christian Torres'},
  {socio:'CTC',fecha:'2026-03-18',monto:24480334,detalle:'Comisión marzo Christian Torres'},
  {socio:'REP',fecha:'2024-06-07',monto:18911247,detalle:'Nómina retiros socios'},
  {socio:'REP',fecha:'2024-08-29',monto:17645988,detalle:'Nómina socios'},
  {socio:'REP',fecha:'2025-02-17',monto:21807630,detalle:'Comisiones febrero 2025'},
  {socio:'REP',fecha:'2025-07-23',monto:5000000,detalle:'Adelanto comisiones'},
  {socio:'REP',fecha:'2025-07-24',monto:5000000,detalle:'Adelanto comisiones'},
  {socio:'REP',fecha:'2025-12-04',monto:15000000,detalle:'Comisiones diciembre 2025'},
  {socio:'REP',fecha:'2026-03-18',monto:36444493,detalle:'Comisión marzo Ricardo Eberle'}
];
const monthOfDate=fecha=>fecha.slice(0,7);
function fmtDate(fecha){const [y,m,d]=fecha.split('-');return `${d}-${m}-${y}`;}
function retiroEventsFor(rm){return RETIROS_REALES.filter(r=>r.socio===rm).sort((a,b)=>a.fecha.localeCompare(b.fecha));}
function anticipoMensual(rm,m){return rm==='RCM' ? (DATA.months.includes(m)?cAndAAdvanceM(m):cAndARunRate()) : 0;}
function monthlyBalanceRows(rm, baseRows){
  let acc={ing:0,contrib:0,fee:0,repartir:0,total:0,anticipos:0,saldo:0};
  let last=null;
  const events=retiroEventsFor(rm);
  return baseRows.map(r=>{
    const ev=events.filter(e=>monthOfDate(e.fecha)===r.m);
    const retiro=ev.reduce((a,e)=>a+e.monto,0);
    if(ev.length){
      last=ev[ev.length-1];
      acc={ing:0,contrib:0,fee:0,repartir:0,total:0,anticipos:0,saldo:0};
    }else{
      const ant=anticipoMensual(rm,r.m);
      acc.ing += r.ing||0;
      acc.contrib += r.contrib||0;
      acc.fee += r.fee||0;
      acc.repartir += r.repartir||0;
      acc.total += r.total||0;
      acc.anticipos += ant;
      acc.saldo += (r.total||0)-ant;
    }
    return {...r,retiro,anticipo:ev.length?0:anticipoMensual(rm,r.m),acum:acc.saldo,acc:{...acc},lastRetiro:last};
  });
}
function balanceTimelineForSocio(rm){
  const realBase=DATA.months.map(m=>({m,...(allocatedSocioRows([m]).find(z=>z.rm===rm)||blankSocio(rm))}));
  const real=monthlyBalanceRows(rm,realBase);
  const last=real.length?real[real.length-1]:{acum:0,lastRetiro:null,acc:null};
  const proj=allocatedProjectionRows().find(x=>x.rm===rm)||blankSocio(rm);
  let acc=last.acc||{ing:0,contrib:0,fee:0,repartir:0,total:0,anticipos:0,saldo:last.acum||0};
  const fut=futureMonths().map(m=>{
    const ant=anticipoMensual(rm,m);
    acc={ing:acc.ing+proj.ing,contrib:acc.contrib+proj.contrib,fee:acc.fee+proj.fee,repartir:acc.repartir+proj.repartir,total:acc.total+proj.total,anticipos:acc.anticipos+ant,saldo:acc.saldo+proj.total-ant};
    return{m,proj:true,...proj,retiro:0,anticipo:ant,acum:acc.saldo,acc:{...acc},lastRetiro:last.lastRetiro};
  });
  return real.concat(fut);
}
function balanceAtSocioMonth(rm,m){
  const row=balanceTimelineForSocio(rm).find(r=>r.m===m);
  return row || null;
}

/* ---- FUNCIONES DETERMINISTAS (las ejecuta el servidor, no la IA) ---- */
const FUNCS = {
  ingresos_cliente: ({cliente, meses=12})=>{
    const c=findClient(cliente); if(!c) return {error:'cliente no encontrado'};
    return {cliente:c, meses, cobrado: sumInc(c, lastN(meses)), formato: CLP(sumInc(c, lastN(meses)))};
  },
  reparto_a_fecha: ({fecha})=>{ // fecha 'YYYY-MM'
    const ms = DATA.months.filter(m=>m<=fecha);
    const soc = contribution(ms).filter(s=>s.total!==0)
      .map(s=>{
        const anticipo = retiroSocioPeriod(s.rm, ms);
        const saldo = s.total - anticipo;
        return {socio:s.rm, devengado:Math.round(s.total), anticipo:Math.round(anticipo), saldo:Math.round(saldo), formato:CLP(saldo)};
      });
    return {fecha, socios: soc};
  },
  retiro_mes_socio: ({socio, fecha})=>{
    const rm=SOCIOS_REALES.find(s=>(socio||'').toUpperCase().includes(s)); if(!rm) return {error:'socio no encontrado'};
    const m = DATA.months.includes(fecha)||futureMonths().includes(fecha) ? fecha : DATA.months[DATA.months.length-1];
    const b=balanceAtSocioMonth(rm,m); if(!b) return {error:'mes no encontrado'};
    return {socio:rm, fecha:m, devengado_mes:Math.round(b.total), anticipo_mes:Math.round(b.anticipo), retiro_mes:Math.round(b.retiro), saldo_acumulado:Math.round(b.acum), acumulado:b.acc, ultimo_retiro:b.lastRetiro?{...b.lastRetiro,fecha_formato:fmtDate(b.lastRetiro.fecha)}:null};
  },
  saldo_socio: ({socio})=>{
    const rm=SOCIOS.find(s=>(socio||'').toUpperCase().includes(s)); if(!rm) return {error:'socio no encontrado'};
    const s=contribution(DATA.months).find(x=>x.rm===rm); const saldo=(s?s.total:0)-retiroSocioPeriod(rm,DATA.months);
    return {socio:rm, saldo:Math.round(saldo), formato:CLP(saldo)};
  }
};
const TOOLS = [
  {type:'function',function:{name:'ingresos_cliente',description:'Ingresos cobrados de un cliente en los últimos N meses',parameters:{type:'object',properties:{cliente:{type:'string'},meses:{type:'integer'}},required:['cliente']}}},
  {type:'function',function:{name:'reparto_a_fecha',description:'Monto devengado y saldo por socio acumulado hasta una fecha YYYY-MM. Solo descuenta anticipos C&A de RCM; no inventa retiros mensuales para otros socios.',parameters:{type:'object',properties:{fecha:{type:'string',description:'YYYY-MM'}},required:['fecha']}}},
  {type:'function',function:{name:'retiro_mes_socio',description:'Saldo acumulado que le tocó o podría retirar un socio al mes YYYY-MM, calculado desde el último retiro/corte registrado. Solo RCM puede tener anticipo mensual por C&A Acciona/Hidro Maule.',parameters:{type:'object',properties:{socio:{type:'string'},fecha:{type:'string',description:'YYYY-MM'}},required:['socio','fecha']}}},
  {type:'function',function:{name:'saldo_socio',description:'Saldo distribuible acumulado de un socio (RCM, REP, CTC), descontando solo anticipos C&A de RCM',parameters:{type:'object',properties:{socio:{type:'string'}},required:['socio']}}},
];

const MONTHS_ES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
};

function localStructuredAnswer(q){
  const text = (q || '').toLowerCase();
  const monthMatch = text.match(/(\d+)\s*mes/);
  const socio = SOCIOS.find(s => q.toUpperCase().includes(s));
  let fecha = DATA.months[DATA.months.length - 1];
  const monthName = Object.keys(MONTHS_ES).find(m => text.includes(m));
  const yearMatch = text.match(/20\d\d/);
  if (monthName && yearMatch) fecha = `${yearMatch[0]}-${MONTHS_ES[monthName]}`;
  if (/(ingres|factur|cobr|cu[aá]nto.*(entr|ingres))/.test(text)) {
    const cliente = findClient(q);
    if (cliente) {
      const meses = monthMatch ? Number(monthMatch[1]) : 12;
      const result = FUNCS.ingresos_cliente({ cliente, meses });
      return `${result.cliente} registra ${result.formato} cobrados en los últimos ${result.meses} meses.`;
    }
  }
  if (/repart|retir.*socio|cu[aá]nto.*retir/.test(text)) {
    if (socio && monthName && yearMatch) {
      const result = FUNCS.retiro_mes_socio({ socio, fecha });
      const acc = result.acumulado || {};
      const last = result.ultimo_retiro ? ` Último retiro/corte: ${CLP(result.ultimo_retiro.monto)} el ${result.ultimo_retiro.fecha_formato}.` : ' Sin retiro/corte registrado.';
      return `${result.socio} en ${result.fecha}: saldo acumulado desde último retiro/corte ${CLP(result.saldo_acumulado)}. Devengado del mes: ${CLP(result.devengado_mes)}. Anticipo del mes: ${CLP(result.anticipo_mes)}${result.socio==='RCM' ? ' (C&A Acciona + Hidro Maule)' : ''}. Acumulado devengado: ${CLP(acc.total||0)}; anticipos acumulados: ${CLP(acc.anticipos||0)}.${last}`;
    }
    const result = FUNCS.reparto_a_fecha({ fecha });
    return `Distribuible acumulado hasta ${fecha}: ${result.socios.map(s => `${s.socio}: devengado ${CLP(s.devengado)}, anticipo ${CLP(s.anticipo)}, saldo ${s.formato}`).join(' · ')}. Solo RCM descuenta C&A como anticipo; no se imputan retiros mensuales a REP/CTC.`;
  }
  if (/saldo/.test(text)) {
    if (socio) {
      const result = FUNCS.saldo_socio({ socio });
      return `Saldo no retirado de ${result.socio}: ${result.formato}.`;
    }
  }
  return null;
}

async function callAi(messages, tools){
  const key = process.env.AI_API_KEY;
  const url = process.env.AI_API_URL;
  const model = process.env.AI_MODEL;
  if(!key || !url || !model) throw new Error('IA financiera no configurada');
  const r = await fetch(url, {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body: JSON.stringify({ model, messages, tools, temperature:0.2 })
  });
  if(!r.ok) throw new Error('IA financiera no disponible');
  return (await r.json()).choices[0].message;
}

const app = express();
app.use(express.json());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/data.json', (req, res) => res.status(404).json({ error: 'not_found' }));
app.use(express.static(__dirname, {
  index: false,
  dotfiles: 'deny',
}));

app.post('/api/chat', async (req,res)=>{
  try{
    const q = (req.body.question||'').slice(0,500);
    const local = localStructuredAnswer(q);
    if (local) return res.json({ answer: local, source: 'motor-local' });

    const sys = 'Eres el asistente financiero de Táctica. Responde en español, breve y preciso. '+
      'Usa SIEMPRE las funciones para obtener cifras; nunca inventes números. Las cifras vienen ya calculadas.';
    let messages = [{role:'system',content:sys},{role:'user',content:q}];
    let msg = await callAi(messages, TOOLS);
    if(msg.tool_calls && msg.tool_calls.length){
      messages.push(msg);
      for(const tc of msg.tool_calls){
        const fn = FUNCS[tc.function.name];
        let args={}; try{args=JSON.parse(tc.function.arguments||'{}');}catch(e){}
        const result = fn ? fn(args) : {error:'función desconocida'};
        messages.push({role:'tool', tool_call_id:tc.id, content: JSON.stringify(result)});
      }
      msg = await callAi(messages, TOOLS);
    }
    res.json({answer: msg.content || 'Sin respuesta.'});
  }catch(e){ res.status(500).json({answer:e.message || 'IA financiera no disponible'}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Módulo Gestión Financiera escuchando en :'+PORT));
