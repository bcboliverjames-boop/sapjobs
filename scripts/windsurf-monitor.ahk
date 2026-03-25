#Requires AutoHotkey v2.0
SetTitleMatchMode 2

windowTitle := "Windsurf"
clickX := 2010
clickY := 1770

hwnd := WinExist("ahk_exe Windsurf.exe")
if !hwnd {
    hwnd := WinExist(windowTitle)
}
if !hwnd {
    ExitApp 2
}

WinActivate hwnd
WinWaitActive hwnd, , 2

try {
    WinSetAlwaysOnTop "On", hwnd
} catch {
}

try {
    WinMaximize hwnd
} catch {
}

Sleep 200

CoordMode "Mouse", "Screen"
if (clickX != 0 || clickY != 0) {
    Click clickX, clickY
    Sleep 100
}

SendText "监控"
Sleep 50
Send "{Enter}"
