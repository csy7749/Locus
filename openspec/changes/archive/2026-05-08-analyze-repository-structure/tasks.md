## 1. OpenSpec 骨架

- [x] 1.1 初始化仓库内的 OpenSpec 工作目录
- [x] 1.2 创建 `analyze-repository-structure` 变更目录
- [x] 1.3 确认 proposal、specs、design、tasks 的模板约束

## 2. 仓库结构调研

- [x] 2.1 采集仓库顶层目录列表
- [x] 2.2 采集各顶层目录的一级核心子结构
- [x] 2.3 读取关键入口文件以确认目录职责边界

## 3. 规格落盘

- [x] 3.1 编写 proposal，说明为何需要仓库结构分析
- [x] 3.2 编写 design，定义统一的分析表达模型
- [x] 3.3 编写 `repository-structure-analysis` 规格，覆盖 11 个顶层目录

## 4. 校验

- [x] 4.1 运行 `openspec validate analyze-repository-structure --strict`
- [x] 4.2 根据校验结果修正规格格式
