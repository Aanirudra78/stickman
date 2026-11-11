' Launches start-studio.cmd with a fully hidden window (window style 0).
' The "StickmanStudio" scheduled task fires this every minute; without this
' wrapper Task Scheduler flashes a console window on each run even when the
' script exits instantly because the studio is already listening.
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\sanir\Music\web\stickman render\app"
shell.Run """C:\Users\sanir\Music\web\stickman render\app\studio\start-studio.cmd""", 0, False
