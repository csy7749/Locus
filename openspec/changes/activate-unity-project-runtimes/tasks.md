## 1. Backend Runtime Model

- [x] 1.1 Add Unity project registry types for registered lightweight status and optional activated runtime state.
- [x] 1.2 Add stable workspace id resolution for registered Unity projects using existing workspace config behavior.
- [ ] 1.3 Move project-scoped runtime state ownership into activated runtime entries, including asset DB state, preview cache, scan phase, watchers, plugin status, and Unity monitor handle.
- [x] 1.4 Add explicit lifecycle helpers to activate, get, and deactivate project runtimes by workspace id.

## 2. Backend Commands And Events

- [x] 2.1 Add Tauri commands to list registered Unity projects, register/open a project, activate a project, deactivate a project, and select the active UI project.
- [x] 2.2 Preserve existing `get_working_dir` and `set_working_dir` commands through active UI project compatibility wrappers.
- [x] 2.3 Route Unity monitor startup and shutdown per activated project instead of through one global monitor handle.
- [x] 2.4 Add `workspaceId` and `projectPath` to Unity status, plugin status, asset scan, and other project-scoped event payloads.
- [x] 2.5 Ensure project deactivation returns an explicit error when active session runs exist and leaves the runtime intact.

## 3. Session And Tool Routing

- [x] 3.1 Update session creation and listing commands to accept or resolve an explicit workspace id.
- [x] 3.2 Resolve session execution context from `sessionId -> workspaceId -> activated runtime` before launching agent work.
- [x] 3.3 Return explicit inactive-project errors when creating or executing sessions for registered projects without activated runtimes.
- [x] 3.4 Update Unity built-in tool context so `unity_execute`, `unity_run_states`, `unity_recompile`, capture, and intercepted Unity tools use the session-bound project path.
- [x] 3.5 Add guards that prevent active UI project selection changes from affecting already running session contexts.

## 4. Frontend State And UI

- [x] 4.1 Replace single-project runtime fields in the project store with a map of Unity project statuses keyed by workspace id.
- [x] 4.2 Add active UI project selection state that is separate from project activation state.
- [x] 4.3 Add a Unity project status center UI showing registered projects, editor state, bridge state, editor status, activation state, and activation/deactivation controls.
- [x] 4.4 Route project-scoped events by workspace id so one project's status does not overwrite another project's state.
- [x] 4.5 Update chat, asset, knowledge, plugin, and Unity status surfaces to read from the selected project's state.
- [x] 4.6 Disable new session creation and execution actions for inactive projects while keeping persisted session history discoverable after activation.
- [x] 4.7 Add a display setting for session list scope with `activeProject` as the default.
- [x] 4.8 Support all-project session listing without switching the active UI project when a session from another project is selected.
- [x] 4.9 Show project names on session rows in all-project mode.
- [x] 4.10 Disable chat input for sessions whose owning project is registered but inactive.

## 5. Unity Embed And Project-Scoped Windows

- [x] 5.1 Include workspace id or project runtime identity in Unity embed window open requests and labels.
- [x] 5.2 Route Unity embed drag/drop, frontend window open, focus debug, and asset inspector actions to the correct project runtime.
- [x] 5.3 Ensure selecting another UI project does not close or rebind existing Unity embed windows for activated projects.

## 6. Tests And Validation

- [x] 6.1 Add Rust tests for registry activation idempotency, deactivation cleanup, and deactivation refusal with active sessions.
- [x] 6.2 Add Rust tests that session execution resolves the project path from the session workspace id rather than active UI state.
- [x] 6.3 Add frontend store tests for multiple project statuses, activation state, active UI project selection, and event routing.
- [x] 6.4 Add UI/component tests for inactive project display, activation controls, and disabled session actions.
- [x] 6.5 Add tests for active-project versus all-project session list scope, selection persistence, project labels, and inactive-project input disabling.
- [ ] 6.6 Run `bun run test` for frontend coverage.
- [ ] 6.7 Run `cargo test --manifest-path src-tauri/Cargo.toml` with the repository's 60 second backend test timeout policy.
