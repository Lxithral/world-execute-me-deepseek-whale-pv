# .tmp/shot.ps1 — 无头 Chrome 截图 / 取 DOM（开发期验证工具，不属于交付物）
# 用法: pwsh -File .tmp/shot.ps1 -Url "http://127.0.0.1:5173/?demo=props&shot=3" -Out "$PWD\.tmp\props.png"
param(
  [Parameter(Mandatory=$true)][string]$Url,
  [string]$Out = "",
  [string]$Dump = "",
  [int]$Budget = 30000,
  [int]$W = 1920,
  [int]$H = 1080
)
$ErrorActionPreference = "Continue"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ud = Join-Path $env:TEMP "dshpv-cud"
$cargs = @(
  "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--window-size=$W,$H", "--virtual-time-budget=$Budget", "--user-data-dir=$ud"
)
$outFull = $null
if ($Out)  { $outFull = [System.IO.Path]::GetFullPath($Out); $cargs += "--screenshot=$outFull" }
if ($Dump) { $cargs += "--dump-dom" }
$cargs += $Url
if ($Dump) {
  & $chrome @cargs 2>$null | Set-Content -LiteralPath $Dump -Encoding UTF8
  Write-Output "dom -> $Dump ($((Get-Item $Dump).Length) bytes)"
} else {
  & $chrome @cargs 2>$null | Out-Null
  if ($outFull -and (Test-Path -LiteralPath $outFull)) {
    $f = Get-Item -LiteralPath $outFull
    Write-Output "png -> $($f.FullName) ($([math]::Round($f.Length/1024,1)) KB)"
  } else { Write-Output "NO SCREENSHOT PRODUCED" }
}
