"""Explicit setup and content-free status. Never print enrollment proofs or credentials."""
import json
import secrets
import sys
import time
import urllib.request
from urllib.parse import urlparse
from .runtime import data_directory


def setup(args):
    if not args:
        raise RuntimeError("Use setup <owned-profile> [https-api-origin]")
    scope, api = args[0], args[1] if len(args)>1 else "https://slarp-api.adrouter.co"
    parsed = urlparse(api)
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")):
        raise RuntimeError("HTTPS API required")
    target = data_directory()/"installation.json"
    if target.exists():
        raise RuntimeError("Revoke and uninstall the existing installation before pairing a new one")

    def post(path, payload):
        req = urllib.request.Request(api+path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.load(response)

    pairing = post("/v1/collector/pairings", {"framework": "hermes", "framework_version": "0.22.5", "label": "Hermes collector"})
    print("Open https://slarp.adrouter.co and review pairing code " + pairing["code"] + ". Confirm only a workload you own.")
    for _ in range(120):
        time.sleep(5)
        result = post("/v1/collector/pairings/"+pairing["id"]+"/exchange", {"proof": pairing["proof"]})
        if result["state"] != "paired":
            continue
        req = urllib.request.Request(api+"/v1/collector/config", headers={"Authorization": "Bearer "+result["credential"]})
        with urllib.request.urlopen(req, timeout=10) as response:
            policy = json.load(response)
        settings = dict(api=api, credential=result["credential"], installation_id=result["installation_id"], secret=secrets.token_hex(32), scope=scope, framework="hermes", framework_version="0.22.5", policy=policy)
        # Exclusive creation prevents concurrent setup from replacing credentials.
        with target.open("x", encoding="utf-8") as output:
            json.dump(settings, output)
        if __import__("os").name != "nt":
            target.chmod(0o600)
        print("Paired. Enable the plugin only for the selected Hermes profile.")
        return
    raise RuntimeError("Pairing expired")


def main():
    try:
        args = sys.argv[1:]
        if args and args[0] == "setup":
            setup(args[1:])
        elif args and args[0] == "status":
            settings = json.loads((data_directory()/"installation.json").read_text())
            print(json.dumps({"installation_id": settings["installation_id"], "framework": "hermes", "scope": settings["scope"], "state": settings["policy"]["state"], "policy_version": settings["policy"]["version"]}))
        else:
            print("Commands: setup, status. Pause/resume in Hermes with /adrouter-pause and /adrouter-resume. Revoke in the WebUI.")
    except Exception:
        # urllib exceptions can contain request destinations. Diagnostic output
        # deliberately contains neither request objects nor response bodies.
        print("Collector setup/status failed. Check service availability, pairing expiry and the local storage path.", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
