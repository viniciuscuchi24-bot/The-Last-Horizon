@echo off
title The Last Horizon - servidor LAN
cd /d "%~dp0.."
where node >nul 2>nul || (echo Instale o Node.js em https://nodejs.org e tente de novo. & pause & exit /b)
start "" http://localhost:8080
node servidor\servidor.js
pause
