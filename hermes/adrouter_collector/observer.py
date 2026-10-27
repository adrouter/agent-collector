import hashlib
import hmac
import re
import uuid
from datetime import datetime, timezone

SECRET = re.compile(r"bearer\s+\S+|(?:api[_ -]?key|password|secret|token)\s*[:=]\s*\S+|-----BEGIN[\s\S]*PRIVATE KEY|(?:sk|ghp|gho|xoxb)-[a-zA-Z0-9_-]{10,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.", re.I)
PUBLIC_TOOLS = {"web_search", "web_fetch", "terminal", "read_file", "write_file", "browser"}
MAPPINGS = {"post_tool_call": "tool.completed", "post_api_request": "model.completed", "api_request_error": "model.failed", "on_session_start": "session.started", "on_session_end": "run.ended", "on_session_finalize": "session.ended"}


def filter_content(raw):
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > 65536 or SECRET.search(raw) or re.search(r"[\x00-\x08\x0e-\x1f]", raw):
        return None
    raw = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[EMAIL]", raw, flags=re.I)
    raw = re.sub(r"https?://[^\s]+", "[URL]", raw, flags=re.I)
    raw = re.sub(r"(?:\+?\d[\d ().-]{7,}\d)", "[PHONE]", raw)
    raw = re.sub(r"(?:[A-Za-z]:\\|/(?:Users|home|private|etc)/)[^\s]+", "[PATH]", raw)
    return raw[:2000] or None


class Observer:
    def __init__(self, policy, secret, scope, emit):
        self.policy, self.secret, self.scope, self.emit = policy, secret, scope, emit
        self.process, self.sequence, self.drops = str(uuid.uuid4()), 0, {}

    def ref(self, kind, value):
        if isinstance(value, str) and 0 < len(value) <= 4096:
            return hmac.new(self.secret.encode(), (kind + "\0" + value).encode(), hashlib.sha256).hexdigest()

    def drop(self, reason):
        self.drops[reason] = self.drops.get(reason, 0) + 1

    def observe(self, hook, raw, context=None):
        try:
            p = self.policy
            if p["state"] != "active" or not p["permissions"]["private_metadata"] or datetime.fromisoformat(p["lease_expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                return
            context = context or {}
            if context.get("scope") != self.scope or context.get("private") is True:
                self.drop("unattributed_or_private")
                return
            if hook not in MAPPINGS:
                return
            event = dict(schema_version=1, event_id=str(uuid.uuid4()), event_type=MAPPINGS[hook], occurred_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), framework="hermes", framework_version="0.22.5", collector_version="0.1.0", capability_version="hermes-v1", source_hook=hook, installation_id=p["installation_id"], process_ref=self.process, sequence=self.sequence, consent_version=p["version"], grant_epochs=p["grant_epochs"].copy(), synthetic=False, observation={"status": "unknown"})
            self.sequence += 1
            for key, value in dict(session_ref=raw.get("session_id"), run_ref=raw.get("turn_id"), call_ref=raw.get("tool_call_id") if hook == "post_tool_call" else raw.get("api_request_id")).items():
                ref = self.ref(key, value)
                if ref:
                    event[key] = ref
            obs = event["observation"]
            if hook == "post_tool_call":
                name = raw.get("tool_name")
                obs["tool_key"] = name if isinstance(name, str) and name in PUBLIC_TOOLS else "local:" + (self.ref("tool", name) or "unknown")
            if raw.get("status") in ("success", "error", "blocked", "interrupted", "unknown"):
                obs["status"] = raw["status"]
            if hook == "api_request_error":
                obs["status"] = "error"
            if hook == "post_api_request":
                obs["status"] = "success"
            if hook == "on_session_end":
                obs["status"] = "interrupted" if raw.get("interrupted") is True else "error" if raw.get("failed") is True else "success" if raw.get("completed") is True else "unknown"
            duration = raw.get("duration_ms")
            if isinstance(duration, (int, float)) and not isinstance(duration, bool) and 0 <= duration <= 604800000:
                obs["duration_ms"] = duration
            retry = raw.get("retry_count")
            if hook in ("post_tool_call", "post_api_request", "api_request_error") and isinstance(retry, int) and not isinstance(retry, bool) and 0 <= retry < 1000:
                obs.update(attempt=retry+1, retry=retry > 0)
            if context.get("private") is False and p["permissions"]["private_content"] and obs.get("tool_key") == "web_search" and "web_search" in p["selected_tools"] and "tool_excerpt" in p["content_fields"]:
                excerpt = filter_content(raw.get("result"))
                if excerpt:
                    event["content"] = {"tool_excerpt": excerpt}
                else:
                    self.drop("content_filtered")
            self.emit(event)
        except Exception:
            self.drop("callback_failure")
