# Repository Guidelines

## Project Structure & Module Organization
This Chrome extension is intentionally flat. `manifest.json` declares the override and permissions, `background.js` redirects new tabs to the custom page, and `newtab.html` wires in `script.js` and `styles.css`. Keep any assets (icons, screenshots) alongside these root files; if you add build outputs, collect them under a new `dist/` directory and ignore them via `.gitignore`.

## Build, Test, and Development Commands
There is no build step—load the folder directly in Chrome. During development use `chrome://extensions` > Developer Mode > Load unpacked and point to the repo root. To ship a package, zip only the runtime files: `zip -r dist/new-tab-ext.zip manifest.json newtab.html script.js styles.css background.js icons/`. After edits, click “Reload” in the extensions page and open a new tab to verify changes.

## Coding Style & Naming Conventions
JavaScript follows modern ES modules with two-space indentation, `const`/`let`, and descriptive camelCase functions (`updateTime`, `displayRecentSites`). Keep DOM ids and class names kebab-case (`shortcut-item`, `searchInput`). Favor concise arrow callbacks unless a named function improves clarity. Comments are currently in Japanese—feel free to add English notes when introducing complex logic, but avoid duplicating commentary. Maintain CSS variables and gradient styling patterns already in `styles.css`.

## Testing Guidelines
Manual validation is expected. After updating code, reload via `chrome://extensions`, then check: time/date updates every second, search bar correctly routes URLs vs. queries, recent sites render without console errors, and background image loads gracefully when offline. Record any new issues in the README if they affect users. If you introduce automation, document the command here and provide sample fixtures under `tests/`.

## Commit & Pull Request Guidelines
Existing history uses short descriptive messages (`first commit`). Use present-tense imperatives (e.g., `add history fallback`) and bundle related changes per commit. For pull requests, include a concise summary, testing notes (e.g., “Reloaded extension locally”), linked issues, and screenshots or GIFs for visual tweaks. Call out permission changes in the description so reviewers can assess their impact.

## Security & Permissions Checks
Only request the permissions you need (`tabs`, `history`). Before adding new APIs, document why they are required and update the README’s “注意事項” section. When pulling remote assets (e.g., background images), ensure fallback logic handles failures and does not block tab creation.
