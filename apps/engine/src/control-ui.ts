// OrbitPanel control window UI — a self-contained HTML document (inline CSS + JS) so it
// needs no separate bundler step. electron-main writes this to a temp file and loads it with
// the preload bridge (window.orbit). The embedded script renders purely from a status object
// pushed by the engine (and reads/writes settings), and exposes window.__setStatus for
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
    display: flex; align-items: flex-start; justify-content: center;
    padding: 22px; user-select: none;
  }
  .app { width: 100%; max-width: 460px; }
  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .logo { width: 14px; height: 14px; border-radius: 4px; background: var(--green); box-shadow: 0 0 12px 1px rgba(52,211,153,.7); }
  .title { font-weight: 800; letter-spacing: 3px; font-size: 20px; }
  .title .accent { color: var(--cyan); }
  .subtitle { color: var(--t2); font-size: 12px; letter-spacing: 2px; margin-left: auto; text-transform: uppercase; }

  .banner {
    display: none; align-items: center; gap: 10px; margin-bottom: 14px; padding: 11px 14px;
    border-radius: 12px; border: 1px solid rgba(245,158,11,.5); background: rgba(245,158,11,.10);
    color: var(--amber); font-size: 13px;
  }
  .banner.show { display: flex; }
  .banner button { margin-left: auto; padding: 7px 12px; font-size: 12px; }

  .card {
    background: linear-gradient(180deg, var(--surf) 0%, var(--surf2) 100%);
    border: 1px solid var(--stroke); border-radius: 14px; padding: 18px; margin-bottom: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }
  .card .ct { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--t2); margin-bottom: 12px; }

  .conn { display: flex; align-items: center; gap: 12px; }
  .dot { width: 13px; height: 13px; border-radius: 50%; background: var(--t2); flex: 0 0 auto; transition: background .3s, box-shadow .3s; }
  .dot.live { background: var(--green); animation: pulse 1.8s infinite; }
  .dot.warn { background: var(--amber); box-shadow: 0 0 10px 1px rgba(245,158,11,.6); }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,.55); } 70% { box-shadow: 0 0 0 9px rgba(52,211,153,0); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
  .conn .state { font-size: 16px; font-weight: 600; }
  .conn .engine { margin-left: auto; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--stroke); color: var(--t2); }
  .engine.running { color: var(--green); border-color: rgba(52,211,153,.5); }
  .engine.paused { color: var(--amber); border-color: rgba(245,158,11,.5); }

  .row { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--stroke); }
  .row .name { font-size: 15px; font-weight: 600; }
  .res { font-size: 12px; color: var(--cyan); border: 1px solid rgba(34,211,238,.35); padding: 3px 8px; border-radius: 6px; font-variant-numeric: tabular-nums; }
  .row .profile { margin-left: auto; font-size: 12px; color: var(--t2); }

  .usage { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--stroke); }
  .usage .line { display: flex; align-items: center; gap: 10px; font-size: 13px; font-variant-numeric: tabular-nums; }
  .usage .line + .line { margin-top: 8px; }
  .usage .tag { width: 58px; color: var(--t2); letter-spacing: 1px; text-transform: uppercase; font-size: 11px; }
  .usage .track { flex: 1; height: 8px; border-radius: 5px; background: var(--stroke); overflow: hidden; }
  .usage .fill { height: 100%; width: 0; background: var(--green); border-radius: 5px; transition: width .4s; }
  .usage .val { width: 150px; text-align: right; color: var(--t1); }
  .usage .val .pct { color: var(--green); margin-left: 6px; }

  .stats { display: flex; gap: 18px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--stroke); }
  .stat { flex: 1; text-align: center; }
  .stat .v { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .k { font-size: 10px; color: var(--t2); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }

  .field { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .field label { width: 130px; font-size: 13px; color: var(--t2); }
  .field input {
    flex: 1; background: var(--surf2); border: 1px solid var(--stroke); border-radius: 9px;
    color: var(--t1); padding: 9px 11px; font-size: 13px; outline: none;
  }
  .field input:focus { border-color: rgba(34,211,238,.5); }
  .hint { font-size: 11px; color: var(--t2); margin: 2px 0 12px; }
  #save { width: 100%; padding: 12px; border-color: rgba(34,211,238,.45); color: var(--cyan); }
  #save.ok { border-color: rgba(52,211,153,.6); color: var(--green); }

  .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  button {
    appearance: none; cursor: pointer; color: var(--t1); background: var(--surf);
    border: 1px solid var(--stroke); border-radius: 12px; padding: 15px; font-size: 15px;
    font-weight: 700; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: transform .08s, background .2s, border-color .2s, opacity .2s;
  }
  button:hover:not(:disabled) { transform: translateY(-1px); background: #16223c; }
  button:active:not(:disabled) { transform: translateY(0); }
  button:disabled { opacity: .35; cursor: not-allowed; }
  .controls .ic { width: 14px; height: 14px; }
  #run:not(:disabled) { border-color: rgba(52,211,153,.45); color: var(--green); }
  #pause:not(:disabled) { border-color: rgba(245,158,11,.45); color: var(--amber); }
  #stop:not(:disabled) { border-color: rgba(248,113,113,.45); color: var(--red); }
  #restart:not(:disabled) { border-color: rgba(167,139,250,.45); color: var(--violet); }

  .foot { color: var(--t2); font-size: 11px; text-align: center; margin-top: 14px; line-height: 1.6; }
</style>
</head>
<body>
  <div class="app">
    <div class="head">
      <span class="logo" id="logo"></span>
      <span class="title">ORBIT<span class="accent">PANEL</span></span>
      <span class="subtitle">Control</span>
    </div>

    <div class="banner" id="adminBanner">
      <span>Not running as administrator &mdash; CPU temperature is unavailable.</span>
      <button id="admin">Restart as admin</button>
    </div>

    <div class="card">
      <div class="conn">
        <span class="dot" id="dot"></span>
        <span class="state" id="state">Engine stopped</span>
        <span class="engine" id="engine">Stopped</span>
      </div>
      <div class="row">
        <span class="name" id="screenName">No panel</span>
        <span class="res" id="screenRes" style="display:none"></span>
        <span class="profile" id="screenProfile"></span>
      </div>
      <div class="usage">
        <div class="line"><span class="tag">Claude</span><span class="track"><span class="fill" id="claudeFill"></span></span><span class="val" id="claudeVal">&mdash;</span></div>
        <div class="line"><span class="tag">Codex</span><span class="track"><span class="fill" id="codexFill"></span></span><span class="val" id="codexVal">&mdash;</span></div>
      </div>
      <div class="stats">
        <div class="stat"><div class="v" id="fps">&mdash;</div><div class="k">fps</div></div>
        <div class="stat"><div class="v" id="rendered">&mdash;</div><div class="k">frames</div></div>
        <div class="stat"><div class="v" id="skipped">&mdash;</div><div class="k">skipped</div></div>
      </div>
    </div>

    <div class="card">
      <div class="ct">Token limits</div>
      <div class="field"><label>Claude 5h limit</label><input id="claudeLimit" placeholder="e.g. 88M" /></div>
      <div class="field"><label>Codex limit</label><input id="codexLimit" placeholder="e.g. 50M" /></div>
      <div class="hint">Sets the progress-bar maximum. Accepts 88M / 500K / raw tokens. Leave blank to show the count with no bar.</div>
      <button id="save">Save &amp; apply</button>
    </div>

    <div class="controls">
      <button id="run"><span class="ic">&#9654;</span> Run</button>
      <button id="pause"><span class="ic">&#10073;&#10073;</span> Pause</button>
      <button id="stop"><span class="ic">&#9632;</span> Stop</button>
      <button id="restart"><span class="ic">&#8635;</span> Restart</button>
    </div>

    <div class="foot" id="foot">Set token limits to see the usage bars fill.</div>
  </div>

<script>
  var S = { alive:false, paused:false, device:'NotDetected', screen:null, fps:0, rendered:0, skipped:0, failed:0, elevated:true, ai:null };
  var $ = function(id){ return document.getElementById(id); };

  function fmtTok(n) {
    if (n == null) return '\\u2014';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(Math.round(n));
  }
  function parseLimit(str) {
    if (!str) return null;
    var m = String(str).trim().match(/^([0-9]*\\.?[0-9]+)\\s*([mkMK])?$/);
    if (!m) return null;
    var n = parseFloat(m[1]);
    var u = (m[2] || '').toLowerCase();
    if (u === 'm') n *= 1e6; else if (u === 'k') n *= 1e3;
    return n > 0 ? Math.round(n) : null;
  }
  function toInput(n) {
    if (n == null) return '';
    if (n >= 1e6 && n % 1e5 === 0) return (n / 1e6) + 'M';
    if (n >= 1e3 && n % 1e3 === 0) return (n / 1e3) + 'K';
    return String(n);
  }

  function deviceLabel(d, alive) {
    if (!alive) return { text:'Engine stopped', cls:'' };
    switch (d) {
      case 'Ready': return { text:'Connected \\u00b7 Ready', cls:'live' };
      case 'Connecting': return { text:'Connecting\\u2026', cls:'warn' };
      case 'Reconnecting': return { text:'Reconnecting\\u2026', cls:'warn' };
      case 'Degraded': return { text:'Degraded', cls:'warn' };
      default: return { text:'No panel detected', cls:'' };
    }
  }

  function usageLine(line, fillEl, valEl) {
    if (!line || !line.available) { fillEl.style.width = '0'; valEl.innerHTML = '\\u2014'; return; }
    var used = fmtTok(line.used);
    if (line.limit && line.limit > 0) {
      var frac = line.used / line.limit;
      var pct = Math.round(frac * 100);
      var col = frac >= 0.9 ? 'var(--red)' : frac >= 0.7 ? 'var(--amber)' : 'var(--green)';
      fillEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
      fillEl.style.background = col;
      valEl.innerHTML = used + ' / ' + fmtTok(line.limit) + '<span class="pct" style="color:' + col + '">' + pct + '%</span>';
    } else {
      fillEl.style.width = '0';
      valEl.innerHTML = used + '<span class="pct" style="color:var(--t2)">no limit</span>';
    }
  }

  function render() {
    var d = deviceLabel(S.device, S.alive);
    $('dot').className = 'dot ' + d.cls;
    $('state').textContent = d.text;
    $('logo').style.background = d.cls === 'live' ? 'var(--green)' : d.cls === 'warn' ? 'var(--amber)' : 'var(--t2)';
    $('logo').style.boxShadow = d.cls === 'live' ? '0 0 12px 1px rgba(52,211,153,.7)' : 'none';

    var estate = !S.alive ? 'stopped' : (S.paused ? 'paused' : 'running');
    var eng = $('engine'); eng.className = 'engine ' + estate;
    eng.textContent = estate.charAt(0).toUpperCase() + estate.slice(1);

    if (S.screen) {
      $('screenName').textContent = S.screen.name || 'Panel';
      $('screenRes').style.display = 'inline-block';
      $('screenRes').textContent = (S.screen.width || '?') + ' \\u00d7 ' + (S.screen.height || '?');
      $('screenProfile').textContent = S.screen.profile || '';
    } else {
      $('screenName').textContent = S.alive ? 'Searching\\u2026' : 'No panel';
      $('screenRes').style.display = 'none';
      $('screenProfile').textContent = '';
    }

    usageLine(S.ai && S.ai.claude, $('claudeFill'), $('claudeVal'));
    usageLine(S.ai && S.ai.codex, $('codexFill'), $('codexVal'));

    $('fps').textContent = S.alive ? String(S.fps || 0) : '\\u2014';
    $('rendered').textContent = S.alive ? String(S.rendered || 0) : '\\u2014';
    $('skipped').textContent = S.alive ? String(S.skipped || 0) : '\\u2014';

    $('adminBanner').className = 'banner' + (S.elevated ? '' : ' show');

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
    $('admin').addEventListener('click', function(){ api.relaunchAdmin(); });
    $('save').addEventListener('click', function(){
      api.setSettings({ claudeLimit: parseLimit($('claudeLimit').value), codexLimit: parseLimit($('codexLimit').value) });
      var b = $('save'); b.className = 'ok'; b.textContent = 'Saved';
      setTimeout(function(){ b.className = ''; b.innerHTML = 'Save &amp; apply'; }, 1400);
    });
    if (api.getSettings) api.getSettings().then(function(s){
      if (!s) return;
      $('claudeLimit').value = toInput(s.claudeLimit);
      $('codexLimit').value = toInput(s.codexLimit);
    });
    if (api.requestStatus) api.requestStatus();
  }
  render();
</script>
</body>
</html>`;
