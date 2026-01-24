# Copilot Instructions for Gesture AutoScroller

## Project Overview
- **Gesture AutoScroller** is a Firefox extension (Android/desktop) for ergonomic, gesture-based scrolling and navigation.
- The project is heavily documented in the `context/` folder. Always consult `context/README.md` and `context/QUICK_REFERENCE.md` for navigation and up-to-date conventions.

## Architecture & Key Files
- **Extension Source:** All code is in `src/`.
  - `manifest.json`: Minimal permissions (`storage`, `activeTab`), Manifest V2 for Firefox Android compatibility.
  - `content.js`: Handles gesture/tap detection, autoscroll logic, and toast notifications.
  - `background.js`: (planned) Settings and host whitelist management.
  - `options.html`/`options.js`: (planned) Configuration UI and logic.
  - `icons/`: Extension icons.
- **Documentation:**
  - `context/INTENTION.md`: Project vision, goals, and scope constraints.
  - `context/FEATURES.md`: Detailed feature specs and implementation notes.
  - `context/research/RESEARCH.md`: Reference project analysis and integration architecture.
  - `context/research/PERMISSIONS.md`: Permission model and manifest structure.
  - `context/research/CODE_EXTRACTION.md`: Production-ready code snippets for reuse.
  - `context/QUICK_REFERENCE.md`: Pro tips, roadmap, and file guide.

## Developer Workflow
- **Build & Run:**
  - Use `./run-firefox.sh` to auto-load the extension in Firefox with hot reload (requires `web-ext`).
  - Manual load: Use `about:debugging#/runtime/this-firefox` in Firefox, load from `src/`.
- **Testing:**
  - Use `test-extension.sh` to validate extension structure.
  - For Android, see `ANDROID_TESTING_GUIDE.md` and use `test-page.html` as a local test site.
- **Debugging:**
  - Use Firefox's Browser Console and Web Console for logs.
  - Inspect extension via `about:debugging` > "Inspect".

## Project-Specific Conventions
- **Always consult `context/FEATURES.md` before implementing features.**
- **Copy, don't type:** Use code from `CODE_EXTRACTION.md` for base logic.
- **Per-site activation:** Host whitelist is critical for UX; see feature specs.
- **Minimal permissions:** Only request what's justified in `PERMISSIONS.md`.
- **Incremental testing:** Test each feature as you build; use provided scripts.
- **Document changes:** Update `context/` docs when making major changes.

## Integration & Patterns
- **Gesture/tap detection** is modeled after `firefox-simple_gesture` (see research docs).
- **Autoscroll logic** is adapted from `AutoScrolling` (see research docs).
- **Settings and whitelist** are managed via background script and options page (planned).
- **No volume key support:** See `VOLUME_KEYS_RESEARCH.md` for rationale.

## Examples
- To add a new gesture, follow the detection pattern in `content.js` and reference `FEATURES.md`.
- To update permissions, edit `manifest.json` and justify in `PERMISSIONS.md`.
- For new features, update `FEATURES.md` and `QUICK_REFERENCE.md`.

## Quick Links
- [context/README.md](../context/README.md)
- [context/FEATURES.md](../context/FEATURES.md)
- [context/QUICK_REFERENCE.md](../context/QUICK_REFERENCE.md)
- [src/content.js](../src/content.js)
- [run-firefox.sh](../run-firefox.sh)

---

**For any ambiguity, consult the documentation in `context/` first.**
