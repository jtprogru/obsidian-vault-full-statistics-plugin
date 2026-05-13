import { Component, Vault, MetadataCache, TFile, TFolder, TAbstractFile, CachedMetadata } from 'obsidian';
import { FullVaultMetrics } from './metrics';
import { addToBucket, DAY_MS, emptyBucket, InboxHealth } from './inbox';
import { countWords } from './text';

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
  private vault!: Vault;
  private metadataCache!: MetadataCache;
  private readonly data: Map<string, FullVaultMetrics> = new Map();
  private backlog: Set<string> = new Set();
  private vaultMetrics: FullVaultMetrics = new FullVaultMetrics();
  private intervalId: number | null = null;
  private readonly batchSize: number = 16;
  private intervalMs = 100;
  private readonly noteMetricsCollector: NoteMetricsCollector;
  private excludedFolders: string[] = [];
  private inboxFolders: string[] = [];
  private inboxReviewTags: Set<string> = new Set();

  // Memoization generation: bumped at the end of every backlog batch and
  // on settings changes so cached graph derivatives (linked paths, orphan
  // count, sources-with-trace, folder aggregates, inbox health, tag count)
  // are reused across renders within a single update cycle.
  private generation = 0;
  private linkedPathsCache: { gen: number; set: Set<string> } | null = null;
  private orphanCountCache: { gen: number; count: number } | null = null;
  private sourcesTraceCache: { gen: number; result: { withTrace: number; dangling: string[] } } | null = null;
  private tagOccurrencesCache: { gen: number; record: Record<string, number>; size: number } | null = null;
  private aggregateCache: { gen: number; key: string; result: GroupAggregate[] } | null = null;
  private inboxHealthCache: { gen: number; hourBucket: number; result: InboxHealth } | null = null;
  private linkValencyCache: { gen: number; incoming: Map<string, number>; outgoing: Map<string, number> } | null = null;

  constructor(owner: Component) {
    this.owner = owner;
    this.noteMetricsCollector = new NoteMetricsCollector();
  }

  /**
   * Invalidate every memoized graph derivative. Called automatically after
   * each backlog batch; callers (settings changes, restart) can call it
   * directly when external state shifts.
   */
  public bumpGeneration() {
    this.generation++;
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
    this.bumpGeneration();
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

  public setInboxFolders(folders: string[]) {
    this.inboxFolders = folders
      .map(f => f.trim().replace(/\/+$/, ''))
      .filter(f => f.length > 0);
    this.bumpGeneration();
    return this;
  }

  public setInboxReviewTags(tags: string[]) {
    this.inboxReviewTags = normalizeTagSet(tags);
    this.bumpGeneration();
    return this;
  }

  private isExcluded(file: TFile): boolean {
    return this.excludedFolders.some(folder =>
      file.path === folder || file.path.startsWith(folder + '/')
    );
  }

  public start() {
    // Obsidian's vault events deliver TAbstractFile; we only care about
    // TFile (folders enter `data` via push as well but are filtered out).
    this.owner.registerEvent(this.vault.on("create", (file: TAbstractFile) => { if (file instanceof TFile) this.onfilecreated(file); }));
    this.owner.registerEvent(this.vault.on("modify", (file: TAbstractFile) => { if (file instanceof TFile) this.onfilemodified(file); }));
    this.owner.registerEvent(this.vault.on("delete", (file: TAbstractFile) => { if (file instanceof TFile) this.onfiledeleted(file); }));
    this.owner.registerEvent(this.vault.on("rename", (file: TAbstractFile, oldPath: string) => { if (file instanceof TFile) this.onfilerenamed(file, oldPath); }));
    this.owner.registerEvent(this.metadataCache.on("changed", (file: TFile) => { this.onfilemodified(file) }));

    // Obsidian fires "resolved" after it rebuilds resolvedLinks (e.g. mass
    // rename, vault load). Bump our generation so memoized graph
    // derivatives recompute against the new link map.
    const resolvedRef = (this.metadataCache as any).on?.("resolved", () => { this.bumpGeneration(); });
    if (resolvedRef) this.owner.registerEvent(resolvedRef);

    this.rescan();

    return this;
  }

  public restart() {
    this.noteMetricsCollector.clearCache();
    this.bumpGeneration();
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
    this.vaultMetrics?.setTags(this.tagOccurrenceSize());
  }

  // metadataCache.getTags() is the canonical Obsidian source for vault-wide
  // tag identifiers — it powers the Tags pane and matches what obsidian-cli
  // reports. It is exposed at runtime but absent from the public typings,
  // hence the cast. Memoized per generation so refreshTagCount inside a
  // backlog batch and the taxonomy view render share one call.
  public getTagOccurrences(): Record<string, number> {
    const cached = this.tagOccurrencesCache;
    if (cached && cached.gen === this.generation) return cached.record;
    const getTags = (this.metadataCache as any)?.getTags;
    const record: Record<string, number> = (typeof getTags === 'function')
      ? ((getTags.call(this.metadataCache) as Record<string, number>) ?? {})
      : {};
    this.tagOccurrencesCache = { gen: this.generation, record, size: Object.keys(record).length };
    return record;
  }

  private tagOccurrenceSize(): number {
    const cached = this.tagOccurrencesCache;
    if (cached && cached.gen === this.generation) return cached.size;
    this.getTagOccurrences();
    return this.tagOccurrencesCache!.size;
  }

  private setAdaptiveInterval() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    const backlogSize = this.backlog.size;
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
    const path = (fileOrPath instanceof TFile) ? fileOrPath.path : fileOrPath;
    this.backlog.add(path);
    this.setAdaptiveInterval();
  }

  private async processBacklog() {
    if (this.backlog.size === 0) return;
    const batch = Array.from(this.backlog).slice(0, this.batchSize);
    this.vaultMetrics?.beginBatch();
    try {
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
          } catch {
            // Silently swallow per-file processing errors so a single
            // bad file does not stall the backlog; the file stays in
            // `data` with its previous value (or remains absent).
          }
        } else {
          // file was deleted — remove from count
          this.update(path, null);
        }
      }));

      // Compute graph-derived metrics in the batch tail so the single
      // coalesced 'updated' event carries fresh orphan and trace counts.
      // Listeners no longer need a separate debounced refresh. update()
      // already bumped the memoization generation per file, so these
      // computes run on a fresh gen and their results are cached for the
      // 500 ms-debounced view render that follows.
      if (this.metadataCache) {
        this.vaultMetrics?.setOrphans(this.computeOrphanCount());
        this.vaultMetrics?.setSourcesWithTrace(this.computeSourcesTrace().withTrace);
      }
    } finally {
      this.vaultMetrics?.endBatch();
    }
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

    // Skip the disk read entirely when nothing relevant changed. A sibling
    // rename or backlink update fires metadataCache.changed without bumping
    // this file's mtime; the signature pre-check catches that and avoids
    // both the cachedRead and the word tokenizer.
    if (this.noteMetricsCollector.peekSignature(file, metadata)) {
      return undefined;
    }

    // cachedRead returns the in-memory copy Obsidian already keeps for open
    // files and a disk read for the rest; either way the call is cheap and
    // throttled by the backlog batch (16 at a time) so the initial scan does
    // not stall on huge vaults.
    const content = await this.vault.cachedRead(file);
    return this.noteMetricsCollector.collect(file, metadata, content);
  }

  public update(fileOrPath: TFile | string, resultOrMetrics: CollectResult | FullVaultMetrics | null, _tags?: Set<string>) {
    const key = (fileOrPath instanceof TFile) ? fileOrPath.path : fileOrPath;

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
      // Drop signature too — otherwise the cache grows unbounded across
      // long sessions with file churn (deletes + renames).
      this.noteMetricsCollector.invalidateCache(key);
    } else {
      this.data.set(key, metrics);
    }

    // data changed → all gen-keyed graph derivatives are stale.
    this.bumpGeneration();

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
    const key = JSON.stringify(groups);
    const cached = this.aggregateCache;
    if (cached && cached.gen === this.generation && cached.key === key) {
      return cached.result;
    }

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

    const result = normalized.map(g => accs.get(g.name)!);
    this.aggregateCache = { gen: this.generation, key, result };
    return result;
  }

  /**
   * Buckets notes inside `inboxFolders` and notes outside those folders
   * tagged with one of `inboxReviewTags` by file age (file.stat.ctime).
   * The two cohorts are reported separately so the user can see both
   * "physical inbox" pressure (folder) and "tag-marked queue" outside.
   *
   * Excluded folders apply: a file in an excluded folder never counts,
   * even if it would otherwise match. Age boundaries are half-open
   * (1d, 7d, 30d) — see inbox.ts.
   */
  public computeInboxHealth(now: Date): InboxHealth {
    // Bucket by hour: age boundaries (1d/7d/30d) shift discretely as time
    // passes, so within an hour the bucketing is stable. This collapses the
    // O(N) walk to ≤1 per hour even with constant render activity.
    const hourBucket = Math.floor(now.getTime() / (60 * 60 * 1000));
    const cached = this.inboxHealthCache;
    if (cached && cached.gen === this.generation && cached.hourBucket === hourBucket) {
      return cached.result;
    }

    const inFolder = emptyBucket();
    const outsideWithTag = emptyBucket();
    const nowMs = now.getTime();
    if (this.inboxFolders.length === 0 && this.inboxReviewTags.size === 0) {
      const empty = { inFolder, outsideWithTag };
      this.inboxHealthCache = { gen: this.generation, hourBucket, result: empty };
      return empty;
    }
    for (const file of this.vault.getMarkdownFiles()) {
      if (this.isExcluded(file)) continue;
      const ageDays = (nowMs - (file.stat?.ctime ?? nowMs)) / DAY_MS;
      const inInbox = matchesAnyFolder(file.path, this.inboxFolders);
      if (inInbox) {
        addToBucket(inFolder, ageDays);
        continue;
      }
      if (this.inboxReviewTags.size === 0) continue;
      const metadata = this.metadataCache.getFileCache(file);
      if (!metadata) continue;
      const fileTags = this.noteMetricsCollector.collectTags(metadata);
      if (hasIntersection(fileTags, this.inboxReviewTags)) {
        addToBucket(outsideWithTag, ageDays);
      }
    }
    const result = { inFolder, outsideWithTag };
    this.inboxHealthCache = { gen: this.generation, hourBucket, result };
    return result;
  }

  /**
   * For each source-tagged note, checks whether at least one own-tagged
   * note links to it (operationalization of "did the source leave a
   * trace"). Returns the count of traced sources plus the list of
   * dangling source paths so callers can surface them.
   *
   * Both ownNotes and sourceNotes flags come from the per-file metrics
   * already in `data`, so this is a graph traversal of resolvedLinks
   * with set lookups — O(L) where L is total resolved links in the
   * vault.
   */
  public computeSourcesTrace(): { withTrace: number; dangling: string[] } {
    const cached = this.sourcesTraceCache;
    if (cached && cached.gen === this.generation) return cached.result;

    const ownPaths = new Set<string>();
    const sourcePaths = new Set<string>();
    for (const [path, m] of this.data) {
      if (m.ownNotes > 0) ownPaths.add(path);
      if (m.sourceNotes > 0) sourcePaths.add(path);
    }
    const cache = this.metadataCache as any;
    const resolvedLinks: Record<string, Record<string, number>> | undefined = cache?.resolvedLinks;
    const traced = new Set<string>();
    if (resolvedLinks) {
      for (const src in resolvedLinks) {
        if (!ownPaths.has(src)) continue;
        const dests = resolvedLinks[src];
        for (const dst in dests) {
          if (sourcePaths.has(dst)) traced.add(dst);
        }
      }
    }
    const dangling: string[] = [];
    for (const p of sourcePaths) {
      if (!traced.has(p)) dangling.push(p);
    }
    dangling.sort();
    const result = { withTrace: traced.size, dangling };
    this.sourcesTraceCache = { gen: this.generation, result };
    return result;
  }

  /**
   * Counts notes in `data` that are not the destination of any resolved
   * link. metadataCache.resolvedLinks is the canonical Obsidian source —
   * keys are sources, inner keys are destinations. We invert it once,
   * then a single pass over data counts paths missing from the linked set.
   */
  public computeOrphanCount(): number {
    const cached = this.orphanCountCache;
    if (cached && cached.gen === this.generation) return cached.count;

    const linked = this.computeLinkedPaths();
    let orphans = 0;
    for (const path of this.data.keys()) {
      if (!linked.has(path)) orphans++;
    }
    this.orphanCountCache = { gen: this.generation, count: orphans };
    return orphans;
  }

  /**
   * Returns iteration over every tracked note path. Used by tangle
   * detection and other consumers that need to enumerate candidates
   * without exposing the internal per-file metrics map.
   */
  public listNotePaths(): IterableIterator<string> {
    return this.data.keys();
  }

  /**
   * Single pass over metadataCache.resolvedLinks that yields both
   * incoming-degree and outgoing-degree per note (count of distinct
   * destinations / sources, not edge multiplicity). Memoized by
   * generation — invalidated by bumpGeneration() the same way as
   * linkedPathsCache.
   */
  public computeLinkValency(): { incoming: Map<string, number>; outgoing: Map<string, number> } {
    const cached = this.linkValencyCache;
    if (cached && cached.gen === this.generation) {
      return { incoming: cached.incoming, outgoing: cached.outgoing };
    }

    const cache = this.metadataCache as any;
    const resolvedLinks: Record<string, Record<string, number>> | undefined = cache?.resolvedLinks;
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();
    if (resolvedLinks) {
      for (const src in resolvedLinks) {
        const dests = resolvedLinks[src];
        let outDeg = 0;
        for (const dst in dests) {
          outDeg++;
          incoming.set(dst, (incoming.get(dst) ?? 0) + 1);
        }
        if (outDeg > 0) outgoing.set(src, outDeg);
      }
    }
    this.linkValencyCache = { gen: this.generation, incoming, outgoing };
    return { incoming, outgoing };
  }

  private computeLinkedPaths(): Set<string> {
    const cached = this.linkedPathsCache;
    if (cached && cached.gen === this.generation) return cached.set;

    const cache = this.metadataCache as any;
    const resolvedLinks: Record<string, Record<string, number>> | undefined = cache?.resolvedLinks;
    const out = new Set<string>();
    if (resolvedLinks) {
      for (const src in resolvedLinks) {
        const dests = resolvedLinks[src];
        for (const dst in dests) {
          out.add(dst);
        }
      }
    }
    this.linkedPathsCache = { gen: this.generation, set: out };
    return out;
  }

}

