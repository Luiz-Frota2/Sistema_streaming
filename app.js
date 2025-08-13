// ====== HELPERS ======
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const BRL = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });
const todayStr = () => new Date().toISOString().slice(0,10);
const ymStr = (d=new Date()) => d.toISOString().slice(0,7);
const addMonths = (d, m) => { const dt = new Date(d); dt.setMonth(dt.getMonth()+m); return dt; };
const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');
const endOfMonth = (d) => new Date(new Date(d).getFullYear(), new Date(d).getMonth()+1, 0);
const endOfMonthStr = (d) => endOfMonth(d).toISOString().slice(0,10);
const daysInMonth = (d) => endOfMonth(d).getDate();
const daysBetweenInclusive = (a,b) => Math.floor((new Date(b)-new Date(a))/(1000*60*60*24)) + 1;
const toast = (msg) => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2800); };

// ====== STORAGE & MIGRAÇÃO ======
const DB_KEY = 'streamrent@v4';
const load = () => JSON.parse(localStorage.getItem(DB_KEY) || '{}');
const save = (data) => localStorage.setItem(DB_KEY, JSON.stringify(data));
const ensure = () => {
  const s = load();
  if(!s.settings){ s.settings = { theme: 'dark', palette:'azul' }; }
  if(!s.servicos){
    s.servicos = [
      {id: crypto.randomUUID(), nome:'Netflix', custo: 55.90, preco: 20.00, slots:4, ativo:true},
      {id: crypto.randomUUID(), nome:'Prime Video', custo: 19.90, preco: 15.00, slots:3, ativo:true},
      {id: crypto.randomUUID(), nome:'Disney+', custo: 33.90, preco: 18.00, slots:4, ativo:false},
      {id: crypto.randomUUID(), nome:'Paramount+', custo: 19.90, preco: 12.00, slots:2, ativo:false}
    ];
  }
  if(!s.clientes){ s.clientes = []; }
  if(!s.despesas){ s.despesas = []; } // {id, competencia:'YYYY-MM', descricao, tipo:'fixa'|'variavel', valor}
  // Migração: clientes.servicos de [id] -> [{id, preco}]
  s.clientes.forEach(c=>{
    if(Array.isArray(c.servicos) && typeof c.servicos[0]==='string'){
      const map = Object.fromEntries(s.servicos.map(x=>[x.id, x.preco]));
      c.servicos = c.servicos.map(id=>({id, preco: map[id]||0}));
    }
  });
  save(s); return s;
};
let state = ensure();

// ====== THEME & PALETA ======
function applyPalette(name){
  const root = document.documentElement;
  const palettes = {
    azul:   {primary:'#6aa2ff', accent:'#8ef0c6'},
    verde:  {primary:'#22c55e', accent:'#86efac'},
    roxo:   {primary:'#8b5cf6', accent:'#c4b5fd'},
    laranja:{primary:'#fb923c', accent:'#fdba74'}
  };
  const p = palettes[name] || palettes.azul;
  root.style.setProperty('--primary', p.primary);
  root.style.setProperty('--accent', p.accent);
}
function applyTheme(){
  const theme = state.settings?.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  $('#themeToggle').classList.toggle('active', theme==='light');
  $('#themeToggle2').classList.toggle('active', theme==='light');
  applyPalette(state.settings.palette||'azul');
}
function toggleTheme(){ state.settings.theme = (state.settings.theme === 'light') ? 'dark' : 'light'; save(state); applyTheme(); }
$('#themeToggle').addEventListener('click', toggleTheme);
$('#themeToggle2').addEventListener('click', toggleTheme);
$('#themePalette').addEventListener('change', (e)=>{ state.settings.palette=e.target.value; save(state); applyTheme(); });

// ====== NAV ======
$$('.nav button').forEach(btn=>btn.addEventListener('click', e=>{
  $$('.nav button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const v = btn.getAttribute('data-view');
  $('#title').textContent = btn.textContent.trim();
  $$('main section').forEach(s=>s.style.display='none');
  $(`main [data-section="${v}"]`).style.display='block';
  renderAll();
}));

// ====== MODALS ======
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(el){ el.closest('.modal').classList.remove('open'); }
$$('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.getAttribute('data-open'))));
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b)));
$$('.modal').forEach(m=>m.addEventListener('click', (e)=>{ if(e.target===m) m.classList.remove('open'); }));

