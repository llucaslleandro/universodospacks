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
    } else if (action === 'pedidos') {
      result.data = getPedidos();
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
  
  if (action === 'atualizarstatus') {
    try {
      var payload = {};
      if (e.postData && e.postData.contents) payload = JSON.parse(e.postData.contents);
      if (!payload.pedido_id || !payload.status) throw new Error('ID ou Status não fornecidos.');
      
      var res = atualizarStatusPedido(payload.pedido_id, payload.status);
      return buildResponse({ ok: true, rowsUpdated: res });
    } catch (err) {
      return buildResponse({ ok: false, error: err.toString() });
    }
  }

  if (action === 'salvar_estoque') {
    try {
      var payload = {};
      if (e.postData && e.postData.contents) payload = JSON.parse(e.postData.contents);
      if (!payload.estoque_updates || !Array.isArray(payload.estoque_updates)) throw new Error('Atualizações de estoque inválidas.');
      
      var res = salvarEstoqueManualmente(payload.estoque_updates);
      return buildResponse({ ok: true, rowsUpdated: res });
    } catch (err) {
      return buildResponse({ ok: false, error: err.toString() });
    }
  }
  
  if (action !== 'pedido') {
    return buildResponse({ ok: false, error: 'Ação inválida. Use action=pedido, action=atualizarStatus ou action=salvar_estoque.' });
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
      sku: String(obj['sku'] || obj['id'] || ''),
      estoque: obj['estoque'] !== undefined && obj['estoque'] !== '' ? Number(obj['estoque']) : 0,
      estoque_minimo: obj['estoque_minimo'] !== undefined && obj['estoque_minimo'] !== '' ? Number(obj['estoque_minimo']) : 2,
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

function getPedidos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Pedidos');
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  var headers = rows[0].map(function(h) { return String(h).trim(); });
  var dataRows = rows.slice(1);

  return dataRows.map(function(r) {
    var obj = {};
    headers.forEach(function(h, idx) {
      // Cria uma chave limpa (ex: "ID do Pedido" vira "id_do_pedido", "Condição" mantem carateres)
      var key = h.toLowerCase().replace(/ /g, '_');
      obj[key] = r[idx];
    });
    return obj;
  });
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
    sheet.appendRow(['Data', 'ID do Pedido', 'Group ID', 'Marca', 'Produto', 'Armazenamento', 'Cor', 'Condição', 'Quantidade', 'Total', 'Status', 'SKU', 'Estoque Processado']);
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0].map(function(h) { return String(h).trim().toLowerCase(); });

  // Ensure SKU and Estoque Processado columns exist
  var skuCol = headers.indexOf('sku');
  if (skuCol === -1) {
    skuCol = headers.length;
    sheet.getRange(1, skuCol + 1).setValue('SKU');
    headers.push('sku');
  }
  var epCol = headers.indexOf('estoque processado');
  if (epCol === -1) {
    epCol = headers.length;
    sheet.getRange(1, epCol + 1).setValue('Estoque Processado');
    headers.push('estoque processado');
  }

  var pedidoId = 'PED-' + new Date().getTime();
  var dataHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  if (pedido.itens && pedido.itens.length > 0) {
    pedido.itens.forEach(function(item) {
      var totalItem = Number(item.preco || 0) * Number(item.quantidade || 0);
      var rowData = new Array(headers.length);
      for(var i=0; i<headers.length; i++) rowData[i] = '';
      
      var mapHeader = function(hName, val) {
        var idx = headers.indexOf(hName.toLowerCase());
        if (idx !== -1) rowData[idx] = val;
      };

      mapHeader('data', dataHora);
      mapHeader('id do pedido', pedidoId);
      mapHeader('group id', item.group_id || '');
      mapHeader('marca', item.marca || '');
      mapHeader('produto', item.nome || '');
      mapHeader('armazenamento', item.armazenamento || '');
      mapHeader('cor', item.cor || '');
      mapHeader('condição', item.condicao || '');
      mapHeader('quantidade', item.quantidade || 1);
      mapHeader('total', totalItem);
      mapHeader('status', 'Pendente');
      mapHeader('sku', item.sku || '');
      mapHeader('estoque processado', '');

      sheet.appendRow(rowData);
    });
  } else {
      var rowData = new Array(headers.length);
      for(var i=0; i<headers.length; i++) rowData[i] = '';
      var idxId = headers.indexOf('id do pedido'); if(idxId !== -1) rowData[idxId] = pedidoId;
      var idxData = headers.indexOf('data'); if(idxData !== -1) rowData[idxData] = dataHora;
      var idxProd = headers.indexOf('produto'); if(idxProd !== -1) rowData[idxProd] = 'Pedido Vazio';
      var idxTotal = headers.indexOf('total'); if(idxTotal !== -1) rowData[idxTotal] = Number(pedido.total || 0);
      var idxStatus = headers.indexOf('status'); if(idxStatus !== -1) rowData[idxStatus] = 'Pendente';
      sheet.appendRow(rowData);
  }

  return { pedido_id: pedidoId };
}

