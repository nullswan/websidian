export type ViewMode = "edit" | "read" | "source" | "kanban";

export interface NoteMeta {
  frontmatter: Record<string, unknown>;
  aliases: string[];
  tags: Array<{ name: string }>;
  links: Array<{ target: string }>;
  embeds: Array<{ target: string }>;
}

export interface BacklinkEntry {
  path: string;
  context: string;
  lineContext?: string;
}

export interface UnlinkedMention {
  path: string;
  line: number;
  lineContext: string;
}

export interface Tab {
  id: string;
  path: string;
  content: string;
  mode: ViewMode;
  noteMeta: NoteMeta | null;
  backlinks: BacklinkEntry[];
  unlinkedMentions: UnlinkedMention[];
  scrollTop: number;
  pinned?: boolean;
  missing?: boolean;
  dirty?: boolean;
  cursorOffset?: number;
  color?: string;
  fileCreated?: string;
  fileModified?: string;
  fileSize?: number;
}

export interface Pane {
  tabIds: string[];
  activeTabId: string | null;
}
