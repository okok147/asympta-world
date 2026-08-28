import { spawn } from "node:child_process";

const [, , timeoutInput, killAfterInput, command, ...args] = process.argv;

function duration(value, fallback) {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(value ?? "");
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";
  return amount * (unit === "m" ? 60_000 : unit === "s" ? 1_000 : 1);
}

if (!command) {
  console.error("Usage: run-with-timeout <timeout> <kill-after> <command> [...args]");
  process.exit(64);
}

const timeoutMs = duration(timeoutInput, 180_000);
const killAfterMs = duration(killAfterInput, 10_000);
const child = spawn(command, args, { stdio: "inherit", env: process.env });
let timedOut = false;
let forceTimer;

const timeoutTimer = setTimeout(() => {
  timedOut = true;
  console.error(`Command exceeded ${timeoutInput}; requesting shutdown.`);
  child.kill("SIGTERM");
  forceTimer = setTimeout(() => child.kill("SIGKILL"), killAfterMs);
}, timeoutMs);

child.once("error", (error) => {
  clearTimeout(timeoutTimer);
  if (forceTimer) clearTimeout(forceTimer);
  console.error(error.message);
  process.exitCode = 69;
});

child.once("exit", (code, signal) => {
  clearTimeout(timeoutTimer);
  if (forceTimer) clearTimeout(forceTimer);
  if (timedOut) process.exitCode = 124;
  else if (signal) process.exitCode = 128;
  else process.exitCode = code ?? 1;
});
