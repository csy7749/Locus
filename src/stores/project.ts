import { ref, computed } from "vue";
import { defineStore } from "pinia";
import * as projectService from "../services/project";
import * as unityService from "../services/unity";
import { assetDbLightStatus, assetDbScanStart } from "../services/asset";
import { normalizeAppError } from "../services/errors";
import { useNotificationStore } from "./notification";
import { t } from "../i18n";
import type {
  AssetDbLightStatus,
  AssetDbScanEvent,
  PluginStatus,
  ScanStats,
  UnityConnectionStatus,
  UnityProjectStatus,
} from "../types";

type PluginNoticeStatus = "missing" | "outdated";
export type UnityLaunchState = "idle" | "starting" | "waitingConnection";

const PLUGIN_STATUS_NOTICE_OPERATION = "unity-plugin-status";
const UNITY_BACKGROUND_HOOK_NOTICE_OPERATION = "unity-background-hook";
const UNITY_LAUNCH_CONNECTION_POLL_MS = 1500;
const UNITY_LAUNCH_WAIT_TIMEOUT_MS = 120_000;

export const useProjectStore = defineStore("project", () => {
  const workingDir = ref("");
  const recentDirs = ref<string[]>([]);
  const unityProjects = ref(new Map<string, UnityProjectStatus>());
  const activeUiUnityProjectId = ref<string | null>(null);
  const unityConnected = ref(false);
  const unityConnectionStatus = ref<UnityConnectionStatus | null>(null);
  const scanPhase = ref<AssetDbScanEvent | null>(null);
  const lastScanStats = ref<ScanStats | null>(null);
  const pluginToast = ref<"missing" | "outdated" | null>(null);
  const pluginInstalling = ref(false);
  const unityLaunchState = ref<UnityLaunchState>("idle");
  const unityLaunching = computed(() => unityLaunchState.value === "starting");
  let scanInFlight = false;
  let unityLaunchPollTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  let unityLaunchWaitStartedAt = 0;

  const isUnityProject = computed(() => workingDir.value.length > 0);
  const unityProjectList = computed(() => Array.from(unityProjects.value.values()));
  const activeUiUnityProject = computed(() => {
    const id = activeUiUnityProjectId.value;
    return id ? unityProjects.value.get(id) ?? null : null;
  });
  const activeUiWorkspaceId = computed(() => activeUiUnityProjectId.value);
  const workingDirUnityProject = computed(() => {
    const normalizedWorkingDir = normalizeProjectPath(workingDir.value);
    if (!normalizedWorkingDir) return null;
    return unityProjectList.value.find((project) =>
      normalizeProjectPath(project.projectPath) === normalizedWorkingDir) ?? null;
  });
  const newSessionUnityProject = computed(() => {
    const project = workingDirUnityProject.value;
    return project?.activated ? project : null;
  });
  const newSessionWorkspaceId = computed(() => newSessionUnityProject.value?.workspaceId ?? null);
  const newSessionRuntimeActive = computed(() => !!newSessionWorkspaceId.value);
  const selectedUnityProjectPath = computed(() =>
    activeUiUnityProject.value?.projectPath ?? workingDir.value,
  );
  const selectedUnityConnectionStatus = computed(() =>
    activeUiUnityProject.value?.connectionStatus ?? unityConnectionStatus.value,
  );
  const selectedUnityConnected = computed(() =>
    activeUiUnityProject.value?.bridgeConnected ?? unityConnected.value,
  );
  const activeUiUnityProjectActivated = computed(() =>
    activeUiUnityProject.value?.activated ?? !!workingDir.value.trim(),
  );
  const activeUiUnityProjectInactive = computed(() =>
    !!activeUiUnityProject.value && !activeUiUnityProject.value.activated,
  );

  function pluginStatusLabel(status: PluginNoticeStatus): string {
    return status === "missing" ? t("app.plugin.notInstalled") : t("app.plugin.needUpdate");
  }

  function setPluginToast(status: PluginNoticeStatus | null) {
    pluginToast.value = status;
    const notificationStore = useNotificationStore();
    if (status) {
      notificationStore.addNotice("error", pluginStatusLabel(status), {
        operation: PLUGIN_STATUS_NOTICE_OPERATION,
        replaceOperation: true,
        skipConsoleLog: true,
      });
    } else {
      notificationStore.clearByOperation(PLUGIN_STATUS_NOTICE_OPERATION);
    }
  }

  function isScanRunning(phase: AssetDbScanEvent | null): boolean {
    return phase != null
      && phase.phase !== "done"
      && phase.phase !== "reconcileDone"
      && phase.phase !== "error";
  }

  function clearUnityLaunchPoll() {
    if (unityLaunchPollTimer) {
      globalThis.clearTimeout(unityLaunchPollTimer);
      unityLaunchPollTimer = null;
    }
    unityLaunchWaitStartedAt = 0;
  }

  function resetUnityLaunchState() {
    clearUnityLaunchPoll();
    unityLaunchState.value = "idle";
  }

  function setUnityConnected(connected: boolean) {
    unityConnected.value = connected;
    if (connected) {
      resetUnityLaunchState();
    }
  }

  function setUnityConnectionStatus(status: UnityConnectionStatus) {
    unityConnectionStatus.value = status;
    upsertUnityProjectFromConnectionStatus(status);
    setUnityConnected(status.connected);
    const hook = status.backgroundHook;
    const notificationStore = useNotificationStore();
    if (hook?.enabled && hook.state === "failed" && hook.error) {
      notificationStore.addNotice("error", hook.error, {
        operation: UNITY_BACKGROUND_HOOK_NOTICE_OPERATION,
        replaceOperation: true,
        skipConsoleLog: true,
      });
    } else if (hook?.state === "patched" || hook?.state === "disabled") {
      notificationStore.clearByOperation(UNITY_BACKGROUND_HOOK_NOTICE_OPERATION);
    }
  }

  function scheduleUnityLaunchConnectionCheck(delayMs = UNITY_LAUNCH_CONNECTION_POLL_MS) {
    if (unityLaunchPollTimer) {
      globalThis.clearTimeout(unityLaunchPollTimer);
    }
    unityLaunchPollTimer = globalThis.setTimeout(() => {
      unityLaunchPollTimer = null;
      void checkUnityConnectionAfterLaunch();
    }, delayMs);
  }

  async function checkUnityConnectionAfterLaunch() {
    await checkUnityConnection();
    if (unityConnected.value || unityLaunchState.value !== "waitingConnection") return;

    if (
      unityLaunchWaitStartedAt > 0
      && Date.now() - unityLaunchWaitStartedAt >= UNITY_LAUNCH_WAIT_TIMEOUT_MS
    ) {
      resetUnityLaunchState();
      return;
    }

    scheduleUnityLaunchConnectionCheck();
  }

  function minimalStatsFromLightStatus(status: AssetDbLightStatus): ScanStats {
    return {
      dirsScanned: 0,
      metaFilesFound: 0,
      yamlAssetsFound: 0,
      nodesAdded: status.nodes,
      edgesAdded: status.edges,
      nodesUpdated: 0,
      nodesDeleted: 0,
      parseFailures: 0,
      elapsedMs: status.lastScanDurationMs ?? 0,
      duplicateGuids: {
        groupCount: 0,
        pathCount: 0,
        assetsOnlyGroups: 0,
        packagesOnlyGroups: 0,
        crossRootGroups: 0,
      },
    };
  }

  function isWorkspaceIdLikeProjectName(name: string, workspaceId: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    const normalizedWorkspaceId = workspaceId.trim().toLowerCase();
    return normalizedName === normalizedWorkspaceId || /^unity-[a-z0-9]+$/i.test(normalizedName);
  }

  function projectDisplayName(status: UnityProjectStatus): string {
    const name = status.name.trim();
    if (name && !isWorkspaceIdLikeProjectName(name, status.workspaceId)) return name;
    return projectNameFromPath(status.projectPath);
  }

  function normalizeUnityProjectStatus(status: UnityProjectStatus): UnityProjectStatus {
    return {
      ...status,
      name: projectDisplayName(status),
    };
  }

  function replaceUnityProjects(statuses: UnityProjectStatus[]) {
    const entries = statuses.map((status) => {
      const normalized = normalizeUnityProjectStatus(status);
      return [normalized.workspaceId, normalized] as const;
    });
    unityProjects.value = new Map(entries);
  }

  function upsertUnityProjectStatus(status: UnityProjectStatus) {
    const normalized = normalizeUnityProjectStatus(status);
    unityProjects.value = new Map(unityProjects.value).set(normalized.workspaceId, normalized);
  }

  function eventWorkspaceId(event: { workspaceId?: string | null }): string | null {
    return event.workspaceId?.trim() || null;
  }

  function isActiveUiProjectEvent(event: { workspaceId?: string | null }): boolean {
    const workspaceId = eventWorkspaceId(event);
    return !workspaceId || workspaceId === activeUiUnityProjectId.value;
  }

  function upsertUnityProjectFromConnectionStatus(status: UnityConnectionStatus) {
    const workspaceId = status.workspaceId?.trim();
    if (!workspaceId) return;
    const projectPath = status.projectPath.trim();
    if (!projectPath) return;
    const existing = unityProjects.value.get(workspaceId);
    const existingName = existing?.name?.trim() ?? "";
    upsertUnityProjectStatus({
      workspaceId,
      projectPath,
      name: existingName && !isWorkspaceIdLikeProjectName(existingName, workspaceId)
        ? existingName
        : projectNameFromPath(projectPath),
      activated: existing?.activated ?? false,
      editorOpen: status.editorProcessState === "running",
      bridgeConnected: status.connected,
      editorStatus: status.editorStatus,
      editorProcessState: status.editorProcessState,
      lastSeenAtMs: status.checkedAtMs,
      connectionStatus: status,
    });
  }

  function projectNameFromPath(projectPath: string): string {
    const normalized = projectPath.replace(/\\/g, "/").replace(/\/+$/g, "");
    return normalized.split("/").filter(Boolean).pop() ?? projectPath;
  }

  function normalizeProjectPath(projectPath: string): string {
    return projectPath.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
  }

  function shouldAutoBuildFromLightStatus(status: AssetDbLightStatus): boolean {
    if (!workingDir.value.trim()) return false;
    if (scanInFlight || isScanRunning(scanPhase.value)) return false;
    if (status.status === "none") return true;
    const phase = status.currentScanPhase;
    return phase?.phase === "error"
      && phase.error.code.startsWith("ref_graph.rescan_required.");
  }

  async function loadWorkingDir() {
    try {
      workingDir.value = await projectService.getWorkingDir();
    } catch (e) {
      console.error("get_working_dir failed:", e);
    }
  }

  async function loadUnityProjectStatuses() {
    try {
      const statuses = await unityService.listUnityProjectStatuses();
      replaceUnityProjects(statuses);
      const active = await unityService.getActiveUiUnityProject();
      activeUiUnityProjectId.value = active.workspaceId?.trim() || null;
    } catch (e) {
      console.error("list_unity_project_statuses failed:", e);
    }
  }

  async function registerUnityProject(path: string) {
    const status = await unityService.registerUnityProject(path);
    upsertUnityProjectStatus(status);
    return status;
  }

  async function openUnityProjectRuntime(path: string) {
    const status = await unityService.openUnityProjectRuntime(path);
    upsertUnityProjectStatus(status);
    return status;
  }

  async function activateUnityProject(workspaceId: string) {
    const status = await unityService.activateUnityProject(workspaceId);
    upsertUnityProjectStatus(status);
    return status;
  }

  async function deactivateUnityProject(workspaceId: string) {
    const status = await unityService.deactivateUnityProject(workspaceId);
    upsertUnityProjectStatus(status);
    return status;
  }

  async function selectActiveUiUnityProject(workspaceId: string | null) {
    const result = await unityService.selectActiveUiUnityProject(workspaceId);
    activeUiUnityProjectId.value = result.workspaceId?.trim() || null;
    scanPhase.value = null;
    lastScanStats.value = null;
  }

  async function setWorkingDir(path: string): Promise<string> {
    const result = await projectService.setWorkingDir(path);
    resetUnityLaunchState();
    workingDir.value = result;
    unityConnectionStatus.value = null;
    scanPhase.value = null;
    lastScanStats.value = null;
    scanInFlight = false;
    await loadUnityProjectStatuses();
    return result;
  }

  async function loadRecentDirs() {
    try {
      recentDirs.value = await projectService.listRecentDirs();
    } catch (e) {
      console.error("list_recent_dirs failed:", e);
    }
  }

  async function removeRecentDir(path: string) {
    recentDirs.value = await projectService.removeRecentDir(path);
  }

  async function openDirInFileExplorer(path: string) {
    await projectService.openDirInFileExplorer(path);
  }

  async function startScan() {
    if (scanInFlight || isScanRunning(scanPhase.value)) return;
    scanInFlight = true;
    scanPhase.value = { phase: "dirScan" };
    try {
      const result = await assetDbScanStart();
      if (!result.started && !result.alreadyRunning) {
        scanInFlight = false;
        scanPhase.value = null;
      }
    } catch (e) {
      const err = normalizeAppError(e);
      scanInFlight = false;
      console.error("ref_graph_scan_start failed:", err);
      scanPhase.value = { phase: "error", error: err };
      useNotificationStore().addNotice("error", err.message, {
        code: err.code,
        operation: "ref_graph_scan_start",
        skipConsoleLog: true,
      });
    }
  }

  async function checkUnityConnection() {
    try {
      setUnityConnectionStatus(await unityService.checkUnityConnectionStatus());
    } catch {
      setUnityConnected(false);
    }
  }

  async function checkUnityPlugin() {
    try {
      const ps = await unityService.checkUnityPlugin();
      setPluginToast((ps.status === "missing" || ps.status === "outdated") ? ps.status : null);
    } catch {
      setPluginToast(null);
    }
  }

  async function installPlugin() {
    pluginInstalling.value = true;
    try {
      await unityService.installUnityPlugin();
    } catch (e) {
      console.error("install_unity_plugin failed:", e);
    } finally {
      pluginInstalling.value = false;
    }
  }

  async function launchUnityProject() {
    if (unityLaunchState.value !== "idle" || unityConnected.value) return;
    clearUnityLaunchPoll();
    unityLaunchState.value = "starting";
    try {
      await unityService.launchUnityProject();
      if (unityConnected.value) {
        resetUnityLaunchState();
        return;
      }
      unityLaunchState.value = "waitingConnection";
      unityLaunchWaitStartedAt = Date.now();
      scheduleUnityLaunchConnectionCheck();
    } catch (e) {
      resetUnityLaunchState();
      const err = normalizeAppError(e);
      console.error("launch_unity_project failed:", err);
      useNotificationStore().addNotice("error", t("app.unityLaunchFailed", err.message), {
        code: err.code,
        operation: "launch_unity_project",
        skipConsoleLog: true,
      });
    }
  }

  async function loadAssetDbStatus() {
    try {
      const status = await assetDbLightStatus();
      const currentPhase = status.currentScanPhase ?? null;

      if (currentPhase) {
        scanPhase.value = currentPhase;
      } else if (!isScanRunning(scanPhase.value)) {
        scanPhase.value = null;
      }

      if (status.lastScanStats) {
        lastScanStats.value = status.lastScanStats;
      } else if (status.status === "indexed") {
        lastScanStats.value = minimalStatsFromLightStatus(status);
      } else if (status.status === "none") {
        lastScanStats.value = null;
      }

      if (status.status === "indexed") {
        console.log(
          "[AssetDb] loaded from existing DB:",
          status.nodes,
          "assets,",
          status.edges,
          "edges",
        );
      }

      if (shouldAutoBuildFromLightStatus(status)) {
        void startScan();
      }
    } catch {
      if (!isScanRunning(scanPhase.value)) {
        lastScanStats.value = null;
      }
    }
  }

  function resetWorkspaceState() {
    workingDir.value = "";
    recentDirs.value = [];
    unityProjects.value = new Map();
    activeUiUnityProjectId.value = null;
    unityConnected.value = false;
    unityConnectionStatus.value = null;
    scanPhase.value = null;
    lastScanStats.value = null;
    scanInFlight = false;
    setPluginToast(null);
    pluginInstalling.value = false;
    resetUnityLaunchState();
  }

  function handleUnityConnectionStatus(connected: boolean) {
    setUnityConnected(connected);
  }

  function handleUnityConnectionStatusDetail(status: UnityConnectionStatus) {
    setUnityConnectionStatus(status);
  }

  function handleScanEvent(event: AssetDbScanEvent) {
    if (!isActiveUiProjectEvent(event)) return;
    scanPhase.value = event;
    if (event.phase === "done") {
      scanInFlight = false;
      lastScanStats.value = event.stats;
    } else if (event.phase === "reconcileDone") {
      scanPhase.value = null;
    } else if (event.phase === "error") {
      scanInFlight = false;
      console.error("[AssetDb] scan error:", event.error);
      useNotificationStore().addNotice("error", event.error.message, {
        code: event.error.code,
        operation: "ref_graph_scan",
        skipConsoleLog: true,
      });
    }
  }

  function handlePluginStatus(status: PluginStatus) {
    if (!isActiveUiProjectEvent(status)) return;
    const s = status.status;
    if (s === "missing" || s === "outdated") {
      setPluginToast(s);
    } else {
      setPluginToast(null);
    }
  }

  return {
    workingDir,
    recentDirs,
    unityProjects,
    unityProjectList,
    activeUiUnityProjectId,
    activeUiWorkspaceId,
    activeUiUnityProject,
    workingDirUnityProject,
    newSessionUnityProject,
    newSessionWorkspaceId,
    newSessionRuntimeActive,
    selectedUnityProjectPath,
    selectedUnityConnectionStatus,
    selectedUnityConnected,
    activeUiUnityProjectActivated,
    activeUiUnityProjectInactive,
    unityConnected,
    unityConnectionStatus,
    scanPhase,
    lastScanStats,
    pluginToast,
    pluginInstalling,
    unityLaunchState,
    unityLaunching,
    isUnityProject,
    loadWorkingDir,
    loadUnityProjectStatuses,
    registerUnityProject,
    openUnityProjectRuntime,
    activateUnityProject,
    deactivateUnityProject,
    selectActiveUiUnityProject,
    setWorkingDir,
    loadRecentDirs,
    removeRecentDir,
    openDirInFileExplorer,
    startScan,
    checkUnityConnection,
    checkUnityPlugin,
    installPlugin,
    launchUnityProject,
    loadAssetDbStatus,
    resetWorkspaceState,
    handleUnityConnectionStatus,
    handleUnityConnectionStatusDetail,
    handleScanEvent,
    handlePluginStatus,
  };
});
