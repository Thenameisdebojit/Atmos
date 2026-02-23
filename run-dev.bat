@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo  AtMoS Carbon Platform - Development
echo ========================================
echo.

echo Step 1: Installing dependencies (if needed)...
if not exist "node_modules" call npm install
if not exist "frontend\node_modules" call npm install --prefix frontend
if not exist "backend\node_modules" call npm install --prefix backend

echo.
echo Step 2: Checking Hardhat node...
echo NOTE: For local blockchain, start Hardhat in another terminal: npx hardhat node
echo.

rem Free ports if already in use
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :4000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :3001 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>nul

echo Step 3: Starting Backend (port 4000)...
start "ATMOS Backend" cmd /k "cd /d %~dp0 && set PORT=4000 && npm --prefix backend run dev"

echo Step 4: Starting Frontend (port 3001)...
start "ATMOS Frontend" cmd /k "cd /d %~dp0 && npm --prefix frontend run dev"

echo.
echo App starting! Frontend: http://localhost:3001  Backend: http://localhost:4000
echo.
endlocal