// ====== MÁSCARAS ======
function parseBRL(str){ if(!str) return 0; return Number(String(str).replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''))||0; }
function formatBRL(v){ return BRL.format(Number(v||0)); }
function attachCurrencyMask(el){
  el.addEventListener('focus', ()=>{ const v=parseBRL(el.value); el.value = v? v.toString().replace('.', ',') : ''; });
  el.addEventListener('blur', ()=>{ el.value = formatBRL(parseBRL(el.value)); });
}
function attachPhoneMask(el){
  el.addEventListener('input', ()=>{
    let v = el.value.replace(/\D/g,'').slice(0,11);
    if(v.length>10) el.value = v.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
    else if(v.length>6) el.value = v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
    else if(v.length>2) el.value = v.replace(/(\d{2})(\d{0,5})/,'($1) $2');
    else el.value = v.replace(/(\d{0,2})/,'($1)');
  });
}
$$('.currency').forEach(attachCurrencyMask);
$$('.phone').forEach(attachPhoneMask);

// ====== SERVIÇOS ======
function renderServicos(){
  const wrap = $('#wrapServicos');
  if(!state.servicos.length){
    wrap.innerHTML = `<div class="empty">Nenhum serviço cadastrado. Clique em "Novo Serviço".</div>`; return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Ativo</th><th>Serviço</th><th>Slots</th><th>Investimento (mês)</th><th>Aluguel (mês)</th><th>Ocupação</th><th>Ações</th>
      </tr></thead>
      <tbody>
        ${state.servicos.map(s=>{
          const occ = serviceOccupancy(s.id);
          return `
            <tr>
              <td><div class="toggle ${s.ativo?'active':''}" data-tgl-srv="${s.id}"><i></i></div></td>
              <td>${s.nome}</td>
              <td>${s.slots||0}</td>
              <td>${formatBRL(s.custo||0)}</td>
              <td>${formatBRL(s.preco||0)}</td>
              <td>${occ}/${s.slots||0}</td>
              <td>
                <button class="btn" data-edit-srv="${s.id}"><i class="fa-regular fa-pen-to-square"></i></button>
                <button class="btn danger" data-del-srv="${s.id}"><i class="fa-regular fa-trash-can"></i></button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  $$('[data-tgl-srv]').forEach(t=>t.addEventListener('click',()=>{
    const id=t.getAttribute('data-tgl-srv'); const srv=state.servicos.find(x=>x.id===id);
    srv.ativo=!srv.ativo; save(state); renderAll(); toast(`Serviço "${srv.nome}" ${srv.ativo?'ativado':'desativado'}.`);
  }));
  $$('[data-edit-srv]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-edit-srv'); const s=state.servicos.find(x=>x.id===id);
    $('#srvNome').value=s.nome; $('#srvCusto').value=formatBRL(s.custo); $('#srvPreco').value=formatBRL(s.preco);
    $('#srvSlots').value=s.slots||1; $('#srvAtivo').classList.toggle('active', s.ativo);
    $('#salvarServico').dataset.editing=id; openModal('servicoModal');
  }));
  $$('[data-del-srv]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-del-srv');
    if(confirm('Excluir este serviço?')){
      state.servicos = state.servicos.filter(x=>x.id!==id);
      state.clientes.forEach(c=> c.servicos = (c.servicos||[]).filter(o=>o.id!==id));
      save(state); renderAll(); toast('Serviço excluído.');
    }
  }));
}
$('#srvAtivo').addEventListener('click', ()=> $('#srvAtivo').classList.toggle('active'));
$('#salvarServico').addEventListener('click', ()=>{
  const nome=$('#srvNome').value.trim();
  const custo=parseBRL($('#srvCusto').value), preco=parseBRL($('#srvPreco').value);
  const slots=parseInt($('#srvSlots').value||'0',10); const ativo=$('#srvAtivo').classList.contains('active');
  if(!nome){ alert('Informe o nome do serviço.'); return; }
  if(!slots || slots<1){ alert('Informe slots (mínimo 1).'); return; }
  const editing=$('#salvarServico').dataset.editing;
  if(editing){ Object.assign(state.servicos.find(x=>x.id===editing), {nome,custo,preco,slots,ativo}); delete $('#salvarServico').dataset.editing; toast('Serviço atualizado.');}
  else { state.servicos.push({id:crypto.randomUUID(), nome,custo,preco,slots,ativo}); toast('Serviço cadastrado.');}
  save(state);
  $('#srvNome').value=''; $('#srvCusto').value=''; $('#srvPreco').value=''; $('#srvSlots').value=''; $('#srvAtivo').classList.add('active');
  closeModal($('#salvarServico')); renderAll();
});
function serviceOccupancy(serviceId){
  return state.clientes.reduce((acc,c)=> acc + ((c.servicos||[]).some(o=>o.id===serviceId)?1:0), 0);
}

// ====== CLIENTES ======
function servicosAtivos(){ return state.servicos.filter(s=>s.ativo); }

function fillCliServicesChecklist(assigned=[]){
  const wrap = $('#cliServicosWrap'); wrap.innerHTML='';
  const ativos = servicosAtivos();
  if(!ativos.length){ wrap.innerHTML='<div class="empty">Nenhum serviço ativo</div>'; return; }
  const assignedMap = new Map(assigned.map(o=>[o.id, o.preco]));
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Usar</th><th>Serviço</th><th>Preço base</th><th>Preço customizado</th><th>Slots disp.</th></tr></thead>
      <tbody>
        ${ativos.map(s=>{
          const precoCustom = assignedMap.has(s.id) ? assignedMap.get(s.id) : '';
          const occ = serviceOccupancy(s.id);
          const disp = (s.slots||0) - occ;
          return `<tr>
            <td><input type="checkbox" class="cli-sel" data-srv="${s.id}" ${assignedMap.has(s.id)?'checked':''} ${disp<=0 && !assignedMap.has(s.id)?'disabled':''}></td>
            <td>${s.nome}</td>
            <td>${formatBRL(s.preco||0)}</td>
            <td><input class="input currency cli-preco" data-srv="${s.id}" placeholder="R$ 0,00" value="${precoCustom!==''?formatBRL(precoCustom):''}"></td>
            <td>${occ}/${s.slots||0}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  $$('.cli-preco').forEach(attachCurrencyMask);
}

function fillDiaCobrancaSelect(){
  const sel = $('#cliDiaCob'); sel.innerHTML='';
  for(let i=1;i<=31;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); sel.appendChild(o);}
}

function nextBillingDate(startDate, billingDay){
  const d = new Date(startDate); const y=d.getFullYear(), m=d.getMonth(); const day=billingDay;
  const daysCur = new Date(y, m+1, 0).getDate();
  const targetThisMonth = new Date(y, m, Math.min(day, daysCur));
  if(d.getDate() <= Math.min(day, daysCur)) return targetThisMonth.toISOString().slice(0,10);
  const next = new Date(y, m+1, 1);
  const daysNext = new Date(next.getFullYear(), next.getMonth()+1, 0).getDate();
  const targetNext = new Date(next.getFullYear(), next.getMonth(), Math.min(day, daysNext));
  return targetNext.toISOString().slice(0,10);
}

function fillFiltrosServico(){
  const options = ['<option value="all">Todos</option>'].concat(state.servicos.map(s=>`<option value="${s.id}">${s.nome}</option>`)).join('');
  $('#filtroServico').innerHTML = options;
  $('#filtroServico2').innerHTML = options;
  $('#filtroServicoCob').innerHTML = options;
}

function getClientServicePrice(c, id){
  const item = (c.servicos||[]).find(o=>o.id===id);
  if(!item) return 0;
  if(item.preco!=null && item.preco!=='' && !Number.isNaN(item.preco)) return Number(item.preco);
  const srv = state.servicos.find(s=>s.id===id);
  return srv?.preco||0;
}
function precoCliente(cliente){
  return (cliente.servicos||[]).reduce((acc,o)=> acc + getClientServicePrice(cliente, o.id), 0);
}

function statusCliente(c){
  const baseDate = $('#dashMes').value ? new Date($('#dashMes').value+'-01') : new Date();
  const cicloAtual = ymStr(baseDate);
  const pagoEsteMes = (c.historico||[]).some(h=>h.ciclo===cicloAtual);
  if(pagoEsteMes) return 'ok';
  const due = new Date(c.proxima);
  if(due < new Date(baseDate.toDateString())) return 'overdue';
  return 'pending';
}

function badge(status){
  if(status==='ok') return '<span class="chip ok"><i class="fa-solid fa-check"></i> Em dia</span>';
  if(status==='overdue') return '<span class="chip overdue"><i class="fa-solid fa-triangle-exclamation"></i> Atrasado</span>';
  return '<span class="chip pending"><i class="fa-regular fa-clock"></i> Pendente</span>';
}

function renderResumoClientes(elId, filtros={}){
  const wrap = $(elId);
  if(!state.clientes.length){ wrap.innerHTML='<div class="empty">Nenhum cliente ainda.</div>'; return; }
  const busca = (filtros.busca||'').toLowerCase();
  const st = filtros.status||'all'; const srv = filtros.servico||'all';
  const filtered = state.clientes.filter(c=>{
    const s1 = !busca || (c.nome?.toLowerCase().includes(busca) || (c.contato||'').toLowerCase().includes(busca));
    const s2 = st==='all' || statusCliente(c)===st;
    const s3 = srv==='all' || (c.servicos||[]).some(o=>o.id===srv);
    return s1 && s2 && s3;
  });
  if(!filtered.length){ wrap.innerHTML='<div class="empty">Nenhum resultado para os filtros.</div>'; return; }
  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Cliente</th><th>Serviços</th><th>Mensalidade</th><th>Dia Cobrança</th><th>Próxima cobrança</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>
      ${filtered.map(c=>{
        const servs=(c.servicos||[]).map(o=> state.servicos.find(s=>s.id===o.id)?.nome).filter(Boolean).join(', ')||'-';
        const mensal = formatBRL(precoCliente(c));
        const status = statusCliente(c);
        return `<tr>
          <td>${c.nome}<div class="note">${c.contato||''}</div></td>
          <td>${servs}</td>
          <td>${mensal}</td>
          <td>${c.diaCob||new Date(c.inicio).getDate()}</td>
          <td>${fmtDate(c.proxima)}</td>
          <td>${badge(status)}</td>
          <td>
            <button class="btn" data-pay="${c.id}"><i class="fa-solid fa-money-bill"></i></button>
            <button class="btn" data-edit-cli="${c.id}"><i class="fa-regular fa-pen-to-square"></i></button>
            <button class="btn danger" data-del-cli="${c.id}"><i class="fa-regular fa-trash-can"></i></button>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
  `;
  bindClienteActions(wrap);
}

function bindClienteActions(ctx){
  $$('[data-del-cli]', ctx).forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-del-cli');
    if(confirm('Excluir cliente?')){
      state.clientes = state.clientes.filter(x=>x.id!==id);
      save(state); renderAll(); toast('Cliente excluído.');
    }
  }));
  $$('[data-edit-cli]', ctx).forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-edit-cli'); const c=state.clientes.find(x=>x.id===id);
    $('#cliNome').value=c.nome; $('#cliContato').value=c.contato||''; $('#cliInicio').value=c.inicio;
    $('#cliDiaCob').value = c.diaCob || new Date(c.inicio).getDate();
    fillCliServicesChecklist(c.servicos||[]);
    $('#salvarCliente').dataset.editing=id; openModal('clienteModal');
  }));
  $$('[data-pay]', ctx).forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-pay'); const c=state.clientes.find(x=>x.id===id);
    marcarPago(c);
  }));
}

