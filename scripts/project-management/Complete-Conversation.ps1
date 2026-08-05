param(
    [Parameter(Mandatory = $true)][string]$SessionId,
    [Parameter(Mandatory = $true)][string]$Summary,
    [Parameter(Mandatory = $true)][string]$Details,
    [Parameter(Mandatory = $true)][string]$Tests,
    [Parameter(Mandatory = $true)][string[]]$Paths,
    [string]$Risk = "None reported",
    [switch]$Amend
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "ConversationPr.Common.ps1")
$root = Get-MainRoot
$state = Read-ConversationState $root $SessionId
$branch = Invoke-GitText $root branch --show-current
if ($branch -notlike 'codex/*') { throw "Current branch '$branch' must match codex/*." }
if (-not (Test-ChineseSummary $Summary)) { throw "Summary must be a one-line Chinese description of at most 50 characters." }
foreach ($value in @($Details, $Tests, $Risk)) {
    if (-not $value.Trim()) { throw "Details, tests, and risk must not be empty." }
}

& (Join-Path $PSScriptRoot "Commit-Conversation.ps1") -Message $Summary -Paths $Paths -Amend:$Amend -Push
if ($LASTEXITCODE -ne 0) { throw "Conversation commit or push failed." }

$title = "[$($state.modelTag)]$Summary"
$detailsHeading = '"\u8be6\u7ec6\u8bf4\u660e"' | ConvertFrom-Json
$testsHeading = '"\u9a8c\u8bc1\u7ed3\u679c"' | ConvertFrom-Json
$riskHeading = '"\u98ce\u9669\u4e0e\u5907\u6ce8"' | ConvertFrom-Json
$body = @"
## $detailsHeading
$Details

## $testsHeading
$Tests

## $riskHeading
$Risk
"@
$temporaryBody = New-TemporaryFile
try {
    [IO.File]::WriteAllText($temporaryBody, $body, [Text.UTF8Encoding]::new($false))
    $existing = Get-ConversationPullRequest $root $branch
    if ($existing) {
        & gh pr edit $existing.number --title $title --body-file $temporaryBody --base main
        if ($LASTEXITCODE -ne 0) { throw "Unable to update pull request #$($existing.number)." }
        if (-not $existing.isDraft) {
            & gh pr ready $existing.number --undo
            if ($LASTEXITCODE -ne 0) { throw "Unable to convert pull request #$($existing.number) back to draft." }
        }
    } else {
        & gh pr create --draft --base main --head $branch --title $title --body-file $temporaryBody
        if ($LASTEXITCODE -ne 0) { throw "Unable to create draft pull request." }
    }
} finally {
    Remove-Item -Force -LiteralPath $temporaryBody -ErrorAction SilentlyContinue
}

$pr = Get-ConversationPullRequest $root $branch
if (-not $pr) { throw "Draft pull request was not found after creation/update." }
if (-not $pr.isDraft -or $pr.baseRefName -ne 'main' -or $pr.headRefName -ne $branch -or $pr.title -ne $title -or -not (Test-PullRequestBody $pr.body)) {
    throw "Pull request verification failed after creation/update."
}
$pr.url
