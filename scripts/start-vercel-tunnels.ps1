# Run explicitly to expose only the local backend through a temporary HTTPS tunnel.
# Camera stays local unless -IncludeCamera is explicitly requested.
# Does not install software, restart services, or change application configuration.
param([switch]$IncludeCamera, [switch]$AllowUnprotectedBackend)
$ErrorActionPreference = 'Stop'
if (-not $AllowUnprotectedBackend) {
    throw 'Public tunnel is disabled: backend access protection must be configured first. No tunnel was started. See docs/vercel-deployment.md.'
}
$projectDirectory = Split-Path -Parent $PSScriptRoot
$cloudflaredTool = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredPath = Join-Path $projectDirectory '.vercel-local/cloudflared.exe'
if ($cloudflaredTool) { $cloudflaredPath = $cloudflaredTool.Source }
if (-not (Test-Path -LiteralPath $cloudflaredPath)) {
    throw 'Install cloudflared first: winget install --id Cloudflare.cloudflared --exact . Then reopen PowerShell. See docs/vercel-deployment.md.'
}
$outputDirectory = Join-Path $projectDirectory '.vercel-local'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$runId = [guid]::NewGuid().ToString('N')
$tunnelProcesses = @()
$publicUrls = @{ camera = 'http://127.0.0.1:8090' }
$services = @(@{ Name = 'backend'; Port = 8000 })
if ($IncludeCamera) { $services += @{ Name = 'camera'; Port = 8090 } }
try {
    foreach ($service in $services) {
        $healthUrl = 'http://127.0.0.1:{0}/health' -f $service.Port
        $null = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
        $logPath = Join-Path $outputDirectory ($service.Name + '-' + $runId + '.log')
        $stdoutPath = Join-Path $outputDirectory ($service.Name + '-' + $runId + '-stdout.log')
        $tunnelProcess = Start-Process -FilePath $cloudflaredPath -ArgumentList @(
            'tunnel', '--url', ('http://127.0.0.1:{0}' -f $service.Port), '--no-autoupdate'
        ) -WindowStyle Hidden -PassThru -RedirectStandardError $logPath -RedirectStandardOutput $stdoutPath
        $tunnelProcesses += $tunnelProcess
        $deadline = (Get-Date).AddSeconds(60)
        do {
            Start-Sleep -Milliseconds 500
            $logText = (Get-Content -LiteralPath $logPath -Raw -ErrorAction SilentlyContinue) +
                       (Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue)
            $urlMatch = [regex]::Match($logText, 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($tunnelProcess.HasExited) { throw ('Tunnel exited. Check ' + $logPath) }
        } until ($urlMatch.Success -or (Get-Date) -gt $deadline)
        if (-not $urlMatch.Success) { throw ('No tunnel URL found. Check ' + $logPath) }
        $publicUrls[$service.Name] = $urlMatch.Value
    }
    $envLines = @(
        'VITE_API_BASE_URL=' + $publicUrls.backend
        'VITE_CAMERA_SERVICE_URL=' + $publicUrls.camera
        'VITE_CAMERA_STREAM_URL=' + $publicUrls.camera + '/stream'
    )
    $envPath = Join-Path $outputDirectory 'frontend.env'
    $envLines | Set-Content -LiteralPath $envPath -Encoding ascii
    Write-Output ($envLines -join [Environment]::NewLine)
    Write-Output ('Saved for Vercel import: ' + $envPath)
    Write-Output ('Stop these tunnels: Stop-Process -Id ' + (($tunnelProcesses | ForEach-Object { $_.Id }) -join ','))
    Write-Output 'Temporary URLs change after restarting tunnels. Configure backend CORS for your Vercel origin before using the site.'
    if (-not $IncludeCamera) { Write-Output 'Camera remains local to the browser device; no camera tunnel was started.' }
} catch {
    foreach ($tunnelProcess in $tunnelProcesses) {
        if (-not $tunnelProcess.HasExited) { Stop-Process -Id $tunnelProcess.Id -ErrorAction SilentlyContinue }
    }
    throw
}
