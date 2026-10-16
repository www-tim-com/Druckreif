@echo off
rem PDFs (oder einen Ordner) auf diese Datei ziehen: fuegt sie nach Dateiname sortiert zu zusammengefuegt.pdf zusammen.
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js fehlt - bitte von https://nodejs.org installieren. & pause & exit /b 1)
if not exist node_modules\pdf-lib call npm install
node werkzeuge\pdfs-zusammenfuegen.mjs %*
pause
