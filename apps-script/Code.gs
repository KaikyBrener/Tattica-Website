/**
 * Recebe os pedidos de orçamento do chat do site, grava na planilha
 * e avisa por e-mail. Campos enviados pelo chat (chat-config.js / chatbot.js):
 * perfil, blocos, unidades, portaria, estrutura, local, assembleia,
 * nome, telefone, prioridade, consentimento, origem, criadoEm.
 */
const CONFIG = {
  NOME_ABA: 'Pedidos',
  EMAIL_DESTINO: 'comercial@exemplo.com.br', // troque pelo e-mail do Comercial
  FUSO_HORARIO: 'America/Sao_Paulo',
  NOME_ABA_METRICAS: 'Métricas',
  NOME_ABA_PAINEL: 'Painel',
  STATUS: ['Novo', 'Contatado', 'Proposta enviada', 'Fechado', 'Perdido'],
  // Expediente do Comercial (segunda a sexta) e prazo do lembrete, em horas úteis sem contato
  HORARIO: { inicio: 8, fim: 18 },
  LEMBRETE_HORAS: { 'Alta': 2, 'Média': 4, 'Normal': 8 },
  // Enquanto o status continuar "Novo", repete o lembrete a cada tantos minutos (dentro do expediente)
  LEMBRETE_REPETIR_MIN: 30,
  PASSOS_ORCAMENTO: ['perfil', 'blocos', 'unidades', 'portaria', 'estrutura', 'internet', 'interfone', 'local', 'assembleia', 'nome', 'telefone', 'autorizacao'],
  CABECALHOS: [
    'data_hora',
    'prioridade',
    'perfil',
    'nome',
    'telefone',
    'local',
    'blocos',
    'unidades',
    'portaria_hoje',
    'camera_ou_acesso',
    'assembleia',
    'origem',
    'consentimento',
    'link_whatsapp',
    'internet_fibra',
    'cabeamento_interfone',
    'pontos_a_avaliar',
    'status',
    'lembrete_enviado'
  ],
  CABECALHOS_METRICAS: ['data_hora', 'sessao', 'evento', 'detalhe']
};

/**
 * Endpoint GET para teste rápido no navegador
 */
