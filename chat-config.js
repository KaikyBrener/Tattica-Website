/* ==========================================================================
   Assistente virtual: configuração e conteúdo.
   A empresa pode editar tudo aqui sem mexer no código do chat (chatbot.js).
   Regra de ouro: o bot (e a IA, se ligada) só responde o que está escrito neste arquivo.
   Tudo o que não está aqui é encaminhado a um atendente.
   ========================================================================== */
window.TATTICA_CHAT = {
    nomeAssistente: 'Assistente Tattica',

    /* Ritmo de "digitação" do bot, em milissegundos. Aumente para um jeito mais calmo. */
    digitacao: { pausa: 450, base: 700, porCaractere: 16, max: 2400 },

    /* WhatsApp que recebe os pedidos do Comercial (DDI + DDD + número, só dígitos).
       Hoje está o mesmo número público do site. Troque pelo WhatsApp do Comercial. */
    whatsappComercial: '552730262196',

    /* Endereço do proxy da IA publicado (veja ia-proxy/README.md). Vazio = o chat funciona só com respostas prontas. */
    iaUrl: '',

    /* Quando o site roda em localhost, o chat usa este endereço (o "npx wrangler dev"), sem precisar mexer no iaUrl. */
    iaUrlLocal: 'http://127.0.0.1:8787',

    /* Endereço do script do Google (veja apps-script/Code.gs). Vazio = não registra em planilha. */
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbz3oAEV35nzzJgJEHMP19m-PqERq-wDluynQUKBopgFOjKNHZBfUqxo8hlEaAId5dHJKg/exec',

    /* Horário do Comercial. dias: 0 = domingo ... 6 = sábado. Horas em formato 24h. */
    horarioComercial: { dias: [1, 2, 3, 4, 5], inicio: 8, fim: 18 },

    /* Telefones publicados no Guia do Aplicativo 2.0 */
    contatos: [
        { nome: 'Setores (manutenção, tecnologia, administrativo)', texto: '(27) 3026-2196', tel: '+552730262196', obs: 'Opção 1: Manutenção. Opção 2: Tecnologia. Opção 3: Administrativo.' },
        { nome: 'Central 24 horas (Vitória)', texto: '(27) 99837-5341', tel: '+5527998375341' },
        { nome: 'Central 24 horas (Guarapari, Vila Velha, Serra e demais regiões)', texto: '(27) 99841-3791', tel: '+5527998413791' }
    ],

    /* Dúvidas de quem quer contratar, agrupadas por tema.
       Fontes: site, informações do Comercial e o modelo de proposta comercial de portaria remota 24h.
       Não entram aqui: preços, prazo de contrato, nomes de clientes e a lista de equipamentos. */
    faq: [
        { tema: 'Como funciona', p: 'O que é portaria virtual?', r: 'É a operação remota de acesso e monitoramento de um condomínio, com atendimento por uma central 24 horas e apoio de sistemas de controle e comunicação.' },
        { tema: 'Como funciona', p: 'Funciona 24 horas?', r: 'Sim. A central acompanha os acessos e as ocorrências durante o dia todo. O atendimento do Comercial é de segunda a sexta, das 8h às 18h.' },
        { tema: 'Como funciona', p: 'Como o visitante entra?', r: 'O visitante chega e toca o interfone. O morador faz o atendimento e, com a liberação dele, o visitante tem acesso ao condomínio.' },
        { tema: 'Como funciona', p: 'Como os moradores entram?', r: 'Nas portas de pedestre, por biometria facial ou pelo aplicativo. Na garagem, por controle remoto ou pelo QR-Code do aplicativo.' },
        { tema: 'Como funciona', p: 'Quem é a Tattica?', r: 'A Tattica é pioneira em portaria virtual no Espírito Santo. Une tecnologia, atendimento humanizado e gestão para trazer segurança, eficiência e redução de custos aos condomínios.' },

        { tema: 'Segurança e manutenção', p: 'E se um equipamento der problema?', r: 'A Tattica faz manutenção preventiva e corretiva, com suporte 24 horas, inclusive para problemas em portões. O condomínio é notificado das ordens de serviço realizadas.' },
        { tema: 'Segurança e manutenção', p: 'E se faltar energia?', r: 'A infraestrutura da operação conta com suporte técnico e recursos de contingência para manter a rotina funcionando com o menor impacto possível.' },
        { tema: 'Segurança e manutenção', p: 'Por quanto tempo as imagens ficam guardadas?', r: 'As imagens ficam guardadas por 15 dias, conforme o contrato, e só o síndico responsável pode solicitá-las.' },

        { tema: 'Instalação e estrutura', p: 'Quanto tempo leva a implantação?', r: 'Depende de cada condomínio, mas geralmente leva cerca de 2 meses.' },
        { tema: 'Instalação e estrutura', p: 'Precisa de obra?', r: 'A proposta aproveita o cabeamento do interfone que o condomínio já tem. Serviços de estrutura, como alvenaria, tubulação ou gesso, não entram na proposta inicial e são avaliados à parte.' },
        { tema: 'Instalação e estrutura', p: 'Precisa de internet?', r: 'Sim. É preciso uma conexão por fibra óptica de no mínimo 10 Mb full. A contratação dessa internet é responsabilidade do condomínio, e o Comercial orienta como fazer.' },
        { tema: 'Instalação e estrutura', p: 'Posso usar as câmeras que já tenho?', r: 'Em muitos casos, sim. A infraestrutura existente é avaliada para verificar a compatibilidade com a operação.' },

        { tema: 'Torre de Vigilância', p: 'O que é a Torre de Vigilância?', r: 'É uma torre de monitoramento instalada na calçada ou na área externa do condomínio e ligada à central da Tattica. Tem 3 câmeras que, juntas, dão visão de 360° do entorno.' },
        { tema: 'Torre de Vigilância', p: 'A torre tem sirene?', r: 'Sim. Um botão de emergência dispara a sirene da própria torre.' },
        { tema: 'Torre de Vigilância', p: 'Dá para falar com a Tattica pela torre?', r: 'Sim. A torre tem interfone para falar direto com a Tattica.' },

        { tema: 'Aplicativo e tecnologia', p: 'O que o aplicativo faz?', r: 'O Tattica Center permite abrir portões por QR-Code, enviar chave virtual para visitantes, agendar mudanças e áreas comuns, cadastrar moradores e ver as câmeras.' },
        { tema: 'Aplicativo e tecnologia', p: 'O condomínio vê as câmeras?', r: 'Sim. As câmeras podem ser vistas pelo aplicativo Tattica Center, conforme a estrutura do condomínio.' },
        { tema: 'Aplicativo e tecnologia', p: 'O sistema é da própria Tattica?', r: 'Sim. A Tattica usa software e sistemas próprios e desenvolve novas tecnologias, como a abertura pelo CarPlay na central multimídia do carro.' }
    ],
    /* Perguntas que o bot não responde: vão para o Comercial. */
    encaminhar: 'Essa informação é tratada diretamente pelo nosso Comercial, que consegue explicar com detalhes. Quer que eu envie o seu pedido para eles?',
    encaminharTitulos: ['Contrato e valores', 'Como é calculada a economia', 'Outro assunto'],

    /* Menu "Sou morador", baseado no Guia do Aplicativo 2.0.
       video: link https do tutorial em vídeo (por exemplo, YouTube "não listado"). Vazio = sem botão de vídeo. */
    morador: [
        { p: 'Baixar o aplicativo', r: 'Procure por "Tattica Center" na Play Store (Android) ou na App Store (iPhone) e toque em Instalar ou Obter.', video: '' },
        { p: 'Primeiro acesso e cadastro', r: 'Abra o app e toque em "Cadastre-se". Digite o e-mail cadastrado no sistema da Tattica, abra a mensagem que chegar no seu e-mail, clique no link, crie a senha, confirme e toque em confirmar.\n\nNão chegou? Veja o spam e a lixeira e confira se o e-mail é o mesmo do cadastro. Se não tiver e-mail, use "Não possui e-mail" na tela de cadastro e siga as instruções.', video: '' },
        { p: 'Esqueci a senha', r: 'Na tela de login, toque em "Esqueceu sua senha?", informe o e-mail cadastrado no sistema, abra o link que receber e digite a nova senha duas vezes.', video: '' },
        { p: 'Abrir portas e portões', r: 'Na página "Acessos", escolha a porta ou o portão. Na parte de cima da tela você vê a câmera do acesso em tempo real antes de enviar o comando.', video: '' },
        { p: 'Ver as câmeras', r: 'Na tela inicial, toque nas três barras no canto superior esquerdo e escolha "Câmeras" para ver as imagens do condomínio em tempo real.', video: '' },
        { p: 'Adicionar uma pessoa ao apartamento', r: 'No início, toque nas três barras no canto superior esquerdo e siga o passo a passo para cadastrar novos moradores no seu apartamento. Quanto mais informações você preencher, melhor.', video: '' },
        { p: 'Cadastro facial', r: 'O morador responsável cadastra o próprio rosto e o dos moradores vinculados a ele. O morador não responsável cadastra só o próprio. Na tela, toque em "Cadastrar facial".\n\nPara a foto: sem óculos, boné, chapéu ou qualquer coisa cobrindo o rosto, com boa iluminação e, de preferência, fundo neutro.', video: '' },
        { p: 'Liberação provisória', r: 'Permite dar acesso temporário a uma pessoa por até 30 dias. Em "Adicionar Liberação", preencha nome, descrição e o documento pedido no próprio app, escolha data de início e fim e toque em "Salvar". Para mais de 30 dias, fale com o Setor Administrativo.\n\nPor segurança, não envie documentos por este chat.', video: '' },
        { p: 'Chave virtual para visitante', r: 'Em "Adicionar Liberação", ative "Enviar Chave Virtual", defina quantos acessos são permitidos (0 = ilimitado) e o horário de início e fim, e toque em "Salvar". Depois é só compartilhar o link com a pessoa. Fora do horário definido, a chave não abre.', video: '' },
        { p: 'Reservas e agendamentos', r: 'Para reservar uma área comum, toque em "Reservas", depois no "+", escolha a área e o dia e preencha os dados. Em "Meus Agendamentos" você consulta e edita data, horário, status e a lista de convidados. Leia as normas do condomínio, que ficam no início da página, antes de criar.', video: '' },
        { p: 'Pedir imagens das câmeras', r: 'As imagens ficam guardadas por 15 dias, conforme o contrato, e só o síndico responsável pode solicitá-las. Quanto antes o pedido for feito, melhor. Fale com a Central.', video: '' }
    ]
};
