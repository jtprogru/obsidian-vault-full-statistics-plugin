import { Component, Vault, MetadataCache, TFile, TFolder, CachedMetadata } from 'obsidian';
import { FullVaultMetrics } from './metrics';

enum FileType {
  Unknown = 0,
  Note,
}

export interface CollectResult {
  metrics: FullVaultMetrics;
  tags: Set<string>;
}

export interface GroupAggregate {
  name: string;
  notes: number;
  links: number;
  ownNotes: number;
  sourceNotes: number;
  conceptNotes: number;
  orphanNotes: number;
}

export interface FolderGroupSpec {
  name: string;
  paths: string[];
}

export class FullVaultMetricsCollector {

  private readonly owner: Component;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private readonly data: Map<string, FullVaultMetrics> = new Map();
  private backlog: Set<string> = new Set();
  private vaultMetrics: FullVaultMetrics = new FullVaultMetrics();
  private intervalId: number | null = null;
  private readonly batchSize: number = 16;
  private intervalMs: number = 100;
  private readonly noteMetricsCollector: NoteMetricsCollector;
  private excludedFolders: string[] = [];

  constructor(owner: Component) {
    this.owner = owner;
    this.noteMetricsCollector = new NoteMetricsCollector();
  }

  public setVault(vault: Vault) {
    this.vault = vault;
    return this;
  }

  public setMetadataCache(metadataCache: MetadataCache) {
    this.metadataCache = metadataCache;
    return this;
  }

  public setFullVaultMetrics(vaultMetrics: FullVaultMetrics) {
    this.vaultMetrics = vaultMetrics;
    return this;
  }

  public setExcludedFolders(folders: string[]) {
    this.excludedFolders = folders
      .map(f => f.trim().replace(/\/+$/, ''))
      .filter(f => f.length > 0);
    return this;
  }

  public setOwnTags(tags: string[]) {
    this.noteMetricsCollector.setOwnTags(tags);
    return this;
  }

  public setSourceTags(tags: string[]) {
    this.noteMetricsCollector.setSourceTags(tags);
    return this;
  }

  public setConceptTags(tags: string[]) {
    this.noteMetricsCollector.setConceptTags(tags);
    return this;
  }

  private isExcluded(file: TFile): boolean {
    return this.excludedFolders.some(folder =>
      file.path === folder || file.path.startsWith(folder + '/')
    );
  }

  public start() {
    this.owner.registerEvent(this.vault.on("create", (file: TFile) => { this.onfilecreated(file) }));
    this.owner.registerEvent(this.vault.on("modify", (file: TFile) => { this.onfilemodified(file) }));
    this.owner.registerEvent(this.vault.on("delete", (file: TFile) => { this.onfiledeleted(file) }));
    this.owner.registerEvent(this.vault.on("rename", (file: TFile, oldPath: string) => { this.onfilerenamed(file, oldPath) }));
    this.owner.registerEvent(this.metadataCache.on("changed", (file: TFile) => { this.onfilemodified(file) }));

    this.rescan();

    return this;
  }

  public restart() {
    this.noteMetricsCollector.clearCache();
    this.rescan();
    return this;
  }

  private rescan() {
    this.data.clear();
    this.backlog = new Set();
    this.vaultMetrics?.reset();
    this.vault.getFiles().forEach((file: TFile) => {
      if (!(file instanceof TFolder)) {
        this.push(file);
      }
    });
    this.refreshTagCount();
    this.setAdaptiveInterval();
  }

  private refreshTagCount() {
    // metadataCache.getTags() is the canonical Obsidian source for vault-wide
    // tag identifiers — it powers the Tags pane and matches what obsidian-cli
    // reports. It is exposed at runtime but absent from the public typings,
    // hence the cast.
    const getTags = (this.metadataCache as any)?.getTags;
    if (typeof getTags !== 'function') return;
    const tagsRecord = getTags.call(this.metadataCache) as Record<string, number>;
    this.vaultMetrics?.setTags(Object.keys(tagsRecord ?? {}).length);
  }

