@echo off
setlocal
cd /d "%~dp0"
if not exist "logs" mkdir "logs"
node "%~dp0fetch-github-trending.mjs" >> "%~dp0logs\daily.log" 2>&1
endlocal