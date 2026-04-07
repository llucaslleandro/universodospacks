// App.js - Lógica Avançada da Dashboard

const IS_LOGIN_PAGE = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/dashboard/') || window.location.pathname.endsWith('/dashboard');

function checkAuth() {
  const loggedIn = localStorage.getItem('vendly_dashboard_auth');
  if (IS_LOGIN_PAGE) {
    if (loggedIn) window.location.href = 'dashboard.html';
  } else {
    if (!loggedIn) window.location.href = 'index.html';
  }
}
checkAuth();

// ---- LÓGICA DE LOGIN (index.html) ----
if (IS_LOGIN_PAGE) {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = document.getElementById('username').value;
      const pass = document.getElementById('password').value;
      const errorMsg = document.getElementById('login-error');

      if (user === CONFIG.dashboard.user && pass === CONFIG.dashboard.pass) {
        localStorage.setItem('vendly_dashboard_auth', 'true');
        window.location.href = 'dashboard.html';
      } else {
        errorMsg.classList.remove('hidden');
      }
    });
  }
}

// ---- LÓGICA DA DASHBOARD (dashboard.html) ----
function initDashboard() {
  if (IS_LOGIN_PAGE) return;

  // Formatadores Genéricos
  const formatText = (val) => val && val.trim() !== '' ? val : 'N/A';
  const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const parseNumber = (val) => { let n = Number(String(val).replace(/[^0-9.-]+/g, "")); return isNaN(n) ? 0 : n; };
  const formatPercent = (val) => {
    const isPos = val >= 0;
    const color = isPos ? 'text-green-500' : 'text-red-500';
    const icon = isPos ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    const sign = isPos ? '+' : '';
    return `<span class="${color} flex items-center gap-1"><i class="fa-solid ${icon}"></i> ${sign}${val.toFixed(1).replace('.', ',')}%</span>`;
  };

  // Gráficos Mestre
  let revenueChart = null;
  let distributionChart = null;

  // Estado da Aplicação
  let allOrders = [];
  let allProducts = [];
  let filteredOrders = [];
  let previousOrders = [];

  // Tabela Filtros
  let tableSearchTerm = "";
  let tableBrandFilter = "all";
  let tableStatusFilter = "all";
  let tablePeriodFilter = "all";

  // Sistema de Abas
  const btnTabGeral = document.getElementById('tab-btn-geral');
  const btnTabEstrategia = document.getElementById('tab-btn-estrategia');
  const btnTabEstoque = document.getElementById('tab-btn-estoque');
  const tabGeral = document.getElementById('tab-geral');
  const tabEstrategia = document.getElementById('tab-estrategia');
  const tabEstoque = document.getElementById('tab-estoque');

  function setTab(activeBtn, activeTab) {
    [btnTabGeral, btnTabEstrategia, btnTabEstoque].forEach(btn => {
      if (btn) btn.className = 'pb-3 border-b-2 border-transparent font-medium text-gray-500 hover:text-gray-700 transition text-sm focus:outline-none flex items-center gap-2';
    });
    [tabGeral, tabEstrategia, tabEstoque].forEach(tab => {
      if (tab) tab.classList.add('hidden');
    });

    if (activeBtn) activeBtn.className = 'pb-3 border-b-2 border-gray-900 font-bold text-gray-900 transition text-sm focus:outline-none flex items-center gap-2';
    if (activeTab) activeTab.classList.remove('hidden');
  }

  if (btnTabGeral && btnTabEstrategia && btnTabEstoque) {
    btnTabGeral.addEventListener('click', () => setTab(btnTabGeral, tabGeral));
    btnTabEstrategia.addEventListener('click', () => setTab(btnTabEstrategia, tabEstrategia));
    btnTabEstoque.addEventListener('click', () => {
      setTab(btnTabEstoque, tabEstoque);
      renderEstoque();
    });
  }

  // Cache Inicialização
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.removeItem('vendly_dashboard_auth');
    window.location.href = 'index.html';
  });

  const periodFilter = document.getElementById('period-filter');
  const customWrap = document.getElementById('custom-date-wrap');
  const dateStart = document.getElementById('date-start');
  const dateEnd = document.getElementById('date-end');

  const searchInput = document.getElementById('table-search');
  const brandSelect = document.getElementById('table-brand');

  if (document.getElementById('btn-refresh')) document.getElementById('btn-refresh').addEventListener('click', () => loadDashboardData(false));
  if (document.getElementById('btn-retry')) document.getElementById('btn-retry').addEventListener('click', () => loadDashboardData(false));

  if (periodFilter) {
    periodFilter.addEventListener('change', () => {
      customWrap.classList.toggle('hidden', periodFilter.value !== 'custom');
      aplicarFiltroPeriodo();
    });
  }

  const tablePeriodSelect = document.getElementById('table-period');
  const tableCustomWrap = document.getElementById('table-custom-wrap');
  const tableDateStart = document.getElementById('table-date-start');

  [dateStart, dateEnd].forEach(el => el?.addEventListener('change', aplicarFiltroPeriodo));
  if (tableDateStart) tableDateStart.addEventListener('change', renderTable);

  searchInput?.addEventListener('input', (e) => { tableSearchTerm = e.target.value.toLowerCase(); renderTable(); });
  brandSelect?.addEventListener('change', (e) => { tableBrandFilter = e.target.value; renderTable(); });
  document.getElementById('table-status')?.addEventListener('change', (e) => { tableStatusFilter = e.target.value; renderTable(); });

  if (tablePeriodSelect) {
    tablePeriodSelect.addEventListener('change', (e) => {
      tablePeriodFilter = e.target.value;
      tableCustomWrap.classList.toggle('hidden', tablePeriodFilter !== 'custom');
      renderTable();
    });
  }

  // 1. Fetching Data
  async function fetchJSON(url) {
    // Quebra o Cache nativo do navegador para forçar o download dos dados em tempo real da planilha
    const urlComCacheBuster = url.includes('?') ? `${url}&_t=${new Date().getTime()}` : `${url}?_t=${new Date().getTime()}`;
    const res = await fetch(urlComCacheBuster, { cache: 'no-store' });
    if (!res.ok) throw new Error('Erro na rede.');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Erro da API.');
    return json.data || [];
  }

  async function fetchPedidosEProdutos() {
    return Promise.all([
      fetchJSON(`${CONFIG.apiBaseUrl}?action=pedidos`),
      fetchJSON(`${CONFIG.apiBaseUrl}?action=produtos`)
    ]);
  }

  // 2. Load Process Principal
  async function loadDashboardData(silent = false) {
    if (!silent) toggleLoading(true);
    try {
      const [rawPedidos, rawProdutos] = await fetchPedidosEProdutos();

      allProducts = rawProdutos;

      // Popula select de marcas
      const brands = new Set(rawProdutos.map(p => p.categoria || 'N/A').filter(b => b !== 'N/A'));
      if (brandSelect) {
        brandSelect.innerHTML = '<option value="all">Todas Marcas</option>';
        brands.forEach(b => brandSelect.innerHTML += `<option value="${b}">${b}</option>`);
      }

      allOrders = rawPedidos.map(order => ({
        ...order,
        parsedDate: order.data ? new Date(order.data) : new Date(0),
        quantidade: parseInt(order.quantidade) || 1,
        total: parseNumber(order.total),
        status: order.status || 'Pendente'
      })).sort((a, b) => b.parsedDate - a.parsedDate);

      aplicarFiltroPeriodo(); // Executa o pipeline de filtros e renders

      if (!silent) toggleLoading(false, true);
    } catch (error) {
      console.error(error);
      if (!silent) toggleLoading(false, false);
    }
  }

  function toggleLoading(isLoading, isSuccess = false) {
    document.getElementById('dashboard-loading').classList.toggle('hidden', !isLoading);
    document.getElementById('dashboard-content').classList.toggle('hidden', isLoading || !isSuccess || allOrders.length === 0);
    document.getElementById('dashboard-empty').classList.toggle('hidden', isLoading || !isSuccess || allOrders.length > 0);
    document.getElementById('dashboard-error').classList.toggle('hidden', isLoading || isSuccess);
  }

  // 3. Engine de Filtragem de Período e Dataset Secundário (Comparativo)
  function aplicarFiltroPeriodo() {
    if (allOrders.length === 0) return;

    const mode = periodFilter.value;
    let startDate = new Date();
    let endDate = new Date();
    let prevStartDate = new Date();
    let prevEndDate = new Date();

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (mode === 'today') {
      prevStartDate.setDate(startDate.getDate() - 1);
      prevEndDate.setDate(endDate.getDate() - 1);
    } else if (mode === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
      prevStartDate.setDate(startDate.getDate() - 1);
      prevEndDate.setDate(endDate.getDate() - 1);
    } else if (mode === '7') {
      startDate.setDate(startDate.getDate() - 7);
      prevStartDate.setDate(startDate.getDate() - 7);
      prevEndDate.setDate(endDate.getDate() - 7);
    } else if (mode === '14') {
      startDate.setDate(startDate.getDate() - 14);
      prevStartDate.setDate(startDate.getDate() - 14);
      prevEndDate.setDate(endDate.getDate() - 14);
    } else if (mode === '30') {
      startDate.setDate(startDate.getDate() - 30);
      prevStartDate.setDate(startDate.getDate() - 30);
      prevEndDate.setDate(endDate.getDate() - 30);
    } else if (mode === 'custom') {
      if (dateStart.value && dateEnd.value) {
        startDate = new Date(dateStart.value + 'T00:00:00');
        endDate = new Date(dateEnd.value + 'T23:59:59');
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - diffDays);
      } else {
        return; // não aplica se falta data custom
      }
    } else {
      startDate = new Date(0); // all
    }

    if (mode === 'all') {
      filteredOrders = [...allOrders];
      previousOrders = [];
    } else {
      filteredOrders = allOrders.filter(o => o.parsedDate >= startDate && o.parsedDate <= endDate);
      previousOrders = allOrders.filter(o => o.parsedDate >= prevStartDate && o.parsedDate <= prevEndDate);
    }

    renderDashboard();
  }

  // 4. Fluxo de Renderização Geral
  function renderDashboard() {
    calcularKPIsEInsights();
    renderCharts();
    renderRankings();
    renderTable();
    if (!tabEstoque.classList.contains('hidden')) renderEstoque();
  }

  // 5. Cálculos Complexos: KPIs e Insights (Variação %)
  function calcularKPIsEInsights() {
    const calcMetrics = (arr) => {
      let fatBase = 0, fatCancelado = 0, fatPendente = 0;
      const pdFechados = new Set(), pdCancelados = new Set(), pdPendentes = new Set(), pdUnicos = new Set();

      arr.forEach(o => {
        if (o.id_do_pedido) pdUnicos.add(o.id_do_pedido);

        if (o.status === 'Fechado') {
          fatBase += o.total;
          if (o.id_do_pedido) pdFechados.add(o.id_do_pedido);
        } else if (o.status === 'Cancelado') {
          fatCancelado += o.total;
          if (o.id_do_pedido) pdCancelados.add(o.id_do_pedido);
        } else {
          fatPendente += o.total;
          if (o.id_do_pedido) pdPendentes.add(o.id_do_pedido);
        }
      });
      return { fatBase, fatCancelado, fatPendente, totais: pdUnicos.size, fechados: pdFechados.size, cancelados: pdCancelados.size, pendentes: pdPendentes.size };
    };

    const curr = calcMetrics(filteredOrders);
    const prev = calcMetrics(previousOrders);

    const calcVar = (c, p) => (p === 0) ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;

    // Atualiza Stats DOM
    document.getElementById('kpi-faturamento').textContent = formatMoney(curr.fatBase);
    document.getElementById('kpi-pendentes').textContent = curr.pendentes;
    document.getElementById('kpi-pendentes-valor').textContent = formatMoney(curr.fatPendente);
    document.getElementById('kpi-perdida').textContent = formatMoney(curr.fatCancelado);

    const conversao = curr.totais > 0 ? (curr.fechados / curr.totais) * 100 : 0;
    document.getElementById('kpi-conversao').textContent = conversao.toFixed(1) + '%';

    const mode = periodFilter.value;
    const showVar = mode !== 'all';

    document.getElementById('kpi-faturamento-var').innerHTML = showVar ? formatPercent(calcVar(curr.fatBase, prev.fatBase)) + ' <span class="text-gray-400 text-[10px] font-normal ml-1">vs ant.</span>' : '';
    document.getElementById('kpi-cancelados-qtd').textContent = `${curr.cancelados} pedidos perdidos`;
    document.getElementById('kpi-conversao-detalhe').textContent = `${curr.fechados} de ${curr.totais} pedidos`;

    // Insights Secção Topo
    let topProd = '-', topModel = '-';
    let maxGrowth = formatPercent(calcVar(curr.fatBase, prev.fatBase));

    let prodCounts = {};
    if (filteredOrders.length > 0) {
      let modelCounts = {};
      const validOrders = filteredOrders.filter(o => o.status !== 'Cancelado');
      validOrders.forEach(o => {
        if (!o.produto || o.produto === 'Pedido Vazio') return;
        prodCounts[o.produto] = (prodCounts[o.produto] || 0) + o.quantidade;
        let pMod = o.group_id && o.group_id !== '' ? o.group_id : o.produto;
        modelCounts[pMod] = (modelCounts[pMod] || 0) + o.quantidade;
      });

      if (Object.keys(prodCounts).length > 0) topProd = Object.keys(prodCounts).sort((a, b) => prodCounts[b] - prodCounts[a])[0];
      if (Object.keys(modelCounts).length > 0) topModel = Object.keys(modelCounts).sort((a, b) => modelCounts[b] - modelCounts[a])[0];
    }

    document.getElementById('insight-top-produto').textContent = topProd.replace(/-/g, ' ');
    document.getElementById('insight-top-modelo').textContent = topModel.replace(/-/g, ' ');
    document.getElementById('insight-top-receita').textContent = formatMoney(curr.fatBase);
    document.getElementById('insight-crescimento').innerHTML = showVar ? maxGrowth : '<span class="text-green-400">Total</span>';

    // Chama Consultor IA Estratégico
    gerarAnaliseEstrategica(curr, prev, calcVar, prodCounts);
  }

  // 6. Consultor Estratégico (Regras de Negócios)
  function gerarAnaliseEstrategica(curr, prev, calcVar, prodCounts) {
    if (filteredOrders.length === 0) {
      const semDadosHtml = '<p class="text-sm font-medium text-gray-500">Sem dados suficientes para processar diagnóstico IA.</p>';
      document.getElementById('analise-prioridade').innerHTML = `<h5 class="text-sm font-bold text-gray-300">Aguardando Vendas...</h5>`;
      document.getElementById('analise-dinheiro').innerHTML = `<h5 class="text-3xl font-black text-white/50">R$ 0,00</h5>`;
      document.getElementById('analise-saude-funil').innerHTML = '';
      document.getElementById('analise-visao-geral').innerHTML = semDadosHtml;
      document.getElementById('analise-comportamento').innerHTML = semDadosHtml;
      document.getElementById('analise-desempenho').innerHTML = semDadosHtml;
      document.getElementById('analise-problemas').innerHTML = semDadosHtml;
      document.getElementById('analise-oportunidades').innerHTML = semDadosHtml;
      document.getElementById('analise-acoes').innerHTML = semDadosHtml;
      return;
    }

    const conversao = curr.totais > 0 ? (curr.fechados / curr.totais) * 100 : 0;
    const ticketMedio = curr.totais > 0 ? (curr.fatBase + curr.fatPendente + curr.fatCancelado) / curr.totais : 0;

    let convStatus = '', convClass = '', funilColor = '', funilIcon = '', funilBadge = '';

    if (conversao >= 15) {
      convStatus = 'Excelente'; convClass = 'text-green-600'; funilColor = 'text-green-500 bg-green-50 border-green-200'; funilIcon = 'fa-fire-flame-curved'; funilBadge = 'MÁQUINA DE VENDAS';
    } else if (conversao >= 10) {
      convStatus = 'Saudável'; convClass = 'text-blue-600'; funilColor = 'text-blue-500 bg-blue-50 border-blue-200'; funilIcon = 'fa-check-double'; funilBadge = 'FUNIL SAUDÁVEL';
    } else if (conversao >= 6) {
      convStatus = 'Atenção'; convClass = 'text-yellow-600'; funilColor = 'text-yellow-600 bg-yellow-50 border-yellow-200'; funilIcon = 'fa-triangle-exclamation'; funilBadge = 'ATENÇÃO AO FOLLOW-UP';
    } else if (conversao >= 4) {
      convStatus = 'Problema'; convClass = 'text-orange-600'; funilColor = 'text-orange-500 bg-orange-50 border-orange-200'; funilIcon = 'fa-bug'; funilBadge = 'GARGALO';
    } else {
      convStatus = 'Crítico'; convClass = 'text-red-600'; funilColor = 'text-red-500 bg-red-50 border-red-200'; funilIcon = 'fa-skull-crossbones'; funilBadge = 'BAIXA EFICIÊNCIA';
    }

    const prodsObj = Object.keys(prodCounts).map(k => ({ nome: k, val: prodCounts[k] })).sort((a, b) => b.val - a.val);
    const topProduto = prodsObj.length > 0 ? prodsObj[0] : null;

    // 1. PRIORIDADE DO DIA
    let prioridadeHtml = '';
    if (curr.pendentes > 0 && curr.fatPendente >= (curr.fatBase * 0.1)) {
      prioridadeHtml = `
          <h5 class="text-xl md:text-2xl font-black mb-1">Recuperar Caixa Parado</h5>
          <p class="text-[13px] text-indigo-100 font-medium tracking-wide">Foque imediatamente em contatar os <strong class="text-white">${curr.pendentes} clientes</strong> pendentes. Eles podem gerar um salto instantâneo na receita equivalente a dinheiro na mão.</p>
       `;
    } else if (curr.cancelados > curr.fechados && curr.fatCancelado > 0) {
      prioridadeHtml = `
          <h5 class="text-xl md:text-2xl font-black mb-1 text-red-200">Estancar Sangria Financeira</h5>
          <p class="text-[13px] text-indigo-100 font-medium tracking-wide">O volume do que foi perdido supera o que foi ganho. Ação corretiva em processos de cobrança é a única prioridade viável agora.</p>
       `;
    } else if (topProduto) {
      prioridadeHtml = `
          <h5 class="text-xl md:text-2xl font-black mb-1">Injetar Tráfego no Campeão</h5>
          <p class="text-[13px] text-indigo-100 font-medium tracking-wide">Com vendas quentes, escalar pesadamente anúncios do <strong class="text-white text-xs">${topProduto.nome}</strong> ditará o lucro da próxima janela.</p>
       `;
    } else {
      prioridadeHtml = `
          <h5 class="text-xl md:text-2xl font-black mb-1">Reativar Vitrine Urgente</h5>
          <p class="text-[13px] text-indigo-100 font-medium tracking-wide">Suas vendas base estão inativas. Acione remarketing e pesque listas velhas de clientes.</p>
       `;
    }
    document.getElementById('analise-prioridade').innerHTML = prioridadeHtml;

    // 2. DINHEIRO RÁPIDO
    document.getElementById('analise-dinheiro').innerHTML = `
      <h5 class="text-3xl lg:text-4xl font-black tracking-tight text-white mb-1 drop-shadow-md">${formatMoney(curr.fatPendente)}</h5>
      <p class="text-[13px] font-medium text-green-100 leading-tight">Você pode captar essa carga bruta HOJE revertendo objeções de <strong class="text-white bg-green-900/40 px-1 py-0.5 rounded">${curr.pendentes} pedidos</strong> deixados para trás.</p>
    `;

    // 3. SAÚDE DO FUNIL
    document.getElementById('analise-saude-funil').innerHTML = `
      <div class="w-16 h-16 rounded-full flex items-center justify-center border-4 mb-2 shadow-inner ${funilColor}">
         <i class="fa-solid ${funilIcon} text-2xl"></i>
      </div>
      <p class="text-[11px] font-bold ${convClass} uppercase text-center mt-2">${funilBadge}</p>
      <p class="text-2xl font-black text-gray-800 mt-1">${conversao.toFixed(1)}%</p>
    `;

    // 4. VISÃO GERAL
    let visaoText = `O fechamento atual acionou uma alavanca validada de <strong class="text-green-600 text-lg tracking-tight bg-green-50 px-1 rounded">${formatMoney(curr.fatBase)}</strong> em lucro aprovado.<br><br>`;
    const modo = periodFilter.value;

    if (modo !== 'all' && prev.totais > 0) {
      let g = calcVar(curr.fatBase, prev.fatBase);
      if (g > 0) visaoText += `✅ Consolidamos um foguete de <strong class="text-green-600 font-bold text-base">+${g.toFixed(1)}% de Expansão</strong> contra o espelho passado. A demanda orgânica confirmou fit de mercado extremo!`;
      else if (g < 0) visaoText += `⚠️ A métrica registrou uma contração em <strong class="text-red-500 font-bold text-base">${Math.abs(g).toFixed(1)}% de Queda</strong>. A pressão vendedora reduziu a boca do seu funil e carece injeções de verba.`;
      else visaoText += `⚖️ Estabilidade métrica flat, garantindo o custo operacional mas ausentando progressão exponencial.`;
    }
    document.getElementById('analise-visao-geral').innerHTML = `<p class="md:text-[15px]">${visaoText}</p>`;

    // 5. COMPORTAMENTO DE CONSUMO
    let compHtml = `<p>Atualmente seu cliente tem injetado um ticket de corte de <strong class="text-indigo-600 text-base font-bold bg-indigo-50 px-1 rounded">${formatMoney(ticketMedio)}</strong> por cada jornada do carrinho.</p>`;
    if (ticketMedio > 2000) {
      compHtml += `<p class="mt-4 text-gray-600 text-[13px] border-l-2 border-indigo-200 pl-3"><strong>Amostragem Alpha:</strong> O Público dominante joga estritamente em vitrines Premium e Eletrônicos de Elite. Eles toleram zero lentidão, mas perdoam tickets rasgados se ganharem em "Status" e confiança absoluta de prova social.</p>`;
    } else if (ticketMedio > 500) {
      compHtml += `<p class="mt-4 text-gray-600 text-[13px] border-l-2 border-indigo-200 pl-3"><strong>Amostragem Intermediária Escalonável:</strong> Público caçador de Custo-Benefício. Vender aqui exige engatilhar escassez de estoque ou usar cupons para acionar compras imediatas.</p>`;
    } else {
      compHtml += `<p class="mt-4 text-gray-600 text-[13px] border-l-2 border-indigo-200 pl-3"><strong>Amostragem Varejo Volumoso:</strong> Hiper sensibilidade a centavos no preço e taxa de frete. Você converte no gatilho de oferta ou bônus visuais esmagadores.</p>`;
    }
    document.getElementById('analise-comportamento').innerHTML = compHtml;

    // 6. DESEMPENHO (LOGÍSTICO/CARGA)
    let desHtml = '';
    if (topProduto) {
      let dominance = curr.fechados > 0 ? (topProduto.val / curr.fechados * 100).toFixed(1) : 100;
      desHtml += `<p>O monstruoso <strong>${topProduto.nome}</strong> está descarregando os lucros da operação (<strong>${topProduto.val} saídas massivas</strong>, ${dominance}% de retenção individual em vitrine).</p>`;
    }
    const soldSet = new Set(filteredOrders.map(o => o.produto ? o.produto.toLowerCase() : ''));
    const idleList = allProducts.filter(p => !soldSet.has(p.nome.toLowerCase()));
    if (idleList.length > 0 && idleList.length <= 30) {
      desHtml += `<p class="mt-4 text-gray-500 text-xs italic bg-gray-50 p-2 rounded">Alerta: Há ociosidade em estoque com ${idleList.length} itens parados nas prateleiras digitais.</p>`;
    }
    document.getElementById('analise-desempenho').innerHTML = desHtml || '<p class="text-sm">Matriz logística indetectável por falta tráfego convertido.</p>';

    // 7. DIAGNÓSTICO DE RISCO (SANGRIA BRUTAL)
    const probs = [];
    if (conversao < 6 && curr.totais > 0) probs.push(`
      <div class="bg-white p-4 rounded-xl flex gap-4 items-start shadow-sm border border-red-100">
         <i class="fa-solid fa-filter-circle-xmark text-red-500 text-lg mt-0.5"></i>
         <div>
            <h6 class="font-extrabold text-red-900 text-[12px] uppercase mb-1 tracking-wider">Conversão Catastrófica</h6>
            <p class="text-[13px] text-gray-700 leading-relaxed">${curr.totais - curr.fechados} leads vazaram no checkout. Um abismo de atrito e esfriamento em minutos no pagamento.</p>
         </div>
      </div>
    `);
    if (curr.fatCancelado > 0) {
      let burnRate = curr.fatBase > 0 ? (curr.fatCancelado / curr.fatBase * 100).toFixed(1) : 100;
      probs.push(`
        <div class="bg-white p-4 rounded-xl flex gap-4 items-start shadow-sm border border-red-100">
           <i class="fa-solid fa-money-bill-transfer text-red-500 text-lg mt-0.5"></i>
           <div>
              <h6 class="font-extrabold text-red-900 text-[12px] uppercase mb-1 tracking-wider">R$ ${formatMoney(curr.fatCancelado).replace('R$ ', '')} Evaporados!</h6>
              <p class="text-[13px] text-gray-700 leading-relaxed">Essa montanha financeira equivale a <span class="bg-red-100 text-red-700 font-bold px-1 py-0.5 rounded">${burnRate}% de sua Receita Provada</span> rasgados fora em cancelamentos cravados.</p>
           </div>
        </div>
       `);
    }
    if (curr.pendentes > 0) probs.push(`
      <div class="bg-white p-4 rounded-xl flex gap-4 items-start shadow-sm border border-orange-100">
         <i class="fa-solid fa-hourglass-half text-orange-500 text-lg mt-0.5"></i>
         <div>
            <h6 class="font-extrabold text-orange-900 text-[12px] uppercase mb-1 tracking-wider">Processos Mofando</h6>
            <p class="text-[13px] text-gray-700 leading-relaxed">${curr.pendentes} pedidos não atualizados. A cada hora extra nessa situação aumenta-se a perda irreparável para concorrentes.</p>
         </div>
      </div>
    `);

    if (probs.length === 0) probs.push(`
      <div class="bg-green-50/50 p-4 rounded-xl border border-green-200">
        <p class="text-green-800 font-bold text-sm"><i class="fa-solid fa-shield-halved mr-2"></i> Resiliência Total. O radar não detectou rupturas agudas.</p>
      </div>
    `);
    document.getElementById('analise-problemas').innerHTML = probs.join('');

    // 8. OPORTUNIDADES EXPLOSIVAS
    const ops = [];
    if (topProduto) ops.push(`
      <div class="bg-white p-4 rounded-xl flex gap-4 items-start shadow-sm border border-blue-100">
         <i class="fa-solid fa-arrow-trend-up text-blue-500 text-lg mt-0.5"></i>
         <div>
            <h6 class="font-extrabold text-blue-900 text-[12px] uppercase mb-1 tracking-wider">Ataque Monopolista no Campeão</h6>
            <p class="text-[13px] text-gray-700 leading-relaxed">Alavancar o orçamento do <strong>${topProduto.nome}</strong> tende a gerar faturamentos imediatos em lookalikes, visto sua tração brutal.</p>
         </div>
      </div>
    `);
    if (curr.pendentes > 0) ops.push(`
      <div class="bg-white p-4 rounded-xl flex gap-4 items-start shadow-sm border border-green-100">
         <i class="fa-solid fa-sack-dollar text-green-500 text-lg mt-0.5"></i>
         <div>
            <h6 class="font-extrabold text-green-900 text-[12px] uppercase mb-1 tracking-wider">Lucro Invisível (Zero Custo)</h6>
            <p class="text-[13px] text-gray-700 leading-relaxed">Recuperar carrinho e injetar telemarketing em leads mornos minera lucro limpo com <strong>CAC = R$ 0,00</strong>.</p>
         </div>
      </div>
    `);
    if (idleList.length > 0) ops.push(`
      <div class="bg-white p-4 rounded-xl flex gap-4 items-start shadow-sm border border-purple-100">
         <i class="fa-solid fa-boxes-packing text-purple-500 text-lg mt-0.5"></i>
         <div>
            <h6 class="font-extrabold text-purple-900 text-[12px] uppercase mb-1 tracking-wider">Fusão Estratégica (Bundles)</h6>
            <p class="text-[13px] text-gray-700 leading-relaxed">A ociosidade dos ${idleList.length} itens parados serve como ferramenta grátis para embutir brindes que inflacionam ofertas principais.</p>
         </div>
      </div>
    `);

    if (ops.length === 0) ops.push(`
      <div class="bg-gray-50/50 p-4 rounded-xl border border-gray-200">
        <p class="text-gray-600 font-bold text-sm"><i class="fa-solid fa-forward mr-2"></i> Escalone os orçamentos, demandas fluindo naturalmente.</p>
      </div>
    `);
    document.getElementById('analise-oportunidades').innerHTML = ops.join('');

    // 9. AÇÕES / CHECKLIST DO GESTOR
    const acoes = [];
    if (curr.pendentes > 0) {
      acoes.push(`
         <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 shadow-sm hover:border-green-300 transition-colors">
            <h5 class="text-green-800 font-extrabold text-[13px] mb-2 flex items-center uppercase"><span class="bg-green-600 text-white w-5 h-5 rounded-full flex items-center justify-center mr-2 text-[10px]">1</span> Sacar Fluxo Pendente (R$ ${formatMoney(curr.fatPendente).replace('R$ ', '')})</h5>
            <ol class="text-[13px] text-gray-700 font-medium space-y-1.5 ml-4 pl-3 border-l hover:border-green-300 transition-colors">
               <li><span class="text-gray-900 font-bold">Passo 1:</span> Vá para Histórico de Pedidos e altere o Filtro Superior para "Status: Pendentes".</li>
               <li><span class="text-gray-900 font-bold">Passo 2:</span> Chame os contatos no WhatsApp com urgência disparando Scripts de Oferta de Entrega/Frete Grátis na aprovação agora!</li>
            </ol>
         </div>
      `);
    }
    if (conversao < 10) {
      acoes.push(`
         <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 shadow-sm hover:border-blue-300 transition-colors">
            <h5 class="text-blue-800 font-extrabold text-[13px] mb-2 flex items-center uppercase"><span class="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center mr-2 text-[10px]">2</span> Aniquilar Dúvida do Consumidor</h5>
            <ol class="text-[13px] text-gray-700 font-medium space-y-1.5 ml-4 pl-3 border-l hover:border-blue-300 transition-colors">
               <li><span class="text-gray-900 font-bold">Passo 1:</span> Injete Prova Social nos atendimentos ativos e melhore a velocidade de respostas no canal.</li>
            </ol>
         </div>
      `);
    }
    if (curr.fatCancelado > 0) {
      acoes.push(`
         <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 shadow-sm hover:border-red-300 transition-colors">
            <h5 class="text-red-800 font-extrabold text-[13px] mb-2 flex items-center uppercase"><span class="bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center mr-2 text-[10px]">3</span> Operação Resgate Final</h5>
            <ol class="text-[13px] text-gray-700 font-medium space-y-1.5 ml-4 pl-3 border-l hover:border-red-300 transition-colors">
               <li><span class="text-gray-900 font-bold">Passo 1:</span> Tentar resgatar os leads perdidos via ofertas de Downsell agresivos para aparelhos inferiores. Aceite descontos violentivos pra não fechar LTV Zero!</li>
            </ol>
         </div>
      `);
    }
    if (acoes.length === 0) {
      acoes.push('<div class="p-5 bg-green-50 text-green-800 text-center font-bold text-sm tracking-wide rounded-xl border border-green-200"><i class="fa-solid fa-champagne-glasses text-2xl mb-2 block"></i> Você Cumpriu Todas As Tarefas e Protegeu As Redes. Continue a tração!</div>');
    }
    document.getElementById('analise-acoes').innerHTML = acoes.join('');
  }

  // 7. Rankings Complexos e Produtos Parados
  function renderRankings() {
    const models = {}, vars = {}, revTick = {};
    const soldSet = new Set();

    filteredOrders.forEach(o => {
      if (!o.produto || o.produto === 'Pedido Vazio') return;

      const gid = o.group_id && o.group_id !== '' ? o.group_id : o.produto;
      models[gid] = (models[gid] || 0) + o.quantidade;

      const varKey = `${o.produto} | ${o.cor || 'Unic'} | ${o.armazenamento || 'Unic'}`;
      vars[varKey] = (vars[varKey] || 0) + o.quantidade;

      if (!revTick[o.produto]) revTick[o.produto] = { fat: 0, qtd: 0 };
      revTick[o.produto].fat += o.total;
      revTick[o.produto].qtd += o.quantidade;

      // Save ID to easily find unsold
      // Because orders might not save product ID, we use Name as correlation since we didn't add product_id
      soldSet.add(o.produto.toLowerCase());
    });

    const rankList = (obj, sorterFx, slicer = 5) => Object.keys(obj).map(k => ({ label: k, val: obj[k] })).sort(sorterFx).slice(0, slicer);

    const sortedModels = rankList(models, (a, b) => b.val - a.val, 10);
    const sortedVars = rankList(vars, (a, b) => b.val - a.val, 10);
    const sortedRev = rankList(revTick, (a, b) => b.val.fat - a.val.fat, 10);

    const renderLi = (arr, elId, formatLabel, formatVal) => {
      const el = document.getElementById(elId);
      el.innerHTML = arr.length ? '' : '<li class="text-sm text-gray-500 py-2">Sem dados</li>';
      arr.forEach((item, idx) => {
        el.innerHTML += `
          <li class="flex items-center justify-between group">
            <div class="flex items-center gap-2 min-w-0 pr-2">
              <span class="w-5 h-5 flex items-center justify-center bg-gray-100 text-gray-700 font-bold text-[10px] rounded shrink-0">${idx + 1}</span>
              <span class="text-sm font-medium text-gray-800 truncate" title="${item.label}">${formatLabel(item.label, item.val)}</span>
            </div>
            <span class="text-xs font-bold text-gray-600 shrink-0 bg-white px-2 py-1 rounded shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-gray-100">${formatVal(item.val)}</span>
          </li>`;
      });
    };

    renderLi(sortedModels, 'rank-models', l => l.replace(/-/g, ' '), v => `${v} unid`);
    renderLi(sortedVars, 'rank-vars', l => {
      const parts = l.split('|'); return `<span class="font-bold">${parts[0]}</span> <span class="text-[10px] text-gray-500 block">${parts[1]} ${parts[2]}</span>`;
    }, v => `${v} und`);
    renderLi(sortedRev, 'rank-revenue', l => l, v => `${formatMoney(v.fat)} <span class="text-[10px] block text-gray-400 font-normal leading-tight">TM: ${formatMoney(v.fat / v.qtd)}</span>`);

    // Produtos Parados Insight
    const idleList = allProducts.filter(p => !soldSet.has(p.nome.toLowerCase()));
    const elIdle = document.getElementById('rank-idle');
    elIdle.innerHTML = idleList.length === 0 ? '<li class="text-sm text-green-600 font-medium py-2"><i class="fa-solid fa-check-double"></i> Todo catálogo teve saída!</li>' : '';

    idleList.slice(0, 10).forEach(p => {
      elIdle.innerHTML += `
         <li class="flex flex-col mb-2 pb-2 border-b border-red-100/50 last:border-0">
           <span class="text-sm font-semibold text-gray-800">${p.nome} | ${p.cor} ${p.armazenamento}</span>
           <span class="text-[10px] text-gray-500 uppercase">${p.categoria} | Estoque Imóvel</span>
         </li>`;
    });
  }

  // 7. Tabelas C/ Search
  function renderTable() {
    const tbody = document.getElementById('orders-table-body');
    let displayOrders = filteredOrders;

    if (tableSearchTerm.length > 0) {
      displayOrders = displayOrders.filter(o =>
        (o.produto || '').toLowerCase().includes(tableSearchTerm) ||
        (o.cor || '').toLowerCase().includes(tableSearchTerm)
      );
    }

    if (tableBrandFilter !== 'all') {
      displayOrders = displayOrders.filter(o => o.marca === tableBrandFilter);
    }

    if (tableStatusFilter !== 'all') {
      displayOrders = displayOrders.filter(o => o.status === tableStatusFilter);
    }

    if (tablePeriodFilter !== 'all') {
      let tCut = new Date();
      tCut.setHours(0, 0, 0, 0);
      let tEnd = new Date();
      tEnd.setHours(23, 59, 59, 999);

      if (tablePeriodFilter === 'yesterday') {
        tCut.setDate(tCut.getDate() - 1);
        tEnd.setDate(tEnd.getDate() - 1);
      } else if (tablePeriodFilter === '7') {
        tCut.setDate(tCut.getDate() - 7);
      } else if (tablePeriodFilter === 'custom') {
        if (tableDateStart && tableDateStart.value) {
          tCut = new Date(tableDateStart.value + 'T00:00:00');
          tEnd = new Date(tableDateStart.value + 'T23:59:59'); // Mesma data
        } else {
          tCut = new Date(0);
        }
      }

      displayOrders = displayOrders.filter(o => o.parsedDate >= tCut && o.parsedDate <= tEnd);
    }

    document.getElementById('label-table-count').textContent = `${displayOrders.length} itens exibidos`;
    tbody.innerHTML = '';

    if (displayOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500 text-sm">Nenhum pedido filtrado na tabela.</td></tr>`;
      return;
    }

    const getStatusColor = (s) => {
      if (s === 'Fechado') return 'bg-green-50 border-green-200 text-green-700';
      if (s === 'Cancelado') return 'bg-red-50 border-red-200 text-red-700';
      return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    };

    displayOrders.forEach(o => {
      const dataFormatada = o.parsedDate.getTime() === 0 ? o.data : o.parsedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const badgeVariacao = (o.armazenamento || o.cor || o.condicao) ? `
        <div class="flex flex-wrap gap-1 mt-1">
          ${o.condicao ? `<span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] uppercase font-semibold tracking-wider">${o.condicao}</span>` : ''}
          ${o.armazenamento ? `<span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">${o.armazenamento}</span>` : ''}
          ${o.cor ? `<span class="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold">${o.cor}</span>` : ''}
        </div>` : '';

      tbody.innerHTML += `
        <tr class="hover:bg-gray-50 transition border-b border-gray-50 last:border-0">
          <td class="px-6 py-3 whitespace-nowrap text-xs text-gray-500 font-medium pt-4">
            <span class="block font-bold text-gray-900 mb-0.5 text-[10px] uppercase tracking-wider">${o.id_do_pedido}</span>
            ${dataFormatada}
          </td>
          <td class="px-6 py-3 pt-4">
            <div class="text-sm font-bold text-gray-900 leading-tight">${formatText(o.produto)}</div>
            ${badgeVariacao}
          </td>
          <td class="px-6 py-3 whitespace-nowrap text-sm text-center font-bold text-gray-700 pt-4">x${o.quantidade}</td>
          <td class="px-6 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900 pt-4">${formatMoney(o.total)}</td>
          <td class="px-6 py-3 whitespace-nowrap text-center pt-4">
            <select data-id="${o.id_do_pedido}" class="status-select w-32 px-2 py-1 text-xs font-semibold rounded-md border appearance-none text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-300 transition ${getStatusColor(o.status)}">
              <option value="Pendente" ${o.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
              <option value="Fechado" ${o.status === 'Fechado' ? 'selected' : ''}>Fechado</option>
              <option value="Cancelado" ${o.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </td>
        </tr>
      `;
    });

    // Bind status events
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', handleStatusChange);
    });
  }

  // 8. Atualização de Status
  async function handleStatusChange(e) {
    const sel = e.target;
    const pedidoId = sel.getAttribute('data-id');
    const newStatus = sel.value;

    sel.disabled = true;
    sel.classList.add('opacity-50', 'cursor-wait');
    showToast('Atualizando pedido...', 'blue', 'fa-spinner', true);

    try {
      const resp = await fetch(`${CONFIG.apiBaseUrl}?action=atualizarStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ pedido_id: pedidoId, status: newStatus })
      });

      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Erro na API');

      // Update local state
      allOrders.forEach(o => { if (o.id_do_pedido === pedidoId) o.status = newStatus; });
      aplicarFiltroPeriodo(); // Re-render everything with new colors and KPIs
      showToast('Status modificado! Atualizando estoque...', 'green', 'fa-check', true);

      // Atualiza de forma silenciosa e automática o Dashboard inteiro e Estoques
      await loadDashboardData(true);
      showToast('Estoque e Dashboard sincronizados!', 'green', 'fa-check');

    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar. Tente novamente.', 'red', 'fa-xmark');
      sel.disabled = false;
      sel.classList.remove('opacity-50', 'cursor-wait');
      // Revert select visually (lazy revert, could also find original value)
      aplicarFiltroPeriodo();
    }
  }

  function showToast(msg, color, icon, isSpin = false) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    const icn = document.getElementById('toast-icon');
    icn.className = `fa-solid ${icon} text-${color}-400 ${isSpin ? 'fa-spin' : ''}`;
    t.className = `fixed bottom-4 right-4 bg-gray-900 text-white px-5 py-3 rounded-lg shadow-xl transition-all duration-300 z-50 flex items-center gap-3`;

    // Auto hide se nao for spinner
    if (!isSpin) {
      setTimeout(() => {
        t.className = `fixed bottom-4 right-4 bg-gray-900 text-white px-5 py-3 rounded-lg shadow-xl translate-y-20 opacity-0 transition-all duration-300 z-50 flex items-center gap-3 pointer-events-none`;
      }, 3000);
    }
  }

  // --- NOVA SESSÃO: GESTÃO DE ESTOQUE ---
  let estoqueBusca = '';
  let pendingEstoqueUpdates = {}; // { sku: { estoque, estoque_minimo } }

  const inpSearchEstoque = document.getElementById('estoque-search');
  const btnSalvarEstoque = document.getElementById('btn-salvar-estoque');

  if (inpSearchEstoque) {
    inpSearchEstoque.addEventListener('input', (e) => {
      estoqueBusca = e.target.value.toLowerCase();
      renderEstoque();
    });
  }

  if (btnSalvarEstoque) {
    btnSalvarEstoque.addEventListener('click', salvarEstoqueManualmente);
  }

  function handleEstoqueEdit(sku, type, value) {
    if (!pendingEstoqueUpdates[sku]) {
      const prod = allProducts.find(p => p.sku === sku);
      pendingEstoqueUpdates[sku] = {
        estoque: prod ? (Number(prod.estoque) || 0) : 0,
        estoque_minimo: prod ? (Number(prod.estoque_minimo) || 2) : 2
      };
    }
    pendingEstoqueUpdates[sku][type] = Number(value);

    // Mostra botão de salvar se houver pendencias
    btnSalvarEstoque.classList.remove('hidden');
  }

  function renderEstoque() {
    const tbody = document.getElementById('estoque-table-body');
    if (!tbody) return;

    let produtosValidos = allProducts.filter(p => p.sku && p.sku !== '');

    let esgotados = 0, poucas = 0, disponiveis = 0;

    produtosValidos.forEach(p => {
      const est = Number(p.estoque) || 0;
      const min = Number(p.estoque_minimo) || 2;
      if (est <= 0) esgotados++;
      else if (est <= min) poucas++;
      else disponiveis++;
    });

    document.getElementById('alert-esgotados').textContent = esgotados;
    document.getElementById('alert-poucas').textContent = poucas;
    document.getElementById('alert-estoque').textContent = disponiveis;

    if (estoqueBusca.length > 0) {
      produtosValidos = produtosValidos.filter(p =>
        (p.nome || '').toLowerCase().includes(estoqueBusca) ||
        (p.sku || '').toLowerCase().includes(estoqueBusca)
      );
    }

    tbody.innerHTML = '';

    if (produtosValidos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500 text-sm">Nenhum produto em estoque encontrado.</td></tr>`;
      return;
    }

    produtosValidos.forEach(p => {
      const pending = pendingEstoqueUpdates[p.sku] || {};
      const estVal = pending.estoque !== undefined ? pending.estoque : (Number(p.estoque) || 0);
      const minVal = pending.estoque_minimo !== undefined ? pending.estoque_minimo : (Number(p.estoque_minimo) || 2);

      let statusBadge = '';
      if (estVal <= 0) statusBadge = '<span class="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-bold uppercase tracking-wider">Esgotado</span>';
      else if (estVal === 1) statusBadge = '<span class="px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs font-bold uppercase tracking-wider">Apenas 1</span>';
      else if (estVal <= minVal) statusBadge = '<span class="px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-xs font-bold uppercase tracking-wider">Poucas Unds</span>';
      else statusBadge = '<span class="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-bold uppercase tracking-wider">Em Estoque</span>';

      const varList = [];
      if (p.armazenamento) varList.push(p.armazenamento);
      if (p.cor) varList.push(p.cor);
      if (p.condicao) varList.push(p.condicao);

      tbody.innerHTML += `
        <tr class="hover:bg-gray-50 transition border-b border-gray-50 last:border-0">
          <td class="px-6 py-4">
            <div class="text-sm font-bold text-gray-900 leading-tight">${formatText(p.nome)}</div>
            <div class="text-[10px] text-gray-400 mt-1 uppercase font-mono tracking-wider">${p.sku}</div>
          </td>
          <td class="px-6 py-4 text-xs font-semibold text-gray-600">${varList.join(' • ')}</td>
          <td class="px-6 py-4">
            <input type="number" min="0" value="${minVal}" class="est-min-input w-20 px-2 py-1.5 text-center text-sm border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" data-sku="${p.sku}">
          </td>
          <td class="px-6 py-4">
            <div class="flex items-center justify-center gap-1">
              <input type="number" value="${estVal}" class="est-val-input w-24 px-2 py-1.5 text-center text-sm font-bold border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none ${estVal <= 0 ? 'text-red-600 border-red-300' : 'text-gray-900'}" data-sku="${p.sku}">
            </div>
          </td>
          <td class="px-6 py-4 text-center">
            ${statusBadge}
          </td>
        </tr>
      `;
    });

    document.querySelectorAll('.est-min-input').forEach(inp => {
      inp.addEventListener('change', (e) => { handleEstoqueEdit(e.target.dataset.sku, 'estoque_minimo', e.target.value); renderEstoque(); });
    });
    document.querySelectorAll('.est-val-input').forEach(inp => {
      inp.addEventListener('change', (e) => { handleEstoqueEdit(e.target.dataset.sku, 'estoque', e.target.value); renderEstoque(); });
    });
  }

  async function salvarEstoqueManualmente() {
    const keys = Object.keys(pendingEstoqueUpdates);
    if (keys.length === 0) return;

    const updates = keys.map(k => ({
      sku: k,
      estoque: pendingEstoqueUpdates[k].estoque,
      estoque_minimo: pendingEstoqueUpdates[k].estoque_minimo
    }));

    btnSalvarEstoque.disabled = true;
    btnSalvarEstoque.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    try {
      showToast('Sincronizando estoque...', 'blue', 'fa-spinner', true);
      const resp = await fetch(`${CONFIG.apiBaseUrl}?action=salvar_estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ estoque_updates: updates })
      });

      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Erro na API');

      // Atualiza estado local
      keys.forEach(k => {
        const prod = allProducts.find(p => p.sku === k);
        if (prod) {
          prod.estoque = pendingEstoqueUpdates[k].estoque;
          prod.estoque_minimo = pendingEstoqueUpdates[k].estoque_minimo;
        }
      });

      pendingEstoqueUpdates = {};
      btnSalvarEstoque.classList.add('hidden');
      renderEstoque();
      showToast('Estoque atualizado com sucesso!', 'green', 'fa-check');

    } catch (err) {
      console.error(err);
      showToast('Falha ao salvar estoque.', 'red', 'fa-xmark');
    } finally {
      btnSalvarEstoque.disabled = false;
      btnSalvarEstoque.innerHTML = 'Salvar Alterações';
    }
  }

  // 8. Visualização Chart.js Dupla (Linhas + Pizza Distribuição)
  function renderCharts() {
    // 8a. Gráfico de Linha Diário
    const ctxL = document.getElementById('revenue-chart').getContext('2d');
    const dData = {};
    const sorted = [...filteredOrders].sort((a, b) => a.parsedDate - b.parsedDate);

    sorted.forEach(o => {
      if (o.parsedDate.getTime() === 0) return;
      const k = o.parsedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      if (!dData[k]) dData[k] = 0;
      dData[k] += o.total;
    });

    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctxL, {
      type: 'line',
      data: {
        labels: Object.keys(dData).length ? Object.keys(dData) : ['Sem dados'],
        datasets: [{
          label: 'Faturamento',
          data: Object.keys(dData).length ? Object.values(dData) : [0],
          borderColor: '#111827', backgroundColor: 'rgba(17, 24, 39, 0.1)',
          borderWidth: 2, fill: true, tension: 0.4,
          pointBackgroundColor: '#fff', pointBorderColor: '#111827', pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', padding: 12, callbacks: { label: c => ' ' + formatMoney(c.parsed.y) } } },
        scales: { y: { beginAtZero: true, grid: { borderDash: [5, 5] }, ticks: { callback: v => 'R$ ' + v } }, x: { grid: { display: false } } }
      }
    });

    // 8b. Gráfico de Pizza Distribuição Modelos
    const ctxP = document.getElementById('distribution-chart').getContext('2d');
    const mData = {};
    filteredOrders.forEach(o => {
      if (!o.produto || o.produto === 'Pedido Vazio') return;
      let gid = o.group_id && o.group_id !== '' ? o.group_id : o.produto;
      gid = gid.replace(/-/g, ' ');
      mData[gid] = (mData[gid] || 0) + o.quantidade;
    });

    let pieArr = Object.keys(mData).map(k => ({ l: k.substring(0, 18), v: mData[k] })).sort((a, b) => b.v - a.v);

    // Agrupar "Outros" se mais de 5 itens
    let pieLabels = [], pieValues = [];
    if (pieArr.length > 5) {
      pieLabels = pieArr.slice(0, 4).map(x => x.l);
      pieValues = pieArr.slice(0, 4).map(x => x.v);
      const othersVal = pieArr.slice(4).reduce((acc, curr) => acc + curr.v, 0);
      pieLabels.push('Outros...');
      pieValues.push(othersVal);
    } else {
      pieLabels = pieArr.map(x => x.l);
      pieValues = pieArr.map(x => x.v);
    }

    if (distributionChart) distributionChart.destroy();
    if (pieValues.length === 0) {
      pieLabels = ['Sem Vendas'];
      pieValues = [1];
    }

    distributionChart = new Chart(ctxP, {
      type: 'doughnut',
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieValues,
          backgroundColor: ['#111827', '#374151', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB'],
          borderWidth: 2, borderColor: '#fff'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: { backgroundColor: '#111827', padding: 10 }
        }
      }
    });
  }

  // Init
  loadDashboardData();

  // Polling automático (Auto-Refresh) a cada 45 segundos
  setInterval(() => {
    // Só atualiza silenciosamente se o usuário NÃO estiver digitando novos estoques
    if (Object.keys(pendingEstoqueUpdates).length === 0) {
      loadDashboardData(true);
    }
  }, 45000);
}

initDashboard();
