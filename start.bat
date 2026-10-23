@echo off
rem Startet den Editor lokal und oeffnet ihn im Browser (Chrome oder Edge).
rem Fertig gebaute Fassung (deutlich schneller als der Entwicklungsmodus); Port 5173 wie bei npm run dev,
rem damit die gemerkte Vault-Freigabe gilt.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js fehlt - bitte von https://nodejs.org installieren. & pause & exit /b 1)
rem npm ci installiert genau die Versionen aus package-lock.json
if not exist node_modules call npm ci
call npm start
