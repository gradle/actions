# security-agent template

Security-focused template for Sentinel-style enforcement.

## Contract
- Runs dependency and secret checks.
- Appends findings to replay ledger `errors` when policy fails.
- Emits telemetry for failure points and retry counts.
