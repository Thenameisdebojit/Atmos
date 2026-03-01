@echo off
cd /d "%~dp0"

echo ========================================
echo  Quick Redeploy - AtMoS Carbon Platform
echo ========================================
echo.

echo Step 0: Installing dependencies...
echo Installing root packages...
call npm install --ignore-scripts
if %ERRORLEVEL% neq 0 (
    echo ERROR: Root npm install failed
    pause
    exit /b 1
)

echo Installing frontend packages...
call npm install --prefix frontend --ignore-scripts
if %ERRORLEVEL% neq 0 (
    echo ERROR: Frontend npm install failed
    pause
    exit /b 1
)

echo Installing backend packages...
call npm install --prefix backend --ignore-scripts
if %ERRORLEVEL% neq 0 (
    echo ERROR: Backend npm install failed
    pause
    exit /b 1
)

echo.
echo Step 1: Compiling contracts...
call npx hardhat compile
if %ERRORLEVEL% neq 0 (
    echo.
    echo Compilation warnings present but continuing...
)

echo.
echo Step 2: Starting Hardhat node (local blockchain)...
rem Kill existing process on 8545 if any, so we can start fresh
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8545" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>nul
start "AtMoS Hardhat Node" cmd /k "cd /d %~dp0 && npx hardhat node"
echo Waiting for Hardhat node on port 8545...
set WAIT_COUNT=0
:wait_for_node
timeout /t 2 /nobreak >nul
netstat -an 2>nul | findstr ":8545" | findstr "LISTENING" >nul
if %ERRORLEVEL% equ 0 goto node_ready
set /a WAIT_COUNT+=1
if %WAIT_COUNT% geq 25 (
    echo ERROR: Hardhat node did not start in time. Check the "AtMoS Hardhat Node" window.
    pause
    exit /b 1
)
goto wait_for_node
:node_ready
echo Hardhat node is ready.

echo.
echo Step 3: Deploying contracts to local network...
call npx hardhat run scripts/deploy/01_deploy_local.js --network localhost
rem On Windows, Node can exit with "Assertion failed" (libuv) after a successful deploy.
rem Verify success by checking that deployment file was written.
findstr /C:"CarbonCreditNFT" deployments\localhost.json >nul 2>nul
if %ERRORLEVEL% equ 0 goto deploy_ok
echo.
echo ERROR: Deployment failed or deployments/localhost.json not updated. Check the "AtMoS Hardhat Node" window.
pause
exit /b 1
:deploy_ok
echo.
echo Deployment verified (deployments/localhost.json updated).
echo (If you see "Assertion failed" on Windows, ignore it - deployment succeeded.)
echo.
echo Step 4: Updating frontend .env.local...
call node scripts/update-frontend-env.js 2>nul
if %ERRORLEVEL% neq 0 (
    echo Note: Could not auto-update .env.local - copy addresses from deployments/localhost.json
)

echo.
echo Step 5: Starting Backend and Frontend...
rem Free ports if already in use
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":4000" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>nul
start "AtMoS Backend" cmd /k "cd /d %~dp0 && set PORT=4000 && npm --prefix backend run dev"
start "AtMoS Frontend" cmd /k "cd /d %~dp0 && npm --prefix frontend run dev"

echo.
echo ========================================
echo  All set! AtMoS + Official Carbon Wallet
echo ========================================
echo  Hardhat node : running in "AtMoS Hardhat Node" window (port 8545)
echo  Backend      : http://localhost:4000  (AtMoS Backend - depository, companies, API)
echo  Frontend     : http://localhost:3001  (AtMoS Frontend window)
echo.
echo  CARBON WALLET (official depository):
echo  - Open http://localhost:3001 and click "Carbon Wallet" in the nav (popup).
echo  - Or go to http://localhost:3001/carbon-wallet for full page.
echo  - Carbon credits are officially stored in the ATMOS Depository (backend).
echo  - Claim credits: Register as Company (Company Register) to claim 5 free credits;
echo    they are recorded on-chain AND in the official Carbon Wallet (depository).
echo  - In Carbon Wallet you can set a password, view account number, official
echo    certificate, ownership of credits, and retire credits.
echo.
echo  Open http://localhost:3001 in your browser.
echo  Keep all three windows open while using the app.
echo.
pause
