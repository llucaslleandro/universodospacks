import { CONFIG } from '../../shared/config.js';
import { state, loadDashboardData } from './store.js';
import { formatMoney, formatText, showToast } from './ui.js';

export function aplicarFiltroPeriodo(callbacks = {}) {
  const periodFilter = document.getElementById('period-filter');
  const dateStart = document.getElementById('date-start');
  const dateEnd = document.getElementById('date-end');
  
  if (!periodFilter || state.allOrders.length === 0) return;

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
  } else if (mode === '7' || mode === '14' || mode === '30') {
    const days = parseInt(mode);
    startDate.setDate(startDate.getDate() - days);
    prevStartDate.setDate(startDate.getDate() - days);
    prevEndDate.setDate(endDate.getDate() - days);
  } else if (mode === 'custom') {
    if (dateStart?.value && dateEnd?.value) {
      startDate = new Date(dateStart.value + 'T00:00:00');
      endDate = new Date(dateEnd.value + 'T23:59:59');
      const diffDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24));
      prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - diffDays);
    } else {
      return;
    }
  } else {
    startDate = new Date(0); // all
  }

  if (mode === 'all') {
    state.filteredOrders = [...state.allOrders];
    state.previousOrders = [];
  } else {
    state.filteredOrders = state.allOrders.filter(o => o.parsedDate >= startDate && o.parsedDate <= endDate);
    state.previousOrders = state.allOrders.filter(o => o.parsedDate >= prevStartDate && o.parsedDate <= prevEndDate);
  }

  if (callbacks.onRender) callbacks.onRender();
}

export function renderTable(callbacks = {}) {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  let displayOrders = state.filteredOrders;

  if (state.tableSearchTerm.length > 0) {
    displayOrders = displayOrders.filter(o =>
      (o.produto || '').toLowerCase().includes(state.tableSearchTerm) ||
      (o.cor || '').toLowerCase().includes(state.tableSearchTerm) ||
      (o.id_do_pedido || '').toLowerCase().includes(state.tableSearchTerm)
    );
  }

  if (state.tableBrandFilter !== 'all') {
    displayOrders = displayOrders.filter(o => o.categoria === state.tableBrandFilter);
  }

  if (state.tableStatusFilter !== 'all') {
    displayOrders = displayOrders.filter(o => o.status === state.tableStatusFilter);
  }

  if (state.tablePeriodFilter !== 'all') {
    let tCut = new Date();
    tCut.setHours(0, 0, 0, 0);
    let tEnd = new Date();
    tEnd.setHours(23, 59, 59, 999);

    if (state.tablePeriodFilter === 'yesterday') {
      tCut.setDate(tCut.getDate() - 1);
      tEnd.setDate(tEnd.getDate() - 1);
    } else if (state.tablePeriodFilter === '7') {
      tCut.setDate(tCut.getDate() - 7);
    } else if (state.tablePeriodFilter === 'custom') {
      const tableDateStart = document.getElementById('table-date-start');
      if (tableDateStart?.value) {
        tCut = new Date(tableDateStart.value + 'T00:00:00');
        tEnd = new Date(tableDateStart.value + 'T23:59:59');
      } else {
        tCut = new Date(0);
      }
    }
    displayOrders = displayOrders.filter(o => o.parsedDate >= tCut && o.parsedDate <= tEnd);
  }

  const labelCount = document.getElementById('label-table-count');
  if (labelCount) labelCount.textContent = `${displayOrders.length} itens exibidos`;
  
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
      <tr id="order-row-${o.item_id || o.id_do_pedido}" class="hover:bg-gray-50 transition border-b border-gray-50 last:border-0">
        <td class="px-6 py-3 whitespace-nowrap text-xs text-gray-500 font-medium pt-4">
          <span class="block font-bold text-gray-900 mb-0.5 text-[10px] uppercase tracking-wider">${o.id_do_pedido}</span>
          ${dataFormatada}
        </td>
        <td class="px-6 py-3 pt-4">
          <div class="text-sm font-bold text-gray-900 leading-tight">${formatText(o.produto)}</div>
          ${badgeVariacao}
        </td>
        <td class="px-6 py-3 whitespace-nowrap text-sm text-center font-bold text-gray-700 pt-4">x${o.quantidade}</td>
        <td class="px-6 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900 pt-4">
          ${o.final_price ? `<span class="text-[10px] text-indigo-500 block leading-[5px] mb-1 font-black uppercase tracking-tighter">Negociado</span>` : ''}
          ${formatMoney(o.final_price || o.total)}
        </td>
        <td class="px-6 py-3 whitespace-nowrap text-center pt-4">
          <select data-id="${o.item_id || o.id_do_pedido}" data-type="${o.item_id ? 'item' : 'order'}" class="status-select w-32 px-2 py-1 text-xs font-semibold rounded-md border appearance-none text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-300 transition ${getStatusColor(o.status)}">
            <option value="Pendente" ${o.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
            <option value="Fechado" ${o.status === 'Fechado' ? 'selected' : ''}>Fechado</option>
            <option value="Cancelado" ${o.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </td>
      </tr>
    `;
  });

  document.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', (e) => handleStatusChange(e, callbacks));
  });
}

export async function handleStatusChange(e, callbacks = {}) {
  const sel = e.target;
  const itemId = sel.getAttribute('data-id');
  const isItemLevel = sel.getAttribute('data-type') === 'item';
  const newStatus = sel.value;
  const oldStatus = state.allOrders.find(o => (o.item_id === itemId || o.id_do_pedido === itemId))?.status || 'Pendente';

  if (!isItemLevel) {
    showToast('Este pedido legado não suporta atualização individual. Limpe os dados antigos.', 'red', 'fa-triangle-exclamation');
    sel.value = oldStatus;
    return;
  }

  if (newStatus === 'Fechado') {
    const item = state.allOrders.find(o => o.item_id === itemId);
    showNegotiationModal(itemId, item.total, async (finalPrice) => {
      await updateStatusAPI(sel, itemId, newStatus, finalPrice, callbacks);
    }, () => {
      // Revert select if cancelled
      sel.value = oldStatus;
      sel.className = sel.className.replace(/bg-\w+-50 border-\w+-200 text-\w+-700/g, '');
      
      const getStatusColor = (s) => {
        if (s === 'Fechado') return 'bg-green-50 border-green-200 text-green-700';
        if (s === 'Cancelado') return 'bg-red-50 border-red-200 text-red-700';
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      };
      
      sel.classList.add(...getStatusColor(oldStatus).split(' '));
    });
    return;
  }

  await updateStatusAPI(sel, itemId, newStatus, null, callbacks);
}

async function updateStatusAPI(sel, itemId, newStatus, finalPrice, callbacks) {

  sel.disabled = true;
  sel.classList.add('opacity-50', 'cursor-wait');
  showToast('Atualizando item...', 'blue', 'fa-spinner', true);

  try {
    const resp = await fetch(`${CONFIG.apiBaseUrl}?action=atualizarStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ item_id: itemId, status: newStatus, final_price: finalPrice })
    });

    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Erro na API');

    state.allOrders.forEach(o => { if (o.item_id === itemId) o.status = newStatus; });
    
    if (callbacks.onStatusUpdated) callbacks.onStatusUpdated();
    
    showToast('Status modificado! Atualizando estoque...', 'green', 'fa-check', true);
    await loadDashboardData(callbacks.dataCallbacks || {}, true);
    showToast('Estoque e Dashboard sincronizados!', 'green', 'fa-check');

  } catch (err) {
    console.error(err);
    showToast('Erro ao atualizar. Tente novamente.', 'red', 'fa-xmark');
    sel.disabled = false;
    sel.classList.remove('opacity-50', 'cursor-wait');
    if (callbacks.onRender) callbacks.onRender();
  }
}

