/**
 * Recebe os pedidos de orçamento do chat do site, grava na planilha
 * e avisa por e-mail. Campos enviados pelo chat (chat-config.js / chatbot.js):
 * perfil, blocos, unidades, portaria, estrutura, local, assembleia,
 * nome, telefone, prioridade, consentimento, origem, criadoEm.
 */
const CONFIG = {
  NOME_ABA: 'Pedidos',
  EMAIL_DESTINO: 'comercial@exemplo.com.br', // troque pelo e-mail do Comercial,
  FUSO_HORARIO: 'America/Sao_Paulo',
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
    'pontos_a_avaliar'
  ]
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
      dataHora,
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
      limparValor(listaTexto(dados.pontos))
    ];

    sheet.appendRow(novaLinha);

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
