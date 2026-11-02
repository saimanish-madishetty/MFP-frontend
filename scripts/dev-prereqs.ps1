# Prepares the machine for the "Start: Full stack" task (MFP.code-workspace).
# Each check only acts when something is missing, so it is safe to run every time.
#   -Root   folder that holds MFP-frontend and MFP-backend (default: two levels up from this script)

param(
  [string]$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
)

$frontend = Join-Path $Root "MFP-frontend"
$backend = Join-Path $Root "MFP-backend"
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }

function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "   ok: $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "   FAILED: $msg" -ForegroundColor Red; exit 1 }

function Test-Docker {
  docker info *> $null
  return $LASTEXITCODE -eq 0
}

# ---------- Docker Desktop ----------
Step "Docker Desktop"
if (Test-Docker) {
  Ok "already running"
} else {
  $dockerExe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path $dockerExe)) { Fail "Docker Desktop not found at $dockerExe" }
  Write-Host "   starting Docker Desktop..."
  Start-Process $dockerExe
  $deadline = (Get-Date).AddMinutes(3)
  while (-not (Test-Docker)) {
    if ((Get-Date) -gt $deadline) { Fail "Docker engine did not become ready within 3 minutes" }
    Start-Sleep -Seconds 3
  }
  Ok "started"
}

# ---------- Ports 3001 (frontend) and 4001 (backend) ----------
Step "Ports 3001 and 4001"
foreach ($port in 3001, 4001) {
  $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  if (-not $owners) { Ok "$port is free"; continue }
  foreach ($procId in $owners) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
    if (-not $proc) { continue }
    # Only stop leftover MFP dev servers; anything else (e.g. another project's service) is left alone.
    if ($proc.CommandLine -notlike "*$Root*") {
      Fail ("port $port is used by another program, not MFP: $($proc.Name) (PID $procId)`n" +
        "   $($proc.CommandLine)`n   Stop it (Stop-Process -Id $procId) and run the task again.")
    }
    Stop-Process -Id $procId -Force -Confirm:$false
    Ok "stopped old MFP server on $port (PID $procId)"
  }
}

# ---------- Dependencies ----------
Step "npm dependencies"
foreach ($dir in $frontend, $backend) {
  if (Test-Path (Join-Path $dir "node_modules")) {
    Ok "$(Split-Path $dir -Leaf) already installed"
  } else {
    Write-Host "   npm install in $(Split-Path $dir -Leaf)..."
    Push-Location $dir
    npm install
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { Fail "npm install failed in $dir" }
    Ok "$(Split-Path $dir -Leaf) installed"
  }
}

# ---------- Backend .env ----------
Step "Backend .env"
$envFile = Join-Path $backend ".env"
if (Test-Path $envFile) {
  Ok "present"
} else {
  Copy-Item (Join-Path $backend ".env.example") $envFile
  Ok "created from .env.example"
}

# ---------- Android tooling ----------
Step "Java (JDK 21 for Capacitor 8 / Gradle)"
if (-not (Get-Command java -ErrorAction SilentlyContinue) -and -not $env:JAVA_HOME) {
  Fail "no JDK found. Install JDK 21 or set JAVA_HOME (Android Studio's jbr folder works)."
}
Ok "found"

Step "adb"
$adb = (Get-Command adb -ErrorAction SilentlyContinue).Source
if (-not $adb) { $adb = Join-Path $sdk "platform-tools\adb.exe" }
if (-not (Test-Path $adb)) { Fail "adb not found. Install Android SDK platform-tools." }
Ok $adb
# The device/emulator is handled by the Android terminal (dev-android.ps1), so booting it
# doesn't hold up the database and servers.

Write-Host "`nAll prerequisites ready." -ForegroundColor Green
