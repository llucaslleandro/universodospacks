function atualizarBadge() {
  const quantidadeTotal = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
  elements.cartBadge.textContent = quantidadeTotal;

  if (quantidadeTotal > 0) {
    elements.cartBadge.classList.remove('hidden');
  } else {
    elements.cartBadge.classList.add('hidden');
  }
}

function salvarCarrinhoLocalStorage() {
  localStorage.setItem(CARRINHO_KEY, JSON.stringify(carrinho));
}

function carregarCarrinhoLocalStorage() {
  const json = localStorage.getItem(CARRINHO_KEY);
  if (json) {
    try { carrinho = JSON.parse(json); } catch (e) { carrinho = []; }
  } else {
    carrinho = [];
  }
  atualizarBadge();
}

function calcularTotal() {
  return carrinho.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
}

function calcularTotalAncorado() {
  return carrinho.reduce((acc, item) => acc + (item.preco + 250) * item.quantidade, 0);
}

function renderCarrinho() {
  elements.cartItems.innerHTML = '';
  if (!carrinho.length) {
    elements.cartItems.innerHTML = '<li class="text-slate-500">Carrinho vazio. Adicione produtos.</li>';
    elements.totalValue.textContent = formatarMoedaBRL(0);
    if (elements.installmentValue) elements.installmentValue.textContent = '';
    hideElement(elements.checkoutForm);
    return;
  }

  carrinho.forEach(item => {
    const subtotal = item.preco * item.quantidade;
    const imageSrc = item.imagem || (produtos.find(p => String(p.id) === String(item.id))?.imagem) || 'https://via.placeholder.com/150';
    const li = document.createElement('li');
    li.className = 'bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-3';
    li.innerHTML = `
      <div class="flex gap-3">
        <div class="w-16 h-16 bg-white border border-gray-100 rounded-md flex items-center justify-center shrink-0 overflow-hidden">
          <img src="${imageSrc}" alt="${item.nome}" class="w-full h-full object-contain">
        </div>
        <div class="flex flex-col flex-1 min-w-0">
          <div class="flex justify-between items-start gap-2">
            <h4 class="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">${item.nome}</h4>
            <button class="text-red-500 text-xs font-semibold hover:text-red-700 remove-item shrink-0" data-id="${item.id}">Remover</button>
          </div>
          <p class="text-gray-500 text-xs mt-1 mb-2">${formatarMoedaBRL(item.preco)}</p>
          
          <div class="flex items-center justify-between mt-auto">
            <div class="flex items-center gap-2">
              <button class="px-2 py-1 min-w-[28px] border border-gray-300 rounded hover:bg-gray-100 text-sm font-medium quantity-minus" data-id="${item.id}">−</button>
              <span class="font-semibold text-sm w-6 text-center" id="qtd-${item.id}">${item.quantidade}</span>
              <button class="px-2 py-1 min-w-[28px] border border-gray-300 rounded hover:bg-gray-100 text-sm font-medium quantity-plus" data-id="${item.id}">+</button>
            </div>
            <p class="text-right font-semibold text-gray-900">${formatarMoedaBRL(subtotal)}</p>
          </div>
        </div>
      </div>
    `;
    elements.cartItems.appendChild(li);
  });

  elements.totalValue.textContent = formatarMoedaBRL(calcularTotal());
  const totalAncorado = calcularTotalAncorado();
  if (elements.installmentValue) {
    if (carrinho.length > 0) {
      elements.installmentValue.textContent = `ou 10x de ${formatarMoedaBRL(totalAncorado / 10)}`;
    } else {
      elements.installmentValue.textContent = '';
    }
  }

  showElement(elements.checkoutForm);
}

function adicionarAoCarrinho(produtoId) {
  const produto = produtos.find(p => p.id === produtoId);
  if (!produto || !produto.ativo) return;

  // Contar cliques e persistir
  produtoClicks[produtoId] = (produtoClicks[produtoId] || 0) + 1;
  salvarClicksLocalStorage();
  registrarClickApi(produtoId);

  const item = carrinho.find(i => i.id === produto.id);
  if (item) {
    item.quantidade += 1;
    item.imagem = produto.imagem;
  } else {
    carrinho.push({ id: produto.id, nome: produto.nome, preco: Number(produto.preco), quantidade: 1, imagem: produto.imagem });
  }

  salvarCarrinhoLocalStorage();
  renderCarrinho();
  atualizarBadge();
  setMessage('success', `Produto "${produto.nome}" adicionado ao carrinho.`);
  openCart();
}