function doGet(e) {
  return ContentService
    .createTextOutput('ok')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Endpoint POST que recebe os pedidos do chat
 */
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    if (!e || !e.postData || !e.postData.contents) {
      return responderJson({ ok: false, erro: 'corpo da requisicao vazio' });
    }

    let dados;
    try {
      dados = JSON.parse(e.postData.contents);
    } catch (err) {
      return responderJson({ ok: false, erro: 'json invalido' });
    }

    // Métricas anônimas do chat (sem nome nem telefone): vêm em lote
    if (dados.tipo === 'eventos') {
      return responderJson({ ok: true, gravados: gravarEventos(dados) });
    }

    // Honeypot: se um campo oculto "site" vier preenchido, ignora em silêncio
    if (dados.site && String(dados.site).trim() !== '') {
      return responderJson({ ok: true });
    }

    // Validação obrigatória: nome e telefone com DDD (10 ou 11 dígitos)
    const nome = limparValor(dados.nome);
    const telefone = limparValor(dados.telefone);
    const digitos = apenasDigitos(telefone);

    if (!nome || digitos.length < 10 || digitos.length > 13) {
      return responderJson({ ok: false, erro: 'dados incompletos' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = obterOuCriarAba(ss);

    // Usa o horário do servidor (mais confiável que o do navegador)
    const dataHora = Utilities.formatDate(
      new Date(),
      CONFIG.FUSO_HORARIO,
      'dd/MM/yyyy HH:mm:ss'
    );

    const prioridade = textoPuro(dados.prioridade) || 'Normal';
    const linkWhatsApp = montarLinkWhatsApp(nome, digitos);

    // Ordem exata das colunas em CONFIG.CABECALHOS
    const novaLinha = [
      new Date(),
      limparValor(prioridade),
      limparValor(dados.perfil),
      nome,
      telefone,
      limparValor(dados.local),
      limparValor(dados.blocos),
      limparValor(dados.unidades),
      limparValor(dados.portaria),
      limparValor(dados.estrutura),
      limparValor(dados.assembleia),
      limparValor(dados.origem),
      limparValor(dados.consentimento),
      linkWhatsApp,
      limparValor(dados.internet),
      limparValor(dados.interfone),
      limparValor(listaTexto(dados.pontos)),
      CONFIG.STATUS[0],
      ''
    ];

    sheet.appendRow(novaLinha);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    linkAmigavel(sheet, sheet.getLastRow(), linkWhatsApp);

    // O pedido já está salvo; uma falha no e-mail não deve derrubar a resposta
    try {
      enviarEmailPedido(dados, dataHora, prioridade, textoPuro(dados.nome), textoPuro(dados.telefone), linkWhatsApp);
    } catch (erroEmail) {
      Logger.log('Falha ao enviar e-mail: ' + erroEmail.message);
    }

    return responderJson({ ok: true });

  } catch (erro) {
    return responderJson({ ok: false, erro: erro.message || 'erro interno' });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/* =========================================================================
   MÉTRICAS ANÔNIMAS DO CHAT
   Recebe lotes de eventos (etapa do chat, clique em botão). Nunca recebe
   nome, telefone nem texto digitado. O "sessao" é um código aleatório que
   só vale enquanto a página fica aberta.
   ========================================================================= */
function gravarEventos(dados) {
  const lista = Array.isArray(dados.eventos) ? dados.eventos.slice(0, 40) : [];
  const linhas = [];
  lista.forEach(function (ev) {
    const evento = textoPuro(ev && ev.evento).slice(0, 40);
    if (!evento) return;
    const quando = ev.quando ? new Date(ev.quando) : new Date();
    linhas.push([
      isNaN(quando.getTime()) ? new Date() : quando,
      limparValor(textoPuro(dados.sessao).slice(0, 16)),
      limparValor(evento),
      limparValor(textoPuro(ev.detalhe).slice(0, 80))
    ]);
  });
  if (!linhas.length) return 0;
  const aba = obterOuCriarAbaMetricas(SpreadsheetApp.getActiveSpreadsheet());
  const inicio = aba.getLastRow() + 1;
  aba.getRange(inicio, 1, linhas.length, 4).setValues(linhas);
  aba.getRange(inicio, 1, linhas.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  return linhas.length;
}

function obterOuCriarAbaMetricas(ss) {
  let aba = ss.getSheetByName(CONFIG.NOME_ABA_METRICAS);
  if (!aba) {
    aba = ss.insertSheet(CONFIG.NOME_ABA_METRICAS);
  }
  if (aba.getLastRow() === 0) {
    aba.appendRow(CONFIG.CABECALHOS_METRICAS);
    try { formatarMetricas(aba); } catch (erro) { Logger.log('Visual das métricas não aplicado: ' + erro.message); }
  }
  return aba;
}

/** Visual da aba "Métricas": mesmo padrão da aba Pedidos */
function formatarMetricas(aba) {
  const n = CONFIG.CABECALHOS_METRICAS.length;
  const total = Math.max(aba.getMaxRows(), 2);
  const COR = { marinho: '#0f2140', zebra: '#f1f5fa', tinta: '#14233f' };
  [150, 110, 190, 340].forEach(function (l, i) { aba.setColumnWidth(i + 1, l); });
  aba.getRange(1, 1, total, n).setFontFamily('Arial').setFontSize(10).setFontColor(COR.tinta).setVerticalAlignment('middle');
  aba.getBandings().forEach(function (b) { b.remove(); });
  aba.getRange(1, 1, total, n).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)
    .setHeaderRowColor(COR.marinho).setFirstRowColor('#ffffff').setSecondRowColor(COR.zebra);
  aba.getRange(1, 1, 1, n).setBackground(COR.marinho).setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('left');
  aba.getRange(2, 1, total - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  aba.setRowHeight(1, 38);
  aba.setFrozenRows(1);
  const filtro = aba.getFilter();
  if (filtro) filtro.remove();
  aba.getRange(1, 1, Math.max(aba.getLastRow(), 2), n).createFilter();
}

/** Deixa as abas na ordem Painel, Pedidos, Métricas */
function organizarAbas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [CONFIG.NOME_ABA_METRICAS, CONFIG.NOME_ABA, CONFIG.NOME_ABA_PAINEL].forEach(function (nome) {
    const aba = ss.getSheetByName(nome);
    if (aba) { ss.setActiveSheet(aba); ss.moveActiveSheet(1); }
  });
}

/**
 * Esconde (sem apagar) as abas de versões antigas do chat, deixando só Painel, Pedidos e Métricas.
 * Para ver de novo: clique com o botão direito nas abas > "Mostrar planilhas ocultas".
 */
function ocultarAbasAntigas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usadas = [CONFIG.NOME_ABA, CONFIG.NOME_ABA_METRICAS, CONFIG.NOME_ABA_PAINEL];
  const ocultas = [];
  ss.getSheets().forEach(function (aba) {
    if (usadas.indexOf(aba.getName()) === -1 && !aba.isSheetHidden() && ss.getSheets().length > usadas.length) {
      aba.hideSheet();
      ocultas.push(aba.getName());
    }
  });
  Logger.log(ocultas.length ? 'Abas ocultadas: ' + ocultas.join(', ') : 'Nenhuma aba antiga encontrada.');
}

/** Formata tudo de uma vez: Pedidos, Métricas, Painel e ordem das abas */
function formatarTudo() {
  formatarPedidos();
  formatarMetricas(obterOuCriarAbaMetricas(SpreadsheetApp.getActiveSpreadsheet()));
  atualizarPainel();
  organizarAbas();
}

/* =========================================================================
   CONFIGURAÇÃO ÚNICA
   Rode "configurarTudo" uma vez no editor (e autorize). Ela atualiza o
   cabeçalho, cria a lista de status, monta o painel e liga o lembrete.
   ========================================================================= */
function configurarTudo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pedidos = obterOuCriarAba(ss);
  obterOuCriarAbaMetricas(ss);

  formatarPedidos();
  atualizarPainel();
  instalarGatilhos();
  Logger.log('Pronto: status, painel e lembrete configurados.');
}

function instalarGatilhos() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'verificarPedidosParados') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('verificarPedidosParados').timeBased().everyMinutes(30).create();
}

/* =========================================================================
   VISUAL DA ABA "PEDIDOS"
   Cabeçalho da marca, larguras, linhas alternadas, cores de prioridade e
   status, lista suspensa de status e link do WhatsApp curto ("Chamar no
   WhatsApp" no lugar do endereço enorme). Pode rodar de novo quando quiser.
   ========================================================================= */
