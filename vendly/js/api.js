function registrarClickApi(produtoId) {
  // Enviar click ao backend via GET (fire-and-forget, sem bloquear a UI)
  fetch(`${API_BASE_URL}?action=click&produtoId=${encodeURIComponent(produtoId)}`)
    .catch(() => { }); // Silenciar erros de rede
}

async function enviarPedidoApi(pedido) {
  try {
    const url = `${API_BASE_URL}?action=pedido`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(pedido)
    });

    if (!response.ok) throw new Error('Erro ao enviar pedido para a API.');

    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Serviço retornou erro.');

    return result;
  } catch (err) {
    throw new Error(err.message || 'Falha na API de pedidos.');
  }
}

async function fetchProdutos() {
  // 1. Tentar renderizar do cache imediatamente
  const cache = carregarCacheProdutos();
  if (cache && Array.isArray(cache)) {
    hideElement(elements.loading);
    aplicarProdutos(cache, true);
    aplicarEventos();

    // Se cache ainda é válido, não precisa buscar da API
    if (cacheValido()) return;
  } else {
    // Sem cache: mostrar skeleton
    showElement(elements.loading);
  }

  // 2. Buscar dados frescos da API em background
  try {
    hideElement(elements.errorMessage);
    hideElement(elements.emptyMessage);

    const response = await fetch(`${API_BASE_URL}?action=produtos`);
    if (!response.ok) throw new Error('Falha ao buscar produtos do servidor.');

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Erro na resposta do servidor.');
    if (!Array.isArray(data.data)) throw new Error('Formato de dados inesperado.');

    // Salvar no cache para próximas visitas
    salvarCacheProdutos(data.data);

    // Atualizar UI com dados frescos (com animação de fade-in)
    aplicarProdutos(data.data, !!cache);
    if (!cache) aplicarEventos(); // Eventos já foram aplicados se tinha cache
  } catch (err) {
    // Se tinha cache, manter os produtos exibidos
    if (!cache) {
      hideElement(elements.loading);
      setError(err.message || 'Erro desconhecido ao carregar os produtos.');
    }
  }
}
