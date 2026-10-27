# Native acceptance procedure

Status: not run for any installed framework/OS combination. Source fixtures and cross-language tests are separate evidence.

## Package preparation

Build from a clean reviewed commit using Node 24.22.1 and Python 3.12.2. Run `npm ci`, `npm run check`, Python fixture tests, then `npm run package`. Retain the `.tgz`, `.zip`, `SHA256SUMS` and `contracts/capabilities.json` together. Rebuild in a fresh clean checkout and compare both archive SHA-256 hashes before calling the artifacts reproducible.

## Windows 11 operator run

Use the operator's existing native Windows 11 x64 PC or VM. WSL is insufficient. Copy the candidate archives, checksums and this procedure into a local non-synced folder, such as `C:\AdRouterV4Acceptance`. Never use OneDrive, Documents or Desktop.

In PowerShell, run `Get-FileHash .\adrouter-agent-collector-0.1.0.tgz -Algorithm SHA256` and `Get-FileHash .\adrouter-hermes-0.1.0.zip -Algorithm SHA256`. Compare exactly to SHA256SUMS. Record the Windows build, Node/Python versions and actual native host versions, without credentials or telemetry.

For each framework separately:

1. Follow installation.md against the designated isolated acceptance service and a designated synthetic account. Confirm private metadata only, research off and content off.
2. Generate a controlled synthetic tool completion in the actual host. Confirm the sanitized preview has no original arguments/results, errors, routing keys, private names or URLs. Inspect the corresponding private analytics through the designated account.
3. Check that an unowned profile and explicitly private activity are excluded where the host supplies privacy state. Unknown correlation remains unattributed.
4. Disconnect the network, generate synthetic activity, restart the host and reconnect. Confirm durable recovery, stable IDs, duplicate delivery without count inflation, and visible queue/drop counters.
5. Pause locally, confirm capture and upload stop, pending data is purged and restart stays paused. Resume and verify future events only.
6. Pause remotely while offline. Confirm the UI states that device synchronization is pending, server uploads are rejected immediately, and online policy refresh takes no more than 60 seconds.
7. Revoke permanently. Confirm old credentials fail, local pending data/credential is removed, and hosted private history follows retention until explicit deletion.
8. Uninstall and confirm no collector worker continues. Check local ACLs with `icacls` on the framework's storage directory before removal. Do not copy file contents into evidence.
9. Exercise slow/unavailable backend, callback exception, full handoff, bounded SQLite capacity and an isolated exhausted-disk test. Verify unchanged native tool results, host continuation and content-free loss counters.

Linux Ubuntu 24.04 x64 and Apple Silicon macOS must run the same installed-artifact procedure in their native environments. Record pass/fail per scenario; never mark a platform supported based only on another OS or source CI.

Receipts contain source/package hashes, versions, scenario IDs and status only. No payload previews, real user data, browser sessions or credentials.
