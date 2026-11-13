# Prepara o proxy da IA para rodar na sua máquina.
# Uso, dentro da pasta ia-proxy:  .\configurar-local.ps1
# Se o Windows bloquear o script:   powershell -ExecutionPolicy Bypass -File .\configurar-local.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (Test-Path .dev.vars) {
    $resp = Read-Host '.dev.vars já existe. Substituir? (s/N)'
    if ($resp -notmatch '^[sS]') { Write-Host 'Mantive o .dev.vars atual.' } else { Remove-Item .dev.vars }
}

if (-not (Test-Path .dev.vars)) {
    $seguro = Read-Host 'Cole a chave do Google AI Studio' -AsSecureString
    $chave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro))
    if ([string]::IsNullOrWhiteSpace($chave)) { throw 'Nenhuma chave informada.' }
    $modelo = Read-Host 'Modelo do Gemini (Enter para usar o padrão do worker.js)'
    $linhas = @("GEMINI_API_KEY=$($chave.Trim())")
    if ($modelo) { $linhas += "GEMINI_MODELO=$($modelo.Trim())" }
    Set-Content -Path .dev.vars -Value $linhas -Encoding ascii
    Remove-Variable chave, seguro
    Write-Host '.dev.vars criado (fica só na sua máquina).'
}

node .\gerar-conhecimento.js

Write-Host ''
Write-Host 'Pronto. Próximos passos:'
Write-Host '  1. Aqui em ia-proxy:      npx wrangler dev   (não digite nada nesse terminal)'
Write-Host '  2. Na pasta do projeto:   npx serve -l 5500 .'
Write-Host '  3. Abra http://localhost:5500/Index.html e use "Digitar a minha pergunta".'
