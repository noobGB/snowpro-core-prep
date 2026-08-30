# SnowPro Study App Launcher (Windows) - optional convenience wrapper around Option A of the
# README (docker compose up -d). Starts Docker Desktop if it isn't running, brings the container
# up, waits for the app to respond, then opens it in the default browser.
#
# Usage: run directly (`powershell -File .\Launch-SnowPro.ps1`), or compile it into a
# double-clickable .exe - see the README's "Windows one-click launcher" section for the command.

# ---------------- config ----------------
$AppUrl          = "https://localhost"
$ComposeFile     = "docker-compose.yml"
$WindowTitle     = "SnowPro Study App"
$HealthTimeoutSec = 90
# -----------------------------------------

# Issue #64: the app is now served over HTTPS via Caddy's self-signed local cert (see README's
# "Adding a user" / CLAUDE.md's HTTPS section for why there's no way around that without owning a
# domain) -- Invoke-WebRequest below would otherwise throw a trust error and this script would
# report "didn't confirm readiness" even though the app is genuinely up. Windows PowerShell 5.1
# (what this script targets, per its own header comment) has no -SkipCertificateCheck parameter
# (that's PowerShell 7+ only), so this is the standard 5.1-compatible workaround: install a
# callback that accepts any cert for the lifetime of this process. Scoped to this script's own
# short-lived process, not a machine-wide trust change.
if (-not ("TrustAllCertsPolicy" -as [type])) {
    Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) {
        return true;
    }
}
"@
}
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy

$Host.UI.RawUI.WindowTitle = $WindowTitle

if ($PSScriptRoot) {
    $ProjectDir = $PSScriptRoot
} else {
    $ProjectDir = Split-Path ([System.Diagnostics.Process]::GetCurrentProcess().Path) -Parent
}
Set-Location $ProjectDir

function Test-DockerRunning {
    docker info *>$null
    return $LASTEXITCODE -eq 0
}

function Find-DockerDesktopExe {
    $candidates = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    return $null
}

Write-Host "== $WindowTitle =="
Write-Host "Project folder: $ProjectDir"
Write-Host ""

if (-not (Test-DockerRunning)) {
    Write-Host "Docker Desktop is not running. Starting it..."
    $dockerExe = Find-DockerDesktopExe
    if (-not $dockerExe) {
        Write-Host "ERROR: Could not find Docker Desktop.exe. Please start Docker Desktop manually and re-run this launcher."
        Read-Host "Press Enter to close"
        exit 1
    }
    Start-Process $dockerExe

    $waited = 0
    while (-not (Test-DockerRunning) -and $waited -lt 120) {
        Start-Sleep -Seconds 3
        $waited += 3
        Write-Host "  ... waiting for Docker Desktop to be ready ($waited s)"
    }
    if (-not (Test-DockerRunning)) {
        Write-Host "ERROR: Docker Desktop did not start within 120 seconds."
        Read-Host "Press Enter to close"
        exit 1
    }
    Write-Host "Docker Desktop is ready."
}

Write-Host ""
Write-Host "Starting containers (docker compose up -d)..."
docker compose -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 'docker compose up' failed. See output above."
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host ""
Write-Host "Waiting for the app to respond at $AppUrl ..."
$waited = 0
$up = $false
while ($waited -lt $HealthTimeoutSec) {
    try {
        $resp = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 3
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { $up = $true; break }
    } catch {
        # not ready yet
    }
    Start-Sleep -Seconds 2
    $waited += 2
}

if ($up) {
    Write-Host "App is up. Opening browser..."
} else {
    Write-Host "App didn't confirm readiness within $HealthTimeoutSec s - opening the browser anyway (it may still be starting)."
}
Start-Process $AppUrl

Start-Sleep -Seconds 2
