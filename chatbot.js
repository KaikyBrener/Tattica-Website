/* Assistente virtual de respostas prontas. Opcionalmente, uma IA (via proxy) responde perguntas livres. Conteúdo em chat-config.js. */
(() => {
    'use strict';
    const CFG = window.TATTICA_CHAT;
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
    let token = 0;               // muda ao recomeçar: interrompe fluxos antigos
    let started = false;
    class Cancel extends Error {}

    const scrollEnd = () => log.scrollTo({ top: log.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
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
            '',
            'Aguardo o retorno de vocês. Desde já, agradeço a atenção.'
        ].join('\n');
    }

    /* ---------- Fluxos ---------- */
    async function menu(tok, intro = true) {
        if (intro) await say(tok, `Oi! 👋 Eu sou o ${CFG.nomeAssistente.toLowerCase()}, o atendimento virtual da Tattica.`, 'Como posso ajudar você hoje?');
        const escolha = await choose(tok, [
            'Quero contratar ou pedir orçamento',
            'Dúvidas sobre a portaria virtual',
            'Sou morador e preciso de ajuda',
            ...(CFG.iaUrl ? ['Digitar a minha pergunta'] : []),
            'Falar com um atendente'
        ]);
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

    async function duvidas(tok) {
        await say(tok, 'Qual é o assunto?');
        const itens = [...CFG.faq.map(f => f.p), ...CFG.encaminharTitulos];
        const e = await choose(tok, [...itens, 'Voltar ao início']);
        if (e.label === 'Voltar ao início') return menu(tok, false);
        const faq = CFG.faq.find(f => f.p === e.label);
        if (faq) {
            await say(tok, faq.r);
            const r = await choose(tok, ['Quero um orçamento', 'Outra dúvida', 'Voltar ao início']);
            if (r.label === 'Quero um orçamento') return orcamento(tok);
            if (r.label === 'Outra dúvida') return duvidas(tok);
            return menu(tok, false);
        }
        await say(tok, CFG.encaminhar);
        const r = await choose(tok, ['Sim, enviar meu pedido', 'Voltar ao início']);
        return r.label.startsWith('Sim') ? orcamento(tok) : menu(tok, false);
    }

    async function morador(tok) {
        await say(tok, 'Sobre o que você precisa de ajuda?');
        const e = await choose(tok, [...CFG.morador.map(m => m.p), 'Falar com um atendente', 'Voltar ao início']);
        if (e.label === 'Voltar ao início') return menu(tok, false);
        if (e.label === 'Falar com um atendente') return atendente(tok);
        const item = CFG.morador.find(m => m.p === e.label);
        await say(tok, item.r);
        const r = await choose(tok, ['Outro assunto de morador', 'Falar com um atendente', 'Voltar ao início']);
        if (r.label.startsWith('Outro')) return morador(tok);
        if (r.label.startsWith('Falar')) return atendente(tok);
        return menu(tok, false);
    }

    async function atendente(tok) {
        await say(tok, 'Com quem você quer falar?');
        const e = await choose(tok, ['Comercial (contratar)', 'Manutenção, Tecnologia ou Administrativo', 'Central 24 horas', 'Voltar ao início']);
        if (e.label === 'Voltar ao início') return menu(tok, false);
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
        await say(tok, 'Quem é você?');
        lead.perfil = (await choose(tok, ['Síndico', 'Administradora', 'Morador (quero indicar)', 'Outro'])).label;
        await say(tok, 'Quantos blocos ou torres o condomínio tem?');
        lead.blocos = (await choose(tok, ['1', '2 a 4', '5 ou mais'])).label;
        lead.unidades = await ask(tok, 'Quantas unidades (apartamentos) aproximadamente?', 'number');
        await say(tok, 'Como é a portaria hoje?');
        lead.portaria = (await choose(tok, ['Portaria física (porteiros)', 'Portaria terceirizada', 'Portaria virtual', 'Não tem portaria'])).label;
        await say(tok, 'O condomínio já tem câmeras ou controle de acesso?');
        lead.estrutura = (await choose(tok, ['Sim', 'Não', 'Não sei'])).label;
        lead.local = await ask(tok, 'Qual o bairro e a cidade?');
        await say(tok, 'Já existe assembleia marcada para decidir sobre a portaria?');
        lead.assembleia = (await choose(tok, ['Sim, já marcada', 'Vamos marcar', 'Sem previsão'])).label;
        lead.nome = await ask(tok, 'Qual o seu nome?');
        lead.telefone = await ask(tok, 'Qual o seu telefone ou WhatsApp?', 'phone');

        await say(tok, 'Posso enviar estes dados ao Comercial da Tattica? Eles usam só para retornar o seu contato. Não envie documentos por aqui.');
        const ok = await choose(tok, ['Autorizo e quero enviar', 'Cancelar']);
        if (ok.label === 'Cancelar') { await say(tok, 'Tudo bem, nada foi enviado.'); return menu(tok, false); }

        lead.prioridade = lead.assembleia.startsWith('Sim') ? 'Alta' : lead.assembleia.startsWith('Vamos') ? 'Média' : 'Normal';
        lead.consentimento = 'Sim';
        lead.origem = location.pathname;
        lead.criadoEm = new Date().toISOString();

        let registrado = false;
        if (CFG.appsScriptUrl) {
            try {
                await fetch(CFG.appsScriptUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(lead) });
                registrado = true;
            } catch (_) { registrado = false; }
        }
        alive(tok);

        const texto = mensagemComercial(lead);

        await say(tok, registrado
            ? 'Pedido registrado! O Comercial recebe os seus dados.'
            : 'Pedido pronto!');
        await say(tok, dentroDoHorario()
            ? 'Toque no botão para enviar a mensagem ao Comercial pelo WhatsApp. Eles atendem agora.'
            : 'O Comercial atende de segunda a sexta, das 8h às 18h. Envie a mensagem pelo WhatsApp e eles respondem no próximo dia útil.');
        await choose(tok, [{ label: 'Enviar ao Comercial pelo WhatsApp', href: wa(texto) }, 'Voltar ao início']);
        return menu(tok, false);
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
    const hideHint = () => { clearTimeout(hintTimer); hint.classList.remove('is-visible'); setTimeout(() => { hint.hidden = true; }, 300); };
    if (!reduceMotion) {
        setTimeout(() => {
            if (!panel.hidden) return;
            hint.hidden = false;
            requestAnimationFrame(() => hint.classList.add('is-visible'));
            hintTimer = setTimeout(hideHint, 9000);
        }, 4000);
    }
    hint.addEventListener('click', () => { hideHint(); open(); });

    function open() {
        hideHint();
        panel.classList.remove('is-closing');
        panel.hidden = false;
        launcher.setAttribute('aria-expanded', 'true');
        launcher.hidden = true;
        document.body.classList.add('chat-open');
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
        run(menu);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
})();
