param(
  [string]$ServerHost = "89.208.211.231",
  [int]$Port = 49619,
  [string]$User = "ubuntu",
  [string]$RemoteDir = "/tmp/psbbitrix24-deploy",
  [switch]$UploadEnv,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

foreach ($tool in @("ssh", "scp", "tar", "npm")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "$tool is required but was not found in PATH."
  }
}

$npmCommand = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue).Source
if (-not $npmCommand) {
  $npmCommand = (Get-Command "npm" -ErrorAction Stop).Source
}

if (-not (Test-Path "node_modules")) {
  & $npmCommand ci
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: npm ci"
  }
}

if (-not $SkipBuild) {
  & $npmCommand run build
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: npm run build"
  }
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

& tar -czf $archive @archiveItems
if ($LASTEXITCODE -ne 0) {
  throw "Command failed: tar -czf $archive $($archiveItems -join ' ')"
}

$target = "${User}@${ServerHost}"
$remoteArchive = "$RemoteDir/release.tgz"

$sshArgs = @("-p", "$Port", "-o", "StrictHostKeyChecking=accept-new", $target, "rm -rf '$RemoteDir' && mkdir -p '$RemoteDir'")
& ssh @sshArgs
if ($LASTEXITCODE -ne 0) {
  throw "Command failed: ssh $($sshArgs -join ' ')"
}

$scpArgs = @("-P", "$Port", "-o", "StrictHostKeyChecking=accept-new", $archive, "${target}:${remoteArchive}")
& scp @scpArgs
if ($LASTEXITCODE -ne 0) {
  throw "Command failed: scp $($scpArgs -join ' ')"
}

$deployArgs = @("-p", "$Port", "-o", "StrictHostKeyChecking=accept-new", $target, "cd '$RemoteDir' && tar -xzf release.tgz && bash deploy/deploy.sh")
& ssh @deployArgs
if ($LASTEXITCODE -ne 0) {
  throw "Command failed: ssh $($deployArgs -join ' ')"
}

Write-Host "Deployment finished: https://psbbitrix24.ru"
