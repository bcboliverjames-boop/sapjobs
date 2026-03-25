param(
  [string]$TaskName = "WindsurfMonitor",
  [string]$AhkScriptPath = "$(Resolve-Path (Join-Path $PSScriptRoot 'windsurf-monitor.ahk'))",
  [string]$AhkExePath = "",
  [string]$StartTime = "08:00",
  [string]$EndTime = "19:00",
  [int]$IntervalMinutes = 10,
  [ValidateSet('LeastPrivilege','HighestAvailable')]
  [string]$RunLevel = 'LeastPrivilege'
)

function Resolve-AhkExePath {
  param([string]$PreferredPath)

  if ($PreferredPath -and (Test-Path -LiteralPath $PreferredPath)) {
    return (Resolve-Path -LiteralPath $PreferredPath).Path
  }

  $cmd = Get-Command -Name "AutoHotkey" -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    return $cmd.Source
  }

  $candidates = @(
    "C:\Program Files\AutoHotkey\AutoHotkey.exe",
    "C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe",
    "C:\Program Files\AutoHotkey\v2\AutoHotkey32.exe",
    "C:\Program Files\AutoHotkey\v1.1.37.02\AutoHotkeyU64.exe",
    "C:\Program Files\AutoHotkey\v1.1.37.02\AutoHotkeyU32.exe",
    "C:\Program Files (x86)\AutoHotkey\AutoHotkey.exe",
    "C:\Program Files (x86)\AutoHotkey\v2\AutoHotkey32.exe"
  )

  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) {
      return (Resolve-Path -LiteralPath $p).Path
    }
  }

  return $null
}

if (-not (Test-Path -LiteralPath $AhkScriptPath)) {
  throw "AHK script not found: $AhkScriptPath"
}

$AhkExePath = Resolve-AhkExePath -PreferredPath $AhkExePath
if (-not $AhkExePath) {
  throw "AutoHotkey executable not found. Install AutoHotkey v2 (recommended) or pass -AhkExePath '<full path to AutoHotkey.exe/AutoHotkey64.exe>'."
}

$today = (Get-Date).ToString('yyyy-MM-dd')
$startBoundary = [datetime]::ParseExact("$today $StartTime", 'yyyy-MM-dd HH:mm', $null)
$endBoundary = [datetime]::ParseExact("$today $EndTime", 'yyyy-MM-dd HH:mm', $null)
$repeatDuration = $endBoundary - $startBoundary
if ($repeatDuration.TotalMinutes -le 0) {
  throw "EndTime must be later than StartTime (same day). StartTime=$StartTime EndTime=$EndTime"
}

$durationMinutes = [int]($endBoundary - $startBoundary).TotalMinutes
if ($durationMinutes -le 0) {
  $durationMinutes = [int]($endBoundary.AddDays(1) - $startBoundary).TotalMinutes
}

$userId = "{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME
$escapedAhkExePath = $AhkExePath.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;').Replace('"','&quot;')
$escapedAhkScriptPath = $AhkScriptPath.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;').Replace('"','&quot;')

$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>$(Get-Date -Format s)</Date>
    <Author>$userId</Author>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>$($startBoundary.ToString('s'))</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
      <Repetition>
        <Interval>PT${IntervalMinutes}M</Interval>
        <Duration>$([System.Xml.XmlConvert]::ToString($repeatDuration))</Duration>
        <StopAtDurationEnd>true</StopAtDurationEnd>
      </Repetition>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$userId</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>$RunLevel</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT5M</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$escapedAhkExePath</Command>
      <Arguments>"$escapedAhkScriptPath"</Arguments>
    </Exec>
  </Actions>
</Task>
"@

$xmlPath = Join-Path $env:TEMP ("{0}.xml" -f $TaskName)
try {
  [System.IO.File]::WriteAllText($xmlPath, $xml, [System.Text.Encoding]::Unicode)
  schtasks /Create /TN $TaskName /XML $xmlPath /F | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "schtasks failed with exit code $LASTEXITCODE"
  }
} finally {
  if (Test-Path -LiteralPath $xmlPath) {
    Remove-Item -LiteralPath $xmlPath -Force
  }
}

Write-Host "Scheduled task '$TaskName' registered."
Write-Host "Runs every $IntervalMinutes minutes from $StartTime to $EndTime (daily)."
Write-Host "AHK: $AhkScriptPath"
Write-Host "AHK EXE: $AhkExePath"
