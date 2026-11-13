import fs from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, ".tools", "storage-tests");
const imports = path.join(dir, "imports");
await fs.mkdir(path.join(dir, "src"), { recursive: true });
await fs.mkdir(imports, { recursive: true });
const bin = path.join(
  process.env.NDK_HOME,
  "toolchains",
  "llvm",
  "prebuilt",
  "windows-x86_64",
  "bin",
);
const run = promisify(execFile);
const { stdout } = await run(
  path.join(bin, "llvm-readobj.exe"),
  [
    "--coff-exports",
    path.join(process.env.SystemRoot, "System32", "winsqlite3.dll"),
  ],
  { windowsHide: true, maxBuffer: 8000000 },
);
const names = [...stdout.matchAll(/Name: (sqlite3_\w+)/g)].map((m) => m[1]);
if (names.length < 100) throw Error("Windows SQLite exports not found");
const def = path.join(imports, "sqlite3.def");
await fs.writeFile(
  def,
  "LIBRARY winsqlite3.dll\nEXPORTS\n" + names.join("\n") + "\n",
);
await run(
  path.join(bin, "llvm-dlltool.exe"),
  [
    "-m",
    "i386:x86-64",
    "-D",
    "winsqlite3.dll",
    "-d",
    def,
    "-l",
    path.join(imports, "libsqlite3.dll.a"),
  ],
  { windowsHide: true },
);
await fs.writeFile(
  path.join(dir, "Cargo.toml"),
  '[package]\nname="orbita_storage_tests"\nversion="0.1.0"\nedition="2021"\n[dependencies]\nchrono={version="=0.4.45",features=["serde","clock"]}\nrusqlite="=0.40.2"\nserde={version="=1.0.229",features=["derive"]}\nserde_json="=1.0.154"\nuuid={version="=1.28.0",features=["v4","serde"]}\nurl="=2.5.8"\ntempfile="=3.27.0"\n',
);
await fs.writeFile(
  path.join(dir, "src", "lib.rs"),
  'extern crate self as tauri;\npub use url::Url;\n#[path="' +
    path
      .join(root, "src-tauri", "src", "storage", "mod.rs")
      .replaceAll("\\", "/") +
    '"]\nmod storage;\n#[path="' +
    path.join(root, "src-tauri", "src", "images.rs").replaceAll("\\", "/") +
    '"]\nmod images;\n',
);
const env = { ...process.env, SQLITE3_LIB_DIR: imports, SQLITE3_STATIC: "0" };
const child = spawn(
  "cargo.exe",
  [
    "test",
    "--offline",
    "--manifest-path",
    path.join(dir, "Cargo.toml"),
    "--target",
    "x86_64-pc-windows-gnu",
  ],
  { cwd: root, env, windowsHide: true, stdio: "inherit" },
);
child.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
child.on("exit", (code) => (process.exitCode = code || 0));
