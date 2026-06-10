## ADDED Requirements

### Requirement: Registered Unity projects remain lightweight until activated
The system SHALL track registered Unity projects separately from activated Unity project runtimes.

#### Scenario: Connected project is not activated
- **WHEN** a registered Unity project has a running Unity Editor process and a connected Locus Unity bridge
- **THEN** the system records lightweight project status without loading asset DB state, knowledge index state, project watchers, preview caches, or session runtime data for that project

#### Scenario: Project status includes activation state
- **WHEN** the frontend lists Unity project statuses
- **THEN** each project status includes its workspace id, project path, editor process state, bridge connection state, editor status, and activated state

### Requirement: Project activation creates a project-scoped runtime
The system SHALL create a project-scoped runtime only when the user activates a registered Unity project.

#### Scenario: Activating a registered project
- **WHEN** the user activates a registered Unity project
- **THEN** the system loads runtime state for that project's asset DB, scan status, knowledge index, project watchers, plugin status, Unity monitor, project caches, and session list

#### Scenario: Activation is idempotent
- **WHEN** the user activates a Unity project that is already activated
- **THEN** the system returns the existing activated runtime status without duplicating watchers, monitors, or caches

### Requirement: Project deactivation releases heavy runtime data
The system SHALL release project-scoped runtime data when the user deactivates an activated Unity project.

#### Scenario: Deactivating an idle project
- **WHEN** the user deactivates an activated Unity project with no active session runs
- **THEN** the system stops that project's asset watcher, knowledge watcher, Unity monitor, scan tasks, and runtime caches while keeping the registered project status available

#### Scenario: Deactivation does not close Unity Editor
- **WHEN** the user deactivates an activated Unity project
- **THEN** the system does not close the Unity Editor process and does not require disconnecting the Locus Unity bridge

#### Scenario: Deactivation refuses active session runs
- **WHEN** the user deactivates a Unity project that has running, queued, starting, waiting input, finishing, or cancelling session runs
- **THEN** the system returns an explicit error and leaves the project activated

### Requirement: Sessions require an activated project runtime
The system SHALL bind every Unity project session to a workspace id and require an activated runtime for session creation and execution.

#### Scenario: Creating a session for an activated project
- **WHEN** the user creates a new chat session for an activated Unity project
- **THEN** the session is persisted with that project's workspace id

#### Scenario: Creating a session for an inactive project
- **WHEN** the user attempts to create a chat session for a registered but inactive Unity project
- **THEN** the system returns an explicit inactive-project error and does not create the session

#### Scenario: Running an existing session after project deactivation
- **WHEN** a persisted session belongs to a registered Unity project that is not activated
- **THEN** the system allows the session history to remain persisted but refuses new execution until the project is activated again

### Requirement: Session tool context resolves by session workspace
The system SHALL resolve Unity tool execution and project-scoped file operations from the session's workspace id rather than the active UI project.

#### Scenario: UI selection changes during a running session
- **WHEN** a session for project A is running and the user selects project B in the UI
- **THEN** Unity tools and project-scoped file operations for the running session continue to use project A

#### Scenario: Unity tool executes for the bound project
- **WHEN** a session-bound Unity tool call executes
- **THEN** the tool context resolves the project path from the session workspace id and sends the request to that project's Unity bridge

### Requirement: Project-scoped events identify their project
The system SHALL include project identity in project-scoped runtime events.

#### Scenario: Unity status event is emitted
- **WHEN** a Unity connection status update is emitted for a registered or activated project
- **THEN** the event payload includes workspace id and project path so the frontend updates only that project's status

#### Scenario: Asset scan event is emitted
- **WHEN** an asset scan or reconcile event is emitted for an activated project
- **THEN** the event payload includes workspace id and project path so scan state is not applied to another project

### Requirement: Active UI project is display focus only
The system SHALL distinguish the active UI project selection from activated project runtimes.

#### Scenario: Selecting an inactive project
- **WHEN** the user selects a registered but inactive Unity project in the UI
- **THEN** the UI displays lightweight status and activation controls without loading heavy runtime data

#### Scenario: Selecting another project does not deactivate current runtime
- **WHEN** the user changes the active UI project selection from project A to project B
- **THEN** project A remains activated until the user explicitly deactivates it

### Requirement: Session list scope is user configurable
The system SHALL let users choose whether the left session list follows the active UI project or shows all project sessions.

#### Scenario: Session list follows the active UI project
- **WHEN** the session list scope is set to follow the active project
- **THEN** the left session list shows sessions for the active UI project's workspace id
- **AND** the last selected session is remembered separately for each project

#### Scenario: Session list shows all project sessions
- **WHEN** the session list scope is set to show all sessions
- **THEN** the left session list shows sessions from all workspace ids sorted by most recent update time
- **AND** each listed session shows the owning project name
- **AND** the last selected session is remembered separately for the all-projects scope

#### Scenario: Selecting a session from another project
- **WHEN** the session list shows all project sessions and the user selects a session owned by project B while project A is the active UI project
- **THEN** the system opens the selected session without switching the active UI project
- **AND** future new sessions are still created for project A until the user explicitly selects another active UI project

#### Scenario: Opened session belongs to an inactive project
- **WHEN** the user opens a persisted session whose workspace id belongs to a registered but inactive project
- **THEN** the transcript remains readable
- **AND** the chat input is disabled with an explicit inactive-project message
