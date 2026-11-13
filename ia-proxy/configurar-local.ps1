# Prepara o proxy da IA para rodar na sua máquina.
# Usa duas APIs: Gemini (principal) e Groq (reserva, usada se o Gemini falhar ou estourar o limite).
# Uso, dentro da pasta ia-proxy:  .\configurar-local.ps1
# Se o Windows bloquear o script:   powershell -ExecutionPolicy Bypass -File .\configurar-local.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Ler-Chave([string]$pergunta) {
    $seguro = Read-Host $pergunta -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
    try { return ([Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

if (Test-Path .dev.vars) {
    $resp = Read-Host '.dev.vars já existe. Substituir? (s/N)'
    if ($resp -notmatch '^[sS]') { Write-Host 'Mantive o .dev.vars atual.' } else { Remove-Item .dev.vars }
}

if (-not (Test-Path .dev.vars)) {
    $linhas = @()

    Write-Host ''
    Write-Host '1/2  Gemini (principal). Chave em https://aistudio.google.com (começa com AIza).'
    $gemini = Ler-Chave 'Cole a chave do Gemini (Enter para pular)'
    if ($gemini) {
        $linhas += "GEMINI_API_KEY=$gemini"
        $modelo = Read-Host 'Modelo do Gemini (Enter para usar o padrão do worker.js)'
        if ($modelo) { $linhas += "GEMINI_MODELO=$($modelo.Trim())" }
    }

    Write-Host ''
    Write-Host '2/2  Groq (reserva). Chave em https://console.groq.com > API Keys (começa com gsk_).'
    $groq = Ler-Chave 'Cole a chave do Groq (Enter para pular)'
    if ($groq) {
        Write-Host 'Copie o nome exato de um modelo de chat em https://console.groq.com > Models.'
        $modeloGroq = (Read-Host 'Modelo do Groq').Trim()
        if (-not $modeloGroq) { throw 'Sem o nome do modelo, o Groq não funciona. Rode o script de novo.' }
        $linhas += 'RESERVA_URL=https://api.groq.com/openai/v1/chat/completions'
        $linhas += "RESERVA_API_KEY=$groq"
        $linhas += "RESERVA_MODELO=$modeloGroq"
    }

    if ($linhas.Count -eq 0) { throw 'Nenhuma chave informada. Informe pelo menos uma.' }
    Set-Content -Path .dev.vars -Value $linhas -Encoding ascii
    Remove-Variable gemini, groq -ErrorAction SilentlyContinue
    Write-Host ''
    Write-Host '.dev.vars criado (fica só na sua máquina).'
}

node .\gerar-conhecimento.js

Write-Host ''
Write-Host 'Pronto. Próximos passos:'
Write-Host '  1. Aqui em ia-proxy:      npx wrangler dev   (não digite nada nesse terminal)'
Write-Host '  2. Na pasta do projeto:   npx serve -l 5500 .'
Write-Host '  3. Abra http://localhost:5500/Index.html e use "Digitar a minha pergunta".'