function atualizarStatusPedido(pedidoId, novoStatus) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Pedidos');
  var prodSheet = ss.getSheetByName('Produtos');
  if (!sheet) throw new Error('Aba Pedidos não encontrada.');

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return 0;
  
  var headers = rows[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var idColIdx = headers.indexOf('id do pedido');
  var statusColIdx = headers.indexOf('status');
  var skuColIdx = headers.indexOf('sku');
  var estProcColIdx = headers.indexOf('estoque processado');
  var qtdColIdx = headers.indexOf('quantidade');
  
  if (idColIdx === -1) throw new Error('Coluna "ID do Pedido" não encontrada.');
  
  // Se coluna status não existir, crie
  if (statusColIdx === -1) {
    statusColIdx = headers.length;
    sheet.getRange(1, statusColIdx + 1).setValue('Status');
    headers.push('status');
  }
  // Se não existir estoque_processado
  if (estProcColIdx === -1) {
    estProcColIdx = headers.length;
    sheet.getRange(1, estProcColIdx + 1).setValue('Estoque Processado');
    headers.push('estoque processado');
  }

  var updatedCount = 0;
  
  // Lógica de Estoque: Precisamos pegar ranges e values de Produtos
  var prodRows = [], prodHeaders = [], pSkuColIdx = -1, pEstoqueColIdx = -1, pIdColIdx = -1;
  if (prodSheet) {
    prodRows = prodSheet.getDataRange().getValues();
    if (prodRows.length > 0) {
      prodHeaders = prodRows[0].map(function(h) { return String(h).trim().toLowerCase(); });
      pSkuColIdx = prodHeaders.indexOf('sku');
      pEstoqueColIdx = prodHeaders.indexOf('estoque');
      pIdColIdx = prodHeaders.indexOf('id');
    }
  }

  var safeUpdateEstoque = function(sku, deltaQtd) {
    if (!prodSheet || pEstoqueColIdx === -1) return;
    for (var j = 1; j < prodRows.length; j++) {
      var rowSku = pSkuColIdx !== -1 ? String(prodRows[j][pSkuColIdx]) : '';
      var rowId = pIdColIdx !== -1 ? String(prodRows[j][pIdColIdx]) : '';
      if ((rowSku !== '' && rowSku === String(sku)) || (rowSku === '' && rowId === String(sku)) || (rowId === String(sku))) {
        var currentStock = Number(prodRows[j][pEstoqueColIdx]) || 0;
        var newStock = currentStock + deltaQtd;
        prodSheet.getRange(j + 1, pEstoqueColIdx + 1).setValue(newStock);
        prodRows[j][pEstoqueColIdx] = newStock; // update local cache
        break;
      }
    }
  };

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][idColIdx]) === String(pedidoId)) {
      var oldStatus = rows[i][statusColIdx];
      var estProc = estProcColIdx !== -1 ? rows[i][estProcColIdx] : '';
      var sku = skuColIdx !== -1 ? rows[i][skuColIdx] : '';
      var qtd = qtdColIdx !== -1 ? Number(rows[i][qtdColIdx] || 1) : 1;
      
      sheet.getRange(i + 1, statusColIdx + 1).setValue(novoStatus);
      rows[i][statusColIdx] = novoStatus;
      
      // Regra de Estoque
      if (novoStatus === 'Fechado' && estProc !== 'SIM' && sku) {
        safeUpdateEstoque(sku, -qtd);
        sheet.getRange(i + 1, estProcColIdx + 1).setValue('SIM');
        rows[i][estProcColIdx] = 'SIM';
      } else if ((novoStatus === 'Cancelado' || novoStatus === 'Pendente') && estProc === 'SIM' && sku) {
        safeUpdateEstoque(sku, qtd);
        sheet.getRange(i + 1, estProcColIdx + 1).setValue('ESTORNADO');
        rows[i][estProcColIdx] = 'ESTORNADO';
      }

      updatedCount++;
    }
  }
  return updatedCount;
}

function salvarEstoqueManualmente(updates) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Produtos');
  if (!sheet) throw new Error('Aba Produtos não encontrada.');

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return 0;

  var headers = rows[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var skuCol = headers.indexOf('sku');
  var idCol = headers.indexOf('id');
  var estoqueCol = headers.indexOf('estoque');
  var minCol = headers.indexOf('estoque_minimo');

  if (skuCol === -1 && idCol === -1) throw new Error('Colunas SKU e ID não encontradas.');
  
  if (estoqueCol === -1) {
    estoqueCol = headers.length;
    sheet.getRange(1, estoqueCol + 1).setValue('Estoque');
    headers.push('estoque');
  }
  if (minCol === -1) {
    minCol = headers.length;
    sheet.getRange(1, minCol + 1).setValue('Estoque Mínimo');
    headers.push('estoque_minimo');
  }

  var updatedCount = 0;
  var updateMap = {};
  updates.forEach(function(u) {
    if (u.sku) updateMap[String(u.sku)] = u;
  });

  for (var i = 1; i < rows.length; i++) {
    var rowSku = skuCol !== -1 ? String(rows[i][skuCol]) : '';
    var rowId = idCol !== -1 ? String(rows[i][idCol]) : '';
    var searchKey = rowSku !== '' ? rowSku : rowId;
    
    if (updateMap[searchKey] || updateMap[rowId]) {
      var u = updateMap[searchKey] || updateMap[rowId];
      if (u.estoque !== undefined) sheet.getRange(i + 1, estoqueCol + 1).setValue(u.estoque);
      if (u.estoque_minimo !== undefined) sheet.getRange(i + 1, minCol + 1).setValue(u.estoque_minimo);
      updatedCount++;
    }
  }

  return updatedCount;
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
