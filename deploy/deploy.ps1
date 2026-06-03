param(
  [string]$ServerHost = "89.208.211.231",
  [int]$Port = 49619,
  [string]$User = "ubuntu",
  [string]$RemoteDir = "/tmp/psbbitrix24-deploy",
  [switch]$UploadEnv,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [string[]]$CommandArgs = @()
  )

  & $Command @CommandArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command $($CommandArgs -join ' ')"
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

foreach ($tool in @("ssh", "scp", "tar", "npm")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "$tool is required but was not found in PATH."
  }
}

if (-not (Test-Path "node_modules")) {
  Invoke-Checked -Command "npm" -CommandArgs @("ci")
}

if (-not $SkipBuild) {
  Invoke-Checked -Command "npm" -CommandArgs @("run", "build")
}

if (-not (Test-Path "dist")) {
  throw "dist folder is missing. Run without -SkipBuild or build the app first."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path $env:TEMP "psbbitrix24-$stamp.tgz"
$archiveItems = @("dist", "server", "deploy", "package.json", "package-lock.json")

if ($UploadEnv) {
  if (-not (Test-Path ".env")) {
    throw "-UploadEnv was provided, but .env was not found."
  }
  $archiveItems += ".env"
}

if (Test-Path $archive) {
  Remove-Item -LiteralPath $archive -Force
}

Invoke-Checked -Command "tar" -CommandArgs (@("-czf", $archive) + $archiveItems)

$target = "${User}@${ServerHost}"
$remoteArchive = "$RemoteDir/release.tgz"

Invoke-Checked -Command "ssh" -CommandArgs @("-p", "$Port", "-o", "StrictHostKeyChecking=accept-new", $target, "rm -rf '$RemoteDir' && mkdir -p '$RemoteDir'")
Invoke-Checked -Command "scp" -CommandArgs @("-P", "$Port", "-o", "StrictHostKeyChecking=accept-new", $archive, "${target}:${remoteArchive}")
Invoke-Checked -Command "ssh" -CommandArgs @("-p", "$Port", "-o", "StrictHostKeyChecking=accept-new", $target, "cd '$RemoteDir' && tar -xzf release.tgz && bash deploy/deploy.sh")

Write-Host "Deployment finished: https://psbbitrix24.ru"
