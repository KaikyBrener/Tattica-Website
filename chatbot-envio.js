/* ==========================================================================
   TATTICA — chatbot: envio do lead.
   Dispara os destinos ativos ao mesmo tempo (Apps Script + Web3Forms).
   O lead conta como entregue se pelo menos um deles confirmar.
   ========================================================================== */

window.TATTICA_BOT_ENVIO = (() => {
    'use strict';

    const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

    const CAMPOS = [
        ['classificacao', 'Classificação'],
        ['perfil', 'Perfil'],
        ['nome', 'Nome'],
        ['telefone', 'Telefone'],
        ['condominio', 'Condomínio'],
        ['cidade_bairro', 'Cidade e bairro'],
        ['unidades', 'Unidades'],
        ['portaria_atual', 'Portaria atual'],
        ['cameras', 'Câmeras'],
        ['prazo', 'Prazo'],
        ['origem_secao', 'Seção de origem'],
        ['pagina', 'Página'],
        ['consentimento', 'Consentimento']
    ];

    // Texto em linhas, usado no e-mail do Web3Forms e na mensagem do WhatsApp.
    function resumo(lead) {
        return CAMPOS
            .filter(([chave]) => lead[chave])
            .map(([chave, rotulo]) => `${rotulo}: ${lead[chave]}`)
            .join('\n');
    }

    function mensagemWhatsApp(lead) {
        const linhas = [
            'Olá! Vim pelo site da Tattica e quero solicitar um orçamento.',
            '',
            ['perfil', 'nome', 'telefone', 'condominio', 'cidade_bairro', 'unidades', 'portaria_atual', 'cameras', 'prazo']
                .filter(chave => lead[chave])
                .map(chave => `${CAMPOS.find(([c]) => c === chave)[1]}: ${lead[chave]}`)
                .join('\n')
        ];
        return linhas.join('\n');
    }

    function linkWhatsApp(numero, texto) {
        return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
    }

    async function postarJson(url, corpo, cabecalhos, limiteMs) {
        const controle = new AbortController();
        const timer = setTimeout(() => controle.abort(), limiteMs);
        try {
            const resposta = await fetch(url, {
                method: 'POST',
                headers: cabecalhos,
                body: JSON.stringify(corpo),
                signal: controle.signal
            });
            return await resposta.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async function enviarAppsScript(config, lead) {
        if (!config.appsScriptUrl) throw new Error('Apps Script desativado');
        // text/plain evita o preflight de CORS, que o Apps Script não responde.
        const dados = await postarJson(
            config.appsScriptUrl,
            { site: '', ...lead },
            { 'Content-Type': 'text/plain;charset=utf-8' },
            config.tempoLimiteEnvioMs
        );
        if (!dados || dados.ok !== true) throw new Error((dados && dados.erro) || 'Apps Script recusou o envio');
    }

    async function enviarWeb3Forms(config, lead) {
        if (!config.web3formsKey) throw new Error('Web3Forms desativado');
        const dados = await postarJson(
            WEB3FORMS_URL,
            {
                access_key: config.web3formsKey,
                subject: `Novo lead do site (${lead.classificacao}) - ${lead.nome}`,
                from_name: 'Chatbot do site Tattica',
                message: resumo(lead),
                botcheck: '',
                ...lead
            },
            { 'Content-Type': 'application/json', Accept: 'application/json' },
            config.tempoLimiteEnvioMs
        );
        if (!dados || dados.success !== true) throw new Error((dados && dados.message) || 'Web3Forms recusou o envio');
    }

    // Retorna { entregue: boolean, destinos: { appsScript, web3forms } } com "ok", "falhou" ou "desativado".
    async function enviar(config, lead) {
        const tarefas = {
            appsScript: enviarAppsScript(config, lead),
            web3forms: enviarWeb3Forms(config, lead)
        };
        const chaves = Object.keys(tarefas);
        const resultados = await Promise.allSettled(chaves.map(chave => tarefas[chave]));

        const destinos = {};
        resultados.forEach((resultado, i) => {
            if (resultado.status === 'fulfilled') destinos[chaves[i]] = 'ok';
            else destinos[chaves[i]] = /desativado/.test(resultado.reason && resultado.reason.message) ? 'desativado' : 'falhou';
        });

        return { entregue: chaves.some(chave => destinos[chave] === 'ok'), destinos };
    }

    return { enviar, mensagemWhatsApp, linkWhatsApp };
})();
