# 项目原子级分析

## 目标

本文档从产品仓库结构视角，对顶层大文件夹及其核心子结构做原子级职责分析。这里的“原子级”不是指源码中的最小函数，而是指在目录结构层面上，不再继续合并抽象、已经可以独立承担一种明确职责的最小单元。

## 顶层协作总览

主执行链路：

`src -> src-tauri -> locus_unity`

- `src` 负责 Vue 前端界面、状态管理与前端服务编排。
- `src-tauri` 负责桌面宿主、Rust 后端能力、工具调度与 Unity 通信。
- `locus_unity` 负责 Unity Editor 侧桥接、嵌入式服务与 Roslyn 执行环境。

代理运行时输入面：

`agent + prompt + knowledge + tools`

- `agent` 提供角色级系统提示词与行为边界。
- `prompt` 提供可复用的独立提示片段。
- `knowledge` 提供可注入的知识载荷。
- `tools` 提供工具调用契约定义。

## `agent`

目录职责：
定义产品内置代理角色的系统提示词、规则、环境提示和配置。

原子单元：
- `agent/dev`：面向工程实现类任务的角色定义。
- `agent/explorer`：面向仓库探索、结构追踪、上下文检索的角色定义。
- `agent/git`：面向版本控制流程的角色定义。
- `agent/knowledge`：面向知识库维护与注入的角色定义。
- `agent/runtime_debugger`：面向运行时诊断和问题排查的角色定义。
- `agent/doc`：面向文档类工作的角色定义。
- `agent/wiki`：面向知识整理和 Wiki 维护的角色定义。
- 每个角色目录中的 `config.json`：角色配置入口。
- 每个角色目录中的 `system.md`：角色主系统提示词。
- 每个角色目录中的 `env.md`：角色环境上下文提示。
- 每个角色目录中的 `rule/`：更细粒度规则集。

输入/输出：
- 输入：产品希望代理遵守的工作方式、规则边界、环境提示。
- 输出：供运行时加载的角色定义与提示词资产。

## `docs`

目录职责：
维护面向用户的人类可读文档站点及其构建辅助内容。

原子单元：
- `docs/overview`：安装、路线图、展示、使用说明等总览类文档。
- `docs/product`：产品能力分区文档。
- `docs/knowledge`：知识系统相关文档。
- `docs/collaboration`：协作流程相关文档。
- `docs/en`：英文文档树。
- `docs/images`：文档站静态图片资源。
- `docs/data`：文档站消费的静态元数据。
- `docs/scripts`：文档专属自动化脚本。

输入/输出：
- 输入：产品功能说明、发布信息、图片资源。
- 输出：站点页面、发布元数据、文档构建输入。

## `knowledge`

目录职责：
保存随产品分发的内置知识库资产，供运行时检索与注入。

运行时语义：
- `Design`：项目设计、方向、需求约束。Agent 后续任务会把这类内容视为需求依据，默认以路径索引方式进入知识结构。
- `Memory`：长期记忆、用户偏好和项目经验。默认由 AI 维护，带显式维护规则；配置为 `full` 的 Memory 会进入 L2 常驻上下文。
- `Skill`：标准流程、SOP 和可复用工作流。除普通知识文档字段外，还可带 `skillEnabled`、`skillSurface`、`commandTrigger` 等技能入口元数据。
- `Reference`：外部资料、官方文档、飞书知识库和外部目录接入内容。通常作为检索资料库使用，不适合大段常驻注入。

注入模式：
- `none`：不直接注入。
- `path`：注入路径或结构索引，Agent 按需使用 `knowledge_read` 读取正文。
- `excerpt`：注入摘要级信息，目录也可通过 summary 或 maintenance rules 提供压缩说明。
- `full`：全文常驻注入，适合少量关键 Memory。
- `rule`：作为 L3 Rules 注入，成为运行期规则。

原子单元：
- `knowledge/skill/builtin/create-skill.md`：创建技能相关知识条目。
- `knowledge/skill/builtin/profiler.md`：性能分析相关知识条目。
- `knowledge/skill/builtin/unity-editor-tooling.md`：Unity Editor 工具相关知识条目。
- `knowledge/skill/builtin/unity-project-setup.md`：Unity 项目初始化相关知识条目。
- `knowledge/skill/builtin/.locus-meta`：知识单元元数据。

输入/输出：
- 输入：需要被代理运行时消费的结构化知识。
- 输出：内置知识对象、技能知识条目、可被 Agent 检索或注入的知识载荷。

## `locus_unity`

目录职责：
维护随桌面应用分发的 Unity 侧嵌入包。