$('#salvarCliente').addEventListener('click', ()=>{
  const nome=$('#cliNome').value.trim(); if(!nome) return alert('Informe o nome.');
  const contato=$('#cliContato').value.trim();
  const inicio=$('#cliInicio').value || todayStr();
  const diaCob=parseInt($('#cliDiaCob').value||'1',10);

  // construir serviços selecionados com preço custom
  const servicos=[];
  $$('.cli-sel').forEach(ch=>{
    if(ch.checked){
      const id=ch.dataset.srv;
      const priceEl=$(`.cli-preco[data-srv="${id}"]`);
      const preco = parseBRL(priceEl.value) || null;
      // valida slots (se novo ou se não estava antes)
      const editing=$('#salvarCliente').dataset.editing;
      let occupied = serviceOccupancy(id);
      if(editing){
        const c=state.clientes.find(x=>x.id===editing);
        if((c.servicos||[]).some(o=>o.id===id)) occupied--; // já contava esse cliente
      }
      const s=state.servicos.find(x=>x.id===id);
      if(occupied >= (s.slots||0)){ alert(`Sem vagas no serviço ${s.nome}.`); return; }
      servicos.push({id, preco});
    }
  });
  if(!servicos.length) return alert('Selecione ao menos um serviço.');

  // próxima cobrança + pró-rata
  const start = new Date(inicio); const startDay = start.getDate();
  let proxima; let prorata=false;
  if(startDay===diaCob){
    proxima = addMonths(inicio,1).toISOString().slice(0,10);
  }else{
    proxima = nextBillingDate(inicio, diaCob);
    prorata = true;
  }

  const editing = $('#salvarCliente').dataset.editing;
  if(editing){
    const c=state.clientes.find(x=>x.id===editing);
    Object.assign(c, {nome,contato,inicio,diaCob,servicos,proxima,prorata});
    delete $('#salvarCliente').dataset.editing;
    toast('Cliente atualizado.');
  } else {
    state.clientes.push({id:crypto.randomUUID(), nome, contato, inicio, diaCob, servicos, proxima, prorata, historico:[]});
    toast('Cliente cadastrado.');
  }
  save(state);
  $('#cliNome').value=''; $('#cliContato').value=''; $('#cliInicio').value='';
  fillCliServicesChecklist([]); closeModal($('#salvarCliente')); renderAll();
});

