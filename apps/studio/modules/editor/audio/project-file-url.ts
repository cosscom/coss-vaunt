/** Where the file route serves a project file such as `imports/<id>-bed.mp3`. */
export function projectFileUrl(projectId: string, file: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/files/${file.split("/").map(encodeURIComponent).join("/")}`;
}
