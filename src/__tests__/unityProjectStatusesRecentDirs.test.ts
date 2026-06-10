import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cwd = process.cwd();

function read(relPath: string) {
  return readFileSync(resolve(cwd, relPath), "utf8");
}

describe("Unity project status loading", () => {
  it("registers recent Unity project dirs before listing statuses", () => {
    const command = read("src-tauri/src/commands/unity_project_runtime.rs");
    const workspace = read("src-tauri/src/commands/workspace.rs");

    expect(command).toContain("register_recent_unity_projects(&app_handle, &registry)?;");
    expect(command).toContain("existing_recent_dirs_from_storage(&data_dir)");
    expect(command).toContain("register_unity_projects_from_dirs(registry, recent_dirs)");
    expect(command).toContain("registry.register_project(trimmed)?;");
    expect(workspace).toContain("pub(crate) fn existing_recent_dirs_from_storage");
    expect(workspace).toContain("Ok(existing_recent_dirs_from_storage(&data_dir))");
  });

  it("keeps activation separate from UI project selection and unscoped chat fallback", () => {
    const center = read("src/components/UnityProjectStatusCenter.vue");
    const command = read("src-tauri/src/commands/unity_project_runtime.rs");
    const workspace = read("src-tauri/src/commands/workspace.rs");
    const session = read("src-tauri/src/commands/session.rs");
    const activateProjectBlock = center.match(
      /async function activateProject\(project: UnityProjectStatus\) \{[\s\S]*?\n\}/,
    )?.[0] ?? "";

    expect(activateProjectBlock).not.toContain("selectActiveUiUnityProject");
    expect(command).not.toContain("registry.select_active_ui_project(Some(&workspace_id))?;");
    expect(workspace).not.toContain("registry.select_active_ui_project(Some(&workspace_id))");
    expect(workspace).not.toContain("registry.activate_project(&workspace_id)");
    expect(session).toContain("fallback_unscoped_workspace_context(workspace).await");
    expect(session).not.toContain("resolve_selected_unity_runtime");
  });
});
