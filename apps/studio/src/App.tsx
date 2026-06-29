import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  renderProfile,
  validateProfile,
  ORBIT_DEFAULT,
  WIDGET_TYPES,
  type Profile,
  type Widget,
  type WidgetType,
} from '@dash';
import { CanvasSurface } from './CanvasSurface';
import { simSnapshot } from './sim';

const SCALE = 2;
const STORAGE_KEY = 'orbitpanel.profile';

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

function loadInitial(): Profile {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const r = validateProfile(raw);
    if (r.ok) return r.profile;
  }
  return clone(ORBIT_DEFAULT);
}

function newWidget(type: WidgetType): Widget {
  const id = (crypto.randomUUID?.() ?? `w${Date.now()}`).slice(0, 8);
  const base = { id, type, x: 24, y: 24, w: 120, h: 40 };
  switch (type) {
    case 'label':
      return { ...base, w: 140, h: 16, props: { text: 'LABEL', scale: 2, color: 't1' } };
    case 'clock':
      return { ...base, w: 120, h: 16, props: { source: 'time', scale: 2, color: 't1' } };
    case 'statusDot':
      return { ...base, w: 8, h: 8, props: {} };
    case 'arcGauge':
      return { ...base, w: 160, h: 160, props: { binding: 'cpu.loadPercent', label: 'CPU', tempBinding: 'cpu.tempC' } };
    case 'statCard':
      return { ...base, w: 200, h: 64, props: { label: 'CARD', mainBinding: 'cpu.loadPercent', mainFmt: 'pct', rightBinding: 'cpu.loadPercent', rightFmt: 'pct', barBinding: 'cpu.loadPercent', barMax: 100, barColor: 'cyan' } };
    case 'progressBar':
      return { ...base, w: 160, h: 10, props: { binding: 'memory.loadPercent', max: 100, color: 'cyan' } };
    case 'aiUsage':
      return { ...base, x: 12, y: 262, w: 456, h: 46, props: {} };
  }
}

