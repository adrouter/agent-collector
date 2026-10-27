"""AdRouter observer adapter. No tools, transforms, prompts or results are modified."""
from .observer import Observer


def register(ctx):
    # Setup creates a runtime explicitly bound to an enrolled profile. Without it,
    # registration stays inert; no host configuration or credentials are scanned.
    from .runtime import configured_runtime
    runtime = configured_runtime(ctx)
    if runtime is None:
        return
    for name in ("post_tool_call", "post_api_request", "api_request_error",
                 "on_session_start", "on_session_end", "on_session_finalize"):
        def callback(_hook=name, **kwargs):
            runtime.observe(_hook, kwargs)
        ctx.register_hook(name, callback)
    def pause_command(*_args, **_kwargs):
        runtime.set_paused(True)
        return "AdRouter capture and upload paused. Pending events are discarded."
    def resume_command(*_args, **_kwargs):
        runtime.set_paused(False)
        return "AdRouter resumed for future events, subject to current server permission."
    ctx.register_command("adrouter-pause", pause_command, "Pause AdRouter collection")
    ctx.register_command("adrouter-resume", resume_command, "Resume AdRouter collection")

    def preview_command(*_args, **_kwargs):
        import json
        return json.dumps({"event": runtime.latest, "dropped": runtime.observer.drops}, ensure_ascii=False)
    ctx.register_command("adrouter-preview", preview_command, "Show the latest sanitized local payload")
