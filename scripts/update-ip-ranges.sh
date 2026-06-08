#!/usr/bin/env bash
set -euo pipefail

mkdir -p data

curl -L "https://s3.amazonaws.com/okta-ip-ranges/ip_ranges.json" -o "data/ip_ranges.json"
curl -Is "https://s3.amazonaws.com/okta-ip-ranges/ip_ranges.json" | grep -i "Last-Modified" | tr -d '\r' > "data/last_modified.txt"

echo "Updated data/ip_ranges.json"
cat data/last_modified.txt