原子单元：
- `locus_unity/Editor/LocusBridge.cs`：桌面端与 Unity 侧的主桥接入口。
- `locus_unity/Editor/LocusBridge.ExecuteCode.cs`：代码执行桥接。
- `locus_unity/Editor/LocusBridge.ReadYaml.cs`：YAML 读取桥接。
- `locus_unity/Editor/LocusBridge.RunStates.cs`：运行状态桥接。
- `locus_unity/Editor/LocusEditorWindow.cs`：Unity Editor 内部 UI 入口。
- `locus_unity/Editor/LocusEmbedHttpServer.cs`：嵌入式 HTTP 服务。
- `locus_unity/Editor/ExecuteCodeAsync`：异步执行辅助模块。
- `locus_unity/Editor/Roslyn`：打包后的 Roslyn 运行时与许可证。
- `locus_unity/package.json`：Unity 包元数据。
- `locus_unity/README.md`：Unity 包说明。

输入/输出：
- 输入：桌面宿主发来的调用请求、Unity Editor 上下文。
- 输出：Unity 侧执行能力、桥接响应、代码执行环境。

## `prompt`

目录职责：
保存可复用但不绑定某一代理角色的独立提示词片段。

原子单元：
- `prompt/commit-message.md`：提交信息生成提示。
- `prompt/plan-reminder.md`：计划提醒提示。

输入/输出：
- 输入：通用提示需求。
- 输出：独立提示模板。

## `public`

目录职责：
保存前端直接分发的静态资源。

原子单元：
- `public/unity-asset-icons`：Unity 资源相关静态图标集合。
- `public/tauri.svg`：静态图标文件。
- `public/vite.svg`：静态图标文件。

输入/输出：
- 输入：前端运行时直接需要的静态文件。
- 输出：无需源码导入、可被直接服务的前端资源。

## `scripts`

目录职责：
维护仓库级构建、打包、运行时准备和发布自动化脚本。

原子单元：
- `scripts/build-locus-roslyn-bundle.mjs`：构建 Roslyn bundle。
- `scripts/build-release-installers.mjs`：构建发布安装包。
- `scripts/generate-third-party-bundle.mjs`：生成第三方许可证 bundle。
- `scripts/prepare-managed-python.mjs`：准备托管 Python 运行时。
- `scripts/prepare-managed-git.mjs`：准备托管 Git 运行时。
- `scripts/run-tauri.mjs`：Tauri 启动包装脚本。
- `scripts/verify-release-version.mjs`：发布版本校验。
- `scripts/chrome-devtools-mcp-wrapper.mjs`：调试或 MCP 相关包装脚本。

输入/输出：
- 输入：构建命令、发布参数、第三方资源。
- 输出：构建产物、准备好的运行时、安装包、许可证 bundle。

## `src`

目录职责：
维护 Vue 前端应用源码。

原子单元：
- `src/components`：界面组件分区。
- `src/components/KnowledgeView.vue`：知识工作区入口，组织知识树、检索设置、注入预览和导入入口。
- `src/components/knowledge/KnowledgeRetrievalPanel.vue`：检索设置面板，展示全文检索、语义检索、embedding 运行时、索引覆盖率和性能指标。
- `src/components/knowledge/KnowledgeInjectionPreviewPanel.vue`：注入预览面板，通过当前选中 Agent 的实际注入项展示知识上下文和规则注入。
- `src/components/knowledge/KnowledgePreview.vue`：知识文档编辑与预览界面，维护摘要、正文、维护规则、注入模式、AI 维护模式和 Skill 元数据。
- `src/components/knowledge/KnowledgeDirectoryPreview.vue`：目录配置界面，维护目录级注入模式、检索规则、继承规则和创建/移动权限。
- `src/composables`：可复用组合式逻辑。
- `src/composables/useKnowledgeState.ts`：知识工作区状态编排，负责文档列表、目录配置、检索、索引状态、外部 Reference 导入和 embedding 设置。
- `src/services`：前端服务层，负责 API/宿主调用/副作用编排。
- `src/services/knowledge.ts`：知识库 Tauri 命令封装，包括 list/read/create/edit/move/delete/query、检索配置、索引重建和 embedding 管理。
- `src/services/agent.ts`：Agent 管理服务，其中 `listAgentInjectedItems` 为知识注入预览提供实际运行时注入项。
- `src/stores`：Pinia 状态管理单元。
- `src/language`：国际化资源。
- `src/assets`：源码导入型资源。
- `src/styles`：样式与视觉基元。
- `src/config`：前端配置辅助。
- `src/__tests__`：前端测试。
- `src/App.vue`：应用根组件。

输入/输出：
- 输入：用户交互、桌面宿主返回数据、配置与资源。
- 输出：前端界面、状态变化、知识库 CRUD 请求、检索配置请求、注入预览请求和外部资料导入请求。

## `src-tauri`