// Preenche modal cliente
function openClienteModalFresh(){
  fillDiaCobrancaSelect(); fillCliServicesChecklist([]); $('#cliInicio').value = todayStr();
}
$$('[data-open="clienteModal"]').forEach(b=>b.addEventListener('click', openClienteModalFresh));

// ====== DESPESAS ======
function addDespesa(){
  const competencia = $('#despMes').value || ymStr();
  const descricao = $('#despDesc').value.trim();
  const tipo=$('#despTipo').value||'fixa';
  const valor = parseBRL($('#despValor').value);
  if(!descricao || !valor){ alert('Informe descrição e valor.'); return; }
  state.despesas.push({id:crypto.randomUUID(), competencia, descricao, tipo, valor});
  save(state); renderDespesas(); renderDashboard(); toast('Despesa adicionada.');
  $('#despDesc').value=''; $('#despValor').value='';
}
function renderDespesas(){
  const wrap=$('#wrapDespesas');
  const mes = $('#filtroDespMes').value || ymStr();
  const items = state.despesas.filter(d=>d.competencia===mes);
  if(!items.length){ wrap.innerHTML='<div class="empty">Sem despesas nesta competência.</div>'; return; }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Descrição</th><th>Tipo</th><th>Competência</th><th>Valor</th><th>Ações</th></tr></thead>
      <tbody>
      ${items.map(d=>`<tr>
        <td>${d.descricao}</td>
        <td>${d.tipo}</td>
        <td>${d.competencia}</td>
        <td>${formatBRL(d.valor)}</td>
        <td><button class="btn danger" data-del-desp="${d.id}"><i class="fa-regular fa-trash-can"></i></button></td>
      </tr>`).join('')}
      </tbody>
    </table>`;
  $$('[data-del-desp]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-del-desp'); state.despesas=state.despesas.filter(x=>x.id!==id);
    save(state); renderDespesas(); renderDashboard(); toast('Despesa removida.');
  }));
}
$('#addDespesa').addEventListener('click', addDespesa);
$('#filtroDespMes').addEventListener('change', renderDespesas);

// ====== COBRANÇAS ======
function marcarPago(c){
  const inicio = new Date(c.inicio);
  const due = new Date(c.proxima);
  const mensal = precoCliente(c);

  let valor = mensal; let ciclo = ymStr(due); let isProrata = false;

  if(c.prorata){
    // cobrar do início até o dia da primeira cobrança real
    const firstBill = new Date(nextBillingDate(inicio, c.diaCob||inicio.getDate()));
    const diasTotais = daysInMonth(inicio);
    const diasUsados = daysBetweenInclusive(inicio, new Date(firstBill.getTime()-24*60*60*1000));
    const fator = Math.max(0, Math.min(1, diasUsados / diasTotais));
    valor = mensal * fator;
    ciclo = ymStr(inicio);
    isProrata = true;
  }

  // Snapshot por serviço (preço efetivo por cliente)
  const itens = (c.servicos||[]).map(o=>{
    const srv=state.servicos.find(x=>x.id===o.id);
    const val = getClientServicePrice(c, o.id);
    return { id:o.id, nome:srv?.nome||'Serviço', valor: val };
  });

  c.historico = c.historico||[];
  c.historico.push({ quando: new Date().toISOString(), valor, ciclo, itens, prorata: isProrata });

  if(c.prorata){
    c.proxima = nextBillingDate(inicio, c.diaCob||inicio.getDate());
    c.prorata = false;
  } else {
    c.proxima = addMonths(c.proxima, 1).toISOString().slice(0,10);
  }

  save(state); renderAll(); toast(`Pagamento registrado (${isProrata? 'pró-rata' : 'mês cheio'}).`);
}
function verificarPendencias(){ alert('Pendências verificadas. Clientes com cobrança vencida aparecerão como "Atrasado".'); renderCobrancas(); }
$('#gerarCobrancas').addEventListener('click', verificarPendencias);

function renderCobrancas(){
  const wrap = $('#wrapCobrancas'); if(!state.clientes.length){ wrap.innerHTML='<div class="empty">Nenhum cliente.</div>'; return; }
  const busca = ($('#buscaCobrancas').value||'').toLowerCase();
  const st = $('#filtroStatusCob').value||'all'; const srv = $('#filtroServicoCob').value||'all';
  const filtered = state.clientes.filter(c=>{
    const s1 = !busca || (c.nome?.toLowerCase().includes(busca) || (c.contato||'').toLowerCase().includes(busca));
    const s2 = st==='all' || statusCliente(c)===st;
    const s3 = srv==='all' || (c.servicos||[]).some(o=>o.id===srv);
    return s1 && s2 && s3;
  });
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>
        ${filtered.map(c=>{
          const status=statusCliente(c); const valor=formatBRL(precoCliente(c));
          const msg = encodeURIComponent(`Olá ${c.nome}! Sua cobrança de ${valor} vence em ${fmtDate(c.proxima)}. Posso enviar o PIX?`);
          return `<tr>
            <td>${c.nome}<div class="note">${c.contato||''}</div></td>
            <td>${valor}</td>
            <td>${fmtDate(c.proxima)}</td>
            <td>${badge(status)}</td>
            <td>
              <button class="btn success" data-pay="${c.id}"><i class="fa-solid fa-circle-check"></i> Marcar pago</button>
              <button class="btn" onclick="navigator.clipboard.writeText('Cobrança ${valor} – ${c.nome} venc. ${fmtDate(c.proxima)}'); toast('Lembrete copiado!')"><i class="fa-regular fa-copy"></i> Copiar</button>
              <a class="btn" target="_blank" href="https://api.whatsapp.com/send?phone=&text=${msg}"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  bindClienteActions(wrap);
}

