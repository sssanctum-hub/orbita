@echo off
setlocal
cd /d "%~dp0.."
set "PATH=%CD%\.tools\node;%PATH%"
call npm.cmd run dev -- --host 127.0.0.1
