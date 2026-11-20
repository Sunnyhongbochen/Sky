@echo off
title Summer Site Launcher

set "ROOT=%~dp0"
set "HUGO=%USERPROFILE%\.local\bin\hugo.exe"
if not exist "%HUGO%" set "HUGO=hugo"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH. Please install Node.js first.
    pause
    exit /b 1
)

set "PLATFORM_RUNNING="
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>nul && set "PLATFORM_RUNNING=1"

set "SITE_RUNNING="
netstat -ano | findstr /R /C:":1313 .*LISTENING" >nul 2>nul && set "SITE_RUNNING=1"

set "HUGO_RUNNING="
netstat -ano | findstr /R /C:":1314 .*LISTENING" >nul 2>nul && set "HUGO_RUNNING=1"

set "YINYI_RUNNING="
netstat -ano | findstr /R /C:":4173 .*LISTENING" >nul 2>nul && set "YINYI_RUNNING=1"

if defined PLATFORM_RUNNING (
    echo [SKIP] Platform already running on port 3000
) else (
    echo [1/4] Starting city platform on port 3000 ...
    start "platform :3000" /D "%ROOT%city-platform" cmd /k node server.js
    timeout /t 2 /nobreak >nul
)

if defined HUGO_RUNNING (
    echo [SKIP] Hugo already running on port 1314
) else (
    echo [2/4] Starting Hugo build server on port 1314 ...
    start "hugo :1314" /D "%ROOT%" cmd /k "%HUGO%" server -D -M --disableFastRender --bind 127.0.0.1 --port 1314 --baseURL http://localhost:1313/ --appendPort=false --disableLiveReload
    timeout /t 3 /nobreak >nul
)

if defined SITE_RUNNING (
    echo [SKIP] Site auth proxy already running on port 1313
) else (
    echo [3/4] Starting site auth proxy on port 1313 ...
    start "site :1313 (password)" /D "%ROOT%" cmd /k node auth-proxy.js
    timeout /t 2 /nobreak >nul
)

if defined YINYI_RUNNING (
    echo [SKIP] YinYi already running on port 4173
) else (
    echo [4/4] Starting YinYi voice knowledge hub on port 4173 ...
    start "YinYi :4173" /D "%ROOT%voice-knowledge-hub-deploy" cmd /k node scripts\serve.mjs
    timeout /t 2 /nobreak >nul
)

echo.
echo Opening browser ...
start "" http://localhost:1313/

echo.
echo === Running ===
echo   Summer site:        http://localhost:1313/  (password: 18924609490)
echo   City platform:      http://localhost:3000/  (open via Links - Works card)
echo   YinYi:              http://localhost:4173/  (open via Links - Works card)
echo   HuiJi:              http://localhost:1313/huiji/  (served by site)
echo.
echo All services run in separate windows. Close a window to stop that service.
echo This window will close in 8 seconds ...
timeout /t 8 /nobreak >nul
