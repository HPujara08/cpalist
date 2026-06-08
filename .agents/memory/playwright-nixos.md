---
name: Playwright on NixOS (Replit)
description: How to run Playwright headless Chromium on Replit's NixOS environment
---

Playwright downloads its own pre-compiled Chromium binary which dynamically links against standard glibc paths (`/usr/lib`, etc.). These paths don't exist on NixOS — all libraries are in `/nix/store/` with hashed paths.

**Symptom:** `browserType.launch` fails with `error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file`.

**Fix:** Install `chromium` as a system dependency and point Playwright to it:

```typescript
import { execSync } from "node:child_process";
function findChromiumExecutable(): string | undefined {
  try {
    return execSync("which chromium 2>/dev/null", { encoding: "utf-8" }).trim() || undefined;
  } catch { return undefined; }
}
const CHROMIUM_EXECUTABLE = findChromiumExecutable();

// Then in launch:
chromium.launch({ headless: true, args: PLAYWRIGHT_ARGS, executablePath: CHROMIUM_EXECUTABLE })
```

**Install the system dep:**
```javascript
await installSystemDependencies({ packages: ["chromium"] });
```

**Why:** The nix-built Chromium is compiled and linked against Nix store paths, so it resolves its own libraries correctly. Playwright's binary is compiled for standard glibc systems.

**How to apply:** Any time Playwright is used in this project, this pattern is required. Do NOT try to fix by installing individual libraries (glib, nss, mesa, etc.) and setting LD_LIBRARY_PATH — it's a whack-a-mole game.
