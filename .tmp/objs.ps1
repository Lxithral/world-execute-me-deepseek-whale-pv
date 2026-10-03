# .tmp/objs.ps1 — 列出某一帧所有可见网格的世界坐标与材质透明度
param([Parameter(Mandatory=$true)][string]$Url, [int]$Budget = 25000)
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ud = Join-Path $env:TEMP "dshpv-objs"
$o = & $chrome --headless=new --disable-gpu --enable-unsafe-swiftshader --use-angle=swiftshader --hide-scrollbars --no-first-run --window-size=1280,720 --virtual-time-budget=$Budget --user-data-dir=$ud --dump-dom $Url 2>$null
$txt = ($o -join "`n")
$m = [regex]::Match($txt, '<pre id="probe"[^>]*>(.*?)</pre>')
if (-not $m.Success) { Write-Output "NO PROBE (len=$($txt.Length))"; exit 0 }
$json = $m.Groups[1].Value -replace '&quot;', '"'
$obj = $json | ConvertFrom-Json
Write-Output ("active=" + ($obj.active -join ',') + "  tris=" + $obj.info.tris + "  calls=" + $obj.info.calls + "  px.mean=" + $obj.px.mean + "  lit=" + $obj.px.lit)
foreach ($e in $obj.objs) {
  Write-Output ("{0,-26} pos=({1}) op={2} tr={3}" -f $e.n, ($e.p -join ','), $e.op, $e.tr)
}
