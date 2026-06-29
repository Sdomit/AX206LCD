// ProbeHost: reads PC sensors via LibreHardwareMonitor and emits one JSON-Lines
// telemetry snapshot (schemaVersion 2) per second on stdout. Child process of the engine.
// null (never zero) for any unavailable metric. Exits when stdin closes (orphan guard).
// CPU/GPU/disk temps need a ring0 driver — run elevated to populate CPU temp.
using System.Text.Json;
using LibreHardwareMonitor.Hardware;

var computer = new Computer
{
    IsCpuEnabled = true,
    IsGpuEnabled = true,
    IsMemoryEnabled = true,
    IsStorageEnabled = true,
    IsNetworkEnabled = true,
};
computer.Open();

// Exit when the parent (engine) closes our stdin.
_ = Task.Run(() =>
{
    try
    {
        while (Console.In.ReadLine() != null) { }
    }
    catch
    {
        // ignore
    }
    Environment.Exit(0);
});

static object Metric(float? value, string unit) => new
{
    value = value.HasValue ? Math.Round(value.Value, 1) : (double?)null,
    unit,
    quality = value.HasValue ? "ok" : "unavailable",
    source = "LHM",
};

// A running CPU/GPU is never <= 0 C; LHM reports 0 when it can't read temps (e.g. no
// elevation). Treat <= 0 as unavailable (null), never a fake zero.
static float? PosTemp(float? v) => v is > 0f ? v : null;

// CPU temp needs a ring0 driver (elevation); GPU temp does not. If we never see a CPU temp,
// say why once so the panel's "-- °C" isn't a mystery. Engine/CLI surface our stderr.
// Sensors can read null/0 for the first cycle or two before the driver populates them, so
// only warn after the null is clearly sustained (a few cycles).
var warnedCpuTemp = false;
var cpuTempNullCycles = 0;

while (true)
{
    foreach (var hw in computer.Hardware)
    {
        hw.Update();
    }

    float? cpuTemp = null, cpuTempAny = null, cpuLoad = null;
    float? gpuTemp = null, gpuTempAny = null, gpuLoad = null;
    float? memUsedGb = null, memAvailGb = null, memLoad = null;
    float? diskTemp = null, diskUsedPct = null;
    float? netDown = null, netUp = null;

    foreach (var hw in computer.Hardware)
    {
        switch (hw.HardwareType)
        {
            case HardwareType.Cpu:
                foreach (var s in hw.Sensors)
                {
                    if (s.SensorType == SensorType.Temperature && s.Value is > 0f)
                    {
                        cpuTempAny ??= s.Value;
                        if (s.Name.Contains("Package") || s.Name.Contains("Tctl") || s.Name.Contains("Tdie")) cpuTemp = s.Value;
                    }
                    else if (s.SensorType == SensorType.Load && s.Name == "CPU Total") cpuLoad = s.Value;
                }
                break;

            case HardwareType.GpuNvidia:
            case HardwareType.GpuAmd:
            case HardwareType.GpuIntel:
                foreach (var s in hw.Sensors)
                {
                    if (s.SensorType == SensorType.Temperature && s.Value is > 0f)
                    {
                        gpuTempAny ??= s.Value;
                        if (s.Name.Contains("Core")) gpuTemp = s.Value;
                    }
                    else if (s.SensorType == SensorType.Load && (s.Name == "GPU Core" || s.Name == "D3D 3D")) gpuLoad ??= s.Value;
                }
                break;

            case HardwareType.Memory:
                foreach (var s in hw.Sensors)
                {
                    if (s.SensorType == SensorType.Data && s.Name == "Memory Used") memUsedGb = s.Value;
                    else if (s.SensorType == SensorType.Data && s.Name == "Memory Available") memAvailGb = s.Value;
                    else if (s.SensorType == SensorType.Load && s.Name == "Memory") memLoad = s.Value;
                }
                break;

            case HardwareType.Storage:
                foreach (var s in hw.Sensors)
                {
                    if (s.SensorType == SensorType.Temperature && s.Value is > 0f) diskTemp ??= s.Value;
                    else if (s.SensorType == SensorType.Load && s.Name == "Used Space") diskUsedPct ??= s.Value;
                }
                break;

            case HardwareType.Network:
                foreach (var s in hw.Sensors)
                {
                    if (s.SensorType == SensorType.Throughput && s.Name == "Download Speed") netDown = (netDown ?? 0) + (s.Value ?? 0);
                    else if (s.SensorType == SensorType.Throughput && s.Name == "Upload Speed") netUp = (netUp ?? 0) + (s.Value ?? 0);
                }
                break;
        }
    }

    if (!warnedCpuTemp)
    {
        if (PosTemp(cpuTemp ?? cpuTempAny) is null)
        {
            if (++cpuTempNullCycles >= 3)
            {
                warnedCpuTemp = true;
                Console.Error.WriteLine(
                    "CPU temperature unavailable after several reads — no CPU temp sensor is exposed. " +
                    "Usually this means OrbitPanel needs to run as administrator (CPU temp needs a ring0 driver); " +
                    "some CPUs/boards expose no temp sensor at all. GPU temp does not require elevation.");
            }
        }
        else
        {
            cpuTempNullCycles = 0;
        }
    }

    float? totalGb = (memUsedGb.HasValue && memAvailGb.HasValue) ? memUsedGb + memAvailGb : null;

    var snapshot = new
    {
        schemaVersion = 2,
        generatedAt = DateTime.UtcNow.ToString("o"),
        cpu = new { tempC = Metric(PosTemp(cpuTemp ?? cpuTempAny), "C"), loadPercent = Metric(cpuLoad, "%") },
        gpu = new { tempC = Metric(PosTemp(gpuTemp ?? gpuTempAny), "C"), loadPercent = Metric(gpuLoad, "%") },
        memory = new
        {
            usedMiB = Metric(memUsedGb.HasValue ? memUsedGb * 1024f : null, "MiB"),
            totalMiB = Metric(totalGb.HasValue ? totalGb * 1024f : null, "MiB"),
            loadPercent = Metric(memLoad, "%"),
        },
        storage = new { tempC = Metric(diskTemp, "C"), usedPercent = Metric(diskUsedPct, "%") },
        network = new { downBps = Metric(netDown, "B/s"), upBps = Metric(netUp, "B/s") },
    };

    Console.WriteLine(JsonSerializer.Serialize(snapshot));
    Console.Out.Flush();
    Thread.Sleep(1000);
}
