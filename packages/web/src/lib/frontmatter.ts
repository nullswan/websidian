export const FM_RE = /^---[\t ]*\r?\n([\s\S]*?)\n---[\t ]*(?:\r?\n|$)/;

export function updateFrontmatterField(content: string, key: string, value: string): string {
  const m = FM_RE.exec(content);
  if (!m) return content;
  const lines = m[1].split("\n");
  const keyRe = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
  const idx = lines.findIndex((l) => keyRe.test(l));
  if (idx >= 0) {
    lines[idx] = `${key}: ${value}`;
  }
  return content.slice(0, m.index) + `---\n${lines.join("\n")}\n---\n` + content.slice(m.index + m[0].length);
}

export function deleteFrontmatterField(content: string, key: string): string {
  const m = FM_RE.exec(content);
  if (!m) return content;
  const lines = m[1].split("\n");
  const keyRe = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
  const filtered = lines.filter((l) => !keyRe.test(l));
  if (filtered.length === 0) {
    return content.slice(m.index + m[0].length);
  }
  return content.slice(0, m.index) + `---\n${filtered.join("\n")}\n---\n` + content.slice(m.index + m[0].length);
}

export function addFrontmatterField(content: string, key: string, value: string): string {
  const m = FM_RE.exec(content);
  if (m) {
    const lines = m[1].split("\n");
    lines.push(`${key}: ${value}`);
    return content.slice(0, m.index) + `---\n${lines.join("\n")}\n---\n` + content.slice(m.index + m[0].length);
  }
  return `---\n${key}: ${value}\n---\n${content}`;
}

export const FRONTMATTER_TEMPLATES: { name: string; fields: string }[] = [
  { name: "Blog Post", fields: "title: \ntags: []\ndate: {{date}}\ndraft: true\ndescription: " },
  { name: "Meeting Note", fields: "title: \ndate: {{date}}\nattendees: []\nagenda: \naction-items: []" },
  { name: "Book Note", fields: "title: \nauthor: \nrating: \nstatus: reading\ndate-started: {{date}}\ngenre: " },
  { name: "Project", fields: "title: \nstatus: active\npriority: medium\ndeadline: \ntags: [project]" },
  { name: "Person", fields: "name: \nemail: \ncompany: \nrole: \ntags: [person]" },
];
