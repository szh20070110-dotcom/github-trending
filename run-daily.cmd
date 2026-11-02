@echo off
setlocal
cd /d "%~dp0"
if not exist "logs" mkdir "logs"
echo ----- start %date% %time% ----- >> "%~dp0logs\daily.log"
node "%~dp0fetch-github-trending.mjs" >> "%~dp0logs\daily.log" 2>&1
node "%~dp0build-report-html.mjs" >> "%~dp0logs\daily.log" 2>&1
echo ----- end %date% %time% ----- >> "%~dp0logs\daily.log"
endlocal
