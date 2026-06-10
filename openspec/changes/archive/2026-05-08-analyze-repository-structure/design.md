## Overview

本变更不是修改业务代码，而是为仓库结构建立一份可验证、可归档的 OpenSpec 分析基线。分析对象限定为仓库顶层的大文件夹，以及每个大文件夹下最能代表职责分层的一级或少量二级结构。

## Analysis Model

每个目录使用同一套表达结构：

1. `目录职责`：这个目录在整个仓库中的存在意义。
2. `原子单元`：该目录下不可再继续抽象的最小职责块，通常是一级子目录、单一配置文件集合或单一资源集合。
3. `输入/输出`：该目录主要消费什么、产出什么。
4. `依赖关系`：该目录与其他顶层目录之间如何协作。

## Scope

纳入分析的顶层目录：

- `agent`
- `docs`
- `knowledge`
- `locus_unity`
- `prompt`
- `public`
- `scripts`
- `src`
- `src-tauri`
- `third_party`
- `tools`

不纳入本次分析的目录：

- `.git`
- `.ace-tool`
- `.codex`
- `openspec`

这些目录属于版本控制、代理运行时或本次规范本身，不属于产品仓库功能结构。

## Output Strategy

实际分析内容落在 `specs/repository-structure-analysis/spec.md` 中，以 requirement 的方式固定下来。这样后续归档后，主规格即可直接作为仓库结构知识基线使用，而不是分散在额外笔记里。