function removerDoCarrinho(produtoId) {
  carrinho = carrinho.filter(i => i.id !== produtoId);
  salvarCarrinhoLocalStorage();
  renderCarrinho();
  atualizarBadge();
}

function ajustarQuantidade(produtoId, delta) {
  const item = carrinho.find(i => i.id === produtoId);
  if (!item) return;
  item.quantidade += delta;
  if (item.quantidade <= 0) {
    removerDoCarrinho(produtoId);
    return;
  }
  salvarCarrinhoLocalStorage();
  renderCarrinho();
  atualizarBadge();
}

function limparCarrinho() {
  carrinho = [];
  salvarCarrinhoLocalStorage();
  renderCarrinho();
  atualizarBadge();
  setMessage('warning', 'Carrinho limpo.');
}

async function finalizarPedido() {
  if (!carrinho.length) {
    setMessage('error', 'Carrinho vazio. Adicione produtos antes de finalizar.');
    return;
  }

  const pedidoObj = {
    itens: carrinho.map(item => {
      const produto = produtos.find(p => String(p.id) === String(item.id)) || item;
      return {
        nome: produto.nome || item.nome,
        marca: produto.categoria || 'N/A',
        armazenamento: produto.armazenamento || 'N/A',
        cor: produto.cor || 'N/A',
        condicao: produto.condicao || 'N/A',
        quantidade: item.quantidade,
        preco: item.preco
      };
    }),
    total: calcularTotal()
  };

  // Registrar pedido no backend sem bloquear a UI
  enviarPedidoApi(pedidoObj).catch(err => console.error('Erro ao registrar pedido:', err));

  const itensFormatados = carrinho.map(item => {
    const produto = produtos.find(p => String(p.id) === String(item.id)) || item;
    const nome = produto.nome || item.nome;
    const cor = produto.cor ? ` - ${produto.cor}` : '';
    const armaz = produto.armazenamento || 'N/A';
    const cond = produto.condicao || 'N/A';
    return `*${nome}${cor}*\n* *${armaz}*\n* *${cond}*`;
  }).join('\n\n');

  let mensagem;
  if (carrinho.length === 1) {
    mensagem = `Olá! Tenho interesse no produto:\n\n${itensFormatados}\n\nPodemos conversar sobre preço e disponibilidade?`;
  } else {
    mensagem = `Olá! Tenho interesse nos seguintes produtos:\n\n${itensFormatados}\n\nPodemos conversar sobre preço e disponibilidade?`;
  }

  const urlWhatsApp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;
  window.open(urlWhatsApp, '_blank');

  setMessage('success', 'A mensagem do pedido foi aberta no WhatsApp.');
}

function comprarViaWhatsApp(produtoId) {
  const produto = produtos.find(p => p.id === produtoId);
  if (!produto || !produto.ativo) return;

  // Adicionar ao carrinho
  adicionarAoCarrinho(produtoId);

  const pedidoObj = {
    itens: [{
      nome: produto.nome,
      marca: produto.categoria || 'N/A',
      armazenamento: produto.armazenamento || 'N/A',
      cor: produto.cor || 'N/A',
      condicao: produto.condicao || 'N/A',
      quantidade: 1,
      preco: Number(produto.preco)
    }],
    total: Number(produto.preco)
  };

  // Registrar pedido no backend sem bloquear a UI
  enviarPedidoApi(pedidoObj).catch(err => console.error('Erro ao registrar pedido:', err));

  // Abrir WhatsApp com mensagem estruturada
  const cor = produto.cor ? ` - ${produto.cor}` : '';
  const armaz = produto.armazenamento || 'N/A';
  const cond = produto.condicao || 'N/A';

  const mensagem = `Olá! Tenho interesse no produto:\n\n${produto.nome}${cor}\n* ${armaz}\n* ${cond}\n\nPodemos conversar sobre preço e disponibilidade?`;
  const urlWhatsApp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;
  window.open(urlWhatsApp, '_blank');
}
