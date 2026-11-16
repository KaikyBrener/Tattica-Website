# Sobe o proxy da IA na sua máquina, sempre na porta 8787 e sem os atalhos de teclado do wrangler
# (assim nenhuma tecla abre o túnel público nem troca para o modo remoto).
# Uso, dentro da pasta ia-proxy:  .\iniciar-local.ps1
# Se o Windows bloquear o script:   powershell -ExecutionPolicy Bypass -File .\iniciar-local.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .dev.vars)) { throw 'Falta o .dev.vars. Rode antes: .\configurar-local.ps1' }

# Encerra o que estiver preso na porta 8787 (normalmente um wrangler antigo que não fechou)
$presos = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
foreach ($id in $presos) {
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Encerrando $($proc.ProcessName) (PID $id), que estava usando a porta 8787."
        Stop-Process -Id $id -Force
    }
}

node .\gerar-conhecimento.js
Write-Host 'Subindo o proxy em http://127.0.0.1:8787  (Ctrl+C para parar)'
npx wrangler dev --port 8787 --ip 127.0.0.1 --show-interactive-dev-session=false
