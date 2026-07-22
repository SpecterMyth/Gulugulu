# 把 assets/steam-store 下全部素材+截图拼成一张审阅用 contact sheet(PNG)。
#   powershell -ExecutionPolicy Bypass -File scripts\make_review_sheet.ps1
param(
  [string]$OutPath = "assets\steam-store\_review_sheet.png",
  [int]$ThumbW = 460,
  [int]$Cols = 4,
  [int]$Pad = 14,
  [int]$LabelH = 26
)
Add-Type -AssemblyName System.Drawing

$root = "D:\AIProjects\CodexProjects\Gulugulu\assets\steam-store"
$files = @(
  Get-ChildItem $root -File | Where-Object { $_.Extension -in ".png", ".jpg" -and $_.Name -notlike "_review*" } | Sort-Object Name
  Get-ChildItem (Join-Path $root "screenshots\en") -File -ErrorAction SilentlyContinue | Sort-Object Name
  Get-ChildItem (Join-Path $root "screenshots\zh") -File -ErrorAction SilentlyContinue | Sort-Object Name
)
if ($files.Count -eq 0) { Write-Error "没有找到素材"; exit 1 }

$rows = [Math]::Ceiling($files.Count / $Cols)
# 估算每格高:按最大高宽比预扫
$cellHs = @()
foreach ($f in $files) {
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $cellHs += [int]($ThumbW * $img.Height / $img.Width)
  $img.Dispose()
}
$rowH = @()
for ($r = 0; $r -lt $rows; $r++) {
  $slice = $cellHs[($r * $Cols)..([Math]::Min(($r + 1) * $Cols - 1, $cellHs.Count - 1))]
  $rowH += (($slice | Measure-Object -Maximum).Maximum + $LabelH + $Pad)
}
$W = $Cols * ($ThumbW + $Pad) + $Pad
$H = ($rowH | Measure-Object -Sum).Sum + $Pad

$sheet = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(255, 245, 234, 210))
$font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 74, 51, 19))

$y = $Pad
$i = 0
for ($r = 0; $r -lt $rows; $r++) {
  for ($c = 0; $c -lt $Cols -and $i -lt $files.Count; $c++) {
    $f = $files[$i]
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $h = [int]($ThumbW * $img.Height / $img.Width)
    $x = $Pad + $c * ($ThumbW + $Pad)
    $g.DrawImage($img, $x, $y, $ThumbW, $h)
    $img.Dispose()
    $label = if ($f.DirectoryName -like "*screenshots*") { "$(Split-Path $f.DirectoryName -Leaf)/$($f.Name)" } else { $f.Name }
    $g.DrawString($label, $font, $brush, $x, $y + $h + 3)
    $i++
  }
  $y += $rowH[$r]
}
$g.Dispose()
$full = Join-Path (Get-Location) $OutPath
$dir = Split-Path -Parent $full
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
$sheet.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
Write-Host "已生成 $OutPath($($files.Count) 张)"
