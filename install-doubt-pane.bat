@echo off
echo Installing the packages the doubt pane needs...
call npm install @google/genai@^2.10.0 @wllama/wllama@^3.5.1 chart.js@^4.5.1
echo.
echo Done. Restart the dev server (npm run dev).
pause