function formatarPedidos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = obterOuCriarAba(ss);
  const n = CONFIG.CABECALHOS.length;
  const linhasTotal = Math.max(aba.getMaxRows(), 2);
  const COR = { marinho: '#0f2140', zebra: '#f1f5fa', tinta: '#14233f' };

  // Largura de cada coluna, na ordem de CONFIG.CABECALHOS
  const larguras = { data_hora: 140, prioridade: 90, perfil: 120, nome: 180, telefone: 130, local: 210, blocos: 80, unidades: 80,
    portaria_hoje: 220, camera_ou_acesso: 130, assembleia: 140, origem: 80, consentimento: 110, link_whatsapp: 160,
    internet_fibra: 150, cabeamento_interfone: 160, pontos_a_avaliar: 340, status: 150, lembrete_enviado: 150 };
  CONFIG.CABECALHOS.forEach(function (nome, i) { aba.setColumnWidth(i + 1, larguras[nome] || 120); });

  // Corpo: fonte, alinhamento e linhas alternadas
  aba.getRange(1, 1, linhasTotal, n).setFontFamily('Arial').setFontSize(10).setFontColor(COR.tinta).setVerticalAlignment('middle');
  aba.getBandings().forEach(function (b) { b.remove(); });
  aba.getRange(1, 1, linhasTotal, n).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)
    .setHeaderRowColor(COR.marinho).setFirstRowColor('#ffffff').setSecondRowColor(COR.zebra);

  // Cabeçalho
  aba.getRange(1, 1, 1, n).setBackground(COR.marinho).setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('left').setWrap(true).setVerticalAlignment('middle');
  aba.setRowHeight(1, 38);
  aba.setFrozenRows(1);
  aba.setFrozenColumns(4);

  // Filtro em todas as colunas
  const filtro = aba.getFilter();
  if (filtro) filtro.remove();
  aba.getRange(1, 1, Math.max(aba.getLastRow(), 2), n).createFilter();

  // Lista suspensa de status
  const colStatus = colunaPedidos('status');
  aba.getRange(2, colStatus, linhasTotal - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.STATUS, true).setAllowInvalid(false).build());

  // Cores por prioridade e por status
  const regras = [];
  const pinta = function (nome, texto, fundo, fonte, cor) {
    const faixa = aba.getRange(2, colunaPedidos(nome), linhasTotal - 1, 1);
    regras.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(texto)
      .setBackground(fundo).setFontColor(fonte).setBold(true).setRanges([faixa]).build());
  };
  pinta('prioridade', 'Alta', '#fee4e2', '#b42318');
  pinta('prioridade', 'Média', '#fef0c7', '#93370d');
  pinta('prioridade', 'Normal', '#f2f4f7', '#344054');
  pinta('status', 'Novo', '#fef0c7', '#93370d');
  pinta('status', 'Contatado', '#dbeafe', '#1849a9');
  pinta('status', 'Proposta enviada', '#e0e7ff', '#3538cd');
  pinta('status', 'Fechado', '#d1fadf', '#05603a');
  pinta('status', 'Perdido', '#f2f4f7', '#475467');
  aba.setConditionalFormatRules(regras);

  // Alturas e alinhamentos
  if (aba.getLastRow() > 1) {
    aba.setRowHeights(2, aba.getLastRow() - 1, 28);
  }
  ['prioridade', 'blocos', 'unidades', 'status'].forEach(function (nome) {
    aba.getRange(2, colunaPedidos(nome), linhasTotal - 1, 1).setHorizontalAlignment('center');
  });

  // Links longos do WhatsApp viram "Chamar no WhatsApp"
  const colLink = colunaPedidos('link_whatsapp');
  if (aba.getLastRow() > 1) {
    const faixaLink = aba.getRange(2, colLink, aba.getLastRow() - 1, 1);
    const valores = faixaLink.getValues();
    valores.forEach(function (v, i) {
      const url = String(v[0] || '');
      if (/^https:\/\/wa\.me\//.test(url)) linkAmigavel(aba, i + 2, url);
    });
  }
  aba.getRange(2, colLink, linhasTotal - 1, 1).setHorizontalAlignment('center');
}

/** Escreve "Chamar no WhatsApp" com o link por trás (nunca o endereço comprido) */
function linkAmigavel(aba, linha, url) {
  try {
    const rico = SpreadsheetApp.newRichTextValue().setText('Chamar no WhatsApp').setLinkUrl(url).build();
    aba.getRange(linha, colunaPedidos('link_whatsapp')).setRichTextValue(rico);
  } catch (erro) {
    Logger.log('Link não encurtado: ' + erro.message);
  }
}

/** Número da coluna (1, 2, 3...) de um cabeçalho da aba Pedidos */
function colunaPedidos(nome) {
  return CONFIG.CABECALHOS.indexOf(nome) + 1;
}

