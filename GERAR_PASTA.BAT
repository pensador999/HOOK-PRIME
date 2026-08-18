@echo off
chcp 65001 >nul
echo Criando pastas a partir da lista...
if not exist numeros.txt (
    echo Arquivo numeros.txt nao encontrado!
    pause
    exit /b
)
for /f "usebackq delims=" %%a in ("numeros.txt") do (
    if not "%%a"=="" (
        mkdir "%%a" 2>nul
        if exist "%%a" (
            echo Criada: %%a
        ) else (
            echo Falha ao criar: %%a
        )
    )
)
echo.
echo Processo concluido!
pause