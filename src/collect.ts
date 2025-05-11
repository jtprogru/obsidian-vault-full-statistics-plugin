import { Component, Vault, MetadataCache, TFile, TFolder, CachedMetadata } from 'obsidian';
import { FullVaultMetrics } from './metrics';
import { MARKDOWN_TOKENIZER, UNIT_TOKENIZER } from './text';


enum FileType {
  Unknown = 0,
  Note,
  Attachment,
}

export class FullVaultMetricsCollector {

  private readonly owner: Component;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private readonly data: Map<string, FullVaultMetrics> = new Map();
  private backlog: Set<string> = new Set();
  private excludeDirectories: Set<string> = new Set();
  private vaultMetrics: FullVaultMetrics = new FullVaultMetrics();
  private readonly cache: Map<string, {mtime: number, metrics: FullVaultMetrics}> = new Map();
  private intervalId: number | null = null;
  private readonly batchSize: number = 8;
  private readonly maxFileSize: number = 512 * 1024; // 512 KB
  private intervalMs: number = 2000;

  constructor(owner: Component) {
    this.owner = owner;
  }

  public setVault(vault: Vault) {
    this.vault = vault;
    return this;
  }

  public setExcludeDirectories(excludeDirectories: string) {
    this.excludeDirectories = new Set(
      excludeDirectories.split(',').map((d) => d.trim()).filter(Boolean)
    );
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

  public start() {
    this.owner.registerEvent(this.vault.on("create", (file: TFile) => { this.onfilecreated(file) }));
    this.owner.registerEvent(this.vault.on("modify", (file: TFile) => { this.onfilemodified(file) }));
    this.owner.registerEvent(this.vault.on("delete", (file: TFile) => { this.onfiledeleted(file) }));
    this.owner.registerEvent(this.vault.on("rename", (file: TFile, oldPath: string) => { this.onfilerenamed(file, oldPath) }));
    this.owner.registerEvent(this.metadataCache.on("resolve", (file: TFile) => { this.onfilemodified(file) }));
    this.owner.registerEvent(this.metadataCache.on("changed", (file: TFile) => { this.onfilemodified(file) }));

    this.data.clear();
    this.backlog = new Set();
    this.cache.clear();
    this.vaultMetrics?.reset();
    this.vault.getFiles().forEach((file: TFile) => {
      if (!(file instanceof TFolder)) {
        this.push(file);
      }
    });
    this.setExcludeDirectories(this.excludeDirectories ? Array.from(this.excludeDirectories).join(',') : '');
    this.setAdaptiveInterval();

    return this;
  }

  private setAdaptiveInterval() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    let backlogSize = this.backlog.size;
    if (backlogSize > 100) {
      this.intervalMs = 500;
    } else if (backlogSize < 10) {
      this.intervalMs = 5000;
    } else {
      this.intervalMs = 2000;
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
      if ((path == null) || path.split("/").some((dir) => this.excludeDirectories.has(dir))) {
        this.backlog.delete(path);
        return;
      }
      let file = this.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        try {
          let metrics = await this.collect(file);
          if (metrics !== null && metrics !== undefined) {
            this.update(path, metrics);
          }
        } catch (e) {
          console.log(`error processing ${path}: ${e}`);
        }
      }
      this.backlog.delete(path);
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
      return FileType.Attachment;
    }
  }

  public async collect(file: TFile): Promise<FullVaultMetrics | null | undefined> {
    const metadata = this.metadataCache.getFileCache(file);
    if (metadata === null) {
      return null;
    }
    // Кэширование по пути и mtime
    const cacheKey = file.path;
    const mtime = file.stat?.mtime ?? 0;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.mtime === mtime) {
      return cached.metrics;
    }
    let metrics: FullVaultMetrics | null | undefined;
    switch (this.getFileType(file)) {
      case FileType.Note:
        metrics = await new NoteMetricsCollector(this.vault, this.maxFileSize).collect(file, metadata);
        break;
      case FileType.Attachment:
        metrics = await new FileMetricsCollector().collect(file, metadata);
        break;
      default:
        metrics = null;
    }
    if (metrics) {
      this.cache.set(cacheKey, {mtime, metrics});
    }
    return metrics;
  }

  public update(fileOrPath: TFile | string, metrics: FullVaultMetrics) {
    let key = (fileOrPath instanceof TFile) ? fileOrPath.path : fileOrPath;

    // Remove the existing values for the passed file if present, update the
    // raw values, then add the values for the passed file to the totals.
    this.vaultMetrics?.dec(this.data.get(key) ?? new FullVaultMetrics());

    if (metrics == null) {
      this.data.delete(key);
    } else {
      this.data.set(key, metrics);
    }

    this.vaultMetrics?.inc(metrics);
  }

}