function letraColuna(n) {
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

/* =========================================================================
   LEMBRETE DE PEDIDO PARADO
   A cada 30 minutos, dentro do expediente, avisa por e-mail os pedidos
   ainda em "Novo" além do prazo (horas úteis: Alta 2h, Média 4h, Normal 8h).
   Enquanto o status for "Novo", o lembrete se repete a cada LEMBRETE_REPETIR_MIN minutos.
   A coluna lembrete_enviado guarda a data/hora do último aviso.
   ========================================================================= */
function verificarPedidosParados() {
  const agora = new Date();
  if (!dentroDoExpediente(agora)) return;

  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.NOME_ABA);
  if (!aba || aba.getLastRow() < 2) return;

  const total = aba.getLastRow() - 1;
  const valores = aba.getRange(2, 1, total, CONFIG.CABECALHOS.length).getValues();
  const iStatus = colunaPedidos('status') - 1;
  const iAviso = colunaPedidos('lembrete_enviado') - 1;
  const iPrio = colunaPedidos('prioridade') - 1;
  const iNome = colunaPedidos('nome') - 1;
  const iTel = colunaPedidos('telefone') - 1;
  const iLocal = colunaPedidos('local') - 1;

  const parados = [];
  valores.forEach(function (linha, i) {
    if (String(linha[iStatus]).trim() !== CONFIG.STATUS[0]) return;
    const ultimo = paraData(linha[iAviso]);
    if (ultimo && (agora.getTime() - ultimo.getTime()) < (CONFIG.LEMBRETE_REPETIR_MIN - 5) * 60000) return;
    const criado = paraData(linha[0]);
    if (!criado) return;
    const prioridade = String(linha[iPrio] || 'Normal');
    const limite = CONFIG.LEMBRETE_HORAS[prioridade] || CONFIG.LEMBRETE_HORAS['Normal'];
    const horas = horasUteisEntre(criado, agora);
    if (horas >= limite) {
      parados.push({ linha: i + 2, prioridade: prioridade, nome: linha[iNome], telefone: linha[iTel], local: linha[iLocal], link: montarLinkWhatsApp(textoPuro(linha[iNome]), apenasDigitos(linha[iTel])), horas: horas });
    }
  });
  if (!parados.length) return;

  parados.sort(function (a, b) { return b.horas - a.horas; });
  const horasTxt = function (p) { return p.horas.toFixed(1).replace('.', ',') + ' h úteis'; };
  const texto = ['Pedidos ainda sem contato (status "Novo") além do prazo:', ''].concat(parados.map(function (p) {
    return '- [' + p.prioridade + '] ' + textoPuro(p.nome) + ', ' + textoPuro(p.telefone) + ', ' + textoPuro(p.local) +
      ' (' + horasTxt(p) + '). WhatsApp: ' + p.link;
  })).concat(['', 'Depois do contato, troque o status na planilha para parar os lembretes.']).join('\n');

  const cores = { 'Alta': '#c62828', 'Média': '#e08a00', 'Normal': '#0a6be0' };
  const cartoes = parados.map(function (p) {
    const cor = cores[p.prioridade] || cores['Normal'];
    return '<tr><td style="padding:0 0 12px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9e2ef;border-left:5px solid ' + cor + ';border-radius:8px;background:#ffffff"><tr><td style="padding:14px 16px">' +
      '<span style="display:inline-block;padding:2px 10px;border-radius:12px;background:' + cor + ';color:#ffffff;font-size:12px;font-weight:bold">' + escaparHtml(p.prioridade) + '</span> ' +
      '<span style="color:#5b6b85;font-size:12px">sem contato há ' + escaparHtml(horasTxt(p)) + '</span>' +
      '<div style="font-size:17px;font-weight:bold;color:#0f2140;margin:8px 0 2px">' + escaparHtml(textoPuro(p.nome)) + '</div>' +
      '<div style="font-size:14px;color:#14233f">' + escaparHtml(textoPuro(p.telefone)) + '</div>' +
      '<div style="font-size:14px;color:#5b6b85;margin-bottom:12px">' + escaparHtml(textoPuro(p.local)) + '</div>' +
      '<a href="' + escaparHtml(p.link) + '" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#1a7f3c;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">Chamar no WhatsApp</a>' +
      '</td></tr></table></td></tr>';
  }).join('');
  const html = '<div style="background:#f1f5fa;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">' +
    '<tr><td style="background:#0f2140;border-radius:8px 8px 0 0;padding:18px 20px;color:#ffffff;font-size:18px;font-weight:bold">Tattica | Pedidos sem contato</td></tr>' +
    '<tr><td style="background:#e4eefb;padding:14px 20px;color:#14233f;font-size:14px">' + parados.length + ' pedido(s) em "Novo" além do prazo. Chame o cliente e depois troque o status na planilha para parar os lembretes.</td></tr>' +
    '<tr><td style="padding:16px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + cartoes + '</table></td></tr>' +
    '<tr><td style="color:#5b6b85;font-size:12px;padding:8px 4px">Novo lembrete a cada ' + CONFIG.LEMBRETE_REPETIR_MIN + ' minutos no expediente, enquanto o status for "Novo".</td></tr>' +
    '</table></div>';

  MailApp.sendEmail({
    to: CONFIG.EMAIL_DESTINO,
    subject: ('[Lembrete] ' + parados.length + ' pedido(s) de orçamento sem contato').replace(/[\r\n]+/g, ' '),
    body: texto,
    htmlBody: html
  });
  parados.forEach(function (p) {
    aba.getRange(p.linha, iAviso + 1).setValue(Utilities.formatDate(agora, CONFIG.FUSO_HORARIO, 'dd/MM/yyyy HH:mm'));
  });
}

function escaparHtml(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Aceita Date da planilha ou texto "dd/MM/yyyy HH:mm:ss" */
function paraData(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})/.exec(String(valor || ''));
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null;
}

function dentroDoExpediente(data) {
  const dia = Number(Utilities.formatDate(data, CONFIG.FUSO_HORARIO, 'u')); // 1 = segunda ... 7 = domingo
  const hora = Number(Utilities.formatDate(data, CONFIG.FUSO_HORARIO, 'H'));
  return dia <= 5 && hora >= CONFIG.HORARIO.inicio && hora < CONFIG.HORARIO.fim;
}

