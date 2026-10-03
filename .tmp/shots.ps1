# .tmp/shots.ps1 — 批量截图（走 CDP：无头 Chrome 的 --screenshot 抓不到 WebGL 后备缓冲）
# 用法: & .\.tmp\shots.ps1 -Shots @(@{n='props';u='?demo=props&shot=4'}, ...)
param(
  [Parameter(Mandatory=$true)][array]$Shots,
  [string]$Probe = "1"
)
$root = (Get-Location).Path
foreach ($s in $Shots) {
  $name = $s.n
  $url = "http://127.0.0.1:5173/" + $s.u
  $png = Join-Path $root ".tmp\$name.png"
  $o = & node (Join-Path $root "tools\shoot.mjs") --url $url --probe $Probe --out $png 2>&1
  $pngLine = ($o | Where-Object { $_ -match '^png ->' }) -join ''
  $statLine = ($o | Where-Object { $_ -match '^t=' }) -join ''
  Write-Output ("{0,-12} {1}  {2}" -f $name, $statLine, $(if ($pngLine) { 'OK' } else { 'NO PNG: ' + ($o -join ' ') }))
}
