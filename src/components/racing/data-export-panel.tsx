"use client";

import { Download, FileJson, FileSpreadsheet, Filter } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DRIVERS, TRACKS } from "@/lib/racing/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DataExportPanel() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [trackFilter, setTrackFilter] = useState<string>("all");

  const buildUrl = (format: "csv" | "json", type: "laps" | "pace" | "championship" | "all") => {
    const params = new URLSearchParams({ format, type });
    if (driverFilter !== "all") params.set("driverId", driverFilter);
    if (trackFilter !== "all") params.set("trackId", trackFilter);
    return `/api/export?${params.toString()}`;
  };

  const handleExport = async (format: "csv" | "json", type: "laps" | "pace" | "championship" | "all") => {
    setExporting(`${format}-${type}`);
    try {
      const res = await fetch(buildUrl(format, type));
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = driverFilter !== "all" || trackFilter !== "all" ? "-filtered" : "";
      a.download = `racing-bulls-${type}${suffix}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${type} as ${format.toUpperCase()}`, {
        description: `${(blob.size / 1024).toFixed(1)} KB downloaded`,
      });
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Download className="h-3.5 w-3.5 text-red-500" />
          Data Export
        </h3>
        <span className="text-[10px] text-slate-500">DB-backed</span>
      </div>

      <p className="mb-3 text-[11px] leading-snug text-slate-500">
        Export persisted telemetry data as CSV or JSON for external analysis. Filter by driver or track to narrow the export.
      </p>

      {/* filters */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-500">
            <Filter className="h-2.5 w-2.5" />
            Driver
          </label>
          <Select value={driverFilter} onValueChange={setDriverFilter}>
            <SelectTrigger className="h-7 border-border/40 bg-slate-900/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Drivers</SelectItem>
              {DRIVERS.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  <span className="font-mono font-bold" style={{ color: d.teamColor }}>{d.code}</span> · {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-500">
            <Filter className="h-2.5 w-2.5" />
            Track
          </label>
          <Select value={trackFilter} onValueChange={setTrackFilter}>
            <SelectTrigger className="h-7 border-border/40 bg-slate-900/60 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Tracks</SelectItem>
              {TRACKS.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.name.split(" ")[0]} · {t.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <ExportRow
          label="All Data"
          description="Laps + pace changes + championship"
          onCsv={() => handleExport("csv", "all")}
          onJson={() => handleExport("json", "all")}
          exporting={exporting === "csv-all" || exporting === "json-all"}
        />
        <ExportRow
          label="Lap History"
          description="Per-lap telemetry with sectors"
          onCsv={() => handleExport("csv", "laps")}
          onJson={() => handleExport("json", "laps")}
          exporting={exporting === "csv-laps" || exporting === "json-laps"}
        />
        <ExportRow
          label="Pace Changes"
          description="Decision log with timestamps"
          onCsv={() => handleExport("csv", "pace")}
          onJson={() => handleExport("json", "pace")}
          exporting={exporting === "csv-pace" || exporting === "json-pace"}
        />
        <ExportRow
          label="Championship Rounds"
          description="Points + positions per round"
          onCsv={() => handleExport("csv", "championship")}
          onJson={() => handleExport("json", "championship")}
          exporting={exporting === "csv-championship" || exporting === "json-championship"}
        />
      </div>
    </div>
  );
}

function ExportRow({
  label,
  description,
  onCsv,
  onJson,
  exporting,
}: {
  label: string;
  description: string;
  onCsv: () => void;
  onJson: () => void;
  exporting: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-slate-900/40 p-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-100">{label}</div>
        <div className="text-[10px] text-slate-500">{description}</div>
      </div>
      <button
        onClick={onCsv}
        disabled={exporting}
        className={cn(
          "flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-slate-800",
          exporting ? "opacity-50" : "text-green-400 hover:text-green-300"
        )}
      >
        <FileSpreadsheet className="h-3 w-3" />
        CSV
      </button>
      <button
        onClick={onJson}
        disabled={exporting}
        className={cn(
          "flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-slate-800",
          exporting ? "opacity-50" : "text-amber-400 hover:text-amber-300"
        )}
      >
        <FileJson className="h-3 w-3" />
        JSON
      </button>
    </div>
  );
}
