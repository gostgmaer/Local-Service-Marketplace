@echo off
REM Database Seeder - Root Folder Runner (Windows Batch)
REM Run this from the project root folder

if exist "database\run-seeder.bat" (
    call database\run-seeder.bat
) else (
    echo Error: database\run-seeder.bat not found
    pause
    exit /b 1
)
