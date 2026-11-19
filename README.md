# Tattica Website

Site institucional estático da Tattica (portaria virtual, Espírito Santo): apresentação da empresa, soluções, como funciona, Tattica Center, equipamentos, central de monitoramento, benefícios, diferenciais, FAQ e contato.

## Estrutura

- `index.html` — página única, em seções. Os ícones ficam em um sprite SVG no início do `<body>`.
- `styles.css` — sistema de design do site (tokens em `:root`, componentes e responsivo).
- `script.js` — menu responsivo, cabeçalho, link ativo da navegação, FAQ, botão de voltar ao topo, ano do rodapé e botões de orçamento, que abrem o assistente direto no fluxo de orçamento (sem JavaScript, o link vai para o WhatsApp).
- `privacidade.html` — página de privacidade e LGPD (reaproveita o `styles.css`). Revisar com o jurídico antes de publicar: prazo de guarda e e-mail do encarregado.
- `images/` — fotos, telas do aplicativo, logotipo e favicon.
  - `central-operacao.jpg` e `Celular*.jpeg` são os originais; o site usa as versões `.webp` geradas a partir deles.
- `fonts/` — Archivo (títulos) e IBM Plex Sans (texto), hospedadas localmente, licença SIL OFL.

## Como rodar

Não há build. Abra `index.html` no navegador ou sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
```

---

## Página no celular, indicador de atendimento e comparativo
- **Abas no celular (até 767 px):** a página mostra um grupo de seções por vez (Portaria, Soluções, Aplicativo, Central e FAQ). O grupo de cada seção é o atributo `data-aba` no `index.html`, e a barra de abas é o `<nav id="abas">`. Cada seção mantém o endereço (`#torre`, `#faq`...), então links, menu e botão voltar funcionam. No computador, ou sem JavaScript, a página continua inteira, rolando como sempre.
- **Indicador de atendimento:** no topo do site, mostra se o Comercial está em atendimento ou fora do expediente e quando volta. Usa `horarioComercial` do `chat-config.js` (o mesmo do chat) no fuso de Brasília. **Não considera feriados.** Confirmar o horário real com o Comercial.
- **Comparativo portaria presencial × virtual:** seção `#comparativo`, tabela no computador e cartões no celular. São argumentos gerais, sem números. **Cada linha precisa ser validada pelo Comercial antes do uso real.**

## Demonstração: assistente virtual (chat) — projeto pessoal


- `chatbot.js` — o chat (sem IA, só botões e respostas prontas). Não precisa mexer.
- `chat-config.js` — todo o conteúdo editável: WhatsApp do Comercial, horário, telefones, perguntas e respostas.
- `chatbot.css` — visual, usando as cores e fontes do site.
- `apps-script/Code.gs` — opcional e gratuito: registra cada pedido em uma planilha do Google, avisa por e-mail e cria um botão "Chamar no WhatsApp" para cada cliente.

### Modo demonstração (MVP)
O site está em `modo: 'demonstracao'` (topo do `chat-config.js`). Nesse modo:
- todos os botões de orçamento abrem o chat direto no fluxo de orçamento, e o fluxo funciona até o fim;
- nada sai do navegador: não grava na planilha, não envia e-mail, não manda métricas e não usa a IA;
- o fim do orçamento avisa que a solicitação foi **simulada e não enviada** e mostra, em cartões marcados como prévia, o e-mail, a linha da planilha e a mensagem de WhatsApp que o Comercial receberia. O envio ao WhatsApp do Comercial não é oferecido;
- o rodapé mostra "Versão de demonstração" e a política de privacidade mostra "Documento em revisão".

Para apresentar o fluxo funcionando de verdade, use `modo: 'homologacao'`:
1. Crie uma planilha só de teste, cole nela o `apps-script/Code.gs` com `EMAIL_DESTINO` de teste, rode `configurarTudo` e `instalarGatilhos` e publique como app da Web.
2. Cole a URL em `appsScriptUrlTeste` no `chat-config.js`.
3. Use dados fictícios. O pedido cai na planilha de teste, o e-mail chega com `[TESTE]` no assunto, o lembrete e o painel funcionam, e o chat mostra o que chegou. O WhatsApp do Comercial não é aberto.

Sem `appsScriptUrlTeste`, a homologação volta a ser demonstração e nunca usa a planilha real.

Para ligar o envio real, troque para `modo: 'producao'`. A integração com o Apps Script continua no código, só fica desligada na demonstração.

### Como o pedido chega ao Comercial
1. O chat faz perguntas curtas (perfil, blocos, unidades, portaria atual, estrutura, internet de fibra, cabeamento do interfone, local, assembleia, nome e telefone) e pede o consentimento. No fim, mostra os pontos que o Comercial vai avaliar e oferece um resumo para levar à assembleia.
2. O cliente toca em "Enviar ao Comercial pelo WhatsApp" e a conversa abre com tudo já escrito.
3. Se `appsScriptUrl` estiver preenchido, o pedido também cai na planilha (o chat lê a resposta e avisa se o registro falhar) (com prioridade alta quando há assembleia marcada) e o Comercial recebe um e-mail.

### Planilha: status, lembrete, painel e métricas
Depois de colar o `apps-script/Code.gs` e publicar uma nova versão, rode `configurarTudo` uma vez no editor do Apps Script. Ela:
- cria a lista suspensa da coluna `status` (Novo, Contatado, Proposta enviada, Fechado, Perdido);
- monta a aba `Painel` (pedidos por semana, status, perfil, portaria, locais, funil do chat e dúvidas mais vistas);
- liga um lembrete a cada 30 minutos, no expediente: pedido em "Novo" além de 2 h úteis (prioridade alta), 4 h (média) ou 8 h (normal) gera um e-mail. Basta mudar o status para parar.

A aba `Métricas` recebe, de forma anônima, as etapas do chat e os cliques em botões (`metricas: true` em `chat-config.js`). Nunca recebe nome, telefone nem texto digitado. Para desligar, use `metricas: false`.

### Verificação automática
`.github/workflows/verificar.yml` roda a cada push: confere a sintaxe dos scripts, confere se `ia-proxy/conhecimento.js` está em dia com o `chat-config.js` (se não estiver, rode `node ia-proxy/gerar-conhecimento.js`) e valida o HTML.

### Vídeos tutoriais
Cada item de `morador` em `chat-config.js` tem o campo `video`. Se for um link `https://` (ex.: YouTube não listado), o bot mostra o botão "Assistir ao vídeo tutorial". Não coloque arquivos de vídeo no repositório.

### IA opcional (perguntas digitadas)
Com `iaUrl` preenchido em `chat-config.js`, aparece a opção "Digitar a minha pergunta" e uma IA responde só com o conteúdo aprovado do `chat-config.js`. O proxy gratuito (Cloudflare Workers + Gemini) está em `ia-proxy/`. O Grok não entra porque a API dele é paga. Detalhes em `ia-proxy/README.md`.

### O que o bot NÃO faz
- Não coleta documentos (CPF, etc.).
- Não responde contrato, valores nem a origem dos números de economia: encaminha ao Comercial.
- Não guarda dados no site.

### Antes de qualquer uso real
Trocar `modo` para `'producao'` em `chat-config.js`, tirar os avisos de demonstração (`footer__demo` no `index.html` e na `privacidade.html`, `legal__status` e `legal__note` na privacidade) e publicar o Apps Script numa conta Google da Tattica.
Trocar `whatsappComercial` pelo número do Comercial, revisar todas as respostas em `chat-config.js` com a gerência e definir a resposta oficial para perguntas sobre reputação da empresa.