  private setAdaptiveInterval() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    let backlogSize = this.backlog.size;
    if (backlogSize > 100) {
      this.intervalMs = 100;
    } else if (backlogSize < 10) {
      this.intervalMs = 1000;
    } else {
      this.intervalMs = 500;
    }
    this.intervalId = window.setInterval(() => this.processBacklog(), this.intervalMs);
  }

  private push(fileOrPath: TFile | string) {
    if (fileOrPath instanceof TFolder) {
      return;
    }
    let path = (fileOrPath instanceof TFile) ? fileOrPath.path : fileOrPath;
    this.backlog.add(path);
    this.setAdaptiveInterval();
  }

  private async processBacklog() {
    if (this.backlog.size === 0) return;
    const batch = Array.from(this.backlog).slice(0, this.batchSize);
    await Promise.allSettled(batch.map(async (path) => {
      this.backlog.delete(path);
      const file = this.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        if (this.isExcluded(file)) {
          // file is in excluded folder — remove from count if it was counted
          this.update(path, null);
          return;
        }
        try {
          const result = await this.collect(file);
          // Convention: null = file should not be counted (non-note,
          // Excalidraw, etc.) — remove if previously counted; undefined
          // = nothing changed (cache hit) — leave existing entry alone.
          if (result === null) {
            this.update(path, null);
          } else if (result !== undefined) {
            this.update(path, result);
          }
        } catch (e) {
          console.log(`error processing ${path}: ${e}`);
        }
      } else {
        // file was deleted — remove from count
        this.update(path, null);
      }
    }));
    this.setAdaptiveInterval();
  }

  private async onfilecreated(file: TFile) {
    this.push(file);
  }

  private async onfilemodified(file: TFile) {
    this.push(file);
  }

  private async onfiledeleted(file: TFile) {
    this.push(file);
  }

  private async onfilerenamed(file: TFile, oldPath: string) {
    this.push(file);
    this.push(oldPath);
  }

  private getFileType(file: TFile): FileType {
    if (file.extension?.toLowerCase() === "md") {
      return FileType.Note;
    } else {
      return FileType.Unknown;
    }
  }

  public async collect(file: TFile): Promise<CollectResult | null | undefined> {
    if (this.getFileType(file) !== FileType.Note) {
      return null;
    }

    // Use empty metadata when the cache has not indexed the file yet.
    // Previously this path returned null and silently dropped the file from
    // the count; now we still credit one note with zero links/tags so the
    // notes total is accurate even before metadata is fully populated.
    const metadata = this.metadataCache.getFileCache(file) ?? ({} as CachedMetadata);

    if (isPluginGeneratedNote(file, metadata)) {
      return null;
    }

    return this.noteMetricsCollector.collect(file, metadata);
  }

  public update(fileOrPath: TFile | string, resultOrMetrics: CollectResult | FullVaultMetrics | null, _tags?: Set<string>) {
    let key = (fileOrPath instanceof TFile) ? fileOrPath.path : fileOrPath;

    let metrics: FullVaultMetrics | null;
    if (resultOrMetrics === null) {
      metrics = null;
    } else if (resultOrMetrics instanceof FullVaultMetrics) {
      metrics = resultOrMetrics;
    } else {
      metrics = resultOrMetrics.metrics;
    }

    this.vaultMetrics?.dec(this.data.get(key) ?? new FullVaultMetrics());

    if (metrics == null) {
      this.data.delete(key);
    } else {
      this.data.set(key, metrics);
    }

    this.vaultMetrics?.inc(metrics);
    this.refreshTagCount();
  }

  /**
   * Aggregates per-file metrics into named folder groups. A note is added
   * to every group whose paths match its file path (overlap is allowed).
   * Per-group tag count is omitted because the canonical vault-wide tag
   * count is delegated to metadataCache.getTags() and is not tracked
   * per-file in this collector.
   */
  public aggregateByGroups(groups: FolderGroupSpec[]): GroupAggregate[] {
    const normalized = groups.map(g => ({
      name: g.name,
      paths: g.paths.map(p => p.replace(/\/+$/, "")).filter(p => p.length > 0),
    }));
    const accs = new Map<string, GroupAggregate>();
    for (const g of normalized) {
      accs.set(g.name, {
        name: g.name,
        notes: 0, links: 0,
        ownNotes: 0, sourceNotes: 0, conceptNotes: 0,
        orphanNotes: 0,
      });
    }

    const linked = this.computeLinkedPaths();
    for (const [path, m] of this.data) {
      const isOrphan = !linked.has(path);
      for (const g of normalized) {
        if (matchesAnyFolder(path, g.paths)) {
          const acc = accs.get(g.name)!;
          acc.notes += m.notes;
          acc.links += m.links;
          acc.ownNotes += m.ownNotes;
          acc.sourceNotes += m.sourceNotes;
          acc.conceptNotes += m.conceptNotes;
          if (isOrphan) acc.orphanNotes += m.notes;
        }
      }
    }

    return normalized.map(g => accs.get(g.name)!);
  }

  /**
   * Counts notes in `data` that are not the destination of any resolved
   * link. metadataCache.resolvedLinks is the canonical Obsidian source —
   * keys are sources, inner keys are destinations. We invert it once,
   * then a single pass over data counts paths missing from the linked set.
   */
  public computeOrphanCount(): number {
    const linked = this.computeLinkedPaths();
    let orphans = 0;
    for (const path of this.data.keys()) {
      if (!linked.has(path)) orphans++;
    }
    return orphans;
  }

  private computeLinkedPaths(): Set<string> {
    const cache = this.metadataCache as any;
    const resolvedLinks: Record<string, Record<string, number>> | undefined = cache?.resolvedLinks;
    const out = new Set<string>();
    if (!resolvedLinks) return out;
    for (const src in resolvedLinks) {
      const dests = resolvedLinks[src];
      for (const dst in dests) {
        out.add(dst);
      }
    }
    return out;
  }

}

