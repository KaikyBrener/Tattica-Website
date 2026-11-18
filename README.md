# Tattica Website

Site institucional estático da Tattica (portaria virtual, Espírito Santo): apresentação da empresa, soluções, como funciona, Tattica Center, equipamentos, central de monitoramento, benefícios, diferenciais, FAQ e contato.

## Estrutura

- `index.html` — página única, em seções. Os ícones ficam em um sprite SVG no início do `<body>`.
- `styles.css` — sistema de design do site (tokens em `:root`, componentes e responsivo).
- `script.js` — menu responsivo, cabeçalho, link ativo da navegação, FAQ, botão de voltar ao topo, ano do rodapé e modal/formulário de orçamento (envia pelo WhatsApp).
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

## Demonstração: assistente virtual (chat) — projeto pessoal


- `chatbot.js` — o chat (sem IA, só botões e respostas prontas). Não precisa mexer.
- `chat-config.js` — todo o conteúdo editável: WhatsApp do Comercial, horário, telefones, perguntas e respostas.
- `chatbot.css` — visual, usando as cores e fontes do site.
- `apps-script/Code.gs` — opcional e gratuito: registra cada pedido em uma planilha do Google, avisa por e-mail e cria um botão "Chamar no WhatsApp" para cada cliente.

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
Trocar `whatsappComercial` pelo número do Comercial, revisar todas as respostas em `chat-config.js` com a gerência e definir a resposta oficial para perguntas sobre reputação da empresa.
