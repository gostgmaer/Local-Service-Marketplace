@echo off
REM Copy migration file into container and run with psql -f
setlocal
r
if "%~1"=="" (
  set MIGRATION=database\migrations\016_add_display_ids.sql
) else (
  set MIGRATION=%1
)
echo Using migration: %MIGRATION%
docker cp "%MIGRATION%" marketplace-postgres:/tmp/migration.sql
if %ERRORLEVEL% neq 0 (
  echo Failed to copy migration file to container.
  exit /b 1
)
docker exec marketplace-postgres psql -U postgres -d marketplace -f /tmp/migration.sql
if %ERRORLEVEL% neq 0 (
  echo Migration failed.
  exit /b 1
)
echo Migration applied successfully.
endlocal
exit /b 0
