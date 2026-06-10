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
    expect(app).toContain("activateWorkspaceProject");
    expect(app).toContain("deactivateWorkspaceProject");
    expect(app).toContain("selectWorkspaceProject");
    expect(app).toContain("workspaceCurrentUnityProject");
    expect(app).toContain("workspaceRuntimeStatusText");
    expect(app).toContain("class=\"workspace-runtime-dot\"");
    expect(app).toContain("class=\"dropdown-label unity-project-label\"");
    expect(app).toContain("class=\"unity-project-row\"");
    expect(app).toContain("project.activated ? deactivateWorkspaceProject(project) : activateWorkspaceProject(project)");
  });
});
