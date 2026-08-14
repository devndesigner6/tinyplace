import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const contracts = [
  ["handle-registry/handle.compact", "handle-registry/managed"],
  ["listing-registry/listing.compact", "listing-registry/managed"],
  ["escrow/escrow.compact", "escrow/managed"],
  ["attestation/attestation.compact", "attestation/managed"],
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
    ...options,
  });
  return result.status === 0;
}

function isMidnightCompact(command) {
  const probe = spawnSync(command, ["compile", "--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return probe.status === 0 && /compact/i.test(probe.stdout ?? probe.stderr ?? "");
}

function compactAvailable() {
  if (process.platform === "win32") {
    // Windows ships C:\Windows\System32\compact.exe (NTFS compression), not Midnight Compact.
    return false;
  }
  const which = spawnSync("which", ["compact"], { encoding: "utf8", shell: true });
  return which.status === 0 && isMidnightCompact("compact");
}

function wslCompact() {
  const result = spawnSync("wsl", ["-e", "bash", "-lc", "command -v compact"], {
    encoding: "utf8",
  });
  return result.status === 0;
}

function compileOne(source, target, runner) {
  mkdirSync(join(root, target), { recursive: true });
  const sourcePath = join(root, source);
  const targetPath = join(root, target);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing Compact source: ${sourcePath}`);
  }
  console.log(`\n=== compact compile ${source} → ${target} ===`);
  const ok = runner(sourcePath, targetPath);
  if (!ok) {
    throw new Error(`Compact compile failed for ${source}`);
  }
}

function nativeRunner(sourcePath, targetPath) {
  return run("compact", ["compile", sourcePath, targetPath], { cwd: root });
}

function wslRunner(sourcePath, targetPath) {
  const toWsl = (windowsPath) =>
    windowsPath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
  const command = `compact compile ${toWsl(sourcePath)} ${toWsl(targetPath)}`;
  return run("wsl", ["-e", "bash", "-lc", command], { shell: false });
}

let runner;
if (compactAvailable()) {
  console.log("Using host `compact` compiler.");
  runner = nativeRunner;
} else if (wslCompact()) {
  console.log("Using WSL `compact` compiler.");
  runner = wslRunner;
} else {
  console.error(`
Compact compiler is not installed.

Midnight Compact does not ship a native Windows compiler. Install it in WSL:

  wsl
  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  source ~/.bashrc
  compact update
  compact compile --version

Then re-run: pnpm --filter @tinyplace/midnight compile
`);
  process.exit(1);
}

for (const [source, target] of contracts) {
  compileOne(source, target, runner);
}

console.log("\nAll Compact contracts compiled.");
