@echo off
cd /d "%~dp0"

echo ========================================
echo  Quick Redeploy - AtMoS Carbon Platform
echo ========================================
echo.

echo Step 0: Installing dependencies...
echo Installing root packages...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ERROR: Root npm install failed
    pause
    exit /b 1
)

echo Installing frontend packages...
call npm install --prefix frontend
if %ERRORLEVEL% neq 0 (
    echo ERROR: Frontend npm install failed
    pause
    exit /b 1
)

echo Installing backend packages...
call npm install --prefix backend
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
echo Step 2: Deploying to local network...
echo NOTE: Ensure Hardhat node is running in another terminal: npx hardhat node
echo.
call npx hardhat run scripts/deploy/01_deploy_local.js --network localhost
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Deployment failed. Is the Hardhat node running?
    echo Start it with: npx hardhat node
    pause
    exit /b 1
)

echo.
echo Step 3: Updating frontend .env.local...
call node scripts/update-frontend-env.js 2>nul
if %ERRORLEVEL% neq 0 (
    echo Note: Could not auto-update .env.local - copy addresses from deployments/localhost.json
)

echo.
echo Step 4: Deployment complete!
echo.
echo Next: Run ./run-dev.bat to start the app (or start Hardhat node first if not running)
echo.
pause
