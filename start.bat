@echo off
rem Startet den Editor lokal und oeffnet ihn im Browser (Chrome oder Edge).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js fehlt - bitte von https://nodejs.org installieren. & pause & exit /b 1)
if not exist node_modules call npm install
call npm run dev -- --open
