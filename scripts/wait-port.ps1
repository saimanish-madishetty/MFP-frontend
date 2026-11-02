# Waits until something is listening on localhost:<Port>, so a task can start only after the
# server it depends on is up. Used by the "Start: Full stack" task (.vscode/tasks.json).
#   wait-port.ps1 -Port 4001 -Name backend [-TimeoutMinutes 5]

param(
  [Parameter(Mandatory)] [int]$Port,
  [string]$Name = "server",
  [int]$TimeoutMinutes = 5
)

function Test-Port {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.ConnectAsync("127.0.0.1", $Port).Wait(500) -and $client.Connected
  } catch {
    $false
  } finally {
    $client.Dispose()
  }
}

Write-Host "Waiting for the $Name on port $Port..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
while (-not (Test-Port)) {
  if ((Get-Date) -gt $deadline) {
    Write-Host "The $Name did not start on port $Port within $TimeoutMinutes minutes. Check its terminal." -ForegroundColor Red
    exit 1
  }
  Start-Sleep -Seconds 1
}
Write-Host "The $Name is up on port $Port." -ForegroundColor Green
