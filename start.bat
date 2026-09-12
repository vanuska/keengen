@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PY="
py -3 -c "import sys" >nul 2>&1 && set "PY=py -3"
if not defined PY python -c "import sys" >nul 2>&1 && set "PY=python"
if not defined PY (
  echo Need Python 3: https://www.python.org/downloads/
  echo Check "Add python.exe to PATH" during setup.
  pause
  exit /b 1
)

%PY% start.py %*
if errorlevel 1 pause
