@echo off
tasklist /fi "imagename eq mysqld.exe" | findstr /i "mysqld.exe" >nul
if errorlevel 1 (
    start "" /b "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --datadir="C:\ProgramData\MySQL\data" --port=3306
    echo MySQL started.
) else (
    echo MySQL is already running.
)