class NoteMetricsCollector {

  public static readonly TOKENIZERS = new Map([
    ["paragraph", MARKDOWN_TOKENIZER],
    ["heading", MARKDOWN_TOKENIZER],
    ["list", MARKDOWN_TOKENIZER],
    ["table", UNIT_TOKENIZER],
    ["yaml", UNIT_TOKENIZER],
    ["code", UNIT_TOKENIZER],
    ["blockquote", MARKDOWN_TOKENIZER],
    ["math", UNIT_TOKENIZER],
    ["thematicBreak", UNIT_TOKENIZER],
    ["html", UNIT_TOKENIZER],
    ["text", UNIT_TOKENIZER],
    ["element", UNIT_TOKENIZER],
    ["footnoteDefinition", UNIT_TOKENIZER],
    ["definition", UNIT_TOKENIZER],
    ["callout", MARKDOWN_TOKENIZER],
    ["comment", UNIT_TOKENIZER],
  ]);

  private readonly vault: Vault;
  private readonly maxFileSize: number;

  constructor(vault: Vault, maxFileSize: number = 512 * 1024) {
    this.vault = vault;
    this.maxFileSize = maxFileSize;
  }

  public async collect(file: TFile, metadata: CachedMetadata): Promise<FullVaultMetrics> {
    let metrics = new FullVaultMetrics();

    metrics.files = 1;
    metrics.notes = 1;
    metrics.attachments = 0;
    metrics.size = file.stat?.size;
    metrics.links = metadata?.links?.length ?? 0;
    const words = await this.vault.cachedRead(file).then((content: string) => {
      // Ограничение размера анализа
      if (content.length > this.maxFileSize) {
        content = content.substring(0, this.maxFileSize);
      }
      return metadata.sections?.map(section => {
        const sectionType = section.type;
        const startOffset = section.position?.start?.offset;
        const endOffset = section.position?.end?.offset;
        const tokenizer = NoteMetricsCollector.TOKENIZERS.get(sectionType);
        if (!tokenizer) {
          console.log(`${file.path}: no tokenizer, section.type=${section.type}`);
          return 0;
        } else {
          const tokens = tokenizer.tokenize(content.substring(startOffset, endOffset));
          return tokens.length;
        }
      }).reduce((a, b) => a + b, 0);
    }).catch((e) => {
      console.log(`${file.path} ${e}`);
      return 0;
    });
    metrics.words = words ?? 0;
    metrics.quality = metrics.notes !== 0 ? (metrics.links / metrics.notes) : 0.0;
    metrics.tags = metadata?.tags?.length ?? 0;

    return metrics;
  }
}

class FileMetricsCollector {

  public async collect(file: TFile, metadata: CachedMetadata): Promise<FullVaultMetrics> {
    let metrics = new FullVaultMetrics();
    metrics.files = 1;
    metrics.notes = 0;
    metrics.attachments = 1;
    metrics.size = file.stat?.size;
    metrics.links = 0;
    metrics.words = 0;
	metrics.quality = 0.0;
	metrics.tags = 0;
    return metrics;
  }
}
