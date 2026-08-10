# 项目 Agent 配置

本目录用于存放本项目专属的 Agent 配置和可复用 skill。目录内容默认纳入 Git，便于团队共享和在 GitHub 上协作。

## 目录约定

- `skills/<skill-name>/SKILL.md`：一个 skill 一个目录，入口文件固定为 `SKILL.md`。
- `skills/<skill-name>/scripts/`：需要执行的辅助脚本（可选）。
- `skills/<skill-name>/references/`：较长的参考资料（可选）。

新增 skill 时，请复制 `skills/_template/`，将目录名改为 kebab-case，并完善 `SKILL.md` 中的用途、输入、输出和验证方式。
