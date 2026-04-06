function renderCategorias() {
  const categorias = ['all', ...new Set(produtos.map(p => p.categoria).filter(Boolean))];
  elements.categorySelect.innerHTML = categorias
    .map(cat => `<option value="${cat}">${cat === 'all' ? 'Todas as categorias' : cat}</option>`)
    .join('');
}

function mapearProduto(item) {
  return {
    id: String(item.id),
    grupo_id: String(item.grupo_id || item.id || ''),
    cor: String(item.cor || ''),
    nome: String(item.nome || ''),
    descricao: String(item.descricao || ''),
    categoria: String(item.categoria || 'Sem categoria'),
    preco: Number(item.preco || 0),
    imagem: String(item.imagem || 'https://via.placeholder.com/400x250?text=Imagem'),
    armazenamento: String(item.armazenamento || ''),
    ram: String(item.ram || ''),
    camera: String(item.camera || ''),
    bateria: String(item.bateria || ''),
    tela: String(item.tela || ''),
    condicao: String(item.condicao || '').trim(),
    ativo: item.ativo === true || String(item.ativo).toLowerCase() === 'true',
    clicks: Number(item.clicks || 0)
  };
}

function aplicarProdutos(data, isFromCache = false) {
  produtos = data.map(mapearProduto);

  // Carregar contagem de cliques da API (fonte de verdade)
  produtos.forEach(p => {
    if (p.clicks > (produtoClicks[p.id] || 0)) {
      produtoClicks[p.id] = p.clicks;
    }
  });
  salvarClicksLocalStorage();

  const ativos = produtos.filter(p => p.ativo);
  if (!ativos.length) {
    hideElement(elements.loading);
    showElement(elements.emptyMessage);
    return;
  }

  hideElement(elements.loading);
  showElement(elements.productsGrid);
  renderCategorias();
  renderProdutos(ativos, !isFromCache); // Animação apenas quando vem da API
  renderCarrinho(); // Atualizar o carrinho para mostrar imagens carregadas
}