/** Horas dentro do expediente entre duas datas (passos de 10 minutos) */
function horasUteisEntre(de, ate) {
  const passo = 10 * 60 * 1000;
  let minutos = 0;
  for (let t = de.getTime(); t < ate.getTime(); t += passo) {
    if (dentroDoExpediente(new Date(t))) minutos += 10;
  }
  return minutos / 60;
}

/* =========================================================================
   PAINEL (aba "Painel"): só fórmulas, atualiza sozinho
   ========================================================================= */

/** Descobre se a planilha usa vírgula ou ponto e vírgula entre os argumentos das fórmulas (depende do idioma) */
function detectarSeparador(aba) {
  const teste = aba.getRange('Z1');
  teste.setFormula('=IF(TRUE,1,2)');
  SpreadsheetApp.flush();
  const funcionou = teste.getValue() === 1;
  teste.clear();
  return funcionou ? ',' : ';';
}

/** Troca as vírgulas fora de aspas pelo separador da planilha */
function localizarFormula(formula, separador) {
  if (separador === ',') return formula;
  let saida = '';
  let aspas = false;
  for (let i = 0; i < formula.length; i++) {
    const c = formula[i];
    if (c === '"') aspas = !aspas;
    saida += (c === ',' && !aspas) ? separador : c;
  }
  return saida;
}

/** Escreve texto como texto e "=..." como fórmula (já no separador certo) */
function escreverCelula(aba, linha, coluna, valor, separador) {
  const celula = aba.getRange(linha, coluna);
  if (typeof valor === 'string' && valor.charAt(0) === '=') {
    celula.setFormula(localizarFormula(valor, separador));
  } else {
    celula.setValue(valor);
  }
}