let currentNegotiation = null;

export function initNegotiationModal() {
  const modal = document.getElementById('modal-negociacao');
  const btnNao = document.getElementById('btn-negoc-nao');
  const btnSim = document.getElementById('btn-negoc-sim');
  const inputWrap = document.getElementById('input-negoc-wrap');
  const inputFinal = document.getElementById('input-final-price');
  const btnConfirm = document.getElementById('btn-negoc-confirm');
  const btnCancel = document.getElementById('btn-negoc-cancel');
  const btnClose = document.getElementById('negociacao-close');

  if (!modal) return;

  btnNao.onclick = () => {
    btnNao.classList.add('border-indigo-600', 'bg-indigo-50', 'text-indigo-700');
    btnSim.classList.remove('border-indigo-600', 'bg-indigo-50', 'text-indigo-700');
    btnSim.classList.add('border-gray-200', 'bg-white', 'text-gray-700');
    inputWrap.classList.add('hidden');
    currentNegotiation.useCustom = false;
    btnConfirm.disabled = false;
  };

  btnSim.onclick = () => {
    btnSim.classList.add('border-indigo-600', 'bg-indigo-50', 'text-indigo-700');
    btnNao.classList.remove('border-indigo-600', 'bg-indigo-50', 'text-indigo-700');
    btnNao.classList.add('border-gray-200', 'bg-white', 'text-gray-700');
    inputWrap.classList.remove('hidden');
    currentNegotiation.useCustom = true;
    checkConfirm();
  };

  const checkConfirm = () => {
    if (currentNegotiation.useCustom) {
      const val = parseFloat(inputFinal.value);
      btnConfirm.disabled = isNaN(val) || val <= 0;
    } else {
      btnConfirm.disabled = false;
    }
  };

  inputFinal.oninput = checkConfirm;

  const close = () => {
    modal.classList.add('hidden');
    if (currentNegotiation && currentNegotiation.onCancel) currentNegotiation.onCancel();
  };

  btnCancel.onclick = close;
  btnClose.onclick = close;

  btnConfirm.onclick = async () => {
    const finalPrice = currentNegotiation.useCustom ? parseFloat(inputFinal.value) : null;
    modal.classList.add('hidden');
    if (currentNegotiation.onConfirm) await currentNegotiation.onConfirm(finalPrice);
  };
}

export function showNegotiationModal(pedidoId, currentTotal, onConfirm, onCancel) {
  currentNegotiation = { pedidoId, currentTotal, onConfirm, onCancel, useCustom: false };
  const modal = document.getElementById('modal-negociacao');
  const inputFinal = document.getElementById('input-final-price');
  const inputWrap = document.getElementById('input-negoc-wrap');
  
  if (!modal) return;

  inputFinal.value = currentTotal;
  inputWrap.classList.add('hidden');
  document.getElementById('btn-negoc-nao').click();
  
  modal.classList.remove('hidden');
}