// ====== DASHBOARD & MÉTRICAS ======
function custoServicosAtivos(){ return state.servicos.filter(s=>s.ativo).reduce((a,s)=>a+(s.custo||0),0); }
function despesasDoMes(ym){ return state.despesas.filter(d=>d.competencia===ym).reduce((a,d)=>a+(d.valor||0),0); }
function despesasFixas(ym){ return state.despesas.filter(d=>d.competencia===ym && d.tipo==='fixa').reduce((a,d)=>a+(d.valor||0),0); }
function despesasVariaveis(ym){ return state.despesas.filter(d=>d.competencia===ym && d.tipo==='variavel').reduce((a,d)=>a+(d.valor||0),0); }
function gastosMes(ym){ return custoServicosAtivos() + despesasDoMes(ym); }
function receitaMes(ym){ return state.clientes.reduce((acc,c)=>acc + (c.historico||[]).filter(h=>h.ciclo===ym).reduce((a,h)=>a+(h.valor||0),0), 0); }
function mrrRecorrente(ym){ return state.clientes.reduce((acc,c)=>acc + (c.historico||[]).filter(h=>h.ciclo===ym && !h.prorata).reduce((a,h)=>a+(h.valor||0),0), 0); }
function clientesPagantesSet(ym){ const set=new Set(); state.clientes.forEach(c=> (c.historico||[]).filter(h=>h.ciclo===ym).forEach(()=> set.add(c.id))); return set; }
function churnRate(ym){
  const prev = ymStr(addMonths(ym+'-01', -1));
  const prevSet = clientesPagantesSet(prev); if(prevSet.size===0) return 0;
  const curSet = clientesPagantesSet(ym); let cancel=0; prevSet.forEach(id=>{ if(!curSet.has(id)) cancel++; });
  return cancel/prevSet.size;
}
function seriesUltimosMeses(n=6, baseYM){
  const base = baseYM? new Date(baseYM+'-01') : new Date();
  const labels=[]; const receita=[]; const gastos=[]; const lucro=[];
  for(let i=n-1;i>=0;i--){
    const d = addMonths(base, -i); const ym = ymStr(d);
    labels.push(ym); const r = receitaMes(ym); const g = gastosMes(ym);
    receita.push(r); gastos.push(g); lucro.push(r-g);
  }
  return { labels, receita, gastos, lucro };
}