目录职责：
维护 Tauri 桌面宿主和 Rust 后端。

原子单元：
- `src-tauri/src/commands`：Tauri 命令入口层。
- `src-tauri/src/commands/knowledge.rs`：知识库命令入口，处理文档 CRUD、目录配置、`knowledge_query`、全文索引重建、embedding 配置和检索概览。
- `src-tauri/src/commands/session.rs`：会话命令入口，其中 `list_agent_injected_items` 会创建预览用 AgentInstance 来返回实际注入项。
- `src-tauri/src/llm`：模型与流式响应适配层。
- `src-tauri/src/session`：会话状态与持久化。
- `src-tauri/src/tool`：工具实现与调度。
- `src-tauri/src/unity_bridge`：Unity 通信桥接。
- `src-tauri/src/unity_yaml`：Unity YAML 解析与索引。
- `src-tauri/src/unity_csharp`：Unity C# 分析能力。
- `src-tauri/src/knowledge_index`：知识索引能力。
- `src-tauri/src/knowledge_index/mod.rs`：知识索引运行时编排，维护 SQLite catalog、Tantivy 全文索引、embedding manager、检索概览和 hybrid rank fusion。
- `src-tauri/src/knowledge_index/tantivy_index.rs`：全文检索索引实现。
- `src-tauri/src/knowledge_index/embedding.rs`：语义检索运行时和 embedding 配置实现，支持本地模型、远端 endpoint、设备策略和索引回填。
- `src-tauri/src/knowledge_store.rs`：知识库文件存储模型，定义 `Design / Memory / Skill / Reference`、注入模式、目录配置、继承规则、检索能力和 Markdown frontmatter 读写。
- `src-tauri/src/asset_db`：资源扫描与索引。
- `src-tauri/src/vcs`：版本控制能力。
- `src-tauri/src/diff`：差异分析能力。
- `src-tauri/src/merge`：合并能力。
- `src-tauri/src/agent`：代理运行时装配。
- `src-tauri/src/agent/instance`：Agent 实例运行时，构造知识上下文、L2 Memory、L3 Rules，并执行 `knowledge_*` 工具。
- `src-tauri/capabilities`：桌面权限配置。
- `src-tauri/icons`：桌面应用图标。
- `src-tauri/gen`：生成产物。
- `src-tauri/tauri.conf.json`：主宿主配置。
- `src-tauri/Cargo.toml`：Rust 工程清单。
- `src-tauri/build.rs`：Rust 构建编排。

输入/输出：
- 输入：前端命令请求、工作区数据、Unity 项目数据、外部工具调用。
- 输出：宿主能力、工具执行结果、Unity 响应、知识索引状态、Agent 知识注入上下文和会话状态。

## `third_party`

目录职责：
维护需要随仓库或安装包一起分发的第三方二进制与许可证资产。

原子单元：
- `third_party/redistributables/directml-1.15.4`：DirectML 再分发包。
- `third_party/redistributables/onnxruntime-1.23.2`：ONNX Runtime 再分发包。
- `third_party/roslyn-3.8.0`：Roslyn 相关第三方载荷。
- `third_party/spdx`：标准许可证文本。

输入/输出：
- 输入：第三方运行时与许可证源文件。
- 输出：供构建、打包、许可证汇总流程使用的再分发载荷。

## `tools`

目录职责：
定义代理运行时可调用工具的声明式契约。

原子单元：
- `tools/read.json`：文件读取工具契约。
- `tools/write.json`：文件写入工具契约。
- `tools/edit.json`：文件编辑工具契约。
- `tools/list.json`：文件枚举工具契约。
- `tools/grep.json`：文本检索工具契约。
- `tools/knowledge_*.json`：知识库相关工具契约集合。
- `tools/knowledge_query.json`：知识检索工具契约，支持精确词法查询、意图式语义查询、路径前缀过滤和结果数量限制。
- `tools/knowledge_read.json`：按类型前缀路径读取知识文档。
- `tools/knowledge_list.json`：按类型前缀目录浏览知识条目。
- `tools/knowledge_create.json`、`tools/knowledge_edit.json`、`tools/knowledge_move.json`、`tools/knowledge_delete.json`：知识库写操作契约，写入前会进入 Agent 侧确认预览和治理判断。
- `tools/unity_*.json`：Unity 相关工具契约集合。
- `tools/bash.json`：命令执行工具契约。
- `tools/canvas.json`：画布工具契约。
- `tools/webfetch.json`：网页抓取工具契约。
- `tools/task.md`：子代理任务说明模板。

输入/输出：
- 输入：运行时工具调用需求。
- 输出：声明式工具模式，供宿主层解析、校验与分发；知识工具进一步连接知识存储、检索索引和 Agent 上下文维护流程。
