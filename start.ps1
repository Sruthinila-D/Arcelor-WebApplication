# ArcelorMittal Pipe Traceability Portal Launcher
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   ArcelorMittal - Pipe Traceability Web Portal" -ForegroundColor DarkYellow
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Get-Process ArcelorMittalPortal -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Credentials: Username: admin | Password: admin" -ForegroundColor Green
Write-Host "Starting web server on http://localhost:5000 ..." -ForegroundColor White

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:5000/login.html"
} | Out-Null

dotnet run --project ArcelorMittalPortal.csproj --urls "http://localhost:5000"
