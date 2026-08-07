# Contributing to Spartan Gaming

Thanks for contributing. The project is currently establishing its architecture and cross-platform build foundation.

## Before opening an issue

- Search existing issues and discussions.
- Include the OS, device, GPU, browser build, provider or game, and reproduction steps.
- For streaming issues, include resolution, framerate, codec, network type, latency, jitter, and packet loss when available.
- Do not include credentials, private stream URLs, or personal data.

## Before opening a pull request

- Keep changes focused and explain the user impact.
- Add or update tests where practical.
- Document platform-specific behavior.
- Preserve Chromium and third-party license notices.
- Do not add telemetry, privileged permissions, or remote-input behavior without an architecture and security review.

## Development

The supported Chromium checkout, toolchain, build targets, formatting, and test commands will be documented as the browser implementation lands. Until then, use the repository's Markdown and YAML checks and keep changes portable across Windows, macOS, and Linux.

## Commit guidance

Use concise imperative subjects, for example:

```text
Add stream session architecture notes
```