function matchesAnyFolder(path: string, folders: string[]): boolean {
  return folders.some(folder =>
    path === folder || path.startsWith(folder + "/")
  );
}

type NoteSignature = { links: number; tagKey: string; mtime: number; words: number };

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

  public async collect(file: TFile, metadata: CachedMetadata, content?: string): Promise<CollectResult | undefined> {
    const linkCount = this.countAllLinks(metadata);
    const noteTags = this.collectTags(metadata);
    const tagKey = Array.from(noteTags).sort().join("|");
    const mtime = file.stat?.mtime ?? 0;
    const cached = this.signatureCache.get(file.path);

    // mtime is in the signature so a body edit that changes word count but
    // leaves links/tags untouched still invalidates the cache.
    if (cached && cached.links === linkCount && cached.tagKey === tagKey && cached.mtime === mtime) {
      return undefined;
    }

    const metrics = new FullVaultMetrics();
    metrics.notes = 1;
    metrics.links = linkCount;
    metrics.tags = noteTags.size;
    metrics.words = content ? countWords(content) : 0;
    metrics.ownNotes = hasIntersection(noteTags, this.ownTags) ? 1 : 0;
    metrics.sourceNotes = hasIntersection(noteTags, this.sourceTags) ? 1 : 0;
    metrics.conceptNotes = hasIntersection(noteTags, this.conceptTags) ? 1 : 0;
    metrics.quality = linkCount;

    this.signatureCache.set(file.path, { links: linkCount, tagKey, mtime, words: metrics.words });

    return { metrics, tags: noteTags };
  }

  /**
   * Cheap probe used by the outer collector to skip cachedRead when the
   * file's own metrics cannot have changed. Re-uses the same fields as the
   * internal cache check in {@link collect}, so the two stay in sync — a
   * peek-hit guarantees an inner-collect cache hit on the same inputs.
   */
  public peekSignature(file: TFile, metadata: CachedMetadata): boolean {
    const cached = this.signatureCache.get(file.path);
    if (!cached) return false;
    const mtime = file.stat?.mtime ?? 0;
    if (cached.mtime !== mtime) return false;
    if (cached.links !== this.countAllLinks(metadata)) return false;
    const tagKey = Array.from(this.collectTags(metadata)).sort().join("|");
    return cached.tagKey === tagKey;
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
