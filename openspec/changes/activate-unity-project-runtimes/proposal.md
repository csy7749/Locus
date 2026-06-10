## Why

Locus currently treats the selected Unity project as a single global workspace, so switching projects stops or replaces project-scoped runtime state even when multiple Unity Editors are open and connected. Users need to keep several Unity projects visible to Locus while only loading memory-heavy data for projects they explicitly activate.

## What Changes

- Add a Unity project status center that tracks registered Unity projects separately from activated project runtimes.
- Track lightweight status for registered projects, including project path, workspace id, editor process state, bridge connection state, editor status, and last seen time.
- Add explicit activation and deactivation for Unity projects. Activation loads project-scoped runtime data into memory; deactivation releases watchers, caches, indexes, and active UI/session state without closing Unity Editor.
- Bind sessions and Unity tool execution to the activated project runtime for their `workspaceId`, not to whichever project is currently selected in the UI.
- Prevent new sessions and resumed session execution for inactive projects while keeping persisted session history available after reactivation.
- Add a user setting for whether the left session list follows the active UI project or shows all project sessions while keeping new sessions bound to the active UI project.
- Preserve compatibility for the existing single-workspace commands through an active UI project selection layer during migration.

## Capabilities

### New Capabilities
- `unity-project-runtime-activation`: Tracks registered Unity projects and controls which projects are activated in Locus memory.

### Modified Capabilities
- None.

## Impact

- Backend workspace state changes from one global `Workspace` and one Unity monitor handle to a registry of registered projects and activated project runtimes.
- Tauri commands for Unity status, project activation, sessions, asset DB, knowledge indexing, and Unity embed routing need explicit `workspaceId` or project runtime resolution.
- Frontend project state changes from a single `workingDir` store to a map of Unity project statuses plus an active UI project selection.
- Session APIs and agent runtime context must resolve `sessionId -> workspaceId -> projectPath` before executing tools.
- Session list APIs must distinguish explicit all-project listing from legacy active-project fallback.
- Existing UI surfaces that show Unity connection, plugin status, scan progress, sessions, and embedded Unity windows must route events by `workspaceId`.
