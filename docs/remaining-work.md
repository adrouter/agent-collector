# Unresolved release gates

This candidate is incomplete and must not open pilot admission.

- Installed-host qualification for both adapters on Linux, Apple Silicon macOS and native Windows 11.
- Complete explicit local optional-field selection and task-description capture; the current backend configuration keeps optional collector content disabled. Do not claim the optional-content journey works.
- Qualify usage/cost fields and units against actual pinned host callbacks; unavailable fields stay unknown.
- Qualify Windows local-control pipe security, disk-full behavior, immediate pause/restart behavior and concurrent host loading.
- End-to-end policy, partial acknowledgment, Retry-After, queue pressure and network-fault evidence for both packaged adapters. Hermes pause/restart persistence still requires implementation and qualification.
- Improve standalone Hermes installation so package naming and profile discovery require no manual directory rename.
- Reproducible clean-checkout archive comparison, complete six-combination evidence and reviewed GitHub Release publication.

The capability manifest intentionally lists unsupported/unknown paths. Source tests do not close these gates.
