import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cwd = process.cwd();

function read(relPath: string) {
  return readFileSync(resolve(cwd, relPath), "utf8");
}

describe("workspace Unity project menu", () => {
  it("merges Unity activation status into the workspace selector", () => {
    const app = read("src/App.vue");

    expect(app).not.toContain("import UnityProjectStatusCenter");
    expect(app).not.toContain("<UnityProjectStatusCenter");
    expect(app).toContain("workspaceUnityProjects");
    expect(app).toContain("workspaceMenuEntries");
    expect(app).toContain("activateWorkspaceProject");
    expect(app).toContain("deactivateWorkspaceProject");
    expect(app).toContain("selectWorkspaceEntry");
    expect(app).toContain("workspaceCurrentUnityProject");
    expect(app).toContain("workspaceRuntimeStatusText");
    expect(app).toContain("class=\"workspace-runtime-dot\"");
    expect(app).not.toContain("class=\"dropdown-label unity-project-label\"");
    expect(app).not.toContain("class=\"unity-project-row\"");
    expect(app).toContain("class=\"workspace-entry-row\"");
    expect(app).toContain("project: UnityProjectStatus;");
    expect(app).toContain("workspaceProjectStatusText(entry.project)");
    expect(app).toContain("entry.project.projectPath");
    expect(app).toContain("entry.project.activated ? deactivateWorkspaceProject(entry.project) : activateWorkspaceProject(entry.project)");
    expect(app).not.toContain("entry.project ? workspaceProjectStatusText(entry.project) : parentPath(entry.dir)");
    expect(app).not.toContain("'is-directory'");
  });
});