function renderProdutos(lista, useAnimation = false) {
  if (!lista.length) {
    elements.productsGrid.innerHTML = '<div class="col-span-full py-10 text-center text-gray-600">Nenhum celular encontrado.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  let index = 0;

  lista.forEach(produto => {
    const disabled = !produto.ativo;
    const isPopular = produtoClicks[produto.id] > 5;
    const specs = {
      armazenamento: produto.armazenamento || '128GB',
      ram: produto.ram || '4GB',
      camera: produto.camera || '12MP',
      bateria: produto.bateria || '4000mAh',
      tela: produto.tela || '6.5"'
    };

    const fullName = produto.categoria ? `${produto.categoria} - ${produto.nome}` : produto.nome;

    let h = 0;
    for (let i = 0; i < produto.id.length; i++) {
      h = ((h << 5) - h + produto.id.charCodeAt(i)) | 0;
      h = Math.imul(h, 2654435761);
    }
    const fakeSales = 5 + (Math.abs(h) % 20);
    const variantLabel = `🔥 ${fakeSales} vendidos`;

    let badge = '';
    if (isPopular) {
      badge = '<span class="absolute top-3 left-3 z-20 bg-yellow-400 text-gray-900 text-xs px-3 py-1 rounded-full font-semibold">★ Popular</span>';
    } else if (Number(produto.preco) < 2500) {
      badge = '<span class="absolute top-3 left-3 z-20 bg-green-400 text-gray-900 text-xs px-3 py-1 rounded-full font-semibold">✓ Melhor Preço</span>';
    } else if (produto.categoria === 'Apple') {
      badge = '<span class="absolute top-3 left-3 z-20 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold">Premium</span>';
    }

    const card = document.createElement('div');
    if (useAnimation) {
      card.style.opacity = '0';
      card.style.animationDelay = `${index * 60}ms`;
      card.classList.add('product-fade-in');
    }
    card.className += ' product-card bg-white rounded-2xl overflow-hidden border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer open-modal-wrap';
    card.setAttribute('data-id', produto.grupo_id);
    card.setAttribute('data-product-id', produto.id);

    let conditionBadge = '';
    if (produto.condicao && produto.condicao.toLowerCase() === 'novo') {
      conditionBadge = '<span class="absolute bottom-3 right-3 z-20 bg-green-100 text-green-800 border border-green-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md tracking-wider shadow-sm">Novo</span>';
    } else if (produto.condicao && produto.condicao.toLowerCase() === 'seminovo') {
      conditionBadge = '<span class="absolute bottom-3 right-3 z-20 bg-purple-100 text-purple-800 border border-purple-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md tracking-wider shadow-sm">Seminovo</span>';
    }

    card.innerHTML = `
      <div class="relative">
        <div class="aspect-square overflow-hidden bg-gray-50 flex items-center justify-center">
          <img src="${produto.imagem}" alt="${fullName}" class="w-4/5 h-4/5 object-contain" loading="lazy" decoding="async">
        </div>
        ${badge}
        ${conditionBadge}
        ${disabled ? '<div class="absolute inset-0 bg-white/60 flex items-center justify-center"><span class="text-sm font-semibold text-gray-600">Indisponível</span></div>' : ''}
      </div>
      <div class="p-6 space-y-4">
        <div>
          <h3 class="font-medium text-base text-gray-900 leading-snug">${fullName}</h3>
          ${variantLabel ? `<p class="text-xs text-gray-400 mt-1">${variantLabel}</p>` : ''}
          <div class="text-xs text-gray-500 space-y-1 mt-2">
            <p>💾 ${specs.armazenamento} • 🧠 ${specs.ram}</p>
            <p>📷 ${specs.camera} • 🔋 ${specs.bateria}</p>
          </div>
        </div>
        <div class="border-t border-gray-100 pt-4">
          <p class="text-sm text-gray-400 line-through mb-1">${formatarMoedaBRL(Number(produto.preco) + 250)}</p>
          <p class="text-2xl font-bold text-gray-900 mb-4">${formatarMoedaBRL(Number(produto.preco))}</p>
          <div class="flex flex-col gap-2">
            <button ${disabled ? 'disabled' : ''} class="w-full btn-solid py-3 rounded-lg font-semibold text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}">
              VER OPÇÕES
            </button>
            <button ${disabled ? 'disabled' : ''} class="compare-card-btn w-full py-2.5 rounded-lg transition text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}" data-grupo-id="${produto.grupo_id}" data-product-id="${produto.id}">
              ${comparacao.some(c => c.id === produto.id) ? '✓ Adicionado' : 'Comparar'}
            </button>
          </div>
        </div>
      </div>
    `;
    fragment.appendChild(card);
    index++;
  });

  elements.productsGrid.innerHTML = '';
  elements.productsGrid.appendChild(fragment);

  document.querySelectorAll('.open-modal-wrap').forEach(wrap => {
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.compare-card-btn')) return;
      const gId = wrap.getAttribute('data-id');
      const pId = wrap.getAttribute('data-product-id');
      openProductModal(gId, pId);
    });
  });

  document.querySelectorAll('.compare-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pId = btn.getAttribute('data-product-id');
      toggleComparacao(pId);
    });
  });
}

function filtrarProdutos() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const categoria = elements.categorySelect.value;
  const condition = elements.conditionSelect ? elements.conditionSelect.value : 'all';
  const sort = elements.sortSelect.value;

  let filtrados = produtos.filter(p => {
    if (!p.ativo) return false;
    const byCat = categoria === 'all' || p.categoria === categoria;
    const byCond = condition === 'all' || (p.condicao && p.condicao.toLowerCase() === condition.toLowerCase());
    const byText = p.nome.toLowerCase().includes(query) || p.descricao.toLowerCase().includes(query);
    return byCat && byCond && byText;
  });

  if (sort === 'price-low') {
    filtrados.sort((a, b) => Number(a.preco) - Number(b.preco));
  } else if (sort === 'price-high') {
    filtrados.sort((a, b) => Number(b.preco) - Number(a.preco));
  } else if (sort === 'popular') {
    filtrados.sort((a, b) => (produtoClicks[b.id] || 0) - (produtoClicks[a.id] || 0));
  }

  renderProdutos(filtrados);
}

