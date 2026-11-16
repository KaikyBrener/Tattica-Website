/* ==========================================================================
   TATTICA — chatbot: widget, navegação e coleta do lead.
   Depende de chatbot-dados.js e chatbot-envio.js (carregue antes deste).
   ========================================================================== */

(() => {
    'use strict';

    const dados = window.TATTICA_BOT;
    const envio = window.TATTICA_BOT_ENVIO;
    if (!dados || !envio) return;

    const { config, mensagens, fluxo, faq, lead: configLead } = dados;
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ATRASO_BOT_MS = reduzirMovimento ? 0 : 450;

    const ICONE_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 10h8M8 13h5"/></svg>';
    const ICONE_REINICIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/></svg>';

    /* ---------- Estado ---------- */
    const estado = {
        aberto: false,
        iniciado: false,
        ocupado: false,     // bot "digitando": ignora cliques
        coletando: false,
        passo: 0,
        respostas: {},
        pontos: 0,
        origem: '',
        enviando: false
    };

    /* ---------- DOM ---------- */
    function criar(tag, classe, texto) {
        const elemento = document.createElement(tag);
        if (classe) elemento.className = classe;
        if (texto !== undefined) elemento.textContent = texto;
        return elemento;
    }

    const raiz = criar('div', 'tbot');
    const botaoAbrir = criar('button', 'tbot__launcher');
    botaoAbrir.type = 'button';
    botaoAbrir.setAttribute('aria-expanded', 'false');
    botaoAbrir.setAttribute('aria-controls', 'tbot-painel');
    botaoAbrir.innerHTML = ICONE_CHAT;
    botaoAbrir.append(criar('span', '', 'Fale conosco'));

    const painel = criar('section', 'tbot__panel');
    painel.id = 'tbot-painel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', `Chat com o ${config.nomeBot}`);
    painel.hidden = true;

    const cabecalho = criar('header', 'tbot__head');
    const titulo = criar('div', 'tbot__title');
    titulo.append(criar('strong', '', config.nomeBot), criar('span', '', config.subtitulo));
    const botaoReiniciar = criar('button', 'tbot__icon-btn');
    botaoReiniciar.type = 'button';
    botaoReiniciar.setAttribute('aria-label', 'Reiniciar conversa');
    botaoReiniciar.innerHTML = ICONE_REINICIAR;
    const botaoFechar = criar('button', 'tbot__icon-btn');
    botaoFechar.type = 'button';
    botaoFechar.setAttribute('aria-label', 'Fechar chat');
    botaoFechar.innerHTML = '&times;';
    cabecalho.append(titulo, botaoReiniciar, botaoFechar);

    const registro = criar('div', 'tbot__log');
    registro.setAttribute('role', 'log');
    registro.setAttribute('aria-live', 'polite');

    const areaOpcoes = criar('div', 'tbot__options');

    const mensagemErro = criar('p', 'tbot__erro');
    mensagemErro.setAttribute('role', 'alert');

    const formulario = criar('form', 'tbot__form');
    formulario.hidden = true;
    formulario.noValidate = true;
    const campo = criar('input', 'tbot__input');
    campo.type = 'text';
    campo.setAttribute('aria-label', 'Sua resposta');
    campo.maxLength = 120;
    const botaoEnviar = criar('button', 'tbot__send', 'Enviar');
    botaoEnviar.type = 'submit';
    formulario.append(campo, botaoEnviar);

    painel.append(cabecalho, registro, areaOpcoes, mensagemErro, formulario);
    raiz.append(botaoAbrir, painel);
    document.body.append(raiz);

    /* ---------- Utilidades ---------- */
    function rolarParaOFim() {
        registro.scrollTop = registro.scrollHeight;
    }

    function pausa(ms) {
        return ms > 0 ? new Promise(resolver => setTimeout(resolver, ms)) : Promise.resolve();
    }

    function mensagemUsuario(texto) {
        registro.append(criar('div', 'tbot__msg tbot__msg--user', texto));
        rolarParaOFim();
    }

    async function mensagemBot(texto, classeExtra) {
        estado.ocupado = true;
        limparOpcoes();
        esconderCampo();
        const digitando = criar('div', 'tbot__msg tbot__msg--bot');
        const pontos = criar('span', 'tbot__typing');
        pontos.setAttribute('aria-hidden', 'true');
        pontos.append(criar('i'), criar('i'), criar('i'));
        digitando.append(pontos);
        registro.append(digitando);
        rolarParaOFim();
        await pausa(ATRASO_BOT_MS);
        digitando.textContent = texto;
        if (classeExtra) digitando.classList.add(classeExtra);
        rolarParaOFim();
        estado.ocupado = false;
    }

    function limparOpcoes() {
        areaOpcoes.replaceChildren();
    }

    function mostrarOpcoes(opcoes, aoEscolher) {
        limparOpcoes();
        opcoes.forEach(opcao => {
            const botao = criar('button', 'tbot__option', opcao.rotulo);
            botao.type = 'button';
            if (opcao.estilo) botao.classList.add(`tbot__option--${opcao.estilo}`);
            botao.addEventListener('click', () => {
                if (estado.ocupado) return;
                aoEscolher(opcao);
            });
            areaOpcoes.append(botao);
        });
        const primeiro = areaOpcoes.querySelector('button');
        if (primeiro && estado.aberto) primeiro.focus({ preventScroll: true });
        rolarParaOFim();
    }

    function mostrarCampo(passo) {
        mensagemErro.textContent = '';
        campo.value = '';
        campo.placeholder = passo.placeholder || '';
        campo.setAttribute('autocomplete', passo.autocomplete || 'off');
        campo.setAttribute('inputmode', passo.inputmode || 'text');
        campo.maxLength = passo.mascara === 'telefone' ? 15 : 120;
        formulario.hidden = false;
        if (estado.aberto) campo.focus({ preventScroll: true });
        rolarParaOFim();
    }

    function esconderCampo() {
        formulario.hidden = true;
        mensagemErro.textContent = '';
    }

    /* ---------- Origem do contato ---------- */
    function secaoVisivel() {
        const meio = window.innerHeight / 2;
        for (const secao of document.querySelectorAll('main section[id]')) {
            const caixa = secao.getBoundingClientRect();
            if (caixa.top <= meio && caixa.bottom >= meio) return secao.id;
        }
        return 'topo';
    }

    /* ---------- Navegação pelo fluxo ---------- */
    function listaFaq() {
        return {
            texto: 'Escolha uma pergunta:',
            opcoes: [
                ...faq.map((item, indice) => ({ rotulo: item.pergunta, vai: `faq-${indice}` })),
                { rotulo: 'Voltar', vai: 'inicio' }
            ]
        };
    }

    function obterNo(id) {
        if (id === 'faq') return listaFaq();
        const correspondencia = /^faq-(\d+)$/.exec(id);
        if (correspondencia) {
            const item = faq[Number(correspondencia[1])];
            return {
                texto: item.resposta,
                opcoes: [
                    { rotulo: 'Outra pergunta', vai: 'faq' },
                    { rotulo: 'Quero um orçamento', acao: 'lead', estilo: 'primary' },
                    { rotulo: 'Voltar ao início', vai: 'inicio' }
                ]
            };
        }
        const no = fluxo[id] || fluxo.naoEntendi;
        return { ...no, texto: no.texto || mensagens.naoEntendi };
    }

    async function irPara(id) {
        const no = obterNo(id);
        await mensagemBot(no.texto);
        mostrarOpcoes(no.opcoes, escolherOpcao);
    }

    function escolherOpcao(opcao) {
        mensagemUsuario(opcao.rotulo);
        if (opcao.acao === 'lead') return iniciarLead();
        if (opcao.acao === 'whatsapp') return abrirWhatsApp(null, 'Abrindo o WhatsApp da nossa equipe.');
        return irPara(opcao.vai);
    }

    async function abrirWhatsApp(texto, aviso) {
        window.open(envio.linkWhatsApp(config.whatsapp, texto), '_blank', 'noopener,noreferrer');
        if (aviso) await mensagemBot(aviso);
        mostrarOpcoes([{ rotulo: 'Voltar ao início', vai: 'inicio' }], escolherOpcao);
    }

    /* ---------- Coleta do lead ---------- */
    async function iniciarLead() {
        estado.coletando = true;
        estado.passo = 0;
        estado.respostas = {};
        estado.pontos = 0;
        estado.origem = estado.origem || secaoVisivel();
        await mensagemBot(mensagens.leadInicio);
        await perguntarPasso();
    }

    async function perguntarPasso() {
        const passo = configLead.passos[estado.passo];
        await mensagemBot(passo.pergunta);
        if (passo.opcoes) {
            mostrarOpcoes(passo.opcoes, responderOpcao);
        } else {
            mostrarCampo(passo);
        }
    }

    function formatarTelefone(valor) {
        const digitos = valor.replace(/\D/g, '').slice(0, 11);
        if (digitos.length <= 2) return digitos.length ? `(${digitos}` : '';
        if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
    }

    const validadores = {
        texto: valor => (/\p{L}{2,}|\d{2,}/u.test(valor) ? '' : mensagens.erroTexto),
        nome: valor => (/\p{L}{2,}\s+\p{L}{1,}/u.test(valor) ? '' : mensagens.erroNome),
        telefone: valor => {
            const digitos = valor.replace(/\D/g, '');
            return digitos.length === 10 || digitos.length === 11 ? '' : mensagens.erroTelefone;
        }
    };

    async function responderOpcao(opcao) {
        const passo = configLead.passos[estado.passo];
        mensagemUsuario(opcao.rotulo);

        if (opcao.cancelar) {
            estado.coletando = false;
            await mensagemBot(mensagens.leadCancelado);
            return mostrarOpcoes(fluxo.inicio.opcoes, escolherOpcao);
        }

        estado.respostas[passo.campo] = opcao.valor || opcao.rotulo;
        estado.pontos += opcao.pontos || 0;
        await avancarPasso();
    }

    async function responderTexto(evento) {
        evento.preventDefault();
        if (estado.ocupado || !estado.coletando) return;
        const passo = configLead.passos[estado.passo];
        const valor = campo.value.trim();
        const erro = validadores[passo.validar || 'texto'](valor);
        if (erro) {
            mensagemErro.textContent = erro;
            campo.focus();
            return;
        }
        mensagemUsuario(valor);
        estado.respostas[passo.campo] = valor;
        await avancarPasso();
    }

    async function avancarPasso() {
        estado.passo += 1;
        if (estado.passo < configLead.passos.length) return perguntarPasso();
        return finalizarLead();
    }

    function classificar() {
        if (estado.pontos >= config.classificacao.quente) return 'Quente';
        if (estado.pontos >= config.classificacao.morno) return 'Morno';
        return 'Frio';
    }

    async function finalizarLead() {
        if (estado.enviando) return;
        estado.enviando = true;
        estado.coletando = false;

        const lead = {
            classificacao: classificar(),
            origem_secao: estado.origem,
            pagina: window.location.href,
            ...estado.respostas
        };

        await mensagemBot(mensagens.leadEnviando);
        estado.ocupado = true;
        const resultado = await envio.enviar(config, lead);
        estado.ocupado = false;
        estado.enviando = false;

        const textoWhatsApp = envio.mensagemWhatsApp(lead);
        const continuarWhatsApp = {
            rotulo: 'Continuar no WhatsApp',
            estilo: 'whatsapp',
            acao: 'continuar'
        };
        const aoEscolher = opcao => {
            if (opcao.acao === 'continuar') {
                mensagemUsuario(opcao.rotulo);
                return abrirWhatsApp(textoWhatsApp);
            }
            return escolherOpcao(opcao);
        };

        if (resultado.entregue) {
            await mensagemBot(mensagens.leadSucesso);
            mostrarOpcoes([continuarWhatsApp, { rotulo: 'Voltar ao início', vai: 'inicio' }], aoEscolher);
        } else {
            await mensagemBot(mensagens.leadFalha, 'tbot__msg--erro');
            mostrarOpcoes([continuarWhatsApp, { rotulo: 'Voltar ao início', vai: 'inicio' }], aoEscolher);
        }
    }

    /* ---------- Abrir, fechar, reiniciar ---------- */
    async function iniciarConversa() {
        estado.iniciado = true;
        await mensagemBot(mensagens.saudacao);
        mostrarOpcoes(fluxo.inicio.opcoes, escolherOpcao);
    }

    function abrir() {
        if (estado.aberto) return;
        estado.aberto = true;
        estado.origem = secaoVisivel();
        raiz.classList.add('is-open');
        painel.hidden = false;
        botaoAbrir.setAttribute('aria-expanded', 'true');
        if (!estado.iniciado) {
            iniciarConversa();
        } else {
            const alvo = formulario.hidden ? areaOpcoes.querySelector('button') : campo;
            if (alvo) alvo.focus({ preventScroll: true });
        }
        rolarParaOFim();
    }

    function fechar() {
        if (!estado.aberto) return;
        estado.aberto = false;
        raiz.classList.remove('is-open');
        painel.hidden = true;
        botaoAbrir.setAttribute('aria-expanded', 'false');
        botaoAbrir.focus();
    }

    function reiniciar() {
        // Durante uma resposta em andamento ou um envio, reiniciar deixaria mensagens antigas voltarem.
        if (estado.enviando || estado.ocupado) return;
        estado.coletando = false;
        estado.passo = 0;
        estado.respostas = {};
        estado.pontos = 0;
        estado.origem = secaoVisivel();
        registro.replaceChildren();
        limparOpcoes();
        esconderCampo();
        iniciarConversa();
    }

    botaoAbrir.addEventListener('click', abrir);
    botaoFechar.addEventListener('click', fechar);
    botaoReiniciar.addEventListener('click', reiniciar);
    formulario.addEventListener('submit', responderTexto);

    campo.addEventListener('input', () => {
        mensagemErro.textContent = '';
        const passo = configLead.passos[estado.passo];
        if (estado.coletando && passo && passo.mascara === 'telefone') {
            campo.value = formatarTelefone(campo.value);
        }
    });

    document.addEventListener('keydown', evento => {
        if (evento.key !== 'Escape' || !estado.aberto) return;
        // Se o modal de orçamento estiver aberto, o Esc é dele.
        if (document.body.classList.contains('quote-modal-open')) return;
        fechar();
    });
})();
