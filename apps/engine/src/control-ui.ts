// OrbitPanel control window UI — a self-contained HTML document (inline CSS + JS) so it
// needs no separate bundler step. electron-main writes this to a temp file and loads it
// with the preload bridge (window.orbit). The embedded script renders purely from a status
// object pushed by the engine via window.orbit.onStatus, and exposes window.__setStatus for
// offline/screenshot previews. Theme mirrors the panel palette in dashboard/colors.ts.
export const CONTROL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OrbitPanel Control</title>
<style>
  :root {
    --bg: #0a0e1a; --surf: #111a2e; --surf2: #0d1424; --stroke: #243150;
    --t1: #e6edf7; --t2: #8595b5; --cyan: #22d3ee; --green: #34d399;
    --amber: #f59e0b; --red: #f87171; --violet: #a78bfa;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  html { background: var(--bg); }
  body {
    min-height: 100vh;
    background: radial-gradient(1200px 600px at 50% -10%, #14213f 0%, var(--bg) 60%);
    color: var(--t1);
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex; align-items: center; justify-content: center;
    padding: 24px; user-select: none;
  }
  .app { width: 100%; max-width: 460px; }
  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .logo {
    width: 14px; height: 14px; border-radius: 4px; background: var(--green);
    box-shadow: 0 0 12px 1px rgba(52,211,153,.7);
  }
  .title { font-weight: 800; letter-spacing: 3px; font-size: 20px; }
  .title .accent { color: var(--cyan); }
  .subtitle { color: var(--t2); font-size: 12px; letter-spacing: 2px; margin-left: auto; text-transform: uppercase; }

  .card {
    background: linear-gradient(180deg, var(--surf) 0%, var(--surf2) 100%);
    border: 1px solid var(--stroke); border-radius: 14px;
    padding: 18px; margin-bottom: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }

  .conn { display: flex; align-items: center; gap: 12px; }
  .dot {
    width: 13px; height: 13px; border-radius: 50%; background: var(--t2);
    position: relative; flex: 0 0 auto; transition: background .3s, box-shadow .3s;
  }
  .dot.live { background: var(--green); box-shadow: 0 0 0 0 rgba(52,211,153,.7); animation: pulse 1.8s infinite; }
  .dot.warn { background: var(--amber); box-shadow: 0 0 10px 1px rgba(245,158,11,.6); }
  .dot.off  { background: var(--t2); }
  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(52,211,153,.55); }
    70%  { box-shadow: 0 0 0 9px rgba(52,211,153,0); }
    100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
  }
  .conn .state { font-size: 16px; font-weight: 600; }
  .conn .engine {
    margin-left: auto; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
    padding: 5px 10px; border-radius: 999px; border: 1px solid var(--stroke); color: var(--t2);
  }
  .engine.running { color: var(--green); border-color: rgba(52,211,153,.5); }
  .engine.paused  { color: var(--amber); border-color: rgba(245,158,11,.5); }
  .engine.stopped { color: var(--t2); }

  .screen { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--stroke); }
  .screen .name { font-size: 15px; font-weight: 600; }
  .screen .res {
    font-size: 12px; color: var(--cyan); border: 1px solid rgba(34,211,238,.35);
    padding: 3px 8px; border-radius: 6px; font-variant-numeric: tabular-nums;
  }
  .screen .profile { margin-left: auto; font-size: 12px; color: var(--t2); }

  .stats { display: flex; gap: 18px; margin-top: 14px; }
  .stat { flex: 1; text-align: center; }
  .stat .v { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .k { font-size: 10px; color: var(--t2); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }

  .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  button {
    appearance: none; cursor: pointer; color: var(--t1);
    background: var(--surf); border: 1px solid var(--stroke); border-radius: 12px;
    padding: 16px; font-size: 15px; font-weight: 700; letter-spacing: 1px;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: transform .08s, background .2s, border-color .2s, opacity .2s;
  }
  button:hover:not(:disabled) { transform: translateY(-1px); background: #16223c; }
  button:active:not(:disabled) { transform: translateY(0); }
  button:disabled { opacity: .35; cursor: not-allowed; }
  button .ic { width: 14px; height: 14px; display: inline-block; }
  #run:not(:disabled)     { border-color: rgba(52,211,153,.45); color: var(--green); }
  #pause:not(:disabled)   { border-color: rgba(245,158,11,.45); color: var(--amber); }
  #stop:not(:disabled)    { border-color: rgba(248,113,113,.45); color: var(--red); }
  #restart:not(:disabled) { border-color: rgba(167,139,250,.45); color: var(--violet); }

  .foot { color: var(--t2); font-size: 11px; text-align: center; margin-top: 16px; line-height: 1.6; }
</style>
</head>
<body>
  <div class="app">
    <div class="head">
      <span class="logo" id="logo"></span>
      <span class="title">ORBIT<span class="accent">PANEL</span></span>
      <span class="subtitle">Control</span>
    </div>

    <div class="card">
      <div class="conn">
        <span class="dot off" id="dot"></span>
        <span class="state" id="state">Engine stopped</span>
        <span class="engine stopped" id="engine">Stopped</span>
      </div>
      <div class="screen">
        <span class="name" id="screenName">No panel</span>
        <span class="res" id="screenRes" style="display:none"></span>
        <span class="profile" id="screenProfile"></span>
      </div>
      <div class="stats">
        <div class="stat"><div class="v" id="fps">—</div><div class="k">fps</div></div>
        <div class="stat"><div class="v" id="rendered">—</div><div class="k">frames</div></div>
        <div class="stat"><div class="v" id="skipped">—</div><div class="k">skipped</div></div>
      </div>
    </div>

    <div class="controls">
      <button id="run"><span class="ic">&#9654;</span> Run</button>
      <button id="pause"><span class="ic">&#10073;&#10073;</span> Pause</button>
      <button id="stop"><span class="ic">&#9632;</span> Stop</button>
      <button id="restart"><span class="ic">&#8635;</span> Restart</button>
    </div>

    <div class="foot" id="foot">Run as administrator to read CPU temperature.</div>
  </div>

<script>
  var S = { alive:false, paused:false, device:'NotDetected', screen:null, fps:0, rendered:0, skipped:0, failed:0 };
  var $ = function(id){ return document.getElementById(id); };

  function deviceLabel(d, alive) {
    if (!alive) return { text:'Engine stopped', cls:'off' };
    switch (d) {
      case 'Ready':        return { text:'Connected \\u00b7 Ready', cls:'live' };
      case 'Connecting':   return { text:'Connecting\\u2026', cls:'warn' };
      case 'Reconnecting': return { text:'Reconnecting\\u2026', cls:'warn' };
      case 'Degraded':     return { text:'Degraded', cls:'warn' };
      default:             return { text:'No panel detected', cls:'off' };
    }
  }

  function render() {
    var d = deviceLabel(S.device, S.alive);
    var dot = $('dot'); dot.className = 'dot ' + d.cls;
    $('state').textContent = d.text;
    $('logo').style.background = d.cls === 'live' ? 'var(--green)' : d.cls === 'warn' ? 'var(--amber)' : 'var(--t2)';
    $('logo').style.boxShadow = d.cls === 'live' ? '0 0 12px 1px rgba(52,211,153,.7)' : 'none';

    var estate = !S.alive ? 'stopped' : (S.paused ? 'paused' : 'running');
    var eng = $('engine');
    eng.className = 'engine ' + estate;
    eng.textContent = estate.charAt(0).toUpperCase() + estate.slice(1);

    if (S.screen) {
      $('screenName').textContent = S.screen.name || 'Panel';
      var res = $('screenRes');
      res.style.display = 'inline-block';
      res.textContent = (S.screen.width || '?') + ' \\u00d7 ' + (S.screen.height || '?');
      $('screenProfile').textContent = S.screen.profile || '';
    } else {
      $('screenName').textContent = S.alive ? 'Searching\\u2026' : 'No panel';
      $('screenRes').style.display = 'none';
      $('screenProfile').textContent = '';
    }

    $('fps').textContent = S.alive ? String(S.fps || 0) : '\\u2014';
    $('rendered').textContent = S.alive ? String(S.rendered || 0) : '\\u2014';
    $('skipped').textContent = S.alive ? String(S.skipped || 0) : '\\u2014';

    $('run').disabled = S.alive && !S.paused;
    $('pause').disabled = !(S.alive && !S.paused);
    $('stop').disabled = !S.alive;
    $('restart').disabled = false;
  }

  function apply(s) { for (var k in s) { S[k] = s[k]; } render(); }
  window.__setStatus = apply; // offline/screenshot preview hook

  var api = window.orbit;
  if (api) {
    api.onStatus(function(s){ apply(s); });
    $('run').addEventListener('click', function(){ api.run(); });
    $('pause').addEventListener('click', function(){ api.pause(); });
    $('stop').addEventListener('click', function(){ api.stop(); });
    $('restart').addEventListener('click', function(){ api.restart(); });
    if (api.requestStatus) api.requestStatus();
  }
  render();
</script>
</body>
</html>`;
