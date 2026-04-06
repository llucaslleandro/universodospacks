function doGet(e) {
  var action = (e.parameter.action || '').toLowerCase();
  var result = {
    ok: false,
    data: null,
    error: ''
  };

  try {
    if (action === 'produtos') {
      result.data = getProdutos();
      result.ok = true;
      return buildResponse(result);
    } else if (action === 'click') {
      var produtoId = e.parameter.produtoId || '';
      var clickResult = registrarClick(produtoId);
      return buildResponse({ ok: true, clicks: clickResult.clicks });
    } else {
      return buildResponse({ ok: false, error: 'Ação inválida. Use action=produtos, action=click ou action=pedido.' });
    }
  } catch (err) {
    return buildResponse({ ok: false, error: err.toString() });
  }
}

function doPost(e) {
  var action = (e.parameter.action || '').toLowerCase();
  if (action !== 'pedido') {
    return buildResponse({ ok: false, error: 'Ação inválida. Use action=pedido.' });
  }

  try {
    var payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      return buildResponse({ ok: false, error: 'Corpo do pedido não encontrado.' });
    }

    var pedido = salvarPedido(payload);
    return buildResponse({ ok: true, pedido_id: pedido.pedido_id });
  } catch (err) {
    return buildResponse({ ok: false, error: err.toString() });
  }
}

function getProdutos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Produtos');
  if (!sheet) throw new Error('Aba Produtos não encontrada.');

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  var headers = rows[0].map(String);
  var dataRows = rows.slice(1);

  var itens = dataRows.map(function(r) {
    var obj = {};
    headers.forEach(function(h, idx) {
      obj[h.trim().toLowerCase()] = r[idx];
    });
    return {
      id: String(obj['id'] || ''),
      grupo_id: String(obj['grupo_id'] || obj['id'] || ''),
      cor: String(obj['cor'] || ''),
      nome: String(obj['nome'] || ''),
      descricao: String(obj['descrição'] || obj['descricao'] || ''),
      categoria: String(obj['categoria'] || ''),
      preco: Number(obj['preço'] || obj['preco'] || 0),
      imagem: String(obj['imagem'] || ''),
      armazenamento: String(obj['armazenamento'] || ''),
      ram: String(obj['ram'] || ''),
      camera: String(obj['camera'] || ''),
      bateria: String(obj['bateria'] || ''),
      tela: String(obj['tela'] || ''),
      condicao: String(obj['condição'] || obj['condicao'] || ''),
      ativo: String(obj['ativo'] || '').toLowerCase() === 'true' || obj['ativo'] === true,
      clicks: Number(obj['clicks'] || 0)
    };
  });

  return itens.filter(function(item) { return item.ativo; });
}

function registrarClick(produtoId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Produtos');
  if (!sheet) throw new Error('Aba Produtos não encontrada.');

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h).trim().toLowerCase(); });

  var idCol = headers.indexOf('id');
  var clicksCol = headers.indexOf('clicks');

  // Se a coluna 'clicks' não existir, criar
  if (clicksCol === -1) {
    clicksCol = headers.length;
    sheet.getRange(1, clicksCol + 1).setValue('clicks');
    // Inicializar todas as linhas com 0
    for (var i = 1; i < rows.length; i++) {
      sheet.getRange(i + 1, clicksCol + 1).setValue(0);
    }
  }

  // Encontrar a linha do produto e incrementar
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === String(produtoId)) {
      var currentClicks = Number(sheet.getRange(i + 1, clicksCol + 1).getValue()) || 0;
      var newClicks = currentClicks + 1;
      sheet.getRange(i + 1, clicksCol + 1).setValue(newClicks);
      return { clicks: newClicks };
    }
  }

  throw new Error('Produto não encontrado: ' + produtoId);
}

function salvarPedido(pedido) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Pedidos');
  if (!sheet) {
    sheet = ss.insertSheet('Pedidos');
    sheet.appendRow(['Data', 'ID do Pedido', 'Marca', 'Produto', 'Armazenamento', 'Cor', 'Condição', 'Quantidade', 'Total']);
  }

  var pedidoId = 'PED-' + new Date().getTime();
  var dataHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  if (pedido.itens && pedido.itens.length > 0) {
    pedido.itens.forEach(function(item) {
      var totalItem = Number(item.preco || 0) * Number(item.quantidade || 0);
      sheet.appendRow([
        dataHora,
        pedidoId,
        item.marca || '',
        item.nome || '',
        item.armazenamento || '',
        item.cor || '',
        item.condicao || '',
        item.quantidade || 1,
        totalItem
      ]);
    });
  } else {
    // Fallback if no items (should not happen, but safe to have)
    sheet.appendRow([
      dataHora,
      pedidoId,
      '',
      'Pedido Vazio',
      '',
      '',
      '',
      0,
      Number(pedido.total || 0)
    ]);
  }

  return { pedido_id: pedidoId };
}

function buildResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}
