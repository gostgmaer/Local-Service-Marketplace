@echo off
REM Simple Database Seeder Runner for Windows
REM Usage: run-seeder.bat

echo.
echo ========================================
echo   Database Seeder - Quick Runner
echo ========================================
echo.

REM Check if we're in the correct directory
if not exist "seed.js" (
    if exist "database\seed.js" (
        echo Changing to database directory...
        cd database
    ) else (
        echo ERROR: seed.js not found
        echo Please run this from the database directory or project root
        pause
        exit /b 1
    )
)

REM Check for node_modules
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo Running database seeder...
echo.

REM Run the seeder
call npm run seed

if errorlevel 1 (
    echo.
    echo ERROR: Seeding failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Seeding completed successfully!
echo ========================================
echo.

REM Ask about verification
set /p verify="Run verification? (Y/n): "
if /i "%verify%"=="n" goto end

echo.
echo Running verification...
echo.
call npm run verify

:end
echo.
echo All done! Default password: password123
echo.
pause
