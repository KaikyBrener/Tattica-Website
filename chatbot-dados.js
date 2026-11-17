/* ==========================================================================
   TATTICA — chatbot: configuração, textos e fluxo da conversa.
   Para mudar o que o bot diz ou pergunta, edite só este arquivo.
   ========================================================================== */

window.TATTICA_BOT = {

    /* ---------- Configuração ---------- */
    config: {
        nomeBot: 'Assistente Tattica',
        subtitulo: 'Portaria virtual',
        whatsapp: '552730262196',

        // Destinos do lead. Deixe vazio para desativar o destino.
        appsScriptUrl: 'https://script.google.com/macros/s/AKfycbz3oAEV35nzzJgJEHMP19m-PqERq-wDluynQUKBopgFOjKNHZBfUqxo8hlEaAId5dHJKg/exec',
        web3formsKey: '',

        tempoLimiteEnvioMs: 12000,

        // Pontuação mínima (soma dos "pontos" das respostas) para cada classificação.
        classificacao: { quente: 5, morno: 3 }
    },

    mensagens: {
        saudacao: 'Olá! Sou o assistente da Tattica, empresa de portaria virtual do Espírito Santo. Como posso ajudar?',
        naoEntendi: 'Não encontrei essa resposta por aqui. Posso te levar para a nossa equipe no WhatsApp.',
        leadInicio: 'Vou fazer algumas perguntas rápidas para a nossa equipe preparar o orçamento do seu condomínio.',
        leadCancelado: 'Tudo bem, não enviei nada. Se mudar de ideia, é só pedir o orçamento de novo.',
        leadEnviando: 'Enviando seus dados…',
        leadSucesso: 'Recebemos seus dados. Nossa equipe vai entrar em contato em breve.',
        leadFalha: 'Não consegui enviar agora. Para não perder o seu pedido, envie pelo WhatsApp: a mensagem já está pronta.',
        erroNome: 'Digite pelo menos o nome e um sobrenome.',
        erroTelefone: 'Digite o telefone com DDD, por exemplo (27) 99999-9999.',
        erroTexto: 'Digite pelo menos 2 letras.'
    },

    /* ---------- Árvore de conversa ----------
       Cada nó tem um texto e botões. Um botão leva a outro nó ("vai") ou
       executa uma ação: "lead" (coleta o orçamento), "whatsapp" (abre o
       WhatsApp) ou "faq" (lista de perguntas frequentes). */
    fluxo: {
        inicio: {
            texto: 'Escolha uma opção:',
            opcoes: [
                { rotulo: 'Sou síndico ou administro um condomínio', vai: 'sindico' },
                { rotulo: 'Sou morador', vai: 'morador' },
                { rotulo: 'Perguntas frequentes', vai: 'faq' },
                { rotulo: 'Falar com a equipe', acao: 'whatsapp', estilo: 'whatsapp' }
            ]
        },

        sindico: {
            texto: 'A Tattica opera portaria virtual com central de monitoramento 24 horas, controle de acesso e câmeras. Posso preparar um pedido de orçamento para o seu condomínio.',
            opcoes: [
                { rotulo: 'Quero um orçamento', acao: 'lead', estilo: 'primary' },
                { rotulo: 'Como funciona a portaria virtual', vai: 'comoFunciona' },
                { rotulo: 'Quais são as soluções', vai: 'solucoes' },
                { rotulo: 'Voltar', vai: 'inicio' }
            ]
        },

        comoFunciona: {
            texto: 'O visitante aciona a central pelo interfone. O operador faz o atendimento e identifica a pessoa, e a central entra em contato com o morador, que confirma ou não a entrada. Em seguida o acesso é liberado remotamente e a operação fica registrada no sistema.',
            opcoes: [
                { rotulo: 'Quero um orçamento', acao: 'lead', estilo: 'primary' },
                { rotulo: 'Quais são as soluções', vai: 'solucoes' },
                { rotulo: 'Voltar', vai: 'sindico' }
            ]
        },

        solucoes: {
            texto: 'São três frentes, operadas pela mesma equipe:\n• Portaria virtual\n• Controle de acesso (tags, biometria, QR Code e chaves virtuais)\n• Monitoramento por câmeras, acompanhado pela central',
            opcoes: [
                { rotulo: 'Quero um orçamento', acao: 'lead', estilo: 'primary' },
                { rotulo: 'Como funciona a portaria virtual', vai: 'comoFunciona' },
                { rotulo: 'Voltar', vai: 'sindico' }
            ]
        },

        morador: {
            texto: 'O Tattica Center é o aplicativo do condomínio, desenvolvido e mantido pela própria Tattica. Nele o morador abre portas e portões por QR Code, cria chaves virtuais para visitantes, vê as câmeras em tempo real, agenda áreas comuns e acessa emergência e WhatsApp com um toque.',
            opcoes: [
                { rotulo: 'Perguntas frequentes', vai: 'faq' },
                { rotulo: 'Falar com a equipe', acao: 'whatsapp', estilo: 'whatsapp' },
                { rotulo: 'Quero levar a Tattica ao meu condomínio', vai: 'sindico' },
                { rotulo: 'Voltar', vai: 'inicio' }
            ]
        },

        naoEntendi: {
            texto: null, // usa mensagens.naoEntendi
            opcoes: [
                { rotulo: 'Falar com a equipe', acao: 'whatsapp', estilo: 'whatsapp' },
                { rotulo: 'Voltar ao início', vai: 'inicio' }
            ]
        }
    },

    /* ---------- Perguntas frequentes (mesmas respostas do site) ---------- */
    faq: [
        {
            pergunta: 'O que é portaria virtual?',
            resposta: 'É a operação remota de acesso e monitoramento de um condomínio, com atendimento por uma central e apoio de sistemas de controle e comunicação.'
        },
        {
            pergunta: 'A portaria funciona 24 horas?',
            resposta: 'Sim. A central acompanha os acessos e as ocorrências durante o dia todo.'
        },
        {
            pergunta: 'Como o visitante entra no condomínio?',
            resposta: 'O visitante aciona a central pelo interfone e o operador realiza o atendimento e identifica a solicitação.'
        },
        {
            pergunta: 'Existe contato com o morador?',
            resposta: 'Em geral, a central entra em contato com o morador ou responsável para confirmar a entrada.'
        },
        {
            pergunta: 'Como funciona em caso de falta de energia?',
            resposta: 'A infraestrutura da operação conta com suporte técnico e recursos de contingência para manter a rotina funcionando com o menor impacto possível.'
        },
        {
            pergunta: 'É possível utilizar as câmeras que o condomínio já tem?',
            resposta: 'Em muitos casos, sim. A infraestrutura existente pode ser avaliada para verificar a compatibilidade com a operação.'
        },
        {
            pergunta: 'O condomínio pode acessar as câmeras?',
            resposta: 'Sim. O acesso às câmeras e aos registros é parte do acompanhamento da operação e pode ser disponibilizado conforme a estrutura do condomínio.'
        }
    ],

    /* ---------- Coleta do lead ----------
       Ordem das perguntas. "campo" é o nome da coluna na planilha.
       "pontos" em cada opção alimenta a classificação quente/morno/frio. */
    lead: {
        passos: [
            {
                campo: 'perfil',
                pergunta: 'Qual é o seu perfil?',
                opcoes: [
                    { rotulo: 'Síndico(a)', pontos: 2 },
                    { rotulo: 'Subsíndico(a)', pontos: 2 },
                    { rotulo: 'Administradora', pontos: 2 },
                    { rotulo: 'Morador(a) ou conselheiro(a)', pontos: 0 }
                ]
            },
            {
                campo: 'unidades',
                pergunta: 'Quantas unidades tem o condomínio?',
                opcoes: [
                    { rotulo: 'Até 50', pontos: 0 },
                    { rotulo: '51 a 150', pontos: 1 },
                    { rotulo: '151 a 300', pontos: 2 },
                    { rotulo: 'Mais de 300', pontos: 2 }
                ]
            },
            {
                campo: 'portaria_atual',
                pergunta: 'Como é a portaria hoje?',
                opcoes: [
                    { rotulo: 'Porteiro 24 horas', pontos: 0 },
                    { rotulo: 'Porteiro em horário parcial', pontos: 0 },
                    { rotulo: 'Sem portaria', pontos: 0 },
                    { rotulo: 'Já tem portaria virtual', pontos: 0 }
                ]
            },
            {
                campo: 'cameras',
                pergunta: 'O condomínio já tem câmeras instaladas?',
                opcoes: [
                    { rotulo: 'Sim', pontos: 0 },
                    { rotulo: 'Não', pontos: 0 },
                    { rotulo: 'Não sei', pontos: 0 }
                ]
            },
            {
                campo: 'prazo',
                pergunta: 'Em quanto tempo o condomínio pretende decidir?',
                opcoes: [
                    { rotulo: 'Em até 30 dias', pontos: 3 },
                    { rotulo: 'De 1 a 3 meses', pontos: 2 },
                    { rotulo: 'Só estou pesquisando', pontos: 0 }
                ]
            },
            {
                campo: 'condominio',
                tipo: 'texto',
                validar: 'texto',
                pergunta: 'Qual é o nome do condomínio?',
                placeholder: 'Nome do condomínio',
                autocomplete: 'organization'
            },
            {
                campo: 'cidade_bairro',
                tipo: 'texto',
                validar: 'texto',
                pergunta: 'Em qual cidade e bairro ele fica?',
                placeholder: 'Ex.: Vila Velha, Praia da Costa',
                autocomplete: 'off'
            },
            {
                campo: 'nome',
                tipo: 'texto',
                validar: 'nome',
                pergunta: 'Qual é o seu nome?',
                placeholder: 'Nome e sobrenome',
                autocomplete: 'name'
            },
            {
                campo: 'telefone',
                tipo: 'texto',
                validar: 'telefone',
                mascara: 'telefone',
                pergunta: 'Qual é o seu telefone com DDD?',
                placeholder: '(27) 99999-9999',
                autocomplete: 'tel',
                inputmode: 'tel'
            },
            {
                campo: 'consentimento',
                pergunta: 'Para enviar, preciso do seu aceite: usaremos seus dados apenas para a Tattica entrar em contato sobre este orçamento.',
                opcoes: [
                    { rotulo: 'Aceito e enviar', valor: 'Aceito', estilo: 'primary' },
                    { rotulo: 'Cancelar', cancelar: true }
                ]
            }
        ]
    }
};
