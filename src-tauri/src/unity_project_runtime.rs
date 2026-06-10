use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex as StdMutex, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::asset_db::AssetDbState;
use crate::commands::asset::{
    AssetDbReconcileTaskState, LastScanInfoState, ScanPhaseState, WorkspacePreviewCache,
};
use crate::commands::{DirEntriesPageCache, RefGraphScanTaskState};
use crate::error::AppError;
use crate::unity_bridge::{UnityConnectionStatus, UnityEditorProcessState, UnityMonitorHandle};
use crate::{AssetDbWatcherHandle, KnowledgeFsWatcherHandle};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnityProjectStatus {
    pub workspace_id: String,
    pub project_path: String,
    pub name: String,
    pub activated: bool,
    pub editor_open: bool,
    pub bridge_connected: bool,
    pub editor_status: String,
    pub editor_process_state: UnityEditorProcessState,
    pub last_seen_at_ms: u64,
    pub connection_status: UnityConnectionStatus,
}

struct RegisteredUnityProject {
    workspace_id: String,
    project_path: String,
    name: String,
    last_seen_at_ms: u64,
    activated_runtime: Option<Arc<ActivatedUnityProjectRuntime>>,
}

struct RegisteredUnityProjectSnapshot {
    workspace_id: String,
    project_path: String,
    name: String,
    last_seen_at_ms: u64,
    activated: bool,
}

pub struct ActivatedUnityProjectRuntime {
    pub workspace_id: String,
    pub project_path: String,
    pub generation: crate::workspace::Workspace,
    pub unity_monitor: UnityMonitorHandle,
    pub ref_graph_state: AssetDbState,
    pub watcher_handle: AssetDbWatcherHandle,
    pub knowledge_watcher_handle: KnowledgeFsWatcherHandle,
    pub scan_task_state: RefGraphScanTaskState,
    pub reconcile_task_state: AssetDbReconcileTaskState,
    pub last_scan_info: LastScanInfoState,
    pub scan_phase_state: ScanPhaseState,
    pub preview_cache: WorkspacePreviewCache,
    pub dir_entries_cache: DirEntriesPageCache,
}

impl ActivatedUnityProjectRuntime {
    fn new(workspace_id: String, project_path: String) -> Self {
        Self {
            generation: crate::workspace::Workspace::new(
                project_path.clone(),
                Some(workspace_id.clone()),
            ),
            workspace_id,
            project_path,
            unity_monitor: Arc::new(tokio::sync::Mutex::new(None)),
            ref_graph_state: AssetDbState(Arc::new(StdMutex::new(None))),
            watcher_handle: Arc::new(StdMutex::new(None)),
            knowledge_watcher_handle: Arc::new(StdMutex::new(None)),
            scan_task_state: RefGraphScanTaskState::new(),
            reconcile_task_state: AssetDbReconcileTaskState::new(),
            last_scan_info: LastScanInfoState::new(),
            scan_phase_state: ScanPhaseState::new(),
            preview_cache: WorkspacePreviewCache::new(),
            dir_entries_cache: DirEntriesPageCache::new(),
        }
    }

    async fn stop(&self) {
        self.scan_task_state
            .cancel_current_and_wait("Unity project runtime deactivation");
        self.reconcile_task_state
            .cancel_current("Unity project runtime deactivation");
        stop_asset_watcher(&self.watcher_handle);
        stop_knowledge_watcher(&self.knowledge_watcher_handle);
        crate::unity_bridge::stop_unity_monitor(&self.unity_monitor).await;
        clear_runtime_caches(self);
    }
}

#[derive(Default)]
struct UnityProjectRegistryInner {
    projects: HashMap<String, RegisteredUnityProject>,
    active_ui_workspace_id: Option<String>,
}

#[derive(Default)]
pub struct UnityProjectRegistry {
    inner: RwLock<UnityProjectRegistryInner>,
}

