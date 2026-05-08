import { Component, Vault, MetadataCache, TFile, TFolder, CachedMetadata } from 'obsidian';
import { FullVaultMetrics } from './metrics';

enum FileType {
  Unknown = 0,
  Note,
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
    this.setAdaptiveInterval();
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
          const metrics = await this.collect(file);
          if (metrics !== null && metrics !== undefined) {
            this.update(path, metrics);
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

  public async collect(file: TFile): Promise<FullVaultMetrics | null | undefined> {
    const metadata = this.metadataCache.getFileCache(file);
    if (metadata === null) {
      return null;
    }

    let metrics: FullVaultMetrics | null | undefined;
    switch (this.getFileType(file)) {
      case FileType.Note:
        metrics = await this.noteMetricsCollector.collect(file, metadata);
        break;
      default:
        metrics = null;
    }
    return metrics;
  }

  public update(fileOrPath: TFile | string, metrics: FullVaultMetrics | null) {
    let key = (fileOrPath instanceof TFile) ? fileOrPath.path : fileOrPath;

    this.vaultMetrics?.dec(this.data.get(key) ?? new FullVaultMetrics());

    if (metrics == null) {
      this.data.delete(key);
    } else {
      this.data.set(key, metrics);
    }

    this.vaultMetrics?.inc(metrics);
  }

}

type NoteSignature = { links: number; tags: number };

export class NoteMetricsCollector {
  private readonly signatureCache: Map<string, NoteSignature> = new Map();

  public async collect(file: TFile, metadata: CachedMetadata): Promise<FullVaultMetrics | null> {
    const linkCount = this.countAllLinks(metadata);
    const tagCount = this.countAllTags(metadata);
    const cached = this.signatureCache.get(file.path);

    if (cached && cached.links === linkCount && cached.tags === tagCount) {
      return null;
    }

    this.signatureCache.set(file.path, { links: linkCount, tags: tagCount });

    let metrics = new FullVaultMetrics();
    metrics.notes = 1;
    metrics.links = linkCount;
    metrics.tags = tagCount;
    metrics.quality = linkCount;

    return metrics;
  }

  private countAllLinks(metadata: CachedMetadata): number {
    let count = 0;
    if (metadata?.links) count += metadata.links.length;
    if (metadata?.embeds) count += metadata.embeds.length;
    if (metadata?.frontmatterLinks) count += metadata.frontmatterLinks.length;
    return count;
  }

  public countAllTags(metadata: CachedMetadata): number {
    let count = 0;
    if (metadata?.tags) count += metadata.tags.length;

    const fmTags = metadata?.frontmatter?.tags;
    if (Array.isArray(fmTags)) {
      count += fmTags.length;
    } else if (typeof fmTags === "string" && fmTags.trim().length > 0) {
      count += fmTags.split(/[,\s]+/).filter(t => t.length > 0).length;
    }

    return count;
  }

  public clearCache() {
    this.signatureCache.clear();
  }

  public invalidateCache(path: string) {
    this.signatureCache.delete(path);
  }
}
