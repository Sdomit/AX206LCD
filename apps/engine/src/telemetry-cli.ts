// Prints live telemetry from the ProbeHost child — proves the data pipeline end to end.
// Usage: npm run telemetry [-- --seconds=N]   (build apps/probehost first)
import { ProbeHost } from './telemetry/probehost';
import { fmtRate } from './dashboard/bindings';
import type { Metric } from './telemetry/snapshot';

function v(m: Metric<number>): string {
  return m.value === null ? `—(${m.quality})` : `${m.value}${m.unit ?? ''}`;
}
function mb(m: Metric<number>): string {
  return m.value === null ? '—' : `${fmtRate(m.value)}B/s`;
}

function main(): void {
  const ph = new ProbeHost();
  ph.on('snapshot', (s) => {
    console.log(
      `cpu ${v(s.cpu.loadPercent)} ${v(s.cpu.tempC)} | gpu ${v(s.gpu.loadPercent)} ${v(s.gpu.tempC)} | ` +
        `mem ${v(s.memory.loadPercent)} | disk ${v(s.storage.tempC)} | net ↓${mb(s.network.downBps)} ↑${mb(s.network.upBps)}`,
    );
  });
  ph.on('stderr', (d: string) => process.stderr.write(`[probehost] ${d}`));
  ph.on('exit', (code: number | null) => console.log(`[probehost exited: ${code}]`));
  ph.on('error', (e: string) =>
    console.error(`[spawn error] ${e}\n  Build it first: dotnet build apps/probehost -c Release`),
  );
  ph.start();

  const secondsArg = process.argv.find((a) => a.startsWith('--seconds='));
  const shutdown = (): void => {
    ph.stop();
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', shutdown);
  if (secondsArg) setTimeout(shutdown, Number(secondsArg.split('=')[1]) * 1000);

  console.log('telemetry started (Ctrl+C to stop)');
}

main();