export default function App(): JSX.Element {
  const [profile, setProfile] = useState<Profile>(loadInitial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sim, setSim] = useState(true);
  const [claudeLimit, setClaudeLimit] = useState(88_000_000);
  const [propsText, setPropsText] = useState('{}');
  const [propsErr, setPropsErr] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const past = useRef<Profile[]>([]);
  const future = useRef<Profile[]>([]);
  const drag = useRef<{ id: string; offx: number; offy: number; start: Profile; pushed: boolean } | null>(null);
  const mounted = useRef(Date.now());

  const selected = useMemo(() => profile.widgets.find((w) => w.id === selectedId) ?? null, [profile, selectedId]);

  useEffect(() => {
    setPropsText(JSON.stringify(selected?.props ?? {}, null, 2));
    setPropsErr(null);
  }, [selectedId, selected]);

  const commit = useCallback(
    (next: Profile) => {
      past.current.push(profile);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      setProfile(next);
    },
    [profile],
  );

  const patchWidget = useCallback(
    (id: string, patch: Partial<Widget>) => {
      commit({ ...profile, widgets: profile.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
    },
    [commit, profile],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(profile);
    setProfile(prev);
  }, [profile]);

  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!nxt) return;
    past.current.push(profile);
    setProfile(nxt);
  }, [profile]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit({ ...profile, widgets: profile.widgets.filter((w) => w.id !== selectedId) });
    setSelectedId(null);
  }, [commit, profile, selectedId]);

  // Keyboard: undo/redo/delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, deleteSelected]);

  // Render loop (2 fps like the panel) + selection overlay
  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      const surface = new CanvasSurface(ctx, profile.width, profile.height, SCALE);
      renderProfile(surface, profile, {
        snapshot: sim ? simSnapshot(Date.now() / 1000) : null,
        stale: !sim,
        ctx: {
          timeStr: new Date().toTimeString().slice(0, 8),
          uptimeStr: new Date(Date.now() - mounted.current).toISOString().slice(11, 19),
          panelState: 'Ready',
          ai: { claudeUsed: 1_240_000, claudeLimit: claudeLimit || null, codexState: '--' },
        },
      });
      if (selected) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.strokeRect(selected.x * SCALE, selected.y * SCALE, selected.w * SCALE, selected.h * SCALE);
      }
    };
    draw();
    const id = window.setInterval(draw, 250);
    return () => window.clearInterval(id);
  }, [profile, selected, sim, claudeLimit]);

  const hitTest = (px: number, py: number): Widget | null => {
    for (let i = profile.widgets.length - 1; i >= 0; i--) {
      const w = profile.widgets[i];
      if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) return w;
    }
    return null;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / SCALE;
    const py = (e.clientY - rect.top) / SCALE;
    const hit = hitTest(px, py);
    setSelectedId(hit?.id ?? null);
    if (hit) drag.current = { id: hit.id, offx: px - hit.x, offy: py - hit.y, start: clone(profile), pushed: false };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / SCALE;
    const py = (e.clientY - rect.top) / SCALE;
    if (!d.pushed) {
      past.current.push(d.start);
      future.current = [];
      d.pushed = true;
    }
    const nx = Math.max(0, Math.round(px - d.offx));
    const ny = Math.max(0, Math.round(py - d.offy));
    setProfile((p) => ({ ...p, widgets: p.widgets.map((w) => (w.id === d.id ? { ...w, x: nx, y: ny } : w)) }));
  };

  const endDrag = () => {
    drag.current = null;
  };

  const applyProps = () => {
    if (!selected) return;
    try {
      const parsed = JSON.parse(propsText) as Record<string, unknown>;
      patchWidget(selected.id, { props: parsed });
      setPropsErr(null);
    } catch (err) {
      setPropsErr(err instanceof Error ? err.message : 'invalid JSON');
    }
  };

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${profile.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      const r = validateProfile(t);
      if (r.ok) {
        commit(r.profile);
        setSelectedId(null);
      } else alert(`Invalid profile: ${r.error}`);
    });
    e.target.value = '';
  };

  return (
    <div className="app">
      <header className="toolbar">
        <strong>OrbitPanel Studio</strong>
        <input className="name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
        <button onClick={() => commit(clone(ORBIT_DEFAULT))}>New (default)</button>
        <button onClick={save}>Save</button>
        <button onClick={exportJson}>Export</button>
        <label className="import">
          Import<input type="file" accept="application/json" onChange={importJson} hidden />
        </label>
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
        <label className="sim">
          <input type="checkbox" checked={sim} onChange={(e) => setSim(e.target.checked)} /> Sim data
        </label>
        <label className="limit">
          Claude 5h limit
          <input type="number" value={claudeLimit} onChange={(e) => setClaudeLimit(Number(e.target.value))} />
        </label>
      </header>

      <div className="body">
        <aside className="palette">
          <h3>Add widget</h3>
          {WIDGET_TYPES.map((t) => (
            <button key={t} onClick={() => commit({ ...profile, widgets: [...profile.widgets, newWidget(t)] })}>
              + {t}
            </button>
          ))}
          <h3>Widgets</h3>
          <ul className="list">
            {profile.widgets.map((w) => (
              <li key={w.id} className={w.id === selectedId ? 'sel' : ''} onClick={() => setSelectedId(w.id)}>
                {w.type} <span className="muted">{w.id}</span>
              </li>
            ))}
          </ul>
        </aside>

        <main className="stage">
          <canvas
            ref={canvasRef}
            width={profile.width * SCALE}
            height={profile.height * SCALE}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
          />
          <p className="muted">{profile.width}×{profile.height} — click to select, drag to move</p>
        </main>

        <aside className="inspector">
          <h3>Inspector</h3>
          {!selected && <p className="muted">Select a widget</p>}
          {selected && (
            <>
              <div className="row">
                <b>{selected.type}</b>
                <button onClick={deleteSelected}>Delete</button>
              </div>
              <div className="geo">
                {(['x', 'y', 'w', 'h'] as const).map((k) => (
                  <label key={k}>
                    {k}
                    <input
                      type="number"
                      value={selected[k]}
                      onChange={(e) => patchWidget(selected.id, { [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              <label className="props">
                props (JSON)
                <textarea rows={12} value={propsText} onChange={(e) => setPropsText(e.target.value)} />
              </label>
              {propsErr && <p className="err">{propsErr}</p>}
              <button onClick={applyProps}>Apply props</button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
