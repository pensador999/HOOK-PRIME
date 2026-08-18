@echo off
:: ========================================
:: HOOK PRIME - Auto-Start Server
:: Para iniciar automaticamente com Windows:
:: 1. Win+R > shell:startup
:: 2. Colar atalho deste .bat nessa pasta
:: ========================================
title HookPrime Server

:: Matar processo node anterior na porta 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Aguardar 1s
timeout /t 1 /nobreak >nul

:: Navegar para a pasta do projeto
cd /d "c:\Users\lucas\OneDrive\Documentos\HOOK PRIME\hub"

:: Iniciar servidor (mantém janela minimizada)
echo ========================================
echo  HOOK PRIME Server
echo  http://localhost:3000
echo  Fechar esta janela encerra o servidor
echo ========================================
echo.
node server.js
