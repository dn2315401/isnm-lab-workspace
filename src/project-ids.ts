export function nextProjectId() {
  const projects: { id: number }[] = JSON.parse(localStorage.getItem('isnm-projects') ?? '[]');
  const previous = Number(localStorage.getItem('isnm-project-sequence') ?? 0);
  const highest = projects.reduce((max, project) => project.id < 1_000_000 ? Math.max(max, project.id) : max, 0);
  const next = Math.max(Number.isSafeInteger(previous) ? previous : 0, highest) + 1;
  localStorage.setItem('isnm-project-sequence', String(next));
  return next;
}