impl UnityProjectRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_project(&self, project_path: &str) -> Result<String, AppError> {
        let identity = resolve_project_identity(project_path)?;
        let mut inner = self.write_inner()?;
        inner
            .projects
            .entry(identity.workspace_id.clone())
            .and_modify(|entry| {
                entry.project_path = identity.project_path.clone();
                entry.name = identity.name.clone();
                entry.last_seen_at_ms = unix_now_ms();
            })
            .or_insert_with(|| RegisteredUnityProject {
                workspace_id: identity.workspace_id.clone(),
                project_path: identity.project_path,
                name: identity.name,
                last_seen_at_ms: unix_now_ms(),
                activated_runtime: None,
            });
        Ok(identity.workspace_id)
    }

    pub fn activate_project(&self, workspace_id: &str) -> Result<bool, AppError> {
        let mut inner = self.write_inner()?;
        let entry = inner.projects.get_mut(workspace_id).ok_or_else(|| {
            AppError::new(
                "unity_project.not_registered",
                "Unity project is not registered in Locus.",
            )
            .detail(workspace_id.to_string())
        })?;
        if entry.activated_runtime.is_none() {
            entry.activated_runtime = Some(Arc::new(ActivatedUnityProjectRuntime::new(
                entry.workspace_id.clone(),
                entry.project_path.clone(),
            )));
            return Ok(true);
        }
        Ok(false)
    }

    pub async fn deactivate_project(&self, workspace_id: &str) -> Result<(), AppError> {
        let runtime = self.take_runtime(workspace_id)?;
        if let Some(runtime) = runtime {
            runtime.stop().await;
        }
        Ok(())
    }

    pub fn select_active_ui_project(&self, workspace_id: Option<&str>) -> Result<(), AppError> {
        let mut inner = self.write_inner()?;
        match workspace_id.map(str::trim).filter(|value| !value.is_empty()) {
            Some(id) if inner.projects.contains_key(id) => {
                inner.active_ui_workspace_id = Some(id.to_string());
                Ok(())
            }
            Some(id) => Err(AppError::new(
                "unity_project.not_registered",
                "Unity project is not registered in Locus.",
            )
            .detail(id.to_string())),
            None => {
                inner.active_ui_workspace_id = None;
                Ok(())
            }
        }
    }

    pub fn active_ui_workspace_id(&self) -> Result<Option<String>, AppError> {
        Ok(self.read_inner()?.active_ui_workspace_id.clone())
    }

    pub fn is_activated(&self, workspace_id: &str) -> Result<bool, AppError> {
        let inner = self.read_inner()?;
        Ok(inner
            .projects
            .get(workspace_id)
            .and_then(|entry| entry.activated_runtime.as_ref())
            .is_some())
    }

    pub fn activated_runtime(
        &self,
        workspace_id: &str,
    ) -> Result<Arc<ActivatedUnityProjectRuntime>, AppError> {
        let inner = self.read_inner()?;
        inner
            .projects
            .get(workspace_id)
            .and_then(|entry| entry.activated_runtime.clone())
            .ok_or_else(|| {
                AppError::new(
                    "unity_project.inactive",
                    "Unity project is registered but not activated in Locus.",
                )
                .detail(workspace_id.to_string())
            })
    }

    pub async fn list_statuses(&self) -> Result<Vec<UnityProjectStatus>, AppError> {
        let snapshots = self.project_snapshots()?;
        let mut statuses = Vec::with_capacity(snapshots.len());
        for snapshot in snapshots {
            statuses.push(status_for_snapshot(snapshot).await);
        }
        Ok(statuses)
    }

    pub async fn status_for_workspace(
        &self,
        workspace_id: &str,
    ) -> Result<UnityProjectStatus, AppError> {
        let snapshot = self.project_snapshot(workspace_id)?;
        Ok(status_for_snapshot(snapshot).await)
    }

    fn project_snapshots(&self) -> Result<Vec<RegisteredUnityProjectSnapshot>, AppError> {
        let inner = self.read_inner()?;
        Ok(inner.projects.values().map(project_snapshot).collect())
    }

    fn project_snapshot(
        &self,
        workspace_id: &str,
    ) -> Result<RegisteredUnityProjectSnapshot, AppError> {
        let inner = self.read_inner()?;
        inner
            .projects
            .get(workspace_id)
            .map(project_snapshot)
            .ok_or_else(|| {
                AppError::new(
                    "unity_project.not_registered",
                    "Unity project is not registered in Locus.",
                )
                .detail(workspace_id.to_string())
            })
    }

    fn take_runtime(
        &self,
        workspace_id: &str,
    ) -> Result<Option<Arc<ActivatedUnityProjectRuntime>>, AppError> {
        let mut inner = self.write_inner()?;
        let entry = inner.projects.get_mut(workspace_id).ok_or_else(|| {
            AppError::new(
                "unity_project.not_registered",
                "Unity project is not registered in Locus.",
            )
            .detail(workspace_id.to_string())
        })?;
        Ok(entry.activated_runtime.take())
    }

    fn read_inner(&self) -> Result<std::sync::RwLockReadGuard<'_, UnityProjectRegistryInner>, AppError> {
        self.inner.read().map_err(|error| {
            AppError::new(
                "unity_project.registry_lock_failed",
                format!("Unity project registry lock error: {error}"),
            )
        })
    }

    fn write_inner(&self) -> Result<std::sync::RwLockWriteGuard<'_, UnityProjectRegistryInner>, AppError> {
        self.inner.write().map_err(|error| {
            AppError::new(
                "unity_project.registry_lock_failed",
                format!("Unity project registry lock error: {error}"),
            )
        })
    }
}

struct UnityProjectIdentity {
    workspace_id: String,
    project_path: String,
    name: String,
}

