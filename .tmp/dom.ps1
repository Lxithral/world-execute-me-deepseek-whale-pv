# .tmp/dom.ps1 — 取回 ?probe 写出的 JSON（走文件重定向，避开 PowerShell 管道的不稳定）
param([Parameter(Mandatory=$true)][string]$Url, [int]$Budget = 25000, [string]$Tag = "probe")
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$ud = Join-Path $env:TEMP "dshpv-fresh2"
$out = Join-Path $root ".tmp\dom3.html"
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
$line = '"' + $chrome + '" --headless=new --disable-gpu --enable-unsafe-swiftshader --use-angle=swiftshader --hide-scrollbars --no-first-run --window-size=1280,720 --virtual-time-budget=' + $Budget + ' --user-data-dir="' + $ud + '" --dump-dom "' + $Url + '" > "' + $out + '" 2>nul'
cmd /c $line
$txt = if (Test-Path -LiteralPath $out) { Get-Content -LiteralPath $out -Raw } else { "" }
if (-not $txt) { Write-Output "[$Tag] EMPTY DOM"; exit 0 }
$m = [regex]::Match($txt, '<pre id="probe"[^>]*>(.*?)</pre>')
if (-not $m.Success) { Write-Output "[$Tag] NO PROBE (dom len=$($txt.Length))"; exit 0 }
$json = $m.Groups[1].Value -replace '&quot;', '"' -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>'
$obj = $json | ConvertFrom-Json
Write-Output ("[$Tag] t=" + $obj.t + " active=" + ($obj.active -join ',') + " tris=" + $obj.info.tris + " calls=" + $obj.info.calls + " px.mean=" + $obj.px.mean + " lit=" + $obj.px.lit + " errors=" + $obj.errorCount)
if ($obj.objs) { foreach ($e in $obj.objs) { Write-Output ("   {0,-26} pos=({1}) op={2} tr={3}" -f $e.n, ($e.p -join ','), $e.op, $e.tr) } }
if ($obj.rows) { foreach ($e in $obj.rows) { Write-Output ("   " + ($e | ConvertTo-Json -Compress)) } }
if ($obj.checks) { foreach ($e in $obj.checks) { Write-Output ("   {0} {1} :: {2}" -f $(if ($e.ok) { 'PASS' } else { 'FAIL' }), $e.name, $e.detail) } }
