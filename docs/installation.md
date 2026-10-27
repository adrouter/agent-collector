# Candidate installation and controls

These steps are for controlled synthetic acceptance after the API and invitation flow are ready. They do not establish supported platform status. Check archive checksums first. Use only the native host versions in `contracts/capabilities.json`.

## OpenClaw

Install Node 24.22.1, then install the candidate `.tgz` with `npm install --global /absolute/local/path/adrouter-agent-collector-0.1.0.tgz`. No npm registry publication is needed. Run `adrouter-collector setup openclaw 2026.10.7 <owned-agent-id>` and approve the displayed short code in the application. Never copy a browser access token to the collector.

Install the same archive using the host's `openclaw plugins install` command and explicitly enable `adrouter-collector`. Do not grant conversation access: this candidate uses metadata hooks. Confirm the plugin host version is 2026.10.7 and that the selected agent ID is supplied by its observation paths. Missing identity drops events.

Commands: `adrouter-collector status`, `adrouter-collector preview`, `adrouter-collector pause`, `adrouter-collector resume`. Preview displays only the most recent sanitized envelope and drop reasons; do not include it in diagnostic receipts. Pause acknowledgment follows capture disable and pending queue purge. Restart must preserve pause.

## Hermes

Install native Hermes 0.22.5 using its official installer. Python 3.12.2 is the development target. Extract the `.zip` and place the `adrouter-collector` directory in the selected profile's plugin directory. Use the host's documented plugin enable command. Do not enroll other profiles.

For explicit setup, use that profile's Python environment with `PYTHONPATH` pointing to the parent containing the package (rename the extracted import directory to `adrouter_collector` for standalone Python commands), then `python -m adrouter_collector setup <owned-profile-name>`. Pair in the normal browser. Runtime version verification uses the host's installed version stamp, not its distribution metadata placeholder.

Local host commands: `/adrouter-pause`, `/adrouter-resume`, `/adrouter-preview`. `python -m adrouter_collector status` displays content-free status. Inspect permissions and state in the application as well. Restart recovery and immediate pause need installed-host qualification before release.

## Storage and removal

OpenClaw uses the local application-data directory under `AdRouterCollector/openclaw`; Hermes uses `AdRouterCollector/hermes`. Linux uses XDG local data, macOS uses `~/Library/Application Support`, and Windows uses `%LOCALAPPDATA%`. The collectors reject known synced paths and apply user-only directory permissions/Windows ACLs. Never place these directories in iCloud, Documents, Desktop or OneDrive.

To uninstall: pause in the running host, permanently revoke the installation in the application, disable/uninstall the host plugin, stop its background worker, then remove only that framework's AdRouterCollector directory and the candidate package. Hosted history is retained until expiry or an explicit deletion request. Deletion and revocation are distinct actions.

## Disclosure

Metadata lasts 90 days; optional content lasts 30 days. Local pending records last at most seven days/100 MB. Callback overload can lose observations before durable enqueueing; it must never stop the agent. Private metadata is not research consent. Content is off by default, and this candidate does not yet implement the complete optional-content workflow. Do not collect real participant activity for release qualification.
