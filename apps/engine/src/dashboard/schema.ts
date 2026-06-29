// Profile schema (v1). Portable JSON, validated, with a migration entry point so future
// versions can upgrade old files. Widgets carry a generic props bag so the editor can edit
// any field uniformly; each widget type interprets its own props (see widgets.ts).
export const SCHEMA_VERSION = 1;

export const WIDGET_TYPES = ['backdrop', 'label', 'clock', 'arcGauge', 'statCard', 'progressBar', 'aiUsage', 'statusDot'] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, unknown>;
}

export interface Profile {
  schemaVersion: number;
  name: string;
  deviceProfileId: string; // must match the panel; a profile for the wrong size fails loudly
  width: number;
  height: number;
  widgets: Widget[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isWidget(o: unknown): o is Widget {
  if (!o || typeof o !== 'object') return false;
  const w = o as Record<string, unknown>;
  return (
    typeof w.id === 'string' &&
    typeof w.type === 'string' &&
    (WIDGET_TYPES as readonly string[]).includes(w.type) &&
    isNum(w.x) && isNum(w.y) && isNum(w.w) && isNum(w.h) &&
    !!w.props && typeof w.props === 'object'
  );
}

// Upgrade older profiles. v1 is the baseline; add cases as the schema evolves.
export function migrate(o: Record<string, unknown>): Record<string, unknown> {
  // (no migrations yet) — future: if (o.schemaVersion === 0) { ...; o.schemaVersion = 1; }
  return o;
}

export function validateProfile(input: unknown): { ok: true; profile: Profile } | { ok: false; error: string } {
  let o: unknown = input;
  if (typeof input === 'string') {
    try {
      o = JSON.parse(input);
    } catch {
      return { ok: false, error: 'invalid JSON' };
    }
  }
  if (!o || typeof o !== 'object') return { ok: false, error: 'profile must be an object' };
  const m = migrate(o as Record<string, unknown>);
  if (!isNum(m.width) || !isNum(m.height)) return { ok: false, error: 'width/height required' };
  if (!Array.isArray(m.widgets)) return { ok: false, error: 'widgets[] required' };
  for (const w of m.widgets) {
    if (!isWidget(w)) return { ok: false, error: `invalid widget: ${JSON.stringify(w).slice(0, 80)}` };
  }
  return {
    ok: true,
    profile: {
      schemaVersion: isNum(m.schemaVersion) ? m.schemaVersion : SCHEMA_VERSION,
      name: typeof m.name === 'string' ? m.name : 'Untitled',
      deviceProfileId: typeof m.deviceProfileId === 'string' ? m.deviceProfileId : 'ax206-usbdisplay',
      width: m.width,
      height: m.height,
      widgets: m.widgets as Widget[],
    },
  };
}
