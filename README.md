# Obsidian Vault Full Statistics Plugin

**NOTE**: This plugin is modified fork of the [Obsidian Vault Statistics Plugin](https://github.com/bkyle/obsidian-vault-statistics-plugin) plugin.

Status bar item with vault full statistics including:

- number of notes – count of all notes in the vault
- number of attachments – count of all attachments in the vault
- number of files – count of all files in the vault (attachments + notes)
- number of links – count of all links in the vault
- number of words – count of all words in the vault
- vault size – total size of all files in the vault
- vault quality – number of links divided by number of notes
- number of tags – count of all tags in the vault

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

Similarly to the above, one can show certain statistics using a similar method to the above.  Below is a snippet that hides all by the notes and attachments statistics.  The snippet can be modified to include more or different statistics.

``` css
/* Hide all statistics. */
.obsidian-vault-full-statistics--item {
    display: none !important;
}

/* Always show the notes and attachments statistics. */
.obsidian-vault-full-statistics--item-notes,
.obsidian-vault-full-statistics--item-attachments {
    display: initial !important;
}
```

## License

[WTFPL](LICENSE)