// ===== Compare Logic =====
let compareToastTimer = null;

function toggleComparacao(produtoId) {
  const produto = produtos.find(p => p.id === produtoId);
  if (!produto) return;

  const index = comparacao.findIndex(c => c.id === produtoId);
  let wasAdded = false;
  if (index > -1) {
    comparacao.splice(index, 1);
  } else if (comparacao.length < 3) {
    comparacao.push(produto);
    wasAdded = true;
  } else {
    alert('Máximo 3 produtos para comparação.');
    return;
  }

  atualizarCompareButton();
  filtrarProdutos();

  if (wasAdded && comparacao.length > 0) {
    showCompareToast(produto);
  } else if (comparacao.length === 0) {
    hideCompareToast();
  } else {
    updateCompareToast();
  }
}

function showCompareToast(produto) {
  clearTimeout(compareToastTimer);
  let toast = document.getElementById('compare-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'compare-toast';
    document.body.appendChild(toast);
  }

  const thumbs = comparacao.map(p => `
    <div style="width:36px;height:36px;border-radius:8px;background:#f3f4f6;border:1px solid #e5e7eb;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
      <img src="${p.imagem}" style="width:100%;height:100%;object-fit:contain;" alt="${p.nome}">
    </div>
  `).join('');

  const slotsLeft = 3 - comparacao.length;
  const slotsText = slotsLeft > 0 ? `<span style="font-size:12px;color:#9ca3af;">${slotsLeft === 1 ? '+ 1 vaga' : `+ ${slotsLeft} vagas`}</span>` : '';

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
      <div style="display:flex;gap:6px;align-items:center;">
        ${thumbs}
        ${slotsLeft > 0 ? `<div style="width:36px;height:36px;border-radius:8px;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="color:#9ca3af;font-size:16px;">+</span></div>` : ''}
      </div>
      <div style="min-width:0;">
        <p style="font-size:13px;font-weight:600;color:#111827;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${comparacao.length} de 3 selecionados</p>
        ${slotsText}
      </div>
    </div>
    <button id="compare-toast-btn" style="background:#111827;color:white;border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background 0.2s;font-family:Inter,system-ui,sans-serif;">
      ${comparacao.length >= 2 ? 'Comparar Agora' : 'Comparar'}
    </button>
  `;

  toast.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 900;
    background: white;
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    transform: translateY(100%);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  `;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
    });
  });

  document.getElementById('compare-toast-btn').addEventListener('click', () => {
    if (comparacao.length >= 2) {
      renderComparacao();
      elements.compareModal.classList.remove('hidden');
      hideCompareToast();
    } else {
      const pModal = document.getElementById('product-modal');
      if (pModal && !pModal.classList.contains('hidden')) {
        pModal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    }
  });

  compareToastTimer = setTimeout(() => {
    hideCompareToast();
  }, 8000);
}

function updateCompareToast() {
  if (comparacao.length > 0 && document.getElementById('compare-toast')) {
    showCompareToast(null);
  }
}

function hideCompareToast() {
  const toast = document.getElementById('compare-toast');
  if (!toast) return;
  toast.style.transform = 'translateY(100%)';
  setTimeout(() => toast.remove(), 350);
}

function atualizarCompareButton() {
  elements.compareCount.textContent = comparacao.length;
  if (comparacao.length > 0) {
    elements.btnCompare.classList.remove('hidden');
  } else {
    elements.btnCompare.classList.add('hidden');
  }
}

