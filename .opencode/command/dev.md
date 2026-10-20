---
description: Start the API and Angular development servers
---

Start the development servers for the whole project.

From the repository root, launch them in a new terminal window so they keep running:

```powershell
Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File', (Join-Path (Get-Location) 'scripts\dev.ps1')
```

Then verify the services are up:

- API: http://localhost:5099
- Web: http://localhost:4200 (proxies `/api` to the API)

If a new window is not possible, run `scripts\dev.ps1` in the background and report the log files under `$env:TEMP\budgetcontroller-dev`.