function atualizarPainel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(CONFIG.NOME_ABA_PAINEL);
  if (!aba) aba = ss.insertSheet(CONFIG.NOME_ABA_PAINEL);
  aba.clear();
  const SEP = detectarSeparador(aba);

  const P = CONFIG.NOME_ABA;
  const M = CONFIG.NOME_ABA_METRICAS;
  const L = function (nome) { return letraColuna(colunaPedidos(nome)); };
  const faixa = function (nome) { return P + '!' + L(nome) + '2:' + L(nome) + '2000'; };
  const unicos = function (filtros) {
    return '=IFERROR(COUNTA(UNIQUE(FILTER(' + M + '!B2:B,' + filtros + '))),0)';
  };
  const poe = function (linha, coluna, valor) { escreverCelula(aba, linha, coluna, valor, SEP); };
  // Visual (cores da marca Tattica)
  const COR = { marinho: '#0f2140', azulInst: '#203b69', azul: '#0a6be0', claro: '#e4eefb', linha: '#dbe5f2', tinta: '#14233f' };
  aba.setHiddenGridlines(true);
  aba.getRange(1, 1, 70, 10).setFontFamily('Arial').setFontColor(COR.tinta).setVerticalAlignment('middle');
  aba.getCharts().forEach(function (g) { aba.removeChart(g); });

  const titulo = function (linha, coluna, texto, largura) {
    aba.getRange(linha, coluna, 1, largura || 2).setBackground(COR.azulInst).setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
    aba.getRange(linha, coluna).setValue(texto);
  };
  const cabecalho = function (linha, coluna, largura) {
    aba.getRange(linha, coluna, 1, largura || 2).setBackground(COR.claro).setFontWeight('bold').setFontColor(COR.azulInst);
  };
  const linhas = function (linha, coluna, altura, largura) {
    aba.getRange(linha, coluna, altura, largura || 2)
      .setBorder(false, false, true, false, false, true, COR.linha, SpreadsheetApp.BorderStyle.SOLID);
    aba.getRange(linha, coluna + 1, altura, 1).setHorizontalAlignment('right');
  };

  aba.getRange('A1:I1').setBackground(COR.marinho).setFontColor('#ffffff').setFontWeight('bold').setFontSize(16);
  aba.getRange('A1').setValue('Painel de pedidos e do chat');
  aba.setRowHeight(1, 40);

  // Resumo
  titulo(3, 1, 'Resumo');
  const resumo = [
    ['Pedidos no total', '=COUNTA(' + faixa('nome') + ')'],
    ['Aguardando contato (Novo)', '=COUNTIF(' + faixa('status') + ',"Novo")'],
    ['Prioridade alta (assembleia marcada)', '=COUNTIF(' + faixa('prioridade') + ',"Alta")'],
    ['Fechados', '=COUNTIF(' + faixa('status') + ',"Fechado")'],
    ['Taxa de fechamento', '=IFERROR(B7/B4,0)']
  ];
  resumo.forEach(function (r, i) { poe(4 + i, 1, r[0]); poe(4 + i, 2, r[1]); });
  aba.getRange('B8').setNumberFormat('0%');
  linhas(4, 1, 5);
  aba.getRange('B4:B8').setFontSize(14).setFontWeight('bold').setFontColor(COR.azul);

  // Por status
  titulo(10, 1, 'Pedidos por status');
  CONFIG.STATUS.forEach(function (nome, i) {
    poe(11 + i, 1, nome);
    poe(11 + i, 2, '=COUNTIF(' + faixa('status') + ',A' + (11 + i) + ')');
  });
  const fimStatus = 11 + CONFIG.STATUS.length;
  linhas(11, 1, CONFIG.STATUS.length);
  aba.getRange(11, 2, CONFIG.STATUS.length, 1).setFontWeight('bold');

  // Por semana (8 últimas, início na segunda)
  titulo(3, 4, 'Pedidos por semana (início na segunda)');
  for (let k = 7; k >= 0; k--) {
    const r = 4 + (7 - k);
    poe(r, 4, '=TODAY()-WEEKDAY(TODAY(),3)-' + (7 * k));
    poe(r, 5, '=SUMPRODUCT(ISNUMBER(' + faixa('data_hora') + ')*(' + faixa('data_hora') + '>=D' + r + ')*(' + faixa('data_hora') + '<D' + r + '+7))');
  }
  aba.getRange(4, 4, 8, 1).setNumberFormat('dd/MM').setHorizontalAlignment('left');
  linhas(4, 4, 8);

  // Quebras por campo
  const consulta = function (linha, coluna, tituloTxt, campo, limite, maxLinhas) {
    titulo(linha, coluna, tituloTxt);
    cabecalho(linha + 1, coluna);
    linhas(linha + 2, coluna, maxLinhas);
    const nome = L('nome');
    poe(linha + 1, coluna,
      '=IFERROR(QUERY(' + P + '!A:' + letraColuna(CONFIG.CABECALHOS.length) + ',"select ' + L(campo) + ', count(' + nome + ') where ' + nome +
      ' is not null and ' + L(campo) + ' is not null group by ' + L(campo) + ' order by count(' + nome + ') desc ' +
      (limite ? 'limit ' + limite + ' ' : '') + 'label count(' + nome + ') \'Pedidos\'",1),"sem dados")');
  };
  consulta(fimStatus + 2, 1, 'Por perfil', 'perfil', 0, 4);
  consulta(fimStatus + 10, 1, 'Por portaria atual', 'portaria_hoje', 0, 4);
  consulta(fimStatus + 18, 1, 'Locais mais frequentes (top 10)', 'local', 10, 10);
  consulta(14, 4, 'Por situação da assembleia', 'assembleia', 0, 3);
  consulta(21, 4, 'Fibra óptica (internet)', 'internet_fibra', 0, 3);
  consulta(28, 4, 'Cabeamento do interfone', 'cabeamento_interfone', 0, 3);

  // Funil do chat
  titulo(3, 7, 'Funil do orçamento no chat (visitas únicas)', 3);
  aba.getRange('G4:I4').setValues([['Etapa', 'Visitas', '% de quem abriu o chat']]);
  cabecalho(4, 7, 3);
  const etapas = [['Abriu o chat', unicos(M + '!C2:C="chat_aberto"')]];
  CONFIG.PASSOS_ORCAMENTO.forEach(function (p) {
    etapas.push(['Chegou em: ' + p, unicos(M + '!C2:C="orc_passo",' + M + '!D2:D="' + p + '"')]);
  });
  etapas.push(['Pedido registrado', unicos(M + '!C2:C="orc_resultado",' + M + '!D2:D="confirmado"')]);
  etapas.push(['Pedido sem confirmação (falhou)', unicos(M + '!C2:C="orc_resultado",' + M + '!D2:D="falhou"')]);
  etapas.push(['Clicou em enviar pelo WhatsApp', unicos(M + '!C2:C="link_clique",REGEXMATCH(' + M + '!D2:D,"WhatsApp")')]);
  etapas.push(['Copiou o resumo da assembleia', unicos(M + '!C2:C="orc_resumo_copiado"')]);
  etapas.forEach(function (e, i) {
    poe(5 + i, 7, e[0]);
    poe(5 + i, 8, e[1]);
    poe(5 + i, 9, '=IFERROR(H' + (5 + i) + '/$H$5,0)');
  });
  aba.getRange(5, 9, etapas.length, 1).setNumberFormat('0%');
  linhas(5, 7, etapas.length, 3);
  aba.getRange(5, 9, etapas.length, 1).setHorizontalAlignment('right');

  // Uso do chat
  const topo = function (linha, tituloTxt, evento, limite, maxLinhas) {
    titulo(linha, 7, tituloTxt);
    cabecalho(linha + 1, 7);
    linhas(linha + 2, 7, maxLinhas);
    poe(linha + 1, 7, '=IFERROR(QUERY(' + M + '!B:D,"select Col3, count(Col1) where Col2=\'' + evento + '\' group by Col3 order by count(Col1) desc ' +
      (limite ? 'limit ' + limite + ' ' : '') + 'label count(Col1) \'Vezes\'",0),"sem dados")');
  };
  const baseUso = 5 + etapas.length + 2;
  topo(baseUso, 'O que as pessoas escolhem no menu', 'menu', 0, 5);
  topo(baseUso + 9, 'Dúvidas mais vistas (top 10)', 'duvida', 10, 10);
  topo(baseUso + 23, 'Ajuda a moradores mais vista (top 10)', 'morador', 10, 10);

  [[1, 260], [2, 90], [3, 24], [4, 170], [5, 90], [6, 24], [7, 300], [8, 90], [9, 170], [10, 24]].forEach(function (c) {
    aba.setColumnWidth(c[0], c[1]);
  });
  aba.setFrozenRows(1);

  // Gráficos (uma só cor, sem legenda: o título já diz o que é)
  try {
    const estilo = function (g, titulo2, largura, altura) {
      return g.setOption('title', titulo2)
        .setOption('titleTextStyle', { color: COR.tinta, fontSize: 13, bold: true })
        .setOption('colors', [COR.azul])
        .setOption('legend', { position: 'none' })
        .setOption('backgroundColor', '#ffffff')
        .setOption('width', largura)
        .setOption('height', altura)
        .setOption('hAxis', { textStyle: { color: '#5b6b85' }, gridlines: { color: COR.linha } })
        .setOption('vAxis', { textStyle: { color: '#5b6b85' }, gridlines: { color: COR.linha } });
    };
    aba.insertChart(estilo(aba.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(aba.getRange(4, 4, 8, 2))
      .setNumHeaders(0)
      .setPosition(3, 11, 0, 0)
      .setOption('bar', { groupWidth: '55%' }), 'Pedidos por semana', 520, 260).build());
    aba.insertChart(estilo(aba.newChart()
      .setChartType(Charts.ChartType.BAR)
      .addRange(aba.getRange(4, 7, etapas.length + 1, 2))
      .setNumHeaders(1)
      .setPosition(18, 11, 0, 0)
      .setOption('reverseCategories', true)
      .setOption('bar', { groupWidth: '60%' }), 'Funil do orçamento no chat', 520, 440).build());
  } catch (erro) {
    Logger.log('Gráficos não criados: ' + erro.message);
  }
}