function gerarInsightsComparacao() {
  if (comparacao.length < 2) return '';

  const insights = [];

  function encontrarMelhor(campo) {
    const valores = comparacao.map(p => extrairNumero(p[campo]));
    const maxVal = Math.max(...valores);
    if (maxVal <= 0) return null;
    const comMax = comparacao.filter((p, i) => valores[i] === maxVal);
    if (comMax.length === comparacao.length) return { empate: true, detail: comMax[0][campo] || '' };
    if (comMax.length > 1) return { empate: true, detail: comMax[0][campo] || '' };
    const idx = valores.indexOf(maxVal);
    return { produto: comparacao[idx], detail: comparacao[idx][campo] || '' };
  }

  function encontrarMelhorPreco() {
    const valores = comparacao.map(p => Number(p.preco)).filter(v => v > 0);
    if (!valores.length) return null;
    const minVal = Math.min(...valores);
    const comMin = comparacao.filter(p => Number(p.preco) === minVal);
    if (comMin.length === comparacao.length) return { empate: true, detail: formatarMoedaBRL(minVal) };
    if (comMin.length > 1) return { empate: true, detail: formatarMoedaBRL(minVal) };
    return { produto: comMin[0], detail: formatarMoedaBRL(minVal) };
  }

  const camera = encontrarMelhor('camera');
  if (camera) {
    if (camera.empate) {
      insights.push({ icon: '📸', label: 'Fotos', nome: 'Equivalente', detail: camera.detail, isEmpate: true });
    } else {
      insights.push({ icon: '📸', label: 'Melhor para fotos', nome: camera.produto.nome, detail: camera.detail });
    }
  }

  const bateria = encontrarMelhor('bateria');
  if (bateria) {
    if (bateria.empate) {
      insights.push({ icon: '🔋', label: 'Bateria', nome: 'Equivalente', detail: bateria.detail, isEmpate: true });
    } else {
      insights.push({ icon: '🔋', label: 'Melhor bateria', nome: bateria.produto.nome, detail: bateria.detail });
    }
  }

  const ram = encontrarMelhor('ram');
  if (ram) {
    if (ram.empate) {
      insights.push({ icon: '⚡', label: 'Desempenho', nome: 'Equivalente', detail: ram.detail, isEmpate: true });
    } else {
      insights.push({ icon: '⚡', label: 'Melhor desempenho', nome: ram.produto.nome, detail: ram.detail });
    }
  }

  const storage = encontrarMelhor('armazenamento');
  if (storage) {
    if (storage.empate) {
      insights.push({ icon: '💾', label: 'Armazenamento', nome: 'Equivalente', detail: storage.detail, isEmpate: true });
    } else {
      insights.push({ icon: '💾', label: 'Maior armazenamento', nome: storage.produto.nome, detail: storage.detail });
    }
  }

  const preco = encontrarMelhorPreco();
  if (preco) {
    if (preco.empate) {
      insights.push({ icon: '💰', label: 'Preço', nome: 'Equivalente', detail: preco.detail, isEmpate: true });
    } else {
      insights.push({ icon: '💰', label: 'Melhor preço', nome: preco.produto.nome, detail: preco.detail });
    }
  }

  if (!insights.length) return '';

  let html = '<div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin-bottom:24px;">';
  html += '<h4 style="font-size:16px; font-weight:700; color:#111827; margin:0 0 16px 0; display:flex; align-items:center; gap:8px;">🏆 Resumo Inteligente</h4>';
  html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">';

  insights.forEach(item => {
    const nameColor = item.isEmpate ? '#6b7280' : '#111827';
    const nameWeight = item.isEmpate ? '600' : '700';
    html += `<div style="background:white; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; transition:box-shadow 0.2s ease;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <span style="font-size:20px; line-height:1;">${item.icon}</span>
        <span style="font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em;">${item.label}</span>
      </div>
      <p style="font-size:14px; font-weight:${nameWeight}; color:${nameColor}; margin:0; line-height:1.4;">${item.nome}</p>
      <p style="font-size:12px; color:#9ca3af; margin:4px 0 0 0;">${item.detail}</p>
    </div>`;
  });

  html += '</div></div>';
  return html;
}

