// Schema-driven renderer: paints a Profile onto any Surface. The single source of truth
// for both the engine (panel) and Studio (preview).
import { COLORS } from './colors';
import type { Surface } from './surface';
import type { Profile } from './schema';
import { WIDGETS } from './widgets';
import type { RenderEnv } from './bindings';

export function renderProfile(s: Surface, profile: Profile, env: RenderEnv): void {
  s.fillRect(0, 0, profile.width, profile.height, COLORS.bg);
  for (const w of profile.widgets) {
    WIDGETS[w.type]?.(s, w, env);
  }
  if (env.stale || !env.snapshot) s.fillRect(0, 0, profile.width, 6, COLORS.red);
}
