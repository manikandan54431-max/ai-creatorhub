Write-Host "Seeding AI CreatorHub database..." -ForegroundColor Green
$env:PYTHONIOENCODING = 'utf-8'
Set-Location -Path "$PSScriptRoot\backend"
py seed.py
Write-Host ""
Write-Host "Done! You can now start the backend with ./start-backend.ps1" -ForegroundColor Green
