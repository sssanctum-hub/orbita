@echo off
setlocal
cd /d "%~dp0.."
set "PATH=%CD%\.tools\node;%USERPROFILE%\.cargo\bin;%PATH%"
call npm.cmd run tauri:build -- --debug --no-bundle -- --locked
