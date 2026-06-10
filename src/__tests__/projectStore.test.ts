import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useProjectStore } from "../stores/project";
import type { UnityConnectionStatus, UnityProjectStatus } from "../types";

const projectServiceMocks = vi.hoisted(() => ({
  getWorkingDir: vi.fn(),
  setWorkingDir: vi.fn(),
  listRecentDirs: vi.fn(),
}));

const unityServiceMocks = vi.hoisted(() => ({
  checkUnityConnection: vi.fn(),
  checkUnityConnectionStatus: vi.fn(),
  listUnityProjectStatuses: vi.fn(),
  getActiveUiUnityProject: vi.fn(),
  selectActiveUiUnityProject: vi.fn(),
  activateUnityProject: vi.fn(),
  deactivateUnityProject: vi.fn(),
  registerUnityProject: vi.fn(),
  openUnityProjectRuntime: vi.fn(),
  checkUnityPlugin: vi.fn(),
  installUnityPlugin: vi.fn(),
  launchUnityProject: vi.fn(),
}));

const assetServiceMocks = vi.hoisted(() => ({
  assetDbLightStatus: vi.fn(),
  assetDbScanStart: vi.fn(),
}));

vi.mock("../services/project", () => projectServiceMocks);
vi.mock("../services/unity", () => unityServiceMocks);
vi.mock("../services/asset", () => assetServiceMocks);

function connectionStatus(
  workspaceId: string,
  projectPath: string,
  connected: boolean,
): UnityConnectionStatus {
  return {
    workspaceId,
    projectPath,
    connected,
    editorStatus: connected ? "editing" : "disconnected",
    editorProcessState: connected ? "running" : "not_running",
    pipeName: `pipe-${workspaceId}`,
    reconnectAttempts: 0,
    backgroundHook: {
      enabled: false,
      supported: true,
      state: "disabled",
      patched: false,
      symbolCount: 0,
      updatedAtMs: 1,
    },
    checkedAtMs: 1,
  };
}

function projectStatus(
  workspaceId: string,
  projectPath: string,
  activated: boolean,
  connected: boolean,
): UnityProjectStatus {
  const status = connectionStatus(workspaceId, projectPath, connected);
  return {
    workspaceId,
    projectPath,
    name: workspaceId,
    activated,
    editorOpen: status.editorProcessState === "running",
    bridgeConnected: connected,
    editorStatus: status.editorStatus,
    editorProcessState: status.editorProcessState,
    lastSeenAtMs: status.checkedAtMs,
    connectionStatus: status,
  };
}

