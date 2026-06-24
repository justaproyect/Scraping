Add-Type -AssemblyName System.Web

$dataDir = "C:\Excel\Scraping\datos"
$jsonFile = "$dataDir\enviar_barranquilla.json"
$skip = 70
$maxContacts = 300

$json = Get-Content $jsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
$withPhone = $json | Where-Object { $_.telefono -ne "" }
$contactos = $withPhone[$skip..($skip + $maxContacts - 1)]
$total = $contactos.Count

Write-Host ">>> SCRAPING - ENVIO MANUAL ASISTIDO <<<" -ForegroundColor Cyan
Write-Host "Contactos: $total (saltando $skip)" -ForegroundColor Yellow
Write-Host ""

function Get-CleanNumber {
    param([string]$raw)
    $num = $raw -replace '\D', ''
    if ($num -match '^57') { $num = $num -replace '^57', '' }
    if ($num -match '^0') { $num = $num -replace '^0', '' }
    if ($num -match '^3') { return "57$num" }
    return ""
}

$ok = 0
$fail = 0
$skipCount = 0

for ($i = 0; $i -lt $total; $i++) {
    $n = $contactos[$i]
    $num = Get-CleanNumber $n.telefono
    $nombre = $n.nombre
    if ($nombre.Length -gt 35) { $nombre = $nombre.Substring(0, 35) }
    
    if (-not $num) {
        $skipCount++
        Write-Host "[$($i+1)/$total] ⚠ $nombre - fijo/sin numero" -ForegroundColor DarkYellow
        continue
    }
    
    $msg = [System.Web.HttpUtility]::UrlEncode($n.mensaje)
    $url = "https://wa.me/$num?text=$msg"
    
    Write-Host "[$($i+1)/$total] ✅ $nombre" -ForegroundColor Green
    Write-Host "   Tel: $($n.telefono)" -ForegroundColor Gray
    Write-Host "   Link: $url" -ForegroundColor DarkGray
    
    Start-Process "chrome.exe" -ArgumentList $url
    Write-Host "   Presiona ENTER cuando hayas enviado..." -ForegroundColor Cyan
    $null = Read-Host
    $ok++
}

Write-Host ""
Write-Host "RESULTADOS" -ForegroundColor Cyan
Write-Host "✅ Enviados: $ok" -ForegroundColor Green
Write-Host "❌ Fallados: $fail" -ForegroundColor Red
Write-Host "⚠ Fijos/sin numero: $skipCount" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "FIN" -ForegroundColor Cyan
