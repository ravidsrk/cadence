/**
 * Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
 * (and later receive registered routes). Noops when the app is not embedded.
 */

import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  collectRoutePathsFromTree,
  installPreviewHostBridge,
} from "@/lib/preview-host-bridge";

function resolvePreviewBridgePath(rawPath: string): string {
  let savedUser = "ravidsrk";
  try {
    const stored = window.localStorage.getItem("cadence:username")?.trim();
    if (stored) savedUser = stored;
  } catch {
    // ignore
  }
  const year = String(new Date().getFullYear());
  let resolved = rawPath
    .replace(/\/\$username\/?(?=$|\?|#)/g, `/${savedUser}`)
    .replace(/\/\$username\//g, `/${savedUser}/`)
    .replace(/\/:username\/?(?=$|\?|#)/g, `/${savedUser}`)
    .replace(/\/:username\//g, `/${savedUser}/`)
    .replace(/\/\$year\/?(?=$|\?|#)/g, `/${year}`)
    .replace(/\/:year\/?(?=$|\?|#)/g, `/${year}`)
    .replace(/\/\$a\/\$b\/?(?=$|\?|#)/g, "/torvalds/yyx990803");
  if (resolved.length > 1 && resolved.endsWith("/")) {
    resolved = resolved.slice(0, -1);
  }
  return resolved;
}

export function PreviewHostBridge() {
  const router = useRouter();

  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => {
        router.history.push(resolvePreviewBridgePath(path));
      },
      getRoutePaths: () => collectRoutePathsFromTree(router.routeTree),
    });
  }, [router]);

  return null;
}