function matchesAnyFolder(path: string, folders: string[]): boolean {
  return folders.some(folder =>
    path === folder || path.startsWith(folder + "/")
  );
}

type NoteSignature = { links: number; tagKey: string };

export class NoteMetricsCollector {
  private readonly signatureCache: Map<string, NoteSignature> = new Map();
  private ownTags: Set<string> = new Set();
  private sourceTags: Set<string> = new Set();
  private conceptTags: Set<string> = new Set();

  public setOwnTags(tags: string[]) {
    this.ownTags = normalizeTagSet(tags);
    this.clearCache();
    return this;
  }

  public setSourceTags(tags: string[]) {
    this.sourceTags = normalizeTagSet(tags);
    this.clearCache();
    return this;
  }

  public setConceptTags(tags: string[]) {
    this.conceptTags = normalizeTagSet(tags);
    this.clearCache();
    return this;
  }

  public async collect(file: TFile, metadata: CachedMetadata): Promise<CollectResult | undefined> {
    const linkCount = this.countAllLinks(metadata);
    const noteTags = this.collectTags(metadata);
    const tagKey = Array.from(noteTags).sort().join("|");
    const cached = this.signatureCache.get(file.path);

    if (cached && cached.links === linkCount && cached.tagKey === tagKey) {
      return undefined;
    }

    this.signatureCache.set(file.path, { links: linkCount, tagKey });

    let metrics = new FullVaultMetrics();
    metrics.notes = 1;
    metrics.links = linkCount;
    metrics.tags = noteTags.size;
    metrics.ownNotes = hasIntersection(noteTags, this.ownTags) ? 1 : 0;
    metrics.sourceNotes = hasIntersection(noteTags, this.sourceTags) ? 1 : 0;
    metrics.conceptNotes = hasIntersection(noteTags, this.conceptTags) ? 1 : 0;
    metrics.quality = linkCount;

    return { metrics, tags: noteTags };
  }

  private countAllLinks(metadata: CachedMetadata): number {
    let count = 0;
    if (metadata?.links) count += metadata.links.length;
    if (metadata?.embeds) count += metadata.embeds.length;
    if (metadata?.frontmatterLinks) count += metadata.frontmatterLinks.length;
    return count;
  }

  public collectTags(metadata: CachedMetadata): Set<string> {
    const out = new Set<string>();

    if (metadata?.tags) {
      for (const t of metadata.tags) {
        const norm = normalizeTag(t.tag);
        if (norm) out.add(norm);
      }
    }

    const fmTags = metadata?.frontmatter?.tags;
    if (Array.isArray(fmTags)) {
      for (const t of fmTags) {
        if (typeof t === "string") {
          const norm = normalizeTag(t);
          if (norm) out.add(norm);
        }
      }
    } else if (typeof fmTags === "string" && fmTags.trim().length > 0) {
      for (const t of fmTags.split(/[,\s]+/)) {
        const norm = normalizeTag(t);
        if (norm) out.add(norm);
      }
    }

    return out;
  }

  public clearCache() {
    this.signatureCache.clear();
  }

  public invalidateCache(path: string) {
    this.signatureCache.delete(path);
  }
}

/**
 * Detects markdown files that are containers for plugin data rather than
 * regular notes — Excalidraw drawings and Kanban boards. These should not
 * count toward "notes" since they are not text documents the user is
 * thinking in.
 */
export function isPluginGeneratedNote(file: TFile, metadata: CachedMetadata): boolean {
  const name = file.name?.toLowerCase() ?? "";
  if (name.endsWith(".excalidraw.md")) return true;

  const fm = metadata?.frontmatter;
  if (fm) {
    if ("excalidraw-plugin" in fm) return true;
    if ("kanban-plugin" in fm) return true;
  }

  return false;
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

function normalizeTagSet(tags: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of tags) {
    const norm = normalizeTag(t);
    if (norm) out.add(norm);
  }
  return out;
}

function hasIntersection(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const v of smaller) {
    if (larger.has(v)) return true;
  }
  return false;
}
