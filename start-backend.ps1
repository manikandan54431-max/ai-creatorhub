Write-Host "Starting AI CreatorHub Backend..." -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/api/docs" -ForegroundColor DarkCyan
$env:PYTHONIOENCODING = 'utf-8'
Set-Location -Path "$PSScriptRoot\backend"
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
