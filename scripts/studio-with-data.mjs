import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// 用法：node scripts/studio-with-data.mjs [--data=src/data/xxx.json]
// 把指定题库包成 { data } 写入 out/.remotion-props.json，再用 remotion studio --props 打开，
// 让 Studio 按这份数据预览（配合 Root.tsx 的 calculateMetadata 动态算时长）。
const arg = process.argv.find((a) => a.startsWith("--data="));
const dataPath = arg ? arg.slice("--data=".length) : "src/data/questions.json";

// 统一以项目根目录为工作目录：remotion 配置、src/、out/ 都相对它解析
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
if (process.cwd() !== projectRoot) {
  process.chdir(projectRoot);
}

const data = JSON.parse(
  fs.readFileSync(path.resolve(projectRoot, dataPath), "utf-8")
);

// props 用相对正斜杠路径，避免 Windows shell 对反斜杠绝对路径的转义问题
const propsPath = path.join("out", ".remotion-props.json").replace(/\\/g, "/");
fs.mkdirSync(path.dirname(propsPath), { recursive: true });
fs.writeFileSync(propsPath, JSON.stringify({ data }), "utf-8");

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(
  command,
  ["remotion", "studio", `--props=${propsPath}`],
  { stdio: "inherit", shell: process.platform === "win32" }
);

child.on("exit", (code) => {
  fs.rmSync(propsPath, { force: true });
  process.exitCode = code ?? 0;
});
