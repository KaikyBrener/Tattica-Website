# Proxy da IA do assistente (gratuito)

O chat do site funciona sem IA. Este proxy é opcional: ele deixa o visitante **digitar uma pergunta** e uma IA responde, **somente com o conteúdo de `chat-config.js`**. O que não estiver lá vira "encaminhar ao Comercial".

A chave da IA fica aqui, no Cloudflare, e nunca vai para o navegador.

## Por que não o Grok
A API do Grok (xAI) é paga por token e, segundo as fontes consultadas, não tem camada gratuita permanente. O Grok gratuito de grok.com é só para conversar no site da xAI, sem API. Por isso o padrão aqui é o **Gemini (Google AI Studio)**, que tem camada gratuita para os modelos Flash e Flash-Lite. Os limites mudam com frequência e são baixos, então use só para demonstração ou pouco tráfego. Na camada gratuita, o Google pode usar as perguntas para melhorar os produtos dele.

## Testar na sua máquina
O `.dev.vars` (com a chave) não vai para o git. Para criá-lo, dentro de `ia-proxy`:
```powershell
.\configurar-local.ps1
npx wrangler dev
```
Em outro terminal, na pasta do projeto: `npx serve -l 5500 .` e abra `http://localhost:5500/Index.html`.
Em `localhost` o chat usa sozinho o endereço `iaUrlLocal` (`http://127.0.0.1:8787`), sem mexer no `iaUrl`.
Não digite nada no terminal do `wrangler dev`: as teclas `t` e `x` abrem um túnel público e fecham o servidor.

## Como publicar (grátis)
1. Crie uma chave em https://aistudio.google.com (sem cartão).
2. Instale o Wrangler e entre na conta Cloudflare: `npm i -g wrangler && wrangler login`
3. Na pasta `ia-proxy`: `node gerar-conhecimento.js` (rode de novo sempre que editar o `chat-config.js`).
4. `wrangler secret put GEMINI_API_KEY` e cole a chave.
5. `wrangler deploy`. Ele mostra o endereço `https://tattica-chat-ia.SEU-USUARIO.workers.dev`.
6. Em `chat-config.js`, preencha `iaUrl` com esse endereço.
7. Em `wrangler.toml`, coloque o endereço do site em `ORIGENS_PERMITIDAS` e publique de novo.

## Reserva opcional
Se o Gemini estiver no limite, o proxy tenta outro serviço compatível com OpenAI (Groq, OpenRouter). Configure `RESERVA_URL`, `RESERVA_MODELO` e, como segredo, `RESERVA_API_KEY`. Confira na página do serviço se o modelo ainda é gratuito.

## Cuidados
- O prompt proíbe preços, contrato, economia, número de clientes e notícias. Isso reduz o risco, mas IA pode errar: a empresa deve aprovar o texto antes de ir ao ar.
- Se a IA falhar ou estourar o limite, o chat avisa e oferece o atendente.
- Como a pergunta vai a um serviço de terceiros, avise isso na política de privacidade antes de usar de verdade (LGPD).