/**
 * Garante que a aba "Pedidos" existe com cabeçalhos em negrito, congelados e com filtro
 */
/** Junta uma lista (ou texto) em uma linha só, sem HTML nem quebras */
function listaTexto(v) {
  const itens = Array.isArray(v) ? v : (v ? [v] : []);
  return itens.slice(0, 10).map(textoPuro).filter(String).join('; ');
}

function obterOuCriarAba(ss) {
  let sheet = ss.getSheetByName(CONFIG.NOME_ABA);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.NOME_ABA);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONFIG.CABECALHOS);
  }

  const headerRange = sheet.getRange(1, 1, 1, CONFIG.CABECALHOS.length);
  // Atualiza o cabeçalho (colunas novas entram no fim e não mexem nas linhas antigas)
  headerRange.setValues([CONFIG.CABECALHOS]);
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  if (!sheet.getFilter()) {
    headerRange.createFilter();
  }

  return sheet;
}

/**
 * Envia o e-mail: versão visual (HTML) e, como reserva, versão em texto simples
 */
function enviarEmailPedido(dados, dataHora, prioridade, nome, telefone, linkWhatsApp) {
  const assunto = ('[' + prioridade + '] Novo pedido de orçamento: ' + nome).replace(/[\r\n]+/g, ' ');

  const pedido = {
    prioridade: prioridade,
    nome: nome,
    telefone: telefone,
    linkWhatsApp: linkWhatsApp,
    dataHora: dataHora,
    origem: textoPuro(dados.origem),
    consentimento: textoPuro(dados.consentimento),
    secoes: [
      {
        titulo: 'Quem pediu',
        linhas: [
          ['Perfil', textoPuro(dados.perfil)]
        ]
      },
      {
        titulo: 'Condomínio',
        linhas: [
          ['Local', textoPuro(dados.local)],
          ['Blocos ou torres', textoPuro(dados.blocos)],
          ['Unidades', textoPuro(dados.unidades)],
          ['Portaria hoje', textoPuro(dados.portaria)],
          ['Câmeras ou acesso', textoPuro(dados.estrutura)],
          ['Assembleia', textoPuro(dados.assembleia)],
          ['Internet (fibra 10 Mb)', textoPuro(dados.internet)],
          ['Cabeamento do interfone', textoPuro(dados.interfone)],
          ['Pontos a avaliar', listaTexto(dados.pontos) || 'Nenhum apontado']
        ]
      }
    ]
  };

  MailApp.sendEmail({
    to: CONFIG.EMAIL_DESTINO,
    subject: assunto,
    name: 'Chat do site Tattica',
    body: montarTextoEmail(pedido),
    htmlBody: montarHtmlEmail(pedido)
  });
}

/**
 * Versão em texto simples (para clientes de e-mail que não mostram HTML)
 */
function montarTextoEmail(p) {
  const linhas = [
    'NOVO PEDIDO DE ORÇAMENTO (prioridade ' + p.prioridade + ')',
    '',
    'Nome: ' + p.nome,
    'Telefone: ' + p.telefone,
    ''
  ];
  p.secoes.forEach(function (secao) {
    linhas.push(secao.titulo.toUpperCase());
    secao.linhas.forEach(function (par) {
      linhas.push('  ' + par[0] + ': ' + (par[1] || '-'));
    });
    linhas.push('');
  });
  linhas.push('Chamar no WhatsApp: ' + p.linkWhatsApp);
  linhas.push('');
  linhas.push('Recebido em ' + p.dataHora + ' | origem: ' + (p.origem || '-') + ' | consentimento: ' + (p.consentimento || '-'));
  return linhas.join('\n');
}

const CORES_PRIORIDADE = {
  'Alta': { fundo: '#fee4e2', texto: '#b42318' },
  'Média': { fundo: '#fef0c7', texto: '#93370d' },
  'Normal': { fundo: '#d1e9ff', texto: '#175cd3' }
};

/**
 * Versão visual: cartão com cabeçalho da marca, prioridade em destaque e
 * botão do WhatsApp. Só usa estilos inline e tabelas, que todo e-mail aceita.
 */
