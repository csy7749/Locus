<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, Circle, Plug, Power, RefreshCw, X } from "lucide";
import LucideIcon from "./icons/LucideIcon.vue";
import { useProjectStore } from "../stores/project";
import { useChatStore } from "../stores/chat";
import { useNotificationStore } from "../stores/notification";
import { useDisplaySettings } from "../composables/useDisplaySettings";
import { normalizeAppError } from "../services/errors";
import type { UnityProjectStatus } from "../types";

const projectStore = useProjectStore();
const chatStore = useChatStore();
const notificationStore = useNotificationStore();
const { state: displaySettings } = useDisplaySettings();

const open = ref(false);
const busyWorkspaceId = ref<string | null>(null);

const projects = computed(() =>
  [...projectStore.unityProjectList].sort((left, right) => left.name.localeCompare(right.name)),
);

const activeProject = computed(() => projectStore.activeUiUnityProject);
const summary = computed(() => {
  const active = activeProject.value;
  if (!active) return "Unity 项目";
  return `${active.name} · ${active.activated ? "已激活" : "未激活"}`;
});

function statusText(project: UnityProjectStatus): string {
  const editor = project.editorOpen ? "Editor 运行" : "Editor 未运行";
  const bridge = project.bridgeConnected ? "Bridge 已连接" : "Bridge 未连接";
  return `${editor} · ${bridge} · ${project.editorStatus || "unknown"}`;
}

function statusIcon(project: UnityProjectStatus) {
  if (project.activated) return Check;
  if (project.bridgeConnected) return Plug;
  if (project.editorOpen) return Circle;
  return X;
}

async function selectProject(project: UnityProjectStatus) {
  await projectStore.selectActiveUiUnityProject(project.workspaceId);
  if (displaySettings.sessionListScope !== "allProjects") {
    chatStore.newChat({ persistSelection: false });
  }
  await chatStore.refreshSessions();
}

async function activateProject(project: UnityProjectStatus) {
  await runProjectAction(project.workspaceId, async () => {
    const previousNewSessionWorkspaceId = projectStore.newSessionWorkspaceId;
    await projectStore.activateUnityProject(project.workspaceId);
    if (
      displaySettings.sessionListScope !== "allProjects"
      && previousNewSessionWorkspaceId !== projectStore.newSessionWorkspaceId
    ) {
      chatStore.newChat({ persistSelection: false });
    }
    await chatStore.refreshSessions();
  });
}

async function deactivateProject(project: UnityProjectStatus) {
  await runProjectAction(project.workspaceId, async () => {
    await projectStore.deactivateUnityProject(project.workspaceId);
    await chatStore.refreshSessions();
  });
}

async function refreshProjects() {
  await runProjectAction("__refresh__", () => projectStore.loadUnityProjectStatuses());
}

async function runProjectAction(workspaceId: string, action: () => Promise<void>) {
  if (busyWorkspaceId.value) return;
  busyWorkspaceId.value = workspaceId;
  try {
    await action();
  } catch (error) {
    const err = normalizeAppError(error);
    notificationStore.addNotice("error", err.message, {
      code: err.code,
      operation: "unityProjectStatusCenter",
      skipConsoleLog: true,
    });
  } finally {
    busyWorkspaceId.value = null;
  }
}
</script>

<template>
  <div class="unity-project-center">
    <button
      class="unity-project-trigger"
      type="button"
      :class="{ active: open, inactive: activeProject && !activeProject.activated }"
      :title="summary"
      @click="open = !open"
    >
      <LucideIcon :icon="activeProject?.activated ? Check : Plug" :size="13" />
      <span class="trigger-label">{{ summary }}</span>
    </button>

    <Transition name="unity-project-popover">
      <div v-if="open" class="unity-project-popover">
        <header class="project-center-header">
          <span>Unity 项目状态</span>
          <button class="icon-button" type="button" title="刷新" @click="refreshProjects">
            <LucideIcon :icon="RefreshCw" :size="13" />
          </button>
        </header>

        <div v-if="projects.length === 0" class="project-empty">暂无已注册 Unity 项目</div>
        <div v-else class="project-list">
          <section
            v-for="project in projects"
            :key="project.workspaceId"
            class="project-row"
            :class="{ selected: project.workspaceId === projectStore.activeUiUnityProjectId }"
          >
            <button class="project-main" type="button" @click="selectProject(project)">
              <LucideIcon :icon="statusIcon(project)" :size="14" />
              <span class="project-text">
                <span class="project-name">{{ project.name }}</span>
                <span class="project-status">{{ statusText(project) }}</span>
              </span>
            </button>
            <button
              class="project-action"
              type="button"
              :disabled="busyWorkspaceId !== null"
              @click="project.activated ? deactivateProject(project) : activateProject(project)"
            >
              <LucideIcon :icon="Power" :size="13" />
              <span>{{ project.activated ? "停用" : "激活" }}</span>
            </button>
          </section>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.unity-project-center {
  position: relative;
  z-index: 20;
}

.unity-project-trigger {
  height: 28px;
  max-width: 260px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--panel-bg) 86%, var(--sidebar-bg) 14%);
  color: var(--text-color);
  padding: 0 9px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.unity-project-trigger:hover,
.unity-project-trigger.active {
  border-color: var(--accent-color);
}

.unity-project-trigger.inactive {
  color: var(--muted-text);
}

.trigger-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unity-project-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: min(520px, calc(100vw - 28px));
  max-height: min(460px, calc(100vh - 86px));
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
}

.project-center-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
}

.icon-button,
.project-action {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--panel-bg);
  color: var(--text-color);
  cursor: pointer;
}

.icon-button {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
}

.project-empty {
  padding: 18px 14px;
  color: var(--muted-text);
  font-size: 12px;
}

.project-list {
  display: grid;
  gap: 1px;
}

.project-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 8px;
  padding: 8px;
}

.project-row.selected {
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
}

.project-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.project-text {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.project-name,
.project-status {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-name {
  font-size: 13px;
  font-weight: 600;
}

.project-status {
  color: var(--muted-text);
  font-size: 11px;
}

.project-action {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  font-size: 12px;
}

.project-action:disabled {
  opacity: 0.55;
  cursor: default;
}

.unity-project-popover-enter-active,
.unity-project-popover-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.unity-project-popover-enter-from,
.unity-project-popover-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
