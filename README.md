# Vault Full Statistics Plugin

![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/jtprogru/obsidian-vault-full-statistics-plugin/total)
![GitHub License](https://img.shields.io/github/license/jtprogru/obsidian-vault-full-statistics-plugin)

**NOTE**: This plugin is modified fork of the [Obsidian Vault Statistics Plugin](https://github.com/bkyle/obsidian-vault-statistics-plugin) plugin.

Status bar item with vault statistics:

- number of notes – count of all notes in the vault
- number of links – count of all links in the vault
- QoV (Quality of Vault) – number of links divided by number of notes

## Installation

For installation this plugin please use [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin. Alternative installation way is download latest version of artifacts from [release section](https://github.com/jtprogru/obsidian-vault-full-statistics-plugin/releases) and move this in `<vault>/.obsidian/plugins/vault-full-statistics`.

## Usage

After the plugin is installed and enabled you will see a new item appear in the status bar showing you the number of notes in your vault.

- Click on the status bar item to cycle through the available statistics.
- Hover over the status bar item to see all of the available statistics.

## Advanced Usage

### Showing All Statistics

All statistics can be shown by creating and enabling a CSS snippet with the following content.

```css
/* Show all vault statistics. */
.obsidian-vault-full-statistics--item {
    display: initial !important;
}
```

### Showing Selected Statistics

Similarly to the above, one can show certain statistics using a similar method to the above.  Below is a snippet that hides all by the notes statistics.  The snippet can be modified to include more or different statistics.

```css
/* Hide all statistics. */
.obsidian-vault-full-statistics--item {
    display: none !important;
}

/* Always show the notes statistics. */
.obsidian-vault-full-statistics--item-notes {
    display: initial !important;
}
```

## License

[WTFPL](LICENSE)
