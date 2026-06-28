// ProbeHost: reads PC sensors via LibreHardwareMonitor and emits one JSON-Lines
// telemetry snapshot per second on stdout. Child process of the engine.
// null (never zero) for any unavailable metric. Exits when stdin closes (orphan guard).
using System.Text.Json;
using System.Text.Json.Serialization;
using LibreHardwareMonitor.Hardware;

var computer = new Computer { IsCpuEnabled = true, IsMemoryEnabled = true };
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

var jsonOpts = new JsonSerializerOptions
{
    DefaultIgnoreCondition = JsonIgnoreCondition.Never,
};

static object Metric(float? value, string unit) => new
{
    value = value.HasValue ? Math.Round(value.Value, 1) : (double?)null,
    unit,
    quality = value.HasValue ? "ok" : "unavailable",
    source = "LHM",
};

while (true)
{
    foreach (var hw in computer.Hardware)
    {
        hw.Update();
    }

    float? cpuPkgTemp = null, cpuAnyTemp = null, cpuLoad = null;
    float? memUsedGb = null, memAvailGb = null, memLoad = null;

    foreach (var hw in computer.Hardware)
    {
        if (hw.HardwareType == HardwareType.Cpu)
        {
            foreach (var s in hw.Sensors)
            {
                // A running CPU is never <= 0 C; LHM reports 0 when it can't read temps
                // (e.g. no elevation). Treat that as unavailable (null), never a fake zero.
                if (s.SensorType == SensorType.Temperature && s.Value is > 0f)
                {
                    cpuAnyTemp ??= s.Value;
                    if (s.Name.Contains("Package") || s.Name.Contains("Tctl") || s.Name.Contains("Tdie"))
                    {
                        cpuPkgTemp = s.Value;
                    }
                }
                else if (s.SensorType == SensorType.Load && s.Name == "CPU Total")
                {
                    cpuLoad = s.Value;
                }
            }
        }
        else if (hw.HardwareType == HardwareType.Memory)
        {
            foreach (var s in hw.Sensors)
            {
                if (s.SensorType == SensorType.Data && s.Name == "Memory Used") memUsedGb = s.Value;
                else if (s.SensorType == SensorType.Data && s.Name == "Memory Available") memAvailGb = s.Value;
                else if (s.SensorType == SensorType.Load && s.Name == "Memory") memLoad = s.Value;
            }
        }
    }

    float? cpuTemp = cpuPkgTemp ?? cpuAnyTemp;
    float? totalGb = (memUsedGb.HasValue && memAvailGb.HasValue) ? memUsedGb + memAvailGb : null;

    var snapshot = new
    {
        schemaVersion = 1,
        generatedAt = DateTime.UtcNow.ToString("o"),
        cpu = new
        {
            tempC = Metric(cpuTemp, "C"),
            loadPercent = Metric(cpuLoad, "%"),
        },
        memory = new
        {
            usedMiB = Metric(memUsedGb.HasValue ? memUsedGb * 1024f : null, "MiB"),
            totalMiB = Metric(totalGb.HasValue ? totalGb * 1024f : null, "MiB"),
            loadPercent = Metric(memLoad, "%"),
        },
    };

    Console.WriteLine(JsonSerializer.Serialize(snapshot, jsonOpts));
    Console.Out.Flush();
    Thread.Sleep(1000);
}
