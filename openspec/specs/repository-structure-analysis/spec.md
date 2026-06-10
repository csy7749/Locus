# repository-structure-analysis Specification

## Purpose
Define the responsibility boundaries of the repository's top-level folders and their core substructures, forming a verifiable, archivable, reusable structural baseline that helps developers and agents decide where functionality belongs, how dependencies flow, and which folders own runtime code, assets, knowledge, tool contracts, and release payloads.

## Requirements
### Requirement: Top-level repository folders SHALL have explicit bounded responsibilities
The repository SHALL define explicit bounded responsibilities for each top-level product folder so that developers and agents can determine where frontend UI, desktop host logic, Unity integration, generated resources, packaging assets, reusable prompts, knowledge artifacts, and tool contracts belong.

#### Scenario: Top-level folder map is enumerated
- **WHEN** the repository structure baseline is reviewed
- **THEN** it MUST enumerate `agent`, `docs`, `knowledge`, `locus_unity`, `prompt`, `public`, `scripts`, `src`, `src-tauri`, `third_party`, and `tools`

#### Scenario: Non-product folders are excluded
- **WHEN** the baseline describes repository responsibilities
- **THEN** it MUST exclude runtime or control folders such as `.git`, `.ace-tool`, `.codex`, and `openspec` from the product structure analysis

### Requirement: The `agent` folder SHALL define agent persona and routing assets
The `agent` folder SHALL be treated as the prompt-and-policy source for internal agent roles used by the product runtime. Its atomic units are role folders such as `dev`, `explorer`, `git`, `knowledge`, `runtime_debugger`, `doc`, and `wiki`, where each role folder owns config files, environment hints, system prompts, and optional rule sets.

#### Scenario: Agent role unit is identified
- **WHEN** `agent/dev`, `agent/explorer`, or `agent/runtime_debugger` is inspected
- **THEN** the analysis MUST describe each role folder as a self-contained agent definition unit composed of `config.json`, `system.md`, optional `env.md`, and optional `rule/` assets

#### Scenario: Agent folder boundary is clarified
- **WHEN** `agent` is compared with `prompt` and `tools`
- **THEN** the analysis MUST state that `agent` defines role behavior and policy, while `prompt` stores reusable free-form prompt snippets and `tools` stores callable tool schemas

### Requirement: The `docs` folder SHALL define the documentation site source tree
The `docs` folder SHALL be treated as the documentation site workspace. Its atomic units are content sections such as `overview`, `product`, `knowledge`, `collaboration`, localized trees such as `en/`, asset buckets such as `images/`, release metadata under `data/`, and documentation-side automation under `docs/scripts/`.

#### Scenario: Documentation content partitions are identified
- **WHEN** `docs/overview`, `docs/product`, or `docs/en` is inspected
- **THEN** the analysis MUST describe them as content partitions for product explanation, feature guides, and localized site structure

#### Scenario: Documentation pipeline support is identified
- **WHEN** `docs/scripts` and `docs/data` are inspected
- **THEN** the analysis MUST describe them as atomic support units for release note generation, manifest generation, and static metadata feeding the docs site

### Requirement: The `knowledge` folder SHALL define built-in knowledge payloads
The `knowledge` folder SHALL be treated as the seed knowledge base packaged with the product. Its atomic units are skill bundles, with `knowledge/skill/builtin` acting as the built-in skill library and each markdown skill file serving as one independently injectable knowledge object.

#### Scenario: Built-in skills are treated as atomic knowledge units
- **WHEN** files such as `create-skill.md`, `profiler.md`, or `unity-project-setup.md` are inspected
- **THEN** the analysis MUST describe each file as an independently addressable built-in knowledge payload rather than general prose documentation

#### Scenario: Knowledge boundary is clarified
- **WHEN** `knowledge` is compared with `docs`
- **THEN** the analysis MUST state that `knowledge` exists for runtime retrieval and agent injection, while `docs` exists for human-facing documentation publishing

### Requirement: The `locus_unity` folder SHALL define the embedded Unity package
The `locus_unity` folder SHALL be treated as the Unity-side integration package distributed with the desktop app. Its atomic units are the `Editor/` bridge code, the `ExecuteCodeAsync/` execution helper, the merged Roslyn payload under `Editor/Roslyn/`, and package metadata files such as `package.json`, `README.md`, and `CHANGELOG.md`.

#### Scenario: Unity bridge units are identified
- **WHEN** `LocusBridge.cs`, `LocusEditorWindow.cs`, or `LocusEmbedHttpServer.cs` are inspected
- **THEN** the analysis MUST describe them as Unity Editor bridge endpoints, editor UI entrypoints, and embedded transport/server units

#### Scenario: Bundled compiler payload is identified
- **WHEN** `locus_unity/Editor/Roslyn` is inspected
- **THEN** the analysis MUST describe it as the packaged Roslyn runtime and license payload consumed by Unity-side code execution features

### Requirement: The `prompt` folder SHALL define reusable standalone prompt snippets
The `prompt` folder SHALL be treated as a lightweight prompt asset library. Its atomic units are single markdown prompt files such as `commit-message.md` and `plan-reminder.md`, each representing one reusable human-or-agent instruction snippet.

#### Scenario: Prompt files are treated as single-purpose assets
- **WHEN** a file inside `prompt/` is inspected
- **THEN** the analysis MUST describe it as a standalone reusable prompt template rather than a full agent definition

#### Scenario: Prompt boundary is clarified
- **WHEN** `prompt` is compared with `agent`
- **THEN** the analysis MUST state that `prompt` contains ad hoc reusable prompt text, while `agent` contains structured role definitions for runtime agents

