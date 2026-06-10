use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::session::store::SessionStore;
use crate::unity_project_runtime::{
    ActivatedUnityProjectRuntime, UnityProjectRegistry, UnityProjectStatus,
};
use crate::ActiveTasks;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterUnityProjectRequest {
    pub project_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateUnityProjectRequest {
    pub workspace_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeactivateUnityProjectRequest {
    pub workspace_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectActiveUiUnityProjectRequest {
    pub workspace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveUiUnityProjectResult {
    pub workspace_id: Option<String>,
}

#[tauri::command]
pub async fn list_unity_project_statuses(
    app_handle: AppHandle,
    registry: State<'_, Arc<UnityProjectRegistry>>,
) -> Result<Vec<UnityProjectStatus>, AppError> {
    register_recent_unity_projects(&app_handle, &registry)?;
    registry.list_statuses().await
}

fn register_recent_unity_projects(
    app_handle: &AppHandle,
    registry: &UnityProjectRegistry,
) -> Result<(), AppError> {
    let data_dir = super::resolve_runtime_storage_dir(app_handle)
        .map_err(|error| AppError::new("unity_project.recent_dirs_failed", error.to_string()))?;
    let recent_dirs = super::workspace::existing_recent_dirs_from_storage(&data_dir);
    register_unity_projects_from_dirs(registry, recent_dirs)
}

fn register_unity_projects_from_dirs<I>(
    registry: &UnityProjectRegistry,
    dirs: I,
) -> Result<(), AppError>
where
    I: IntoIterator<Item = String>,
{
    for dir in dirs {
        let trimmed = dir.trim();
        if trimmed.is_empty() || !crate::unity_bridge::is_unity_project(trimmed) {
            continue;
        }
        registry.register_project(trimmed)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn register_unity_project(
    request: RegisterUnityProjectRequest,
    registry: State<'_, Arc<UnityProjectRegistry>>,
) -> Result<UnityProjectStatus, AppError> {
    let workspace_id = registry.register_project(&request.project_path)?;
    registry.status_for_workspace(&workspace_id).await
}

#[tauri::command]
pub async fn open_unity_project_runtime(
    request: RegisterUnityProjectRequest,
    app_handle: AppHandle,
    registry: State<'_, Arc<UnityProjectRegistry>>,
) -> Result<UnityProjectStatus, AppError> {
    let workspace_id = registry.register_project(&request.project_path)?;
    let created = registry.activate_project(&workspace_id)?;
    if created {
        start_activated_runtime(&app_handle, &registry, &workspace_id).await?;
    }
    registry.status_for_workspace(&workspace_id).await
}

#[tauri::command]
pub async fn activate_unity_project(
    request: ActivateUnityProjectRequest,
    app_handle: AppHandle,
    registry: State<'_, Arc<UnityProjectRegistry>>,
) -> Result<UnityProjectStatus, AppError> {
    let workspace_id = normalized_workspace_id(&request.workspace_id)?;
    let created = registry.activate_project(&workspace_id)?;
    if created {
        start_activated_runtime(&app_handle, &registry, &workspace_id).await?;
    }
    registry.status_for_workspace(&workspace_id).await
}

#[tauri::command]
pub async fn deactivate_unity_project(
    request: DeactivateUnityProjectRequest,
    registry: State<'_, Arc<UnityProjectRegistry>>,
    store: State<'_, Arc<SessionStore>>,
    active_tasks: State<'_, ActiveTasks>,
) -> Result<UnityProjectStatus, AppError> {
    let workspace_id = normalized_workspace_id(&request.workspace_id)?;
    ensure_no_active_sessions(&workspace_id, store.inner().as_ref(), active_tasks.inner()).await?;
    registry.deactivate_project(&workspace_id).await?;
    registry.status_for_workspace(&workspace_id).await
}

#[tauri::command]
pub async fn select_active_ui_unity_project(
    request: SelectActiveUiUnityProjectRequest,
    registry: State<'_, Arc<UnityProjectRegistry>>,
) -> Result<ActiveUiUnityProjectResult, AppError> {
    let workspace_id = request
        .workspace_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    registry.select_active_ui_project(workspace_id.as_deref())?;
    Ok(ActiveUiUnityProjectResult { workspace_id })
}

#[tauri::command]
pub async fn get_active_ui_unity_project(
    registry: State<'_, Arc<UnityProjectRegistry>>,
) -> Result<ActiveUiUnityProjectResult, AppError> {
    Ok(ActiveUiUnityProjectResult {
        workspace_id: registry.active_ui_workspace_id()?,
    })
}

fn normalized_workspace_id(workspace_id: &str) -> Result<String, AppError> {
    let trimmed = workspace_id.trim();
    if trimmed.is_empty() {
        return Err(AppError::new(
            "unity_project.workspace_id_empty",
            "Unity project workspace id cannot be empty.",
        ));
    }
    Ok(trimmed.to_string())
}

async fn ensure_no_active_sessions(
    workspace_id: &str,
    store: &SessionStore,
    active_tasks: &ActiveTasks,
) -> Result<(), AppError> {
    let session_ids = active_session_ids(active_tasks).await;
    let active = sessions_for_workspace(store, workspace_id, session_ids)?;
    if active.is_empty() {
        return Ok(());
    }
    Err(AppError::new(
        "unity_project.active_sessions",
        "Unity project has active session runs and cannot be deactivated.",
    )
    .detail(active.join(", "))
    .operation("deactivateUnityProject")
    .retryable(true))
}

async fn active_session_ids(active_tasks: &ActiveTasks) -> Vec<String> {
    active_tasks.lock().await.keys().cloned().collect()
}

fn sessions_for_workspace(
    store: &SessionStore,
    workspace_id: &str,
    session_ids: Vec<String>,
) -> Result<Vec<String>, AppError> {
    let mut active = Vec::new();
    for session_id in session_ids {
        let session_workspace_id = store.get_session_workspace_id(&session_id)?;
        if session_workspace_id.as_deref() == Some(workspace_id) {
            active.push(session_id);
        }
    }
    Ok(active)
}

async fn start_activated_runtime(
    app_handle: &AppHandle,
    registry: &UnityProjectRegistry,
    workspace_id: &str,
) -> Result<(), AppError> {
    let runtime = registry.activated_runtime(workspace_id)?;
    start_unity_monitor_for_runtime(app_handle, &runtime).await
}

async fn start_unity_monitor_for_runtime(
    app_handle: &AppHandle,
    runtime: &ActivatedUnityProjectRuntime,
) -> Result<(), AppError> {
    crate::unity_bridge::start_unity_monitor(
        app_handle.clone(),
        runtime.project_path.clone(),
        &runtime.unity_monitor,
    )
    .await;
    crate::unity_bridge::emit_plugin_status(app_handle, &runtime.project_path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sessions_for_workspace_filters_active_session_ids_by_workspace() {
        let temp = tempfile::tempdir().expect("session store dir");
        let store = SessionStore::new(temp.path()).expect("session store");
        let target = store
            .create_session("Target", None, Some("workspace-a"), "chat", None)
            .expect("target session");
        let other = store
            .create_session("Other", None, Some("workspace-b"), "chat", None)
            .expect("other session");
        let global = store
            .create_session("Global", None, None, "chat", None)
            .expect("global session");

        let active = sessions_for_workspace(
            &store,
            "workspace-a",
            vec![target.clone(), other, global],
        )
        .expect("active sessions");

        assert_eq!(active, vec![target]);
    }

    #[test]
    fn registers_unity_projects_from_recent_dirs() {
        let unity_project = tempfile::tempdir().expect("unity project dir");
        std::fs::create_dir_all(unity_project.path().join("Assets")).expect("create Assets");
        std::fs::create_dir_all(unity_project.path().join("ProjectSettings"))
            .expect("create ProjectSettings");
        let plain_dir = tempfile::tempdir().expect("plain dir");
        let registry = UnityProjectRegistry::new();

        register_unity_projects_from_dirs(
            &registry,
            [
                plain_dir.path().to_string_lossy().to_string(),
                unity_project.path().to_string_lossy().to_string(),
            ],
        )
        .expect("register recent unity projects");

        let statuses = futures::executor::block_on(registry.list_statuses()).expect("list statuses");
        assert_eq!(statuses.len(), 1);
        assert_eq!(
            statuses[0].name,
            unity_project.path().file_name().unwrap().to_string_lossy().to_string(),
        );
    }
}