let lineChart, pieChart;
function renderCharts(){
  const ctxL = $('#chartLine');
  const ctxP = $('#chartPie');
  const ym = $('#dashMes').value || ymStr();
  const s = seriesUltimosMeses(6, ym);
  if(lineChart) lineChart.destroy();
  lineChart = new Chart(ctxL, {
    type:'line',
    data:{ labels:s.labels, datasets:[
      { label:'Receita', data:s.receita },
      { label:'Gastos', data:s.gastos },
      { label:'Lucro', data:s.lucro }
    ]},
    options:{ responsive:true, plugins:{ legend:{ display:true } } }
  });
  const mapa = new Map();
  state.clientes.forEach(c=> (c.historico||[]).filter(h=>h.ciclo===ym).forEach(h=> (h.itens||[]).forEach(it=> mapa.set(it.nome, (mapa.get(it.nome)||0)+ (it.valor||0)))));
  if(mapa.size===0){
    state.servicos.forEach(srv=> mapa.set(srv.nome, 0));
    state.clientes.forEach(c=> (c.servicos||[]).forEach(o=>{ const srv=state.servicos.find(x=>x.id===o.id); if(srv) mapa.set(srv.nome, (mapa.get(srv.nome)||0)+ getClientServicePrice(c, o.id)); }));
  }
  const labels=[...mapa.keys()], valores=[...mapa.values()];
  if(pieChart) pieChart.destroy();
  pieChart = new Chart(ctxP, { type:'doughnut', data:{ labels, datasets:[{ data: valores }] }, options:{ plugins:{ legend:{ position:'bottom' } } } });
}

