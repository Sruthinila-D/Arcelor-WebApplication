@echo off
title ArcelorMittal Pipe Traceability Portal
echo =======================================================
echo    ArcelorMittal - Pipe Traceability Web Portal
echo =======================================================
echo.
echo Starting application on http://localhost:5000 ...
echo Default Credentials:
echo   Username: admin
echo   Password: admin
echo.
echo Browser will automatically open in 3 seconds...
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000/login.html"
dotnet run --urls "http://localhost:5000"
pause
