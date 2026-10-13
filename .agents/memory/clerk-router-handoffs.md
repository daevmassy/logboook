---
name: Clerk router handoffs
description: Correctly route Clerk's absolute URLs through the app's Wouter router.
---

The Clerk/Wouter adapter must distinguish same-origin routes from cross-origin URLs. Send same-origin URLs through Wouter as pathname, search, and hash after stripping the app base path. Use full-page browser navigation for cross-origin URLs.

**Why:** Clerk can request an absolute cross-origin SSO handoff URL; passing it to Wouter's `setLocation` makes `history.pushState` throw a cross-origin error.

**How to apply:** Preserve the origin check in both Clerk router callbacks. Use `location.assign` for external pushes and `location.replace` for external replacements.
