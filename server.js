/*
 * MONITOR TÁCTICA — Módulo Gestión Financiera (backend)
 * Sirve el front-end y expone /api/chat: el chatbot.
 *
 * SEGURIDAD: la llave de DeepSeek se lee de la variable de entorno DEEPSEEK_API_KEY.
 * NUNCA se escribe en el código ni se envía al navegador. Los datos financieros
 * (data.json) viven aquí, en el servidor; a DeepSeek solo viaja la PREGUNTA del
 * usuario, el catálogo de funciones y el RESULTADO ya calculado localmente.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const ENT = ['TACTICA', 'C&A'], SOCIOS = ['RCM','REP','CTC','RCM-REP','SIN RM'], SOCIOS_REALES = ['RCM','REP','CTC'];
const UF = DATA.indicadores?.UF || 39128;

const g = (d,e)=>d[e]||{};
const clients = ()=>{const s=new Set();ENT.forEach(e=>Object.keys(g(DATA.income,e)).forEach(c=>s.add(c)));return[...s];};
const incM = (c,m)=>ENT.reduce((a,e)=>a+((g(DATA.income,e)[c]||{})[m]||0),0);
const costM = (c,m)=>ENT.reduce((a,e)=>a+((g(DATA.cost,e)[c]||{})[m]||0),0);
const officeM = m=>ENT.reduce((a,e)=>a+(g(DATA.office,e)[m]||0),0);
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
    const fee=ing*0.20, rep=mg-mg*f-fee; return{rm,total:fee+rep};});
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
  const exp=-(l3.reduce((a,m)=>a+officeM(m),0))/3;
  const factor=totM>0?exp/totM:0;
  return SOCIOS.map(rm=>{
    const grp=rows.filter(r=>r.rm===rm), ing=grp.reduce((a,r)=>a+r.ing,0), margen=grp.reduce((a,r)=>a+r.margen,0);
    const fee=ing*.20, contrib=margen*factor, repartir=margen-contrib-fee;
    return {rm,total:fee+repartir};
  });
}
function allocatedSocioValue(rows, rm){
  let total=0;
  rows.forEach(row=>splitOwners(row.rm).forEach(o=>{if(o.rm===rm) total += row.total*o.w;}));
  return total;
}
function contributionForMonth(m, rm){
  const raw = DATA.months.includes(m) ? contribution([m]) : projectedContributionBySocio();
  return allocatedSocioValue(raw, rm);
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
    const total=contributionForMonth(m,rm);
    const anticipo=retiroSocioPeriod(rm,[m]), saldo=total-anticipo;
    return {socio:rm, fecha:m, devengado:Math.round(total), anticipo:Math.round(anticipo), saldo:Math.round(saldo), c_and_a_run_rate_futuro:Math.round(rm==='RCM'?cAndARunRate():0)};
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
  {type:'function',function:{name:'retiro_mes_socio',description:'Monto que le tocó o podría retirar un socio en un mes YYYY-MM. Solo RCM puede tener anticipo mensual por C&A Acciona/Hidro Maule.',parameters:{type:'object',properties:{socio:{type:'string'},fecha:{type:'string',description:'YYYY-MM'}},required:['socio','fecha']}}},
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
      return `${result.socio} en ${result.fecha}: le toca o podría retirar ${CLP(result.devengado)}. Anticipo/retiro imputado: ${CLP(result.anticipo)}${result.socio==='RCM' ? ' (C&A Acciona + Hidro Maule)' : ''}. Saldo del mes: ${CLP(result.saldo)}.`;
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

async function deepseek(messages, tools){
  const key = process.env.DEEPSEEK_API_KEY;
  if(!key) throw new Error('DEEPSEEK_API_KEY no configurada');
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body: JSON.stringify({ model:'deepseek-v4-pro', messages, tools, temperature:0.2 })
  });
  if(!r.ok) throw new Error('DeepSeek '+r.status);
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
    let msg = await deepseek(messages, TOOLS);
    if(msg.tool_calls && msg.tool_calls.length){
      messages.push(msg);
      for(const tc of msg.tool_calls){
        const fn = FUNCS[tc.function.name];
        let args={}; try{args=JSON.parse(tc.function.arguments||'{}');}catch(e){}
        const result = fn ? fn(args) : {error:'función desconocida'};
        messages.push({role:'tool', tool_call_id:tc.id, content: JSON.stringify(result)});
      }
      msg = await deepseek(messages, TOOLS);
    }
    res.json({answer: msg.content || 'Sin respuesta.'});
  }catch(e){ res.status(500).json({answer:'Error: '+e.message}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Módulo Gestión Financiera escuchando en :'+PORT));
