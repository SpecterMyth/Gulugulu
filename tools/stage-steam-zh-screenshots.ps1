$ErrorActionPreference = 'Stop'

$englishDir = 'C:\Users\admin\AppData\Local\Temp\gulugulu_steam_en_20260804'
$chineseSourceDir = 'D:\AIProjects\CodexProjects\Gulugulu\assets\steam-store\p0-v4\screenshots\zh'
$outputDir = 'C:\Users\admin\AppData\Local\Temp\gulugulu_steam_zh_20260804'

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Get-ChildItem -LiteralPath $englishDir -File -Filter '*.png' | ForEach-Object {
    $baseName = $_.BaseName -replace '^\d+_', ''
    $source = Join-Path $chineseSourceDir ($baseName + '.png')
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Missing localized screenshot: $source"
    }

    $localizedName = $_.BaseName + '_schinese.png'
    Copy-Item -LiteralPath $source -Destination (Join-Path $outputDir $localizedName) -Force
}

Get-ChildItem -LiteralPath $outputDir -File | Sort-Object Name | Select-Object Name, Length