function montarHtmlEmail(p) {
  const cor = CORES_PRIORIDADE[p.prioridade] || CORES_PRIORIDADE['Normal'];
  const fonte = 'font-family:Arial,Helvetica,sans-serif;';

  const secoes = p.secoes.map(function (secao) {
    const linhas = secao.linhas.map(function (par) {
      return '<tr>' +
        '<td style="padding:10px 0;border-bottom:1px solid #e5ebf3;color:#5b6b82;font-size:13px;width:38%;vertical-align:top;' + fonte + '">' + escaparHtml(par[0]) + '</td>' +
        '<td style="padding:10px 0;border-bottom:1px solid #e5ebf3;color:#14233f;font-size:15px;font-weight:bold;vertical-align:top;' + fonte + '">' + (escaparHtml(par[1]) || '&mdash;') + '</td>' +
        '</tr>';
    }).join('');

    return '<tr><td style="padding:22px 28px 0;">' +
      '<div style="color:#0b5fc4;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;' + fonte + '">' + escaparHtml(secao.titulo) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;border-collapse:collapse;">' + linhas + '</table>' +
      '</td></tr>';
  }).join('');

  return '' +
    '<div style="background:#f1f5fa;padding:24px 12px;' + fonte + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d9e2ee;border-radius:12px;border-collapse:separate;overflow:hidden;">' +

    // Cabeçalho
    '<tr><td style="background:#0f2140;padding:24px 28px;">' +
    '<div style="color:#8fc2ff;font-size:12px;font-weight:bold;letter-spacing:2px;' + fonte + '">TATTICA &middot; CHAT DO SITE</div>' +
    '<div style="color:#ffffff;font-size:24px;font-weight:bold;margin-top:6px;' + fonte + '">Novo pedido de or&ccedil;amento</div>' +
    '</td></tr>' +

    // Prioridade, nome e telefone
    '<tr><td style="padding:26px 28px 6px;">' +
    '<span style="display:inline-block;background:' + cor.fundo + ';color:' + cor.texto + ';font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:999px;' + fonte + '">Prioridade ' + escaparHtml(p.prioridade) + '</span>' +
    '<div style="color:#0f2140;font-size:26px;font-weight:bold;line-height:1.25;margin-top:14px;' + fonte + '">' + escaparHtml(p.nome) + '</div>' +
    '<div style="margin-top:4px;font-size:16px;' + fonte + '"><a href="tel:+55' + escaparHtml(apenasDigitos(p.telefone).replace(/^55(?=\d{10,11}$)/, '')) + '" style="color:#0b5fc4;text-decoration:none;">' + escaparHtml(p.telefone) + '</a></div>' +
    '</td></tr>' +

    // Botão do WhatsApp
    '<tr><td style="padding:18px 28px 4px;">' +
    '<a href="' + escaparHtml(p.linkWhatsApp) + '" style="display:inline-block;background:#1a7f46;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;padding:13px 24px;border-radius:8px;' + fonte + '">Chamar no WhatsApp</a>' +
    '</td></tr>' +

    secoes +

    // Rodapé
    '<tr><td style="padding:26px 28px 24px;">' +
    '<div style="border-top:1px solid #e5ebf3;padding-top:14px;color:#7a889c;font-size:12px;line-height:1.6;' + fonte + '">' +
    'Recebido em ' + escaparHtml(p.dataHora) + '<br>' +
    'Origem: ' + (escaparHtml(p.origem) || '&mdash;') + ' &middot; Consentimento: ' + (escaparHtml(p.consentimento) || '&mdash;') +
    '</div></td></tr>' +

    '</table></div>';
}

/**
 * Texto como foi digitado (sem o apóstrofo de proteção da planilha)
 */
function textoPuro(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  return String(valor).trim();
}

/**
 * Impede que o que o cliente digitou vire HTML dentro do e-mail
 */
function escaparHtml(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Link que abre a conversa com o cliente no WhatsApp, com mensagem pronta
 */
function montarLinkWhatsApp(nome, digitos) {
  let numero = digitos;
  if (numero.length <= 11) {
    numero = '55' + numero;
  }
  const mensagem = 'Olá, ' + nome + '. Aqui é da equipe Comercial da Tattica. ' +
    'Recebemos o seu pedido de proposta de portaria virtual e gostaríamos de ' +
    'entender melhor a necessidade do condomínio. Podemos conversar agora?';
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem);
}

function apenasDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

/**
 * Normaliza valores ausentes para string vazia e neutraliza texto que a
 * planilha interpretaria como fórmula (começa com = + - @).
 */
function limparValor(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }
  const texto = String(valor).trim();
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}

/**
 * Padroniza a resposta HTTP em JSON
 */
function responderJson(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * FUNÇÃO DE TESTE MANUAL
 * Selecione "testarEnvioPedido" na barra superior do Apps Script e clique em "Executar"
 */
function testarEnvioPedido() {
  const payloadSimulado = {
    perfil: 'Síndico',
    blocos: '2 a 4',
    unidades: '48',
    portaria: 'Portaria física (porteiros)',
    estrutura: 'Sim',
    local: 'Praia da Costa, Vila Velha',
    assembleia: 'Sim, já marcada',
    internet: 'Pode contratar',
    interfone: 'Não sei',
    pontos: ['contratação da fibra óptica (mín. 10 Mb)', 'cabeamento do interfone: confirmar'],
    nome: 'Carlos Eduardo Mendes',
    telefone: '(27) 99988-7766',
    prioridade: 'Alta',
    consentimento: 'Sim',
    origem: '/',
    criadoEm: new Date().toISOString()
  };

  const eventoSimulado = {
    postData: {
      contents: JSON.stringify(payloadSimulado),
      type: 'text/plain'
    }
  };

  const resultado = doPost(eventoSimulado);
  Logger.log('Resposta do script: ' + resultado.getContent());
}
