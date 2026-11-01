# SORT for Windows, installed from PowerShell:
#   irm https://sortcdav.netlify.app/install.ps1 | iex
#
# A file fetched by PowerShell carries no "downloaded from the internet" mark,
# so SmartScreen does not stop the installer. It installs for the current user,
# with no administrator rights needed.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'          # the progress bar makes downloads crawl in PowerShell 5
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$base = if ($env:SORT_BASE) { $env:SORT_BASE } else { 'https://sortcdav.netlify.app' }
function Say($t) { Write-Host "> $t" -ForegroundColor Yellow }

Say "Asking $base for the newest SORT"
try { $m = Invoke-RestMethod "$base/latest.json" } catch { throw "Could not reach $base. Check the internet and try again." }
$f = $m.files.win
if (-not $f -or -not $f.name) { throw 'The site did not say which file to download.' }

$out = Join-Path $env:TEMP $f.name
Say "Downloading SORT $($m.version)"
Invoke-WebRequest "$base/download/$($f.name)" -OutFile $out -UseBasicParsing

if ($f.sha256) {
  $got = (Get-FileHash $out -Algorithm SHA256).Hash.ToLower()
  if ($got -ne $f.sha256.ToLower()) { Remove-Item $out -Force; throw 'The download does not match the published file. Nothing was installed.' }
}
Unblock-File $out

# a SORT that is open would keep the old files in use
Get-Process SORT -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600

Say 'Installing'
Start-Process $out -ArgumentList '/S' -Wait
Remove-Item $out -Force -ErrorAction SilentlyContinue

$exe = @("$env:LOCALAPPDATA\Programs\SORT\SORT.exe", "$env:LOCALAPPDATA\Programs\sort-cdavio\SORT.exe") |
       Where-Object { Test-Path $_ } | Select-Object -First 1
Say "SORT $($m.version) is installed."
if ($exe) { Start-Process $exe } else { Write-Host 'Open SORT from the Start menu.' }
