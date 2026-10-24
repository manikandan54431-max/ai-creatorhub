Write-Host "`n🚀 AI CreatorHub Startup" -ForegroundColor Cyan
Write-Host "========================`n" -ForegroundColor Cyan

function Get-FreePort {
    param([int]$Start = 8000)
    $used = @()
    netstat -ano | Select-String "LISTENING" | ForEach-Object {
        if ($_ -match ':(\d+)\s') { $used += [int]$Matches[1] }
    }
    $port = $Start
    while ($port -in $used) { $port++ }
    return $port
}

$backendPort = Get-FreePort -Start 8000
Write-Host "✅ Backend port: $backendPort" -ForegroundColor Green

$envPath = Join-Path $PSScriptRoot "frontend\.env"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace 'VITE_API_URL=http://localhost:\d+', "VITE_API_URL=http://localhost:$backendPort"
$envContent = $envContent -replace 'VITE_WS_URL=ws://localhost:\d+', "VITE_WS_URL=ws://localhost:$backendPort"
Set-Content $envPath $envContent -NoNewline
Write-Host "✅ Updated frontend/.env -> port $backendPort" -ForegroundColor Green

$backendDir = Join-Path $PSScriptRoot "backend"
Write-Host "`n📦 Starting backend on port $backendPort..." -ForegroundColor Yellow
$backend = Start-Process "py" "-m uvicorn app.main:app --host 0.0.0.0 --port $backendPort" -WorkingDirectory $backendDir -PassThru -NoNewWindow

Start-Sleep -Seconds 2

$frontendDir = Join-Path $PSScriptRoot "frontend"
Write-Host "🎨 Starting frontend..." -ForegroundColor Yellow
$frontend = Start-Process "npm" "run dev -- --port 5173" -WorkingDirectory $frontendDir -PassThru -NoNewWindow

Write-Host "`n🎉 Servers starting!" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173"
Write-Host "   Backend:  http://localhost:$backendPort"
Write-Host "   API Docs: http://localhost:$backendPort/api/docs"
Write-Host "`n   Logins:"
Write-Host "   Client:  aisha@example.com / Client@123"
Write-Host "   Creator: priya@example.com / Creator@123"
Write-Host "   Admin:   admin@aicreatorhub.com / Admin@1234"
Write-Host "`nPress Ctrl+C to stop.`n" -ForegroundColor DarkGray
try { Wait-Process -Id $backend.Id } catch {}
