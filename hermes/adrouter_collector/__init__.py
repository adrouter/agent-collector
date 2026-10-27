"""AdRouter observer adapter. No tools, transforms, prompts or results are modified."""
from .observer import Observer


def register(ctx):
    # Setup creates a runtime explicitly bound to an enrolled profile. Without it,
    # registration stays inert; no host configuration or credentials are scanned.
    from .runtime import configured_runtime
    runtime = configured_runtime()
    if runtime is None:
        return
    for name in ("post_tool_call", "post_api_request", "api_request_error",
                 "on_session_start", "on_session_end", "on_session_finalize"):
        def callback(_hook=name, **kwargs):
            runtime.observe(_hook, kwargs)
        ctx.register_hook(name, callback)
