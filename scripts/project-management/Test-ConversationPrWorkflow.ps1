$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "ConversationPr.Common.ps1")

function Assert-Equal($Expected, $Actual, [string]$Message) {
    if ($Expected -ne $Actual) { throw "$Message Expected '$Expected', got '$Actual'." }
}
function Assert-True($Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

Assert-Equal 'GPT5.6SOL' (ConvertTo-ModelTag 'gpt-5.6-sol') 'Model normalization failed.'
Assert-Equal 'CLAUDEOPUS4.7' (ConvertTo-ModelTag 'claude-opus-4.7') 'Alternate model normalization failed.'
$chineseSummary = '"\u4fee\u590d\u7e41\u4f53\u4e2d\u6587\u5f15\u5bfc\u6587\u6848"' | ConvertFrom-Json
Assert-True (Test-ChineseSummary $chineseSummary) 'Valid Chinese summary was rejected.'
Assert-True (-not (Test-ChineseSummary 'Fix onboarding copy')) 'English-only summary was accepted.'
Assert-True (-not (Test-ChineseSummary ($chineseSummary + "`n" + $chineseSummary))) 'Multiline summary was accepted.'
$validBody = ('"## \u8be6\u7ec6\u8bf4\u660e\n\u5185\u5bb9\n\n## \u9a8c\u8bc1\u7ed3\u679c\n\u901a\u8fc7\n\n## \u98ce\u9669\u4e0e\u5907\u6ce8\n\u65e0"' | ConvertFrom-Json)
Assert-True (Test-PullRequestBody $validBody) 'Valid PR body was rejected.'
$incompleteBody = '"## \u8be6\u7ec6\u8bf4\u660e\n\u5185\u5bb9"' | ConvertFrom-Json
Assert-True (-not (Test-PullRequestBody $incompleteBody)) 'Incomplete PR body was accepted.'
$emptySectionBody = '"## \u8be6\u7ec6\u8bf4\u660e\n\n## \u9a8c\u8bc1\u7ed3\u679c\n\u901a\u8fc7\n\n## \u98ce\u9669\u4e0e\u5907\u6ce8\n\u65e0"' | ConvertFrom-Json
Assert-True (-not (Test-PullRequestBody $emptySectionBody)) 'Empty PR body section was accepted.'

$fixture = Join-Path ([IO.Path]::GetTempPath()) ("gulugulu-pr-workflow-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $fixture | Out-Null
try {
    & git -C $fixture init --quiet
    & git -C $fixture config user.email 'workflow-test@example.com'
    & git -C $fixture config user.name 'Workflow Test'
    Set-Content -LiteralPath (Join-Path $fixture 'tracked.txt') -Value 'initial'
    & git -C $fixture add tracked.txt
    & git -C $fixture commit --quiet -m initial
    $clean = Get-RepositoryFingerprint $fixture
    Set-Content -LiteralPath (Join-Path $fixture 'tracked.txt') -Value 'changed'
    $dirty = Get-RepositoryFingerprint $fixture
    Assert-True ($clean -ne $dirty) 'Tracked content change did not alter fingerprint.'
    Set-Content -LiteralPath (Join-Path $fixture 'untracked.txt') -Value 'new'
    $untracked = Get-RepositoryFingerprint $fixture
    Assert-True ($dirty -ne $untracked) 'Untracked file did not alter fingerprint.'
} finally {
    Remove-Item -Recurse -Force -LiteralPath $fixture
}

Write-Output 'Conversation PR workflow tests passed.'
