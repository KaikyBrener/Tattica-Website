/* Assistente virtual de respostas prontas. Opcionalmente, uma IA (via proxy) responde perguntas livres. Conteúdo em chat-config.js. */
(() => {
    'use strict';
    const CFG = window.TATTICA_CHAT;
    /* Em localhost, usa o proxy local da IA, se o iaUrl publicado estiver vazio */
    const emLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (!CFG.iaUrl && emLocalhost && CFG.iaUrlLocal) CFG.iaUrl = CFG.iaUrlLocal;
    if (!CFG) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wait = (ms) => new Promise(res => setTimeout(res, reduceMotion ? 0 : ms));

    /* ---------- Estrutura da janela (HTML fixo, sem dados de usuário) ---------- */
    const root = document.createElement('div');
    root.className = 'chat';
    root.innerHTML = `
        <button type="button" class="chat__launcher" aria-expanded="false" aria-controls="chat-panel" aria-label="Abrir atendimento virtual">
            <svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9.5h8M8 12.5h5"/></svg>
            <span class="chat__launcher-text">Fale conosco</span>
        </button>
        <p class="chat__hint" role="status" hidden>Precisa de ajuda? <strong>Fale conosco</strong></p>
        <section class="chat__panel" id="chat-panel" role="dialog" aria-label="${CFG.nomeAssistente}" hidden>
            <header class="chat__head">
                <span class="chat__avatar" aria-hidden="true"></span>
                <div>
                    <p class="chat__title">${CFG.nomeAssistente}</p>
                    <p class="chat__sub" aria-hidden="true"><span class="chat__status-dot"></span><span class="chat__status-text">Online</span></p>
                </div>
                <div class="chat__head-actions">
                    <button type="button" class="chat__icon-btn" data-chat-restart aria-label="Recomeçar a conversa" title="Recomeçar">&#8635;</button>
                    <button type="button" class="chat__icon-btn" data-chat-close aria-label="Fechar o atendimento" title="Fechar">&times;</button>
                </div>
            </header>
            <div class="chat__log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Conversa"></div>
            <form class="chat__form" hidden>
                <label class="chat__label" for="chat-input">Sua resposta</label>
                <div class="chat__form-row">
                    <input class="chat__input" id="chat-input" type="text" autocomplete="off" maxlength="80">
                    <button type="submit" class="chat__send" aria-label="Enviar resposta">&#10148;</button>
                </div>
                <p class="chat__error" role="alert"></p>
            </form>
        </section>`;
    document.body.appendChild(root);

    const launcher = root.querySelector('.chat__launcher');
    const panel = root.querySelector('.chat__panel');
    const log = root.querySelector('.chat__log');
    const form = root.querySelector('.chat__form');
    const input = root.querySelector('.chat__input');
    const label = root.querySelector('.chat__label');
    const errorEl = root.querySelector('.chat__error');
    const statusText = root.querySelector('.chat__status-text');
    const setStatus = (t) => { statusText.textContent = t; root.classList.toggle('is-typing', t !== 'Online'); };

    /* ---------- Controle da conversa ---------- */
    /* ---------- Métricas anônimas ----------
       Só guarda a etapa do chat e cliques em botões. Nunca envia nome, telefone nem texto digitado.
       O código da sessão é aleatório e vale só enquanto a página está aberta (sem cookie nem armazenamento).
       Os eventos saem em lotes para o mesmo Apps Script dos pedidos. */
    const sessao = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
    let fila = [];
    let filaTimer;
    function enviarFila() {
        clearTimeout(filaTimer);
        if (!fila.length || !CFG.appsScriptUrl) { fila = []; return; }
        const corpo = JSON.stringify({ tipo: 'eventos', sessao, eventos: fila });
        fila = [];
        try {
            const blob = new Blob([corpo], { type: 'text/plain;charset=utf-8' });
            if (!(navigator.sendBeacon && navigator.sendBeacon(CFG.appsScriptUrl, blob))) {
                fetch(CFG.appsScriptUrl, { method: 'POST', body: corpo, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, keepalive: true, mode: 'no-cors' }).catch(() => {});
            }
        } catch (_) { /* métrica nunca pode atrapalhar o chat */ }
    }
    function m(evento, detalhe = '') {
        if (!CFG.appsScriptUrl || CFG.metricas === false) return;
        fila.push({ evento, detalhe: String(detalhe).slice(0, 80), quando: new Date().toISOString() });
        if (fila.length >= 8) return enviarFila();
        clearTimeout(filaTimer);
        filaTimer = setTimeout(enviarFila, 15000);
    }
    /* Ao sair ou trocar de aba, envia o que faltou (é assim que se vê onde a pessoa parou) */
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') enviarFila(); });
    window.addEventListener('pagehide', enviarFila);

    let token = 0;               // muda ao recomeçar: interrompe fluxos antigos
    let started = false;
    class Cancel extends Error {}

    const scrollEnd = () => log.scrollTo({ top: log.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
    /* Quando a área da conversa muda de tamanho (campo de texto abre ou fecha, teclado do celular),
       mantém a última mensagem à vista, se a pessoa já estava lendo o fim. */
    if ('ResizeObserver' in window) {
        let ultimaAltura = log.clientHeight;
        new ResizeObserver(() => {
            const encolheu = log.clientHeight < ultimaAltura;
            ultimaAltura = log.clientHeight;
            if (encolheu) log.scrollTop = log.scrollHeight;
        }).observe(log);
    }
    const alive = (tok) => { if (tok !== token) throw new Cancel(); };

    function addBubble(text, who) {
        const el = document.createElement('div');
        el.className = `chat__msg chat__msg--${who}`;
        el.textContent = text;
        el.dataset.time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        log.appendChild(el);
        scrollEnd();
        return el;
    }

    /* Indicador "digitando": escondido do leitor de tela, que só lê a mensagem pronta */
    function addTyping() {
        const el = document.createElement('div');
        el.className = 'chat__msg chat__msg--bot is-typing';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="chat__dot"></span><span class="chat__dot"></span><span class="chat__dot"></span>';
        log.appendChild(el);
        scrollEnd();
        return el;
    }

    /* Quebra respostas longas em mensagens curtas, como uma pessoa faria no chat */
    function pedacos(texto) {
        const paragrafos = texto.split(/\n\n+/);
        const out = [];
        paragrafos.forEach((p) => {
            if (p.length <= 170) return out.push(p);
            const frases = p.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [p];
            let atual = '';
            frases.forEach((f) => {
                if ((atual + f).length > 170 && atual) { out.push(atual.trim()); atual = ''; }
                atual += f;
            });
            if (atual.trim()) out.push(atual.trim());
        });
        return out;
    }

    const RITMO = Object.assign({ pausa: 450, base: 700, porCaractere: 16, max: 2400 }, CFG.digitacao);

    async function say(tok, ...texts) {
        const todos = texts.flatMap(pedacos);
        for (let i = 0; i < todos.length; i++) {
            const t = todos[i];
            await wait(i === 0 ? RITMO.pausa : 250);      // "lendo" antes de começar a digitar
            alive(tok);
            setStatus('digitando…');
            const typing = addTyping();
            await wait(Math.min(RITMO.max, RITMO.base + t.length * RITMO.porCaractere));
            alive(tok);
            typing.remove();
            addBubble(t, 'bot').classList.add('is-written');
            setStatus('Online');
            scrollEnd();
        }
    }

    /* Botões de escolha. Cada item: texto ou { label, href }. Retorna o item escolhido. */
    function choose(tok, options) {
        return new Promise((resolve, reject) => {
            const box = document.createElement('div');
            box.className = 'chat__options';
            options.forEach((opt, i) => {
                const item = typeof opt === 'string' ? { label: opt } : opt;
                let el;
                if (item.href) {
                    el = document.createElement('a');
                    el.href = item.href;
                    el.target = item.href.startsWith('tel:') ? '_self' : '_blank';
                    el.rel = 'noopener noreferrer';
                    el.className = 'chat__opt chat__opt--link';
                    el.style.setProperty('--i', i);
                    el.textContent = item.label;
                    el.addEventListener('click', () => m('link_clique', item.label));
                    box.appendChild(el);
                    return;
                }
                el = document.createElement('button');
                el.type = 'button';
                el.className = 'chat__opt';
                el.style.setProperty('--i', i);
                el.textContent = item.label;
                el.addEventListener('click', () => {
                    if (tok !== token) return reject(new Cancel());
                    box.remove();
                    log.focus({ preventScroll: true });
                    addBubble(item.label, 'user');
                    resolve(item);
                });
                box.appendChild(el);
            });
            log.appendChild(box);
            scrollEnd();
            const first = box.querySelector('button, a');
            if (first && panel.contains(document.activeElement) === false) first.focus({ preventScroll: true });
            else first?.focus({ preventScroll: true });
        });
    }

    /* Pergunta de texto livre. kind: 'text' | 'number' | 'phone'. */
    function ask(tok, prompt, kind = 'text') {
        return new Promise(async (resolve, reject) => {
            try { await say(tok, prompt); } catch (e) { return reject(e); }
            label.textContent = prompt;
            input.value = '';
            input.type = kind === 'number' ? 'text' : 'text';
            input.inputMode = kind === 'text' ? 'text' : 'numeric';
            input.maxLength = kind === 'phone' ? 15 : kind === 'longo' ? 300 : 80;
            input.placeholder = kind === 'phone' ? '(27) 99999-9999' : kind === 'longo' ? 'Digite a sua pergunta' : '';
            errorEl.textContent = '';
            form.hidden = false;
            input.focus();

            const clean = (v) => v.replace(/\s+/g, ' ').trim();
            const maskPhone = () => {
                const d = input.value.replace(/\D/g, '').slice(0, 11);
                input.value = d.length <= 2 ? (d ? `(${d}` : '')
                    : d.length <= 7 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
                        : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
            };
            const onInput = () => { if (kind === 'phone') maskPhone(); if (kind === 'number') input.value = input.value.replace(/\D/g, '').slice(0, 5); };
            const done = () => { form.removeEventListener('submit', onSubmit); input.removeEventListener('input', onInput); form.hidden = true; };
            const onSubmit = (ev) => {
                ev.preventDefault();
                if (tok !== token) { done(); return reject(new Cancel()); }
                const value = clean(input.value);
                if (!value) { errorEl.textContent = 'Escreva a sua resposta e toque em enviar.'; return; }
                if (kind === 'phone' && value.replace(/\D/g, '').length < 10) { errorEl.textContent = 'Telefone incompleto. Digite com DDD, por exemplo (27) 99999-9999.'; return; }
                if (kind === 'number' && Number(value) < 1) { errorEl.textContent = 'Digite um número maior que zero, só com algarismos.'; return; }
                done();
                addBubble(value, 'user');
                resolve(value);
            };
            form.addEventListener('submit', onSubmit);
            input.addEventListener('input', onInput);
        });
    }

    /* ---------- Horário do Comercial ---------- */
    function dentroDoHorario() {
        const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const h = CFG.horarioComercial;
        return h.dias.includes(agora.getDay()) && agora.getHours() >= h.inicio && agora.getHours() < h.fim;
    }

    const wa = (texto) => `https://wa.me/${CFG.whatsappComercial}?text=${encodeURIComponent(texto)}`;

    function saudacao() {
        const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getHours();
        return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    }

    /* Triagem informativa: só aponta o que o Comercial precisa confirmar. Não promete nem nega nada. */
    function pontosAvaliar(l) {
        const p = [];
        if (l.internet === 'Pode contratar') p.push('contratação da fibra óptica (mín. 10 Mb)');
        if (l.internet === 'Não sei') p.push('internet: confirmar se há fibra óptica de no mínimo 10 Mb');
        if (l.interfone === 'Não') p.push('interfone sem cabeamento: avaliar a estrutura');
        if (l.interfone === 'Não sei') p.push('cabeamento do interfone: confirmar');
        if (l.estrutura === 'Sim') p.push('câmeras ou acesso existentes: avaliar compatibilidade');
        return p;
    }

    /* Resumo para o síndico levar à assembleia. Só usa fatos já aprovados no FAQ. */
    function resumoAssembleia(l) {
        const blocos = l.blocos === '1' ? '1 bloco' : l.blocos === '5 ou mais' ? '5 ou mais blocos' : `${l.blocos} blocos`;
        return [
            'RESUMO PARA ASSEMBLEIA: PORTARIA VIRTUAL TATTICA',
            '',
            'Dados do condomínio',
            `- Localização: ${l.local}`,
            `- Porte: ${blocos}, cerca de ${l.unidades} unidades`,
            `- Portaria atual: ${l.portaria.toLowerCase()}`,
            '',
            'Pauta sugerida',
            '- Apresentação da proposta de portaria virtual da Tattica.',
            '- Deliberação sobre a contratação, conforme a convenção do condomínio.',
            '',
            'Pontos que o Comercial esclarece',
            '- Implantação: geralmente cerca de 2 meses, conforme o condomínio.',
            '- Internet: fibra óptica de no mínimo 10 Mb full, contratada pelo condomínio.',
            '- Cabeamento do interfone existente é aproveitado; serviços de estrutura (alvenaria, tubulação, gesso) são avaliados à parte.',
            '- Imagens das câmeras guardadas por 15 dias, conforme o contrato.',
            '- Valores: apresentados na proposta comercial.',
            '',
            `Comercial Tattica: segunda a sexta, das 8h às 18h. Telefone ${CFG.contatos[0].texto}.`
        ].join('\n');
    }

    /* Mensagem profissional enviada ao Comercial pelo WhatsApp */
    function mensagemComercial(l) {
        const pedido = {
            'Síndico': 'uma proposta de portaria virtual para o condomínio do qual sou síndico(a)',
            'Administradora': 'uma proposta de portaria virtual para um condomínio sob a nossa administração',
            'Morador (quero indicar)': 'informações sobre portaria virtual, pois pretendo indicar o serviço ao síndico do meu condomínio',
            'Outro': 'uma proposta de portaria virtual para um condomínio'
        }[l.perfil];
        const estrutura = { 'Sim': 'já possui', 'Não': 'não possui', 'Não sei': 'não sei informar' }[l.estrutura];
        const assembleia = { 'Sim, já marcada': 'já marcada', 'Vamos marcar': 'em fase de agendamento', 'Sem previsão': 'sem previsão no momento' }[l.assembleia];
        const blocos = l.blocos === '1' ? '1 bloco' : l.blocos === '5 ou mais' ? '5 ou mais blocos' : `${l.blocos} blocos`;
        return [
            `${saudacao()}, equipe Comercial da Tattica.`,
            '',
            `Entrei em contato pelo site e gostaria de receber ${pedido}. Seguem as informações:`,
            '',
            `*Nome:* ${l.nome}`,
            `*Perfil:* ${l.perfil}`,
            `*Telefone:* ${l.telefone}`,
            `*Localização:* ${l.local}`,
            `*Porte:* ${blocos} e cerca de ${l.unidades} unidades`,
            `*Portaria atual:* ${l.portaria.toLowerCase()}`,
            `*Câmeras ou controle de acesso:* ${estrutura}`,
            `*Assembleia:* ${assembleia}`,
            `*Internet (fibra 10 Mb):* ${l.internet.toLowerCase()}`,
            `*Cabeamento do interfone:* ${l.interfone.toLowerCase()}`,
            '',
            'Aguardo o retorno de vocês. Desde já, agradeço a atenção.'
        ].join('\n');
    }

    /* ---------- Fluxos ---------- */
    async function menu(tok, intro = true) {
        if (intro) await say(tok, 'Oi! 👋 Eu sou o assistente virtual da Tattica.', 'Como posso ajudar você hoje?');
        const escolha = await choose(tok, [
            'Quero contratar ou pedir orçamento',
            'Dúvidas sobre a portaria virtual',
            'Sou morador e preciso de ajuda',
            ...(CFG.iaUrl ? ['Digitar a minha pergunta'] : []),
            'Falar com um atendente'
        ]);
        m('menu', escolha.label);
        if (escolha.label.startsWith('Quero')) return orcamento(tok);
        if (escolha.label.startsWith('Dúvidas')) return duvidas(tok);
        if (escolha.label.startsWith('Sou morador')) return morador(tok);
        if (escolha.label.startsWith('Digitar')) return perguntar(tok);
        return atendente(tok);
    }

    /* Pergunta livre respondida por IA (opcional, via proxy em ia-proxy/). Só usa o conteúdo aprovado. */
    async function consultarIA(pergunta) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        try {
            const r = await fetch(CFG.iaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pergunta }),
                signal: ctrl.signal
            });
            if (!r.ok) return { erro: true };
            return await r.json();
        } catch { return { erro: true }; } finally { clearTimeout(timer); }
    }

    async function perguntar(tok) {
        await say(tok, 'Pode escrever a sua dúvida. Respondo com o que a Tattica já divulgou. Sou um assistente virtual e posso errar, então, se preferir, fale com um atendente.');
        for (;;) {
            const texto = await ask(tok, 'Qual é a sua pergunta?', 'longo');
            setStatus('digitando…');
            const typing = addTyping();
            const [r] = await Promise.all([consultarIA(texto), wait(900)]);
            alive(tok);
            typing.remove();
            setStatus('Online');
            let sugerir = false;
            if (r.recusar) {
                await say(tok, CFG.recusar || 'Não posso ajudar com isso. Posso ajudar com dúvidas sobre a portaria virtual da Tattica.');
                const op = await choose(tok, ['Fazer outra pergunta', 'Voltar ao início']);
                if (op.label.startsWith('Voltar')) return menu(tok, false);
                continue;
            }
            if (r.erro) {
                await say(tok, 'Não consegui responder agora por uma falha minha. Quer falar com um atendente?');
                sugerir = true;
            } else if (r.encaminhar || !r.resposta) {
                await say(tok, CFG.encaminhar);
                sugerir = true;
            } else {
                await say(tok, r.resposta);
            }
            const op = await choose(tok, sugerir
                ? ['Fazer o pedido pelo chat', 'Falar com um atendente', 'Fazer outra pergunta', 'Voltar ao início']
                : ['Fazer outra pergunta', 'Falar com um atendente', 'Voltar ao início']);
            if (op.label.startsWith('Fazer o pedido')) return orcamento(tok);
            if (op.label.startsWith('Falar')) return atendente(tok);
            if (op.label.startsWith('Voltar')) return menu(tok, false);
        }
    }

    async function duvidas(tok, tema) {
        const temas = [...new Set(CFG.faq.map(f => f.tema).filter(Boolean))];
        /* Com temas configurados, primeiro escolhe o tema e depois a pergunta */
        if (temas.length && !tema) {
            await say(tok, 'Qual é o assunto?');
            const t = await choose(tok, [...temas, ...CFG.encaminharTitulos, 'Voltar ao início']);
            if (t.label === 'Voltar ao início') return menu(tok, false);
            if (temas.includes(t.label)) { m('duvida_tema', t.label); return duvidas(tok, t.label); }
            return encaminharDuvida(tok);
        }
        const lista = tema ? CFG.faq.filter(f => f.tema === tema) : CFG.faq;
        await say(tok, tema ? 'Qual é a sua dúvida?' : 'Qual é o assunto?');
        const e = await choose(tok, [...lista.map(f => f.p), ...(tema ? ['Ver outros temas'] : CFG.encaminharTitulos), 'Voltar ao início']);
        if (e.label === 'Voltar ao início') return menu(tok, false);
        if (e.label === 'Ver outros temas') return duvidas(tok);
        const faq = lista.find(f => f.p === e.label);
        if (!faq) { m('duvida_sem_resposta', e.label); return encaminharDuvida(tok); }
        m('duvida', faq.p);
        await say(tok, faq.r);
        const r = await choose(tok, ['Quero um orçamento', 'Outra dúvida', 'Voltar ao início']);
        if (r.label === 'Quero um orçamento') return orcamento(tok);
        if (r.label === 'Outra dúvida') return duvidas(tok, tema);
        return menu(tok, false);
    }

    async function encaminharDuvida(tok) {
        await say(tok, CFG.encaminhar);
        const r = await choose(tok, ['Sim, enviar meu pedido', 'Voltar ao início']);
        return r.label.startsWith('Sim') ? orcamento(tok) : menu(tok, false);
    }

    async function morador(tok) {
        await say(tok, 'Sobre o que você precisa de ajuda?');
        const e = await choose(tok, [...CFG.morador.map(m => m.p), 'Falar com um atendente', 'Voltar ao início']);
        if (e.label === 'Voltar ao início') return menu(tok, false);
        if (e.label === 'Falar com um atendente') return atendente(tok);
        const item = CFG.morador.find((x) => x.p === e.label);
        m('morador', item.p);
        await say(tok, item.r);
        const video = /^https:\/\//.test(item.video || '') ? [{ label: 'Assistir ao vídeo tutorial', href: item.video }] : [];
        const r = await choose(tok, [...video, 'Outro assunto de morador', 'Falar com um atendente', 'Voltar ao início']);
        if (r.label.startsWith('Outro')) return morador(tok);
        if (r.label.startsWith('Falar')) return atendente(tok);
        return menu(tok, false);
    }

    async function atendente(tok) {
        await say(tok, 'Com quem você quer falar?');
        const e = await choose(tok, ['Comercial (contratar)', 'Manutenção, Tecnologia ou Administrativo', 'Central 24 horas', 'Voltar ao início']);
        if (e.label === 'Voltar ao início') return menu(tok, false);
        m('atendente', e.label);
        if (e.label.startsWith('Comercial')) {
            await say(tok, dentroDoHorario()
                ? 'O Comercial atende de segunda a sexta, das 8h às 18h, e está no horário agora. Toque para abrir o WhatsApp.'
                : 'O Comercial atende de segunda a sexta, das 8h às 18h. Agora está fora do horário, mas você pode deixar a mensagem e eles respondem no próximo dia útil.');
            const r = await choose(tok, [
                { label: 'Abrir WhatsApp do Comercial', href: wa(`${saudacao()}, equipe Comercial da Tattica. Entrei em contato pelo site e gostaria de falar com um consultor sobre portaria virtual.`) },
                'Fazer o pedido pelo chat', 'Voltar ao início'
            ]);
            return r.label.startsWith('Fazer') ? orcamento(tok) : menu(tok, false);
        }
        if (e.label.startsWith('Manutenção')) {
            const c = CFG.contatos[0];
            await say(tok, `Ligue para ${c.texto}. ${c.obs}`);
        } else {
            await say(tok, 'A central funciona 24 horas. Escolha a sua região:');
        }
        const links = e.label.startsWith('Manutenção')
            ? [{ label: `Ligar ${CFG.contatos[0].texto}`, href: `tel:${CFG.contatos[0].tel}` }]
            : CFG.contatos.slice(1).map(c => ({ label: `${c.nome}: ${c.texto}`, href: `tel:${c.tel}` }));
        await choose(tok, [...links, 'Voltar ao início']);
        return menu(tok, false);
    }

    /* ---------- Orçamento: qualifica e entrega ao Comercial ---------- */
    async function orcamento(tok) {
        const lead = {};
        await say(tok, 'Ótimo! Vou fazer algumas perguntas rápidas para o Comercial já chegar preparado. Leva cerca de 1 minuto.');
        m('orc_inicio');
        m('orc_passo', 'perfil');
        await say(tok, 'Quem é você?');
        lead.perfil = (await choose(tok, ['Síndico', 'Administradora', 'Morador (quero indicar)', 'Outro'])).label;
        m('orc_passo', 'blocos');
        await say(tok, 'Quantos blocos ou torres o condomínio tem?');
        lead.blocos = (await choose(tok, ['1', '2 a 4', '5 ou mais'])).label;
        m('orc_passo', 'unidades');
        lead.unidades = await ask(tok, 'Quantas unidades (apartamentos) aproximadamente?', 'number');
        m('orc_passo', 'portaria');
        await say(tok, 'Como é a portaria hoje?');
        lead.portaria = (await choose(tok, ['Portaria física (porteiros)', 'Portaria terceirizada', 'Portaria virtual', 'Não tem portaria'])).label;
        m('orc_passo', 'estrutura');
        await say(tok, 'O condomínio já tem câmeras ou controle de acesso?');
        lead.estrutura = (await choose(tok, ['Sim', 'Não', 'Não sei'])).label;
        m('orc_passo', 'internet');
        await say(tok, 'O condomínio tem, ou pode contratar, internet por fibra óptica de no mínimo 10 Mb? Essa contratação fica por conta do condomínio.');
        lead.internet = (await choose(tok, ['Já tem fibra óptica', 'Pode contratar', 'Não sei'])).label;
        m('orc_passo', 'interfone');
        await say(tok, 'O interfone atual tem cabeamento? A proposta aproveita o cabeamento que já existe.');
        lead.interfone = (await choose(tok, ['Sim', 'Não', 'Não sei'])).label;
        lead.pontos = pontosAvaliar(lead);
        m('orc_passo', 'local');
        lead.local = await ask(tok, 'Qual o bairro e a cidade?');
        m('orc_passo', 'assembleia');
        await say(tok, 'Já existe assembleia marcada para decidir sobre a portaria?');
        lead.assembleia = (await choose(tok, ['Sim, já marcada', 'Vamos marcar', 'Sem previsão'])).label;
        m('orc_passo', 'nome');
        lead.nome = await ask(tok, 'Qual o seu nome?');
        m('orc_passo', 'telefone');
        lead.telefone = await ask(tok, 'Qual o seu telefone ou WhatsApp?', 'phone');

        m('orc_passo', 'autorizacao');
        await say(tok, 'Posso enviar estes dados ao Comercial da Tattica? Eles usam só para retornar o seu contato. Não envie documentos por aqui.');
        const ok = await choose(tok, ['Autorizo e quero enviar', { label: 'Ler a política de privacidade', href: 'privacidade.html' }, 'Cancelar']);
        if (ok.label === 'Cancelar') { m('orc_cancelado'); await say(tok, 'Tudo bem, nada foi enviado.'); return menu(tok, false); }

        lead.prioridade = lead.assembleia.startsWith('Sim') ? 'Alta' : lead.assembleia.startsWith('Vamos') ? 'Média' : 'Normal';
        lead.consentimento = 'Sim';
        lead.origem = location.pathname;
        lead.criadoEm = new Date().toISOString();

        let situacao = await registrarPedido(lead);
        alive(tok);
        m('orc_resultado', situacao);

        const texto = mensagemComercial(lead);

        if (situacao === 'falhou') {
            for (;;) {
                await say(tok, 'Não consegui confirmar o registro do pedido por aqui. Para garantir que o Comercial receba, envie pelo WhatsApp: a mensagem já está pronta.');
                const r = await choose(tok, [{ label: 'Enviar ao Comercial pelo WhatsApp', href: wa(texto) }, 'Tentar enviar de novo', 'Voltar ao início']);
                if (r.label.startsWith('Voltar')) return menu(tok, false);
                setStatus('digitando…');
                const typing = addTyping();
                situacao = await registrarPedido(lead);
                alive(tok);
                m('orc_resultado', situacao === 'falhou' ? 'falhou_de_novo' : situacao);
                typing.remove();
                setStatus('Online');
                if (situacao !== 'falhou') break;
            }
        }

        await say(tok, situacao === 'confirmado'
            ? 'Pedido registrado! O Comercial recebe os seus dados.'
            : 'Pedido pronto!');
        await say(tok, dentroDoHorario()
            ? 'Toque no botão para enviar a mensagem ao Comercial pelo WhatsApp. Eles atendem agora.'
            : 'O Comercial atende de segunda a sexta, das 8h às 18h. Envie a mensagem pelo WhatsApp e eles respondem no próximo dia útil.');
        await say(tok, lead.pontos.length
            ? 'Pontos que o Comercial vai avaliar com vocês: ' + lead.pontos.join('; ') + '.'
            : 'Pela sua resposta, não há pendências a avaliar agora. O Comercial confirma os detalhes na proposta.');
        let resumoFeito = false;
        for (;;) {
            const r = await choose(tok, [
                { label: 'Enviar ao Comercial pelo WhatsApp', href: wa(texto) },
                ...(resumoFeito ? [] : ['Copiar resumo para a assembleia']),
                'Voltar ao início'
            ]);
            if (r.label.startsWith('Voltar')) break;
            resumoFeito = true;
            m('orc_resumo_copiado');
            const resumo = resumoAssembleia(lead);
            let copiou = false;
            try { await navigator.clipboard.writeText(resumo); copiou = true; } catch (_) { /* sem permissão: mostra o texto */ }
            await say(tok, copiou ? 'Resumo copiado! Cole no documento da assembleia.' : 'Não consegui copiar sozinho. Selecione o texto abaixo e copie:', ...(copiou ? [] : [resumo]));
        }
        return menu(tok, false);
    }

    /* Envia o pedido ao script do Google e LÊ a resposta, em vez de assumir que deu certo.
       Retorna 'confirmado', 'falhou' ou 'sem-planilha' (quando não há script configurado).
       O Content-Type text/plain evita a verificação prévia (preflight) do navegador. */
    async function registrarPedido(lead) {
        if (!CFG.appsScriptUrl) return 'sem-planilha';
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
            const r = await fetch(CFG.appsScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(lead),
                signal: ctrl.signal
            });
            if (!r.ok) return 'falhou';
            const resposta = await r.json();
            return resposta && resposta.ok === true ? 'confirmado' : 'falhou';
        } catch (_) {
            return 'falhou';
        } finally {
            clearTimeout(timer);
        }
    }

    /* ---------- Abrir, fechar, recomeçar ---------- */
    async function run(fn) {
        const tok = ++token;
        log.replaceChildren();
        form.hidden = true;
        setStatus('Online');
        try { await fn(tok); } catch (e) { if (!(e instanceof Cancel)) console.error(e); }
    }

    const hint = root.querySelector('.chat__hint');
    let hintTimer;
    /* O balão fica à esquerda do botão do chat, para nunca cobrir o botão de voltar ao topo (acima dele) */
    const posicionarHint = () => {
        const r = launcher.getBoundingClientRect();
        hint.style.right = `${Math.round(window.innerWidth - r.left + 12)}px`;
        hint.style.bottom = `${Math.round(window.innerHeight - r.bottom)}px`;
    };
    const hideHint = () => { clearTimeout(hintTimer); hint.classList.remove('is-visible'); setTimeout(() => { hint.hidden = true; }, 300); };
    if (!reduceMotion) {
        setTimeout(() => {
            if (!panel.hidden) return;
            hint.hidden = false;
            posicionarHint();
            requestAnimationFrame(() => hint.classList.add('is-visible'));
            hintTimer = setTimeout(hideHint, 9000);
        }, 4000);
    }
    hint.addEventListener('click', () => { m('balao_clique'); hideHint(); open(); });

    function open() {
        hideHint();
        panel.classList.remove('is-closing');
        panel.hidden = false;
        launcher.setAttribute('aria-expanded', 'true');
        launcher.hidden = true;
        document.body.classList.add('chat-open');
        m('chat_aberto', dentroDoHorario() ? 'no horário' : 'fora do horário');
        if (!started) { started = true; run(menu); }
        panel.querySelector('button, input, a')?.focus({ preventScroll: true });
    }
    function close() {
        const finish = () => {
            panel.hidden = true;
            panel.classList.remove('is-closing');
            launcher.hidden = false;
            launcher.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('chat-open');
            launcher.focus();
        };
        if (reduceMotion) return finish();
        panel.classList.add('is-closing');
        panel.addEventListener('animationend', finish, { once: true });
    }

    launcher.addEventListener('click', open);
    root.querySelector('[data-chat-close]').addEventListener('click', close);
    const restartBtn = root.querySelector('[data-chat-restart]');
    restartBtn.addEventListener('click', () => {
        restartBtn.classList.remove('is-spinning'); void restartBtn.offsetWidth; restartBtn.classList.add('is-spinning');
        m('reiniciou');
        run(menu);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
})();
