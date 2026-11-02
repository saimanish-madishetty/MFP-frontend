# Android step of the "Start: Full stack" task (.vscode/tasks.json).
# Makes sure a device is ready (boots the first emulator if none is connected) while the
# servers start, then waits for the frontend, forwards the backend port and starts live reload.

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$adb = (Get-Command adb -ErrorAction SilentlyContinue).Source
if (-not $adb) { $adb = Join-Path $sdk "platform-tools\adb.exe" }

function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "   ok: $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "   FAILED: $msg" -ForegroundColor Red; exit 1 }
function Get-Devices { & $adb devices | Select-String "\tdevice$" }

# ---------- Device ----------
Step "Android device"
if (Get-Devices) {
  Ok "connected: $((Get-Devices | ForEach-Object { ($_ -split "`t")[0] }) -join ', ')"
} else {
  $emulator = Join-Path $sdk "emulator\emulator.exe"
  if (-not (Test-Path $emulator)) { Fail "no device connected and the emulator is not installed" }
  # An emulator that is already booting shows up as a qemu process; don't start a second one.
  if (Get-Process -Name "qemu-system*" -ErrorAction SilentlyContinue) {
    Write-Host "   an emulator is already starting, waiting for it..."
  } else {
    $avd = & $emulator -list-avds | Where-Object { $_ } | Select-Object -First 1
    if (-not $avd) { Fail "no device connected and no emulator (AVD) exists. Create one in Android Studio." }
    Write-Host "   no device connected, starting emulator $avd..."
    Start-Process $emulator -ArgumentList "-avd", $avd
  }
  & $adb wait-for-device
  $deadline = (Get-Date).AddMinutes(4)
  while ((& $adb shell getprop sys.boot_completed 2>$null) -notmatch "1") {
    if ((Get-Date) -gt $deadline) { Fail "emulator did not finish booting within 4 minutes" }
    Start-Sleep -Seconds 3
  }
  Ok "emulator booted"
}

# ---------- Frontend ----------
Step "Frontend"
& "$PSScriptRoot\wait-port.ps1" -Port 3001 -Name frontend
if (-not $?) { exit 1 }

# ---------- Live reload ----------
# The device is picked from Capacitor's list below, so forward the backend port on every connected
# device; whichever one is picked can then reach the backend at localhost:4001.
Step "Forward backend port 4001 to connected devices"
$serials = Get-Devices | ForEach-Object { ($_ -split "`t")[0] }
$forwarded = 0
foreach ($serial in $serials) {
  & $adb -s $serial reverse tcp:4001 tcp:4001 *> $null
  if ($LASTEXITCODE -eq 0) { Ok $serial; $forwarded++ } else { Write-Host "   skipped: $serial (not reachable)" }
}
if ($forwarded -eq 0) { Fail "could not forward the port to any device" }

Step "Live reload (choose the device below)"
npm run android:live
