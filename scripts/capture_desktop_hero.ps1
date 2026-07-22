# 桌面真机 hero 镜头截屏(Steam 商店 s7):
#   powershell -ExecutionPolicy Bypass -File scripts\capture_desktop_hero.ps1 `
#     [-OutPath assets\steam-store\screenshots\en\desktop_hero.png] [-Delay 8] [-CropX -1] [-CropY -1]
# 用法:先摆好舞台(干净壁纸 + 无隐私内容的编辑器/终端窗口 + 启动
# projects\gulugulu-app\src-tauri\target\release\gulugulu.exe 拖到右下),
# 运行本脚本,倒计时后全屏截取并裁出 1920x1080。
# 关键:显示器 3440x1440@125% 缩放 → 必须先 SetProcessDPIAware,否则
# CopyFromScreen 只看到 2752x1152 的缩放坐标系(裁剪错位)。

param(
  [string]$OutPath = "assets\steam-store\screenshots\en\desktop_hero.png",
  [int]$Delay = 8,
  [int]$CropX = -1,
  [int]$CropY = -1,
  [int]$CropW = 1920,
  [int]$CropH = 1080
)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DpiFix {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[void][DpiFix]::SetProcessDPIAware()
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Host ("主屏物理分辨率:{0}x{1}" -f $bounds.Width, $bounds.Height)
if ($bounds.Width -lt $CropW -or $bounds.Height -lt $CropH) {
  Write-Error "主屏小于 ${CropW}x${CropH},无法满足 Steam 截图分辨率"
  exit 1
}

for ($i = $Delay; $i -gt 0; $i--) {
  Write-Host ("倒计时 {0}s…摆好舞台(宠物窗口置于裁剪区内)" -f $i)
  Start-Sleep -Seconds 1
}

$full = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($full)
$g.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $full.Size)
$g.Dispose()

# 默认裁剪:右下锚定(留边距,避开任务栏约 60px)。
if ($CropX -lt 0) { $CropX = $bounds.Width - $CropW - 40 }
if ($CropY -lt 0) { $CropY = $bounds.Height - $CropH - 70 }
$CropX = [Math]::Max(0, [Math]::Min($CropX, $bounds.Width - $CropW))
$CropY = [Math]::Max(0, [Math]::Min($CropY, $bounds.Height - $CropH))

$crop = New-Object System.Drawing.Bitmap($CropW, $CropH)
$g2 = [System.Drawing.Graphics]::FromImage($crop)
$srcRect = New-Object System.Drawing.Rectangle($CropX, $CropY, $CropW, $CropH)
$dstRect = New-Object System.Drawing.Rectangle(0, 0, $CropW, $CropH)
$g2.DrawImage($full, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g2.Dispose()

$dir = Split-Path -Parent $OutPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
$crop.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose(); $full.Dispose()
Write-Host ("已保存 {0}(裁剪原点 {1},{2})" -f $OutPath, $CropX, $CropY)