fn resolve_project_identity(project_path: &str) -> Result<UnityProjectIdentity, AppError> {
    let canonical = canonical_unity_project_path(project_path)?;
    let workspace_id = crate::workspace::load_or_create_workspace(&canonical)
        .map_err(|error| AppError::new("unity_project.workspace_id_failed", error))?;
    Ok(UnityProjectIdentity {
        workspace_id,
        name: project_display_name(&canonical),
        project_path: canonical,
    })
}

fn canonical_unity_project_path(project_path: &str) -> Result<String, AppError> {
    let trimmed = project_path.trim();
    if trimmed.is_empty() {
        return Err(AppError::new(
            "unity_project.path_empty",
            "Unity project path cannot be empty.",
        ));
    }
    let path = Path::new(trimmed);
    if !crate::unity_bridge::is_unity_project(trimmed) {
        return Err(AppError::new(
            "unity_project.invalid_project",
            "Selected directory is not a Unity project.",
        )
        .detail(trimmed.to_string()));
    }
    Ok(dunce::canonicalize(path)
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| trimmed.to_string()))
}

fn project_display_name(project_path: &str) -> String {
    Path::new(project_path)
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(project_path)
        .to_string()
}

fn project_snapshot(entry: &RegisteredUnityProject) -> RegisteredUnityProjectSnapshot {
    RegisteredUnityProjectSnapshot {
        workspace_id: entry.workspace_id.clone(),
        project_path: entry.project_path.clone(),
        name: entry.name.clone(),
        last_seen_at_ms: entry.last_seen_at_ms,
        activated: entry.activated_runtime.is_some(),
    }
}

async fn status_for_snapshot(snapshot: RegisteredUnityProjectSnapshot) -> UnityProjectStatus {
    let status = crate::unity_bridge::query_unity_connection_status(&snapshot.project_path).await;
    UnityProjectStatus {
        workspace_id: snapshot.workspace_id,
        project_path: snapshot.project_path,
        name: snapshot.name,
        activated: snapshot.activated,
        editor_open: matches!(status.editor_process_state, UnityEditorProcessState::Running),
        bridge_connected: status.connected,
        editor_status: status.editor_status.clone(),
        editor_process_state: status.editor_process_state.clone(),
        last_seen_at_ms: snapshot.last_seen_at_ms,
        connection_status: status,
    }
}

fn clear_runtime_caches(runtime: &ActivatedUnityProjectRuntime) {
    runtime.last_scan_info.clear();
    runtime.scan_phase_state.clear();
    runtime.preview_cache.clear();
    runtime.dir_entries_cache.clear();
    if let Ok(mut guard) = runtime.ref_graph_state.0.lock() {
        *guard = None;
    }
}

fn stop_asset_watcher(watcher_handle: &AssetDbWatcherHandle) {
    let watcher = watcher_handle.lock().ok().and_then(|mut guard| guard.take());
    if let Some(watcher) = watcher {
        watcher.stop_and_join();
    }
}

fn stop_knowledge_watcher(watcher_handle: &KnowledgeFsWatcherHandle) {
    let watcher = watcher_handle.lock().ok().and_then(|mut guard| guard.take());
    if let Some(watcher) = watcher {
        watcher.stop();
    }
}

fn unix_now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_unity_project() -> tempfile::TempDir {
        let project = tempfile::tempdir().expect("create unity project");
        std::fs::create_dir_all(project.path().join("Assets")).expect("create Assets");
        std::fs::create_dir_all(project.path().join("ProjectSettings"))
            .expect("create ProjectSettings");
        std::fs::write(
            project.path().join("ProjectSettings/ProjectSettings.asset"),
            "PlayerSettings:\n  productGUID: 2d9a8f42f0da40f2a22b9c4c93ce7d34\n",
        )
        .expect("write ProjectSettings");
        project
    }

    #[test]
    fn activation_is_idempotent() {
        let project = create_unity_project();
        let registry = UnityProjectRegistry::new();
        let workspace_id = registry
            .register_project(&project.path().to_string_lossy())
            .expect("register project");

        assert!(registry.activate_project(&workspace_id).expect("activate"));
        assert!(!registry.activate_project(&workspace_id).expect("activate again"));
        assert!(registry.is_activated(&workspace_id).expect("activation status"));
    }

    #[tokio::test]
    async fn deactivation_releases_runtime_but_keeps_registration() {
        let project = create_unity_project();
        let registry = UnityProjectRegistry::new();
        let workspace_id = registry
            .register_project(&project.path().to_string_lossy())
            .expect("register project");
        registry.activate_project(&workspace_id).expect("activate");

        registry
            .deactivate_project(&workspace_id)
            .await
            .expect("deactivate");

        assert!(!registry.is_activated(&workspace_id).expect("activation status"));
        let status = registry
            .status_for_workspace(&workspace_id)
            .await
            .expect("registered status remains available");
        assert_eq!(status.workspace_id, workspace_id);
        assert!(!status.activated);
    }
}
