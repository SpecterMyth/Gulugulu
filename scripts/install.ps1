$ErrorActionPreference = "Stop"

$Repository = "SpecterMyth/Gulugulu"
$LatestReleaseApi = "https://api.github.com/repos/$Repository/releases/latest"

function Select-InstallerAsset {
  param([array]$Assets)

  $preferredExtensions = @(".msi", ".exe")
  foreach ($extension in $preferredExtensions) {
    $match = $Assets |
      Where-Object { $_.name -like "*$extension" -and $_.name -notlike "*.sig" } |
      Select-Object -First 1

    if ($match) {
      return $match
    }
  }

  return $null
}

Write-Host "Fetching latest Gulugulu release..."

try {
  $release = Invoke-RestMethod -Uri $LatestReleaseApi -Headers @{ "User-Agent" = "Gulugulu-Installer" }
} catch {
  Write-Error "Could not fetch the latest release. Check https://github.com/$Repository/releases/latest or build from source with INSTALL.md."
  exit 1
}

$asset = Select-InstallerAsset -Assets $release.assets
if (-not $asset) {
  Write-Error "No Windows installer asset was found in the latest release. Build from source with INSTALL.md."
  exit 1
}

$downloadPath = Join-Path $env:TEMP $asset.name
Write-Host "Downloading $($asset.name)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $downloadPath -Headers @{ "User-Agent" = "Gulugulu-Installer" }

Write-Host "Starting installer: $downloadPath"
if ($downloadPath.EndsWith(".msi", [System.StringComparison]::OrdinalIgnoreCase)) {
  Start-Process -FilePath "msiexec.exe" -ArgumentList @("/i", "`"$downloadPath`"") -Wait
} else {
  Start-Process -FilePath $downloadPath -Wait
}

Write-Host "Gulugulu installer finished."
