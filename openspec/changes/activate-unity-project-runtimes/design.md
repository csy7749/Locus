## Context

Locus currently has a single selected workspace path and a single Unity monitor handle. Many lower-level Unity bridge operations already accept a project path and route by pipe/project key, but the application state above that layer assumes one active project for asset DB state, watchers, knowledge indexing, plugin status, Unity status, session lists, and agent tool context.

The new model separates project discovery from project activation. A registered Unity project can be known to Locus, have a running Unity Editor process, and have a connected Unity bridge while still remaining inactive in Locus. Inactive projects keep only lightweight status in memory. Activated projects own the memory-heavy runtime data required for sessions, asset indexing, knowledge indexing, watchers, and Unity-bound tools.

## Goals / Non-Goals

**Goals:**
- Represent multiple Unity projects in Locus at the same time without requiring all of them to load heavy runtime state.
- Let users explicitly activate and deactivate Unity projects.
- Load project-scoped asset, knowledge, session, Unity monitor, cache, and watcher state only for activated projects.
- Bind sessions and tool execution to the project runtime associated with the session workspace id.
- Preserve a compatibility path for the existing single-workspace UI and commands while migrating to explicit workspace routing.

**Non-Goals:**
- Automatically activating every Unity Editor process that is detected.
- Closing Unity Editor or disconnecting the Unity plugin when a project is deactivated.
- Replacing the existing session database schema unless a migration is required for explicit workspace routing.
- Adding fake or fallback session execution for inactive projects.

## Decisions

1. Introduce a Unity project registry with lightweight and activated states.

   The backend will hold a `UnityProjectRegistry` keyed by stable `workspaceId`. Each entry stores canonical project path, display name, lightweight Unity status, and optional activated runtime. This avoids multiplying global singleton state while making inactive projects cheap to track.

   Alternative considered: keep a single `Workspace` and add a `chatEnabled` flag. That would not solve memory ownership, because the asset DB, knowledge watcher, Unity monitor, and caches would still be global.

2. Activation creates an explicit project runtime.

   Activation creates an `ActivatedUnityProjectRuntime` that owns project-scoped state such as asset DB, scan phase, preview cache, asset watcher, knowledge watcher/index handle, plugin status, Unity monitor handle, session selection, and runtime generation. Deactivation tears down this runtime and leaves a lightweight registry entry behind.

   Alternative considered: lazily loading each subsystem on first use. That makes memory behavior harder to reason about and risks accidentally loading project data when only status polling was intended.

3. Session execution resolves `sessionId -> workspaceId -> activated runtime`.

   Session creation and execution will use an explicit workspace id. Existing sessions already store `workspace_id`, so the runtime can resolve the correct project path from the session record before running tools. If the project is inactive, execution returns an explicit error.

   Alternative considered: using the currently selected UI project for execution. That is unsafe for parallel projects because switching the UI could redirect `unity_execute` or file operations to the wrong project.

4. Events include project identity.

   Unity connection status, plugin status, asset scan progress, knowledge changes, session content changes, and Unity embed events that are project scoped will include `workspaceId` and `projectPath`. The frontend will update the matching project state instead of overwriting a single global project store.

   Alternative considered: using separate event names per project. That complicates subscription management and makes dynamic project lists harder to maintain.

5. Deactivation is explicit and refuses to orphan active work.

   Deactivation will fail with an explicit error when the project has running, queued, waiting, finishing, or cancelling sessions. The UI can ask the user to cancel sessions first. This preserves visible failure instead of silently dropping in-memory work.

   Alternative considered: auto-cancelling sessions during deactivation. That is convenient but too surprising for long-running agent work.

6. Session list scope is a display/query preference, not a runtime binding.

   The left session list will support `activeProject` and `allProjects` modes. `activeProject` preserves the existing behavior: list sessions for the active UI project and restore the last selection for that project. `allProjects` explicitly queries all sessions, sorts them by recent update time, shows each session's project name, and restores a separate global selection. Selecting a session for another project does not switch the active UI project. Creating a new session always uses the active UI project's workspace id.

   Session execution remains bound to the session's own `workspaceId`. If an opened session belongs to a registered project that is not activated, the transcript remains readable but the input is disabled with an explicit inactive-project message.

   Alternative considered: automatically switching the active UI project when a session from another project is selected. That makes session history navigation mutate the project workspace and risks surprising asset, knowledge, and Unity status changes.

## Risks / Trade-offs

- [Risk] The migration touches many modules that currently read `workspace.path`.
  -> Mitigation: keep compatibility commands that operate on the active UI project while progressively moving internals to explicit `workspaceId` resolution.

- [Risk] Some event handlers may accidentally keep using global state.
  -> Mitigation: add typed project-scoped event payloads and tests that events for one workspace do not update another workspace.

- [Risk] Deactivation can leave stale UI selections if the active UI project is deactivated.
  -> Mitigation: clear or switch active UI selection after runtime teardown and make inactive project detail pages read-only except for activation.

- [Risk] Multiple activated project runtimes increase memory use.
  -> Mitigation: activation is user-controlled, status-only projects stay lightweight, and deactivation releases watchers, caches, and indexes.

## Migration Plan

1. Add registry types and commands while preserving existing `get_working_dir` and `set_working_dir` behavior through an active UI project.
2. Move Unity monitor ownership into activated project runtimes and add `workspaceId/projectPath` to emitted status payloads.
3. Move asset DB, knowledge watcher, preview cache, and scan state behind runtime lookup.
4. Update session commands and agent runtime context to resolve workspace from the session record.
5. Update frontend stores to track a map of Unity projects and route events by workspace id.
6. Convert UI surfaces to use active UI project state while allowing multiple registered projects.
7. Add session list scope settings and explicit all-project session listing.
8. Remove obsolete compatibility paths only after all callers use explicit project/runtime routing.

Rollback is to keep the compatibility single-active-project commands operational until the new project status center is fully wired. If a later phase fails, the app can still operate through the active UI project path.

## Open Questions

- Should registered projects persist in global app config, recent directories, or a new Unity project registry file?
- Should activation survive app restart, or should every app start restore registered projects as inactive until the user activates them?
- Should deactivation support an explicit `cancelRunningSessions` option, or should cancellation remain a separate user action?