function renderComparacao() {
  if (!comparacao.length) {
    elements.compareContent.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <p style="font-size:48px;margin-bottom:16px;">📊</p>
        <p style="color:#6b7280;font-size:15px;margin-bottom:24px;">Nenhum produto selecionado para comparação.</p>
        <button onclick="fecharCompareEVoltar()" style="background:#111827;color:white;border:none;border-radius:10px;padding:12px 28px;font-size:14px;font-weight:600;cursor:pointer;font-family:Inter,system-ui,sans-serif;transition:background 0.2s;"
          onmouseover="this.style.background='#374151'" onmouseout="this.style.background='#111827'">Escolher Produtos</button>
      </div>`;
    return;
  }

  const slotsLeft = 3 - comparacao.length;
  let html = gerarInsightsComparacao();

  const specLabels = {
    nome: 'Nome',
    preco: 'Preço',
    armazenamento: 'Armazenamento',
    ram: 'RAM',
    camera: 'Câmera',
    bateria: 'Bateria',
    tela: 'Tela'
  };
  const specs = Object.keys(specLabels);

  const winners = {};
  specs.forEach(spec => {
    if (spec === 'nome') return;
    const valores = comparacao.map(p => {
      if (spec === 'preco') return Number(p.preco);
      return extrairNumero(p[spec]);
    });

    let bestVal, bestIdx;
    if (spec === 'preco') {
      bestVal = Math.min(...valores.filter(v => v > 0));
      if (!isFinite(bestVal)) return;
    } else {
      bestVal = Math.max(...valores);
      if (bestVal <= 0) return;
    }

    const comMelhor = valores.filter(v => v === bestVal);
    if (comMelhor.length > 1) return;

    bestIdx = valores.indexOf(bestVal);
    if (bestIdx >= 0) winners[spec] = bestIdx;
  });

  html += `
    <div style="display:flex; justify-content:flex-end; margin-bottom: 16px;">
      <button onclick="limparComparacao()" style="background:#fee2e2; color:#ef4444; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; border:none; cursor:pointer; transition:all 0.2s; font-family:Inter,system-ui,sans-serif;" 
        onmouseover="this.style.background='#f87171';this.style.color='white';" onmouseout="this.style.background='#fee2e2';this.style.color='#ef4444';">
        <i class="fa-solid fa-trash-can" style="margin-right: 6px;"></i> Limpar Comparação
      </button>
    </div>
  `;

  html += '<div class="overflow-x-auto"><table style="width:100%; font-size:14px; border-collapse:separate; border-spacing:0; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">';
  html += '<thead><tr style="background:#f9fafb;">';
  html += '<th style="padding:12px 16px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb;">Spec</th>';
  comparacao.forEach(p => {
    html += `<th style="padding:12px 16px; text-align:center; border-bottom:1px solid #e5e7eb; position:relative;">
      <button onclick="removerDaComparacao('${p.id}')" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:#9ca3af;font-size:16px;transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#9ca3af'" title="Remover produto">✕</button>
      <img src="${p.imagem}" style="width:56px; height:56px; object-fit:contain; margin:0 auto 6px;" alt="${p.nome}">
      <div style="font-size:13px; font-weight:600; color:#111827;">${p.nome}</div>
    </th>`;
  });
  for (let s = 0; s < slotsLeft; s++) {
    html += `<th style="padding:12px 16px; text-align:center; border-bottom:1px solid #e5e7eb; vertical-align:middle;">
      <div onclick="fecharCompareEVoltar()" style="cursor:pointer;margin:0 auto;width:56px;height:56px;border-radius:12px;border:2px dashed #d1d5db;display:flex;align-items:center;justify-content:center;margin-bottom:6px;transition:border-color 0.2s;" onmouseover="this.style.borderColor='#9ca3af'" onmouseout="this.style.borderColor='#d1d5db'">
        <span style="font-size:24px;color:#9ca3af;">+</span>
      </div>
      <div style="font-size:12px;color:#9ca3af;font-weight:500;">Adicionar</div>
    </th>`;
  }
  html += '</tr></thead><tbody>';

  let rowIndex = 0;
  specs.forEach(spec => {
    if (spec === 'nome') return;
    const rowBg = rowIndex % 2 === 0 ? 'background:white;' : 'background:#fafafa;';
    html += `<tr style="${rowBg}">`;
    html += `<td style="padding:10px 16px; font-weight:600; color:#374151; font-size:13px; border-bottom:1px solid #f3f4f6;">${specLabels[spec]}</td>`;
    comparacao.forEach((produto, i) => {
      let value = produto[spec] || 'N/A';
      if (spec === 'preco') value = formatarMoedaBRL(Number(value));
      const isWinner = winners[spec] === i;
      const winnerStyle = isWinner ? 'color:#059669; font-weight:700;' : 'color:#374151;';
      const badge = isWinner ? ' <span style="display:inline-block; background:#ecfdf5; color:#059669; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; margin-left:4px;">✓</span>' : '';
      html += `<td style="padding:10px 16px; text-align:center; border-bottom:1px solid #f3f4f6; font-size:13px; ${winnerStyle}">${value}${badge}</td>`;
    });
    for (let s = 0; s < slotsLeft; s++) {
      html += `<td style="padding:10px 16px; text-align:center; border-bottom:1px solid #f3f4f6; color:#d1d5db; font-size:13px;">—</td>`;
    }
    html += '</tr>';
    rowIndex++;
  });

  html += '<tr style="background:#f9fafb;">';
  html += '<td style="padding:14px 16px; font-weight:600; color:#374151; font-size:13px;">Ação</td>';
  comparacao.forEach(produto => {
    html += `<td style="padding:14px 16px; text-align:center;">
      <button style="background:#111827; color:white; padding:8px 20px; border-radius:8px; font-size:13px; font-weight:600; border:none; cursor:pointer; transition:background 0.2s;" 
        onmouseover="this.style.background='#374151'" onmouseout="this.style.background='#111827'"
        onclick="adicionarAoCarrinho('${produto.id}')">Eu Quero</button>
    </td>`;
  });
  for (let s = 0; s < slotsLeft; s++) {
    html += `<td style="padding:14px 16px; text-align:center;">
      <button onclick="fecharCompareEVoltar()" style="background:transparent; color:#6b7280; padding:8px 20px; border-radius:8px; font-size:13px; font-weight:600; border:1px solid #e5e7eb; cursor:pointer; transition:all 0.2s; font-family:Inter,system-ui,sans-serif;"
        onmouseover="this.style.background='#f3f4f6';this.style.borderColor='#d1d5db'" onmouseout="this.style.background='transparent';this.style.borderColor='#e5e7eb'">+ Adicionar</button>
    </td>`;
  }
  html += '</tr>';

  html += '</tbody></table></div>';
  elements.compareContent.innerHTML = html;
}

function fecharCompareEVoltar() {
  elements.compareModal.classList.add('hidden');
  const pModal = document.getElementById('product-modal');
  if (pModal && !pModal.classList.contains('hidden')) {
    pModal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  const grid = document.getElementById('products-grid');
  if (grid) {
    const headerOffset = 80;
    const pos = grid.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: pos - headerOffset, behavior: 'smooth' });
  }
}

function limparComparacao() {
  comparacao = [];
  atualizarCompareButton();
  filtrarProdutos();
  hideCompareToast();
  fecharCompareEVoltar();
}

function removerDaComparacao(produtoId) {
  const index = comparacao.findIndex(c => c.id === produtoId);
  if (index > -1) {
    comparacao.splice(index, 1);
    atualizarCompareButton();
    filtrarProdutos();

    if (comparacao.length > 0) {
      renderComparacao();
      updateCompareToast();
    } else {
      fecharCompareEVoltar();
      hideCompareToast();
    }
  }
}

// ===== Lógica do Modal de Produto =====
function openProductModal(grupoId, productId) {
  modalVariacoes = produtos.filter(p => p.grupo_id === grupoId && p.ativo);
  if (!modalVariacoes.length) return;

  const mModal = document.getElementById('product-modal');
  mModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const scrollArea = mModal.querySelector('.overflow-y-auto');
  if (scrollArea) scrollArea.scrollTop = 0;

  let baseVar = modalVariacoes[0];
  if (productId) {
    const clicked = modalVariacoes.find(v => v.id === productId);
    if (clicked) baseVar = clicked;
  }

  selColor = baseVar.cor;
  selStorage = baseVar.armazenamento;
  selCondition = baseVar.condicao;

  const uColors = getUniqueValues(modalVariacoes, 'cor');
  const uStorages = getUniqueValues(modalVariacoes, 'armazenamento');
  const uConditions = getUniqueValues(modalVariacoes, 'condicao');

  const cDiv = document.getElementById('pm-color-section');
  const sDiv = document.getElementById('pm-storage-section');
  const condDiv = document.getElementById('pm-condition-section');

  cDiv.classList.toggle('hidden', uColors.length < 1);
  sDiv.classList.toggle('hidden', uStorages.length < 1);
  condDiv.classList.toggle('hidden', uConditions.length < 1);

  renderModalOptions('pm-colors', uColors, selColor, (val) => { selColor = val; updateModalSelection(); });
  renderModalOptions('pm-storages', uStorages, selStorage, (val) => { selStorage = val; updateModalSelection(); });
  renderModalOptions('pm-conditions', uConditions, selCondition, (val) => { selCondition = val; updateModalSelection(); });

  updateModalSelection();

  const oldBuy = document.getElementById('pm-buy-btn');
  const newBuy = oldBuy.cloneNode(true);
  oldBuy.parentNode.replaceChild(newBuy, oldBuy);
  newBuy.addEventListener('click', () => {
    if (currentTargetId) {
      adicionarAoCarrinho(currentTargetId);
      aplicarAnimacaoAdicao(newBuy);
    }
  });

  const oldCompare = document.getElementById('pm-compare-btn');
  const newCompare = oldCompare.cloneNode(true);
  oldCompare.parentNode.replaceChild(newCompare, oldCompare);
  newCompare.addEventListener('click', () => {
    if (currentTargetId) {
      toggleComparacao(currentTargetId);
      const isComp = comparacao.some(c => c.id === currentTargetId);
      newCompare.textContent = isComp ? '✓ Adicionado' : 'Comparar';
    }
  });

  const closeBtn = document.getElementById('close-product');
  closeBtn.onclick = () => {
    mModal.classList.add('hidden');
    document.body.style.overflow = '';
  };
}

function renderModalOptions(containerId, optionsList, selectedValue, onSelect, availableSet) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  optionsList.forEach(opt => {
    const btn = document.createElement('button');
    const isAvailable = !availableSet || availableSet.has(opt);
    const isSelected = opt === selectedValue;

    if (isAvailable) {
      btn.textContent = opt;
      btn.className = `px-4 py-2 border rounded-md text-sm font-medium transition ${isSelected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'}`;
    } else {
      btn.innerHTML = `<span class="opacity-60">${opt}</span> <span class="text-[10px] ml-0.5 opacity-40">✕</span>`;
      btn.className = 'px-4 py-2 border border-dashed border-gray-200 rounded-md text-sm font-medium bg-gray-50 text-gray-400 hover:border-gray-300 hover:bg-gray-100 transition';
      btn.title = `${opt} — clique para trocar`;
    }
    btn.onclick = () => onSelect(opt);
    container.appendChild(btn);
  });
}