describe("project store asset scan state", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    unityServiceMocks.listUnityProjectStatuses.mockResolvedValue([]);
    unityServiceMocks.getActiveUiUnityProject.mockResolvedValue({ workspaceId: null });
    unityServiceMocks.selectActiveUiUnityProject.mockResolvedValue({ workspaceId: null });
    assetServiceMocks.assetDbScanStart.mockResolvedValue({
      started: true,
      alreadyRunning: false,
    });
  });

  it("allows a new scan after switching workspaces while a background scan is running", async () => {
    const store = useProjectStore();

    await store.startScan();
    expect(assetServiceMocks.assetDbScanStart).toHaveBeenCalledTimes(1);

    projectServiceMocks.setWorkingDir.mockResolvedValue("F:/project-b");
    await store.setWorkingDir("F:/project-b");
    await store.startScan();

    expect(assetServiceMocks.assetDbScanStart).toHaveBeenCalledTimes(2);
  });

  it("tracks multiple Unity projects and selected project runtime state", async () => {
    const projectA = projectStatus("ws-a", "F:/ProjectA", true, true);
    const projectB = projectStatus("ws-b", "F:/ProjectB", false, false);
    unityServiceMocks.listUnityProjectStatuses.mockResolvedValue([projectA, projectB]);
    unityServiceMocks.getActiveUiUnityProject.mockResolvedValue({ workspaceId: "ws-b" });
    const store = useProjectStore();

    await store.loadUnityProjectStatuses();

    expect(store.unityProjects.size).toBe(2);
    expect(store.activeUiUnityProjectId).toBe("ws-b");
    expect(store.activeUiUnityProject?.projectPath).toBe("F:/ProjectB");
    expect(store.selectedUnityProjectPath).toBe("F:/ProjectB");
    expect(store.selectedUnityConnected).toBe(false);
    expect(store.activeUiUnityProjectActivated).toBe(false);
    expect(store.activeUiUnityProjectInactive).toBe(true);
  });

  it("uses the project path name when backend status name is a workspace id", async () => {
    const unityId = "unity-75ae3a1f";
    unityServiceMocks.listUnityProjectStatuses.mockResolvedValue([
      projectStatus(unityId, "F:/Games/Ability", true, true),
    ]);
    const store = useProjectStore();

    await store.loadUnityProjectStatuses();

    expect(store.unityProjects.get(unityId)?.name).toBe("Ability");
  });

  it("derives the new session project from the activated current working directory", async () => {
    const projectA = projectStatus("ws-a", "F:/ProjectA", true, true);
    const projectB = projectStatus("ws-b", "F:/ProjectB", false, false);
    unityServiceMocks.listUnityProjectStatuses.mockResolvedValue([projectA, projectB]);
    unityServiceMocks.getActiveUiUnityProject.mockResolvedValue({ workspaceId: "ws-a" });
    projectServiceMocks.setWorkingDir.mockResolvedValue("F:/ProjectB");
    const store = useProjectStore();

    await store.loadUnityProjectStatuses();
    await store.setWorkingDir("F:/ProjectB");

    expect(store.activeUiWorkspaceId).toBe("ws-a");
    expect(store.newSessionWorkspaceId).toBeNull();

    unityServiceMocks.activateUnityProject.mockResolvedValue(
      projectStatus("ws-b", "F:/ProjectB", true, true),
    );
    await store.activateUnityProject("ws-b");

    expect(store.activeUiWorkspaceId).toBe("ws-a");
    expect(store.newSessionWorkspaceId).toBe("ws-b");
  });

  it("does not select a project when opening its runtime", async () => {
    unityServiceMocks.openUnityProjectRuntime.mockResolvedValue(
      projectStatus("ws-a", "F:/ProjectA", true, true),
    );
    const store = useProjectStore();

    await store.openUnityProjectRuntime("F:/ProjectA");

    expect(store.activeUiUnityProjectId).toBeNull();
  });

  it("routes project scoped events only to the selected Unity project", async () => {
    const store = useProjectStore();
    unityServiceMocks.openUnityProjectRuntime.mockResolvedValue(
      projectStatus("ws-a", "F:/ProjectA", true, true),
    );
    await store.openUnityProjectRuntime("F:/ProjectA");
    unityServiceMocks.selectActiveUiUnityProject.mockResolvedValue({ workspaceId: "ws-a" });
    await store.selectActiveUiUnityProject("ws-a");

    store.handleScanEvent({
      workspaceId: "ws-b",
      projectPath: "F:/ProjectB",
      phase: "done",
      stats: {
        dirsScanned: 1,
        metaFilesFound: 1,
        yamlAssetsFound: 1,
        nodesAdded: 1,
        edgesAdded: 1,
        nodesUpdated: 0,
        nodesDeleted: 0,
        parseFailures: 0,
        elapsedMs: 1,
        duplicateGuids: {
          groupCount: 0,
          pathCount: 0,
          assetsOnlyGroups: 0,
          packagesOnlyGroups: 0,
          crossRootGroups: 0,
        },
      },
    });

    expect(store.lastScanStats).toBeNull();

    store.handleScanEvent({
      workspaceId: "ws-a",
      projectPath: "F:/ProjectA",
      phase: "reconcileDone",
    });

    expect(store.scanPhase).toBeNull();
  });
});
