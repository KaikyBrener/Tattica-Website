# Tattica Website

Site institucional estático da Tattica (portaria virtual, Espírito Santo): apresentação da empresa, soluções, como funciona, Tattica Center, equipamentos, central de monitoramento, benefícios, diferenciais, FAQ e contato.

## Estrutura

- `index.html` — página única, em seções. Os ícones ficam em um sprite SVG no início do `<body>`.
- `styles.css` — sistema de design do site (tokens em `:root`, componentes e responsivo).
- `script.js` — menu responsivo, cabeçalho, link ativo da navegação, FAQ, botão de voltar ao topo, ano do rodapé e modal/formulário de orçamento (envia pelo WhatsApp).
- `images/` — fotos, telas do aplicativo, logotipo e favicon.
  - `central-operacao.jpg` e `Celular*.jpeg` são os originais; o site usa as versões `.webp` geradas a partir deles.
- `fonts/` — Archivo (títulos) e IBM Plex Sans (texto), hospedadas localmente, licença SIL OFL.

## Como rodar

Não há build. Abra `index.html` no navegador ou sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
```
