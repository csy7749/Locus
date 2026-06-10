## Why

当前仓库已经形成前端、Tauri 宿主、Unity 插件、知识库、工具定义、发布脚本等多条职责线，但顶层目录之间的边界和每个目录内部的原子职责还没有用统一规范沉淀下来。为了支持后续开发、重构、知识注入和代理路由，需要先用 OpenSpec 明确仓库结构的职责模型。

## What Changes

- 新增一个基于 OpenSpec 的仓库结构分析变更，用规范文件描述顶层大文件夹的职责边界。
- 为 `agent`、`docs`、`knowledge`、`locus_unity`、`prompt`、`public`、`scripts`、`src`、`src-tauri`、`third_party`、`tools` 建立原子级别作用分析。
- 补充一份设计文档，统一分析表达格式，固定为“目录职责 + 原子单元 + 输入输出 + 依赖关系”。
- 增加任务清单，使该分析可以被后续归档为正式规格基线。

## Capabilities

### New Capabilities
- `repository-structure-analysis`: 定义仓库顶层目录及其一级核心子结构的原子职责分析规范。

### Modified Capabilities

## Impact

- 影响 `openspec/` 下的变更提案、规格、设计和任务文件。
- 为后续理解 `src/`、`src-tauri/`、`locus_unity/` 与 `tools/` 的协作关系提供规范入口。
- 不改变运行时代码、构建脚本或发布产物。
