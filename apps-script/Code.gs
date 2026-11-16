/**
 * Registro dos pedidos do chat em uma planilha do Google + aviso por e-mail.
 * Gratuito. Passo a passo:
 *  1. Crie uma planilha no Google Sheets e abra Extensões > Apps Script.
 *  2. Cole este código, troque EMAIL_AVISO e salve.
 *  3. Implantar > Nova implantação > Tipo: App da Web.
 *     Executar como: você. Quem tem acesso: Qualquer pessoa.
 *  4. Copie o endereço gerado e cole em appsScriptUrl no arquivo chat-config.js.
 *
 * Na planilha, a coluna "Chamar no WhatsApp" abre a conversa com o cliente em um clique.
 */
const EMAIL_AVISO = 'comercial@exemplo.com.br'; // troque pelo e-mail do Comercial
const ABA = 'Pedidos';
const CABECALHO = ['Data', 'Prioridade', 'Nome', 'Telefone', 'Perfil', 'Local', 'Blocos', 'Unidades',
    'Portaria hoje', 'Câmeras ou acesso', 'Assembleia', 'Consentimento', 'Chamar no WhatsApp'];

function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
        const d = JSON.parse(e.postData.contents);
        const planilha = SpreadsheetApp.getActiveSpreadsheet();
        let aba = planilha.getSheetByName(ABA);
        if (!aba) {
            aba = planilha.insertSheet(ABA);
            aba.appendRow(CABECALHO);
            aba.setFrozenRows(1);
        }
        const digitos = String(d.telefone || '').replace(/\D/g, '');
        const saudacao = 'Olá, ' + (d.nome || '') + '. Aqui é da equipe Comercial da Tattica. Recebemos o seu pedido de proposta de portaria virtual e gostaríamos de entender melhor a necessidade do condomínio. Podemos conversar agora?';
        const link = digitos ? '=HYPERLINK("https://wa.me/55' + digitos + '?text=' + encodeURIComponent(saudacao) + '";"Chamar")' : '';
        const data = Utilities.formatDate(new Date(d.criadoEm || new Date()), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');

        aba.appendRow([data, d.prioridade, d.nome, d.telefone, d.perfil, d.local, d.blocos, d.unidades,
            d.portaria, d.estrutura, d.assembleia, d.consentimento, link]);

        MailApp.sendEmail({
            to: EMAIL_AVISO,
            subject: '[' + d.prioridade + '] Novo pedido de orçamento: ' + d.nome,
            body: 'Novo pedido pelo chat do site.\n\n' +
                'Nome: ' + d.nome + '\nTelefone: ' + d.telefone + '\nPerfil: ' + d.perfil +
                '\nLocal: ' + d.local + '\nBlocos: ' + d.blocos + ' | Unidades: ' + d.unidades +
                '\nPortaria hoje: ' + d.portaria + '\nCâmeras ou acesso: ' + d.estrutura +
                '\nAssembleia: ' + d.assembleia + '\nPrioridade: ' + d.prioridade
        });
        return ContentService.createTextOutput('ok');
    } catch (erro) {
        return ContentService.createTextOutput('erro');
    } finally {
        lock.releaseLock();
    }
}