### Requirement: The `public` folder SHALL define static frontend assets
The `public` folder SHALL be treated as the raw static asset root for the Vite frontend. Its atomic units are direct static files such as `tauri.svg` and `vite.svg`, plus static asset collections such as `unity-asset-icons/`.

#### Scenario: Static asset role is identified
- **WHEN** `public/` is inspected
- **THEN** the analysis MUST describe it as pass-through static content served or bundled without frontend compilation logic

#### Scenario: Public boundary is clarified
- **WHEN** `public` is compared with `src/assets`
- **THEN** the analysis MUST state that `public` stores directly served files, while `src/assets` stores source-side assets imported by frontend code

### Requirement: The `scripts` folder SHALL define repository-level automation entrypoints
The `scripts` folder SHALL be treated as repository automation for build, packaging, runtime preparation, and release validation. Its atomic units are standalone Node or Bun scripts such as Roslyn bundling, managed Python preparation, managed Git preparation, license bundle generation, Tauri launch wrapping, installer builds, and version verification.

#### Scenario: Build and packaging scripts are partitioned
- **WHEN** `build-locus-roslyn-bundle.mjs`, `prepare-managed-python.mjs`, or `build-release-installers.mjs` is inspected
- **THEN** the analysis MUST describe each script as a single-purpose automation entrypoint in the release toolchain

#### Scenario: Script boundary is clarified
- **WHEN** `scripts` is compared with `docs/scripts`
- **THEN** the analysis MUST state that root `scripts` automates repository and product packaging workflows, while `docs/scripts` automates documentation-specific workflows

### Requirement: The `src` folder SHALL define the Vue frontend application
The `src` folder SHALL be treated as the frontend source tree. Its atomic units are UI component slices under `components/`, reusable runtime logic under `composables/`, application service adapters under `services/`, Pinia state units under `stores/`, i18n resources under `language/`, imported assets under `assets/`, visual design tokens under `styles/`, config helpers under `config/`, and frontend tests under `__tests__/`.

#### Scenario: Frontend layering is identified
- **WHEN** `components`, `composables`, `services`, and `stores` are inspected
- **THEN** the analysis MUST describe them respectively as view composition, reusable view logic, side-effect or API integration, and application state units

#### Scenario: Frontend support units are identified
- **WHEN** `language`, `styles`, `assets`, `config`, or `__tests__` is inspected
- **THEN** the analysis MUST describe them as localization payloads, styling primitives, imported source assets, frontend configuration helpers, and verification assets

### Requirement: The `src-tauri` folder SHALL define the desktop host and Rust backend
The `src-tauri` folder SHALL be treated as the Tauri desktop host workspace. Its atomic units are Rust subsystems under `src/`, capability permissions under `capabilities/`, bundle and build configuration files such as `Cargo.toml` and `tauri.conf.json`, generated artifacts under `gen/`, and application icons under `icons/`.

#### Scenario: Rust subsystem slices are identified
- **WHEN** `src-tauri/src` is inspected
- **THEN** the analysis MUST describe `commands`, `llm`, `session`, `tool`, `unity_bridge`, `unity_yaml`, `unity_csharp`, `knowledge_index`, `asset_db`, `vcs`, `diff`, `merge`, and `agent` as distinct backend capability slices

#### Scenario: Host configuration units are identified
- **WHEN** `capabilities`, `tauri.conf.json`, or `build.rs` is inspected
- **THEN** the analysis MUST describe them as desktop permission policy, bundle/resource wiring, and Rust build orchestration units

### Requirement: The `third_party` folder SHALL define vendored redistribution payloads
The `third_party` folder SHALL be treated as the repository’s vendored third-party dependency payload area. Its atomic units are redistributable runtime bundles under `redistributables/`, Roslyn source/binary payloads under `roslyn-3.8.0/`, and canonical license text files under `spdx/`.

#### Scenario: Redistributable payloads are identified
- **WHEN** `third_party/redistributables` is inspected
- **THEN** the analysis MUST describe it as vendor payload storage for packaged runtimes such as DirectML and ONNX Runtime plus their notices

#### Scenario: License source role is identified
- **WHEN** `third_party/spdx` is inspected
- **THEN** the analysis MUST describe it as a canonical local license-text source used by packaging and notice generation workflows

### Requirement: The `tools` folder SHALL define tool invocation contracts
The `tools` folder SHALL be treated as the schema registry for built-in tool calls exposed to the agent runtime. Its atomic units are one-schema-per-tool JSON files, where each file defines one callable contract such as file IO, knowledge operations, Unity operations, search, web fetch, task delegation, or canvas manipulation.

#### Scenario: Tool schema units are identified
- **WHEN** files such as `read.json`, `edit.json`, `knowledge_query.json`, or `unity_yaml_search.json` are inspected
- **THEN** the analysis MUST describe each JSON file as a standalone tool contract rather than generic configuration

#### Scenario: Tool boundary is clarified
- **WHEN** `tools` is compared with `src-tauri/src/tool`
- **THEN** the analysis MUST state that `tools` stores declarative tool schemas, while `src-tauri/src/tool` stores the Rust-side implementation and dispatch logic for those tools

### Requirement: The structure baseline SHALL describe cross-folder collaboration paths
The repository structure baseline SHALL explain how the major folders collaborate across the product flow instead of treating each folder as isolated.

#### Scenario: Frontend to host to Unity path is described
- **WHEN** the main execution path is summarized
- **THEN** the analysis MUST describe the path `src -> src-tauri -> locus_unity` as the primary desktop-to-Unity interaction chain

#### Scenario: Prompt and knowledge injection path is described
- **WHEN** agent behavior inputs are summarized
- **THEN** the analysis MUST describe the path `agent + prompt + knowledge + tools` as the composite runtime input surface for agent behavior, guidance, and callable abilities
