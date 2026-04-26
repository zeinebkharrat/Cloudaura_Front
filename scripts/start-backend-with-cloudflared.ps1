param(
    [int]$BackendPort = 9091
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$cloudflaredExe = Join-Path $repoRoot "tools\cloudflared\cloudflared.exe"

if (!(Test-Path $cloudflaredExe)) {
    throw "cloudflared.exe not found at $cloudflaredExe"
}

$logPath = Join-Path $env:TEMP ("cloudflared-activity-qr-{0}.log" -f ([guid]::NewGuid().ToString("N")))

function Get-AvailablePort {
    param([int]$PreferredPort)

    try {
        $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $PreferredPort)
        $probe.Start()
        $probe.Stop()
        return $PreferredPort
    }
    catch {
        $fallback = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
        $fallback.Start()
        $freePort = ([System.Net.IPEndPoint]$fallback.LocalEndpoint).Port
        $fallback.Stop()
        return $freePort
    }
}

$effectivePort = Get-AvailablePort -PreferredPort $BackendPort
if ($effectivePort -ne $BackendPort) {
    Write-Host "Port $BackendPort is busy, using free port $effectivePort"
}

$cloudflaredArgs = @(
    "tunnel",
    "--url", "http://localhost:$effectivePort",
    "--logfile", $logPath,
    "--no-autoupdate"
)

$cloudflaredProc = Start-Process -FilePath $cloudflaredExe -ArgumentList $cloudflaredArgs -PassThru -WindowStyle Hidden

try {
    $publicUrl = ""
    for ($i = 0; $i -lt 60; $i++) {
        if (Test-Path $logPath) {
            $content = Get-Content -Path $logPath -Raw -ErrorAction SilentlyContinue
            if ($content -match "https://[a-z0-9-]+\.trycloudflare\.com") {
                $publicUrl = $matches[0]
                break
            }
        }
        Start-Sleep -Milliseconds 500
    }

    if ([string]::IsNullOrWhiteSpace($publicUrl)) {
        throw "Could not detect a trycloudflare tunnel URL from $logPath"
    }

    $publicUrl = $publicUrl.TrimEnd('/')

    Write-Host "Cloudflared public URL: $publicUrl"
    Write-Host "QR codes will use this public URL for signed activity receipt PDF links."

    $env:SERVER_PORT = "$effectivePort"
    $env:APP_PUBLIC_BASE_URL = $publicUrl
    $env:APP_BACKEND_BASE_URL = $publicUrl

    Push-Location $backendDir
    try {
        & .\mvnw.cmd spring-boot:run
    } finally {
        Pop-Location
    }
}
finally {
    if ($cloudflaredProc -and !$cloudflaredProc.HasExited) {
        Stop-Process -Id $cloudflaredProc.Id -Force
    }
    if (Test-Path $logPath) {
        try {
            Remove-Item $logPath -Force -ErrorAction Stop
        }
        catch {
            # Ignore cleanup errors (e.g., temporary file lock by AV/indexer).
        }
    }
}
