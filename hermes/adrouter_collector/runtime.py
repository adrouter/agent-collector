"""Bounded callback handoff; only this background worker touches SQLite/network."""
import hashlib
import importlib.metadata
import json
import os
import queue
import random
import sqlite3
import subprocess
import threading
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from .observer import Observer


def data_directory():
    if os.name == "nt":
        base = Path(os.environ["LOCALAPPDATA"])
    elif __import__("sys").platform == "darwin":
        base = Path.home() / "Library/Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local/share")))
    path = base / "AdRouterCollector" / "hermes"
    resolved = str(path.resolve())
    if any(s.lower() in resolved.lower() for s in ("Mobile Documents", "iCloud", "OneDrive", "/Documents/", "/Desktop/")):
        raise RuntimeError("synced_storage_forbidden")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name == "nt":
        who = subprocess.check_output(["whoami"], text=True).strip()
        subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r", who + ":(OI)(CI)F"], check=True, capture_output=True)
    else:
        path.chmod(0o700)
    return path


class Runtime:
    def __init__(self, settings, scope_supplier):
        self.settings = settings
        self.scope_supplier = scope_supplier
        self.handoff = queue.Queue(maxsize=1000)
        self.observer = Observer(settings["policy"], settings["secret"], settings["scope"], self.enqueue)
        self.latest = None
        self.stopped = False
        self.paused = settings["policy"]["state"] == "paused"
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def enqueue(self, event):
        try:
            self.latest = json.loads(json.dumps(event))
            self.handoff.put_nowait(event)
        except queue.Full:
            self.observer.drop("handoff_full")

    def observe(self, hook, raw):
        try:
            # profile_name is resolved by the host in the current callback scope.
            self.observer.observe(hook, raw, {"scope": self.scope_supplier(), "private": raw.get("incognito")})
        except Exception:
            self.observer.drop("callback_failure")

    def request(self, path, payload=None):
        req = urllib.request.Request(self.settings["api"] + path, data=json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None, headers={"Authorization": "Bearer " + self.settings["credential"], "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.load(response)

    def set_paused(self, paused):
        self.paused = paused
        self.latest = None
        self.observer.policy = {**self.observer.policy, "state": "paused" if paused else "active"}
        if paused:
            while True:
                try:
                    self.handoff.get_nowait()
                except queue.Empty:
                    break

    def run(self):
        conn = None
        try:
            path = data_directory() / (self.settings["installation_id"] + ".sqlite")
            conn = sqlite3.connect(path)
            conn.executescript("PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS pending(id TEXT PRIMARY KEY,captured INTEGER NOT NULL,bytes INTEGER NOT NULL,payload TEXT NOT NULL);")
            if os.name != "nt":
                path.chmod(0o600)
            last_refresh = last_flush = last_heartbeat = retry_at = failures = 0
            while not self.stopped:
                now = time.time()
                try:
                    event = self.handoff.get(timeout=.1)
                    raw = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
                    if not self.paused and len(raw.encode()) <= 16384 and self.observer.policy["state"] == "active":
                        conn.execute("INSERT OR IGNORE INTO pending VALUES(?,?,?,?)", (event["event_id"], int(now*1000), len(raw.encode()), raw))
                    else:
                        self.observer.drop("paused_or_oversized")
                except queue.Empty:
                    pass
                removed = conn.execute("DELETE FROM pending WHERE captured<?", (int((now-7*86400)*1000),)).rowcount
                if removed:
                    self.observer.drops["queue_age"] = self.observer.drops.get("queue_age", 0) + removed
                while conn.execute("SELECT coalesce(sum(bytes),0) FROM pending").fetchone()[0] > 100*1024*1024:
                    conn.execute("DELETE FROM pending WHERE id IN (SELECT id FROM pending ORDER BY captured,id LIMIT 1)")
                    self.observer.drop("queue_capacity")
                if self.paused:
                    conn.execute("DELETE FROM pending")
                conn.commit()
                if now < retry_at:
                    continue
                try:
                    if now-last_refresh >= 60:
                        policy = self.request("/v1/collector/config")
                        if policy["version"] != self.observer.policy["version"] or policy["state"] != "active" or not policy["permissions"]["private_metadata"]:
                            conn.execute("DELETE FROM pending")
                            conn.commit()
                        if self.paused:
                            policy["state"] = "paused"
                        self.observer.policy = policy
                        self.settings["policy"] = policy
                        target = data_directory()/"installation.json"
                        target.write_text(json.dumps(self.settings))
                        if os.name != "nt":
                            target.chmod(0o600)
                        last_refresh = now
                    p = self.observer.policy
                    if self.paused or p["state"] != "active" or not p["permissions"]["private_metadata"] or datetime.fromisoformat(p["lease_expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                        continue
                    count = conn.execute("SELECT count(*) FROM pending").fetchone()[0]
                    if count and (count >= 100 or now-last_flush >= 10):
                        rows = conn.execute("SELECT id,payload FROM pending ORDER BY captured,id LIMIT 100").fetchall()
                        batch, size = [], 14
                        for _, raw in rows:
                            if size+len(raw.encode())+1 > 1048576:
                                break
                            batch.append(json.loads(raw))
                            size += len(raw.encode())+1
                        result = self.request("/v1/events/batch", {"events": batch})
                        ids = {event["event_id"] for event in batch}
                        for receipt in result["receipts"]:
                            if receipt.get("event_id") in ids and (receipt["status"] in ("accepted", "duplicate") or receipt["status"] == "rejected" and not receipt.get("retryable", False)):
                                conn.execute("DELETE FROM pending WHERE id=?", (receipt["event_id"],))
                        conn.commit()
                        last_flush = now
                    if now-last_heartbeat >= 60:
                        self.request("/v1/collector/heartbeat", {"queued": count, "dropped": sum(self.observer.drops.values()), "rejected": 0, "policy_version": p["version"]})
                        last_heartbeat = now
                    failures = 0
                except urllib.error.HTTPError as error:
                    if error.code == 401:
                        self.set_paused(True)
                        self.observer.policy["state"] = "revoked"
                        conn.execute("DELETE FROM pending")
                        conn.commit()
                        (data_directory()/"installation.json").unlink(missing_ok=True)
                    elif error.code in (400, 413):
                        for event in locals().get("batch", []):
                            conn.execute("DELETE FROM pending WHERE id=?", (event["event_id"],))
                        conn.commit()
                        self.observer.drop("permanent_rejection")
                    elif error.code == 403:
                        conn.execute("DELETE FROM pending")
                        conn.commit()
                        last_refresh = 0
                        retry_at = now+5
                    else:
                        failures += 1
                        retry_at = now+min(300, 2**min(failures, 9))*(.75+random.random()*.25)
                except Exception:
                    failures += 1
                    retry_at = now+min(300, 2**min(failures, 9))*(.75+random.random()*.25)
        except Exception:
            self.set_paused(True)
            self.observer.drop("local_storage_failed")
        finally:
            if conn:
                conn.close()


def configured_runtime(ctx):
    try:
        from hermes_cli import __version__
        if __version__ != "0.22.5":
            return None
        settings = json.loads((data_directory()/"installation.json").read_text())
        if settings["framework"] != "hermes" or ctx.profile_name != settings["scope"]:
            return None
        runtime = Runtime(settings, lambda: ctx.profile_name)
        if hasattr(ctx, "on_unload"):
            ctx.on_unload(lambda: setattr(runtime, "stopped", True))
        return runtime
    except Exception:
        return None
