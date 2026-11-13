/* Gera ia-proxy/conhecimento.js a partir do chat-config.js, para a IA responder
   somente com o conteúdo que a empresa já aprovou. Rode: node ia-proxy/gerar-conhecimento.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const origem = fs.readFileSync(path.join(__dirname, '..', 'chat-config.js'), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(origem, ctx);
const c = ctx.window.TATTICA_CHAT;

const bloco = (titulo, itens) => `${titulo}\n` + itens.map(i => `- ${i.tema ? '[' + i.tema + '] ' : ''}${i.p}: ${i.r.replace(/\s*\n+\s*/g, ' ')}`).join('\n');
const texto = [
    'EMPRESA: Tattica, portaria virtual e segurança eletrônica na Grande Vitória (ES).',
    `Comercial: segunda a sexta, das ${c.horarioComercial.inicio}h às ${c.horarioComercial.fim}h. Central 24 horas.`,
    'Contatos: ' + c.contatos.map(x => `${x.nome}: ${x.texto}`).join('; '),
    bloco('DÚVIDAS DE QUEM QUER CONTRATAR', c.faq),
    bloco('AJUDA PARA MORADORES (aplicativo Tattica Center)', c.morador)
].join('\n\n');

fs.writeFileSync(path.join(__dirname, 'conhecimento.js'),
    '// Arquivo gerado por gerar-conhecimento.js. Não edite à mão.\nexport const CONHECIMENTO = ' + JSON.stringify(texto) + ';\n');
console.log('conhecimento.js gerado (' + texto.length + ' caracteres)');
