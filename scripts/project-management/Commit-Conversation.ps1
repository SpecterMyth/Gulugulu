param(
    [Parameter(Mandatory = $true)][string]$Message,
    [Parameter(Mandatory = $true)][string[]]$Paths,
    [switch]$Amend,
    [switch]$Push
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "ConversationPr.Common.ps1")
$mainRoot = Get-MainRoot
$branch = Invoke-GitText $mainRoot branch --show-current
if ($branch -notlike "codex/*") { throw "Conversation commits require a codex/* branch; current branch is '$branch'." }
if (-not $Message.Trim()) { throw "Commit message must not be empty." }
foreach ($path in $Paths) {
    if ([IO.Path]::IsPathRooted($path)) { throw "Paths must be repository-relative: $path" }
    & git -C $mainRoot add -- $path
    if ($LASTEXITCODE -ne 0) { throw "Unable to stage $path" }
}
$staged = @(& git -C $mainRoot diff --cached --name-only)
if (-not $staged) { throw "No staged conversation changes." }
if ($Amend) { & git -C $mainRoot commit --amend -m $Message } else { & git -C $mainRoot commit -m $Message }
if ($LASTEXITCODE -ne 0) { throw "Commit failed." }
if ($Push) {
    if ($Amend) { & git -C $mainRoot push --force-with-lease -u origin $branch }
    else { & git -C $mainRoot push -u origin $branch }
    if ($LASTEXITCODE -ne 0) { throw "Push failed." }
}
