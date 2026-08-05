$ErrorActionPreference = "SilentlyContinue"
$inputJson = [Console]::In.ReadToEnd() | ConvertFrom-Json
$root = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $root) { exit 0 }
. (Join-Path $root "scripts\project-management\ConversationPr.Common.ps1")
$statePath = Get-ConversationStatePath $root $inputJson.session_id
if (-not (Test-Path -LiteralPath $statePath)) { exit 0 }
$state = Read-ConversationState $root $inputJson.session_id
$currentHead = Invoke-GitText $root rev-parse HEAD
$currentFingerprint = Get-RepositoryFingerprint $root
if ($currentHead -ne $state.initialHead -or $currentFingerprint -ne $state.initialFingerprint) {
    $auditPath = Join-Path (Get-ConversationStateDirectory $root) "$($inputJson.session_id -replace '[^A-Za-z0-9_.-]', '_').audit.log"
    "$(Get-Date -Format o) Session ended after repository changes; verify that its draft PR exists." | Add-Content -Encoding UTF8 -LiteralPath $auditPath
}
