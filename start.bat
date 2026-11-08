@echo off
title GST Billing Software
echo ===================================================
echo Starting GST Billing Software...
echo ===================================================
cd /d "%~dp0"
start http://localhost:5000
node server/index.js
pause
