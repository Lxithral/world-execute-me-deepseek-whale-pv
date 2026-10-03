# .tmp/probe.ps1 — 取回 ?probe=1 写出的 JSON（开发期取证工具）
param([Parameter(Mandatory=$true)][string]$Url, [string]$Tag = "probe", [int]$Budget = 25000, [int]$W = 1280, [int]$H = 720)
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ud = Join-Path $env:TEMP "dshpv-cud2"
$o = & $chrome --headless=new --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader --hide-scrollbars --no-first-run --window-size="$W,$H" --virtual-time-budget=$Budget --user-data-dir=$ud --enable-logging=stderr --v=0 --dump-dom $Url 2>&1
$txt = ($o -join "`n")
$i = $txt.IndexOf('PROBE {')
if ($i -lt 0) { Write-Output "[$Tag] NO PROBE"; exit 0 }
$j = $txt.IndexOf('}", source:', $i)
if ($j -lt 0) { $j = $txt.IndexOf("}`n", $i) }
$json = $txt.Substring($i + 6, $j - $i - 6 + 1)
try {
  $obj = $json | ConvertFrom-Json
  Write-Output ("[$Tag] " + ($obj | ConvertTo-Json -Depth 6 -Compress))
} catch {
  Write-Output ("[$Tag] RAW " + $json)
}