function renderDashboard(){
  const ym = $('#dashMes').value || ymStr();
  const rec = receitaMes(ym), gas = gastosMes(ym), lucro = rec - gas, mrr = mrrRecorrente(ym);
  $('#receitaMes').textContent = formatBRL(rec);
  $('#gastosMes').textContent  = formatBRL(gas);
  $('#lucroMes').textContent   = formatBRL(lucro);
  $('#mrrMes').textContent     = formatBRL(mrr);
  renderResumoClientes('#wrapResumoClientes', {
    busca: $('#buscaClientes').value,
    status: $('#filtroStatus').value,
    servico: $('#filtroServico').value
  });
  renderCharts();
}

// ====== RELATÓRIOS ======
function ymRange(a,b){ const out=[]; let cur=new Date(a+'-01'); const end=new Date(b+'-01'); while(cur<=end){ out.push(ymStr(cur)); cur = addMonths(cur, 1);} return out; }
function buildRelatorio(a,b){
  const yms=ymRange(a,b);
  return yms.map(ym=>{
    const receita=receitaMes(ym);
    const fixosServ=custoServicosAtivos();
    const fixas=despesasFixas(ym);
    const variaveis=despesasVariaveis(ym);
    const gastos=fixosServ+fixas+variaveis;
    const lucro=receita-gastos;
    const mrr=mrrRecorrente(ym);
    const pagantes=clientesPagantesSet(ym).size;
    const arpu = pagantes? (mrr/pagantes) : 0;
    const churn=churnRate(ym);
    return { ym, receita, fixosServ, fixas, variaveis, gastos, lucro, mrr, arpu, churn };
  });
}
function renderRelatorio(){
  const de=$('#relDe').value||ymStr();
  const ate=$('#relAte').value||ymStr();
  const rows=buildRelatorio(de,ate);
  const wrap=$('#wrapRelatorio');
  if(!rows.length){ wrap.innerHTML='<div class="empty">Selecione um período válido.</div>'; return; }
  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>Mês</th><th>Receita</th><th>Fixos (Serviços)</th><th>Fixas (Despesas)</th><th>Variáveis</th><th>Gastos</th><th>Lucro</th><th>MRR</th><th>ARPU</th><th>Churn</th>
      </tr></thead>
      <tbody>
      ${rows.map(r=>`<tr>
        <td>${r.ym}</td><td>${formatBRL(r.receita)}</td><td>${formatBRL(r.fixosServ)}</td>
        <td>${formatBRL(r.fixas)}</td><td>${formatBRL(r.variaveis)}</td>
        <td>${formatBRL(r.gastos)}</td><td>${formatBRL(r.lucro)}</td>
        <td>${formatBRL(r.mrr)}</td><td>${formatBRL(r.arpu)}</td>
        <td>${(r.churn*100).toFixed(1)}%</td>
      </tr>`).join('')}
      </tbody>
    </table>`;
  const last = rows[rows.length-1];
  $('#relMRR').textContent = formatBRL(last.mrr);
  $('#relARR').textContent = formatBRL(last.mrr*12);
  $('#relARPU').textContent= formatBRL(last.arpu);
  $('#relChurn').textContent=(last.churn*100).toFixed(1)+'%';
  wrap.dataset.rows = JSON.stringify(rows);
}
function exportCSV(){
  const rows = JSON.parse($('#wrapRelatorio').dataset.rows||'[]'); if(!rows.length){ alert('Gere o relatório primeiro.'); return; }
  const header=['Mes','Receita','FixosServicos','Fixas','Variaveis','Gastos','Lucro','MRR','ARPU','Churn'];
  const csv=[header.join(',')].concat(rows.map(r=>[
    r.ym,r.receita,r.fixosServ,r.fixas,r.variaveis,r.gastos,r.lucro,r.mrr,r.arpu,(r.churn*100).toFixed(1)+'%'
  ].join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`relatorio_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
function exportXLS(){
  const rows = JSON.parse($('#wrapRelatorio').dataset.rows||'[]'); if(!rows.length){ alert('Gere o relatório primeiro.'); return; }
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table border="1"><tr><th>Mês</th><th>Receita</th><th>Fixos (Serviços)</th><th>Fixas</th><th>Variáveis</th><th>Gastos</th><th>Lucro</th><th>MRR</th><th>ARPU</th><th>Churn</th></tr>${
    rows.map(r=>`<tr><td>${r.ym}</td><td>${r.receita}</td><td>${r.fixosServ}</td><td>${r.fixas}</td><td>${r.variaveis}</td><td>${r.gastos}</td><td>${r.lucro}</td><td>${r.mrr}</td><td>${r.arpu}</td><td>${(r.churn*100).toFixed(1)}%</td></tr>`).join('')
  }</table></body></html>`;
  const blob=new Blob([html],{type:'application/vnd.ms-excel'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`relatorio_${Date.now()}.xls`; a.click(); URL.revokeObjectURL(a.href);
}
$('#gerarRel').addEventListener('click', renderRelatorio);
$('#expCSV').addEventListener('click', exportCSV);
$('#expXLS').addEventListener('click', exportXLS);

// ====== EXPORT / IMPORT BACKUP ======
$('#exportBtn').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='streamrent-backup.json'; a.click(); URL.revokeObjectURL(a.href);
});
$('#importBtn').addEventListener('click', ()=> $('#importFile').click());
$('#importFile').addEventListener('change', async e=>{
  const file=e.target.files[0]; if(!file) return; const text=await file.text();
  try{ const data=JSON.parse(text); state=data; save(state); applyTheme(); renderAll(); alert('Backup importado com sucesso!'); }
  catch(err){ alert('Arquivo inválido.'); }
  e.target.value='';
});

// ====== BIND FILTROS ======
['buscaClientes','filtroStatus','filtroServico','dashMes'].forEach(id=> $('#'+id).addEventListener('input', renderDashboard));
['buscaClientes2','filtroStatus2','filtroServico2'].forEach(id=> $('#'+id).addEventListener('input', renderClientes));
['buscaCobrancas','filtroStatusCob','filtroServicoCob'].forEach(id=> $('#'+id).addEventListener('input', renderCobrancas));

// ====== RENDER ROOTS ======
function renderClientes(){
  renderResumoClientes('#wrapClientes', {
    busca: $('#buscaClientes2').value,
    status: $('#filtroStatus2').value,
    servico: $('#filtroServico2').value
  });
}
function renderAll(){
  applyTheme();
  fillDiaCobrancaSelect();
  fillCliServicesChecklist([]);
  fillFiltrosServico();
  const ym=ymStr();
  $('#dashMes').value = $('#dashMes').value || ym;
  $('#relDe').value = $('#relDe').value || ym;
  $('#relAte').value = $('#relAte').value || ym;
  $('#despMes').value = ym; $('#filtroDespMes').value = ym;
  renderDashboard(); renderClientes(); renderServicos(); renderCobrancas(); renderDespesas();
}

// ====== PWA ======
if('serviceWorker' in navigator){
  const httpsOrLocal = location.protocol==='https:' || location.hostname==='localhost';
  if(httpsOrLocal){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
}

// init
applyTheme(); renderAll();