function getAvailableForKey(key, otherFilters) {
  const available = new Set();
  modalVariacoes.forEach(v => {
    let matches = true;
    for (const [fKey, fVal] of Object.entries(otherFilters)) {
      if (fVal && v[fKey] !== fVal) {
        matches = false;
        break;
      }
    }
    if (matches && v[key]) available.add(v[key]);
  });
  return available;
}

function updateModalSelection() {
  const uColors = getUniqueValues(modalVariacoes, 'cor');
  const uStorages = getUniqueValues(modalVariacoes, 'armazenamento');
  const uConditions = getUniqueValues(modalVariacoes, 'condicao');

  const availColors = new Set(uColors);
  const availStorages = getAvailableForKey('armazenamento', { cor: selColor });

  if (selStorage && availStorages.size > 0 && !availStorages.has(selStorage)) {
    selStorage = [...availStorages][0];
  }

  const availConditions = getAvailableForKey('condicao', { cor: selColor, armazenamento: selStorage });

  if (selCondition && availConditions.size > 0 && !availConditions.has(selCondition)) {
    selCondition = [...availConditions][0];
  }

  const match = modalVariacoes.find(v =>
    (v.cor === selColor || (!v.cor && !selColor)) &&
    (v.armazenamento === selStorage || (!v.armazenamento && !selStorage)) &&
    (v.condicao === selCondition || (!v.condicao && !selCondition))
  );

  document.getElementById('pm-color-lbl').textContent = selColor || '';

  renderModalOptions('pm-colors', uColors, selColor, (val) => { selColor = val; updateModalSelection(); }, availColors);
  renderModalOptions('pm-storages', uStorages, selStorage, (val) => { selStorage = val; updateModalSelection(); }, availStorages);
  renderModalOptions('pm-conditions', uConditions, selCondition, (val) => { selCondition = val; updateModalSelection(); }, availConditions);

  document.getElementById('pm-color-section').classList.toggle('hidden', uColors.length < 1);
  document.getElementById('pm-storage-section').classList.toggle('hidden', uStorages.length < 1);
  document.getElementById('pm-condition-section').classList.toggle('hidden', uConditions.length < 1);

  const btnBuy = document.getElementById('pm-buy-btn');
  const btnComp = document.getElementById('pm-compare-btn');
  const statusMsg = document.getElementById('pm-status-msg');

  if (match) {
    currentTargetId = match.id;
    document.getElementById('pm-image').src = match.imagem;
    document.getElementById('pm-name').textContent = match.categoria ? `${match.categoria} - ${match.nome}` : match.nome;
    document.getElementById('pm-desc').textContent = match.descricao || '';
    document.getElementById('pm-price').textContent = formatarMoedaBRL(Number(match.preco));
    document.getElementById('pm-old-price').textContent = formatarMoedaBRL(Number(match.preco) + 250);

    btnBuy.disabled = false;
    btnBuy.classList.remove('opacity-50', 'cursor-not-allowed');
    btnComp.disabled = false;
    btnComp.classList.remove('opacity-50', 'cursor-not-allowed');
    statusMsg.classList.add('hidden');

    const isComp = comparacao.some(c => c.id === currentTargetId);
    btnComp.textContent = isComp ? '✓ Adicionado' : 'Comparar';
  } else {
    currentTargetId = '';
    btnBuy.disabled = true;
    btnBuy.classList.add('opacity-50', 'cursor-not-allowed');
    btnComp.disabled = true;
    btnComp.classList.add('opacity-50', 'cursor-not-allowed');
    statusMsg.classList.remove('hidden');

    if (modalVariacoes[0]) {
      document.getElementById('pm-image').src = modalVariacoes[0].imagem;
      document.getElementById('pm-name').textContent = modalVariacoes[0].nome;
      document.getElementById('pm-price').textContent = '----------';
      document.getElementById('pm-old-price').textContent = '';
    }
  }
}
