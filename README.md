# Okta IP Allowlist Finder

A lightweight static GitHub Pages tool that helps admins identify which Okta IP ranges to allowlist for a tenant.

## What's new in this version

- Adds explicit cell mapping based on known Okta cell-to-JSON-key values.
- Uses local `data/ip_ranges.json` instead of fetching directly from S3 in the browser.
- Stores the S3 `Last-Modified` header in `data/last_modified.txt`.
- Adds unsupported tenant handling for `*.okta.gov` and `*.okta.mil`.

## Known mapping

```text
OK1  -> us_cell_1
OK2  -> us_cell_2
OK3  -> us_cell_3
OK4  -> us_cell_4
OK5  -> us_cell_5
OK6  -> us_cell_6
OK7  -> us_cell_7
OK8  -> apac_cell_1
EU1  -> emea_cell_1
OK9  -> emea_cell_2
OK10 -> us_cell_10
OK11 -> us_cell_11
OK12 -> us_cell_12
OK14 -> us_cell_14
OK16 -> apac_cell_2
OP1  -> preview_cell_1
OP2  -> preview_cell_2
OP3  -> preview_cell_3
```

Source:

https://support.okta.com/help/s/article/list-of-ip-addresses-that-should-be-allowlisted-for-inbound-traffic

https://help.okta.com/en-us/content/topics/security/ip-address-allow-listing.htm

## Download/update the local JSON

PowerShell:

```powershell
./scripts/update-ip-ranges.ps1
```

Manual curl:

```powershell
mkdir data
curl.exe -L "https://s3.amazonaws.com/okta-ip-ranges/ip_ranges.json" -o "data/ip_ranges.json"
curl.exe -Is "https://s3.amazonaws.com/okta-ip-ranges/ip_ranges.json" | Select-String "Last-Modified" | ForEach-Object { $_.ToString().Trim() } | Set-Content "data/last_modified.txt"
```

Bash:

```bash
./scripts/update-ip-ranges.sh
```

## Local test

```powershell
py -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## Disclaimer

This is an independent project and is not affiliated with, endorsed by, or sponsored by Okta.
