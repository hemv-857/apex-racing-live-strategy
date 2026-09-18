// Dev supervisor — keeps `next dev` alive by respawning it if it exits.
// Run via: nohup setsid bun dev-supervisor.ts > dev.log 2>&1 &
import { spawn } from "child_process";

function start() {
  const child = spawn(
    process.execPath, // bun
    ["next", "dev", "-p", "3000"],
    {
      cwd: "/home/z/my-project",
      stdio: "inherit",
      env: { ...process.env, FORCE_COLOR: "1" },
    }
  );
  child.on("exit", (code, signal) => {
    console.log(`[dev-supervisor] next dev exited code=${code} signal=${signal}, restarting in 2s...`);
    setTimeout(start, 2000);
  });
  child.on("error", (err) => {
    console.error("[dev-supervisor] spawn error:", err);
    setTimeout(start, 2000);
  });
  console.log(`[dev-supervisor] started next dev (pid ${child.pid})`);
}

start();

process.on("SIGTERM", () => {
  console.log("[dev-supervisor] SIGTERM received, exiting");
  process.exit(0);
});
