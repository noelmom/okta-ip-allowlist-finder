$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "data" | Out-Null

curl.exe -L "https://s3.amazonaws.com/okta-ip-ranges/ip_ranges.json" -o "data/ip_ranges.json"

$lastModified = curl.exe -Is "https://s3.amazonaws.com/okta-ip-ranges/ip_ranges.json" |
  Select-String -Pattern "Last-Modified" |
  ForEach-Object { $_.ToString().Trim() }

$lastModified | Set-Content -Path "data/last_modified.txt" -NoNewline

Write-Host "Updated data/ip_ranges.json"
Write-Host $lastModified
