---
status: drafting
context: [draft]
wordGoal: 300
---
```gtd-scene
```

## Beats

- [x] Manual install via symlink
- [ ] Community-plugins install (once published)
- [ ] Screenshot of the enabled plugin

## Draft

The plugin isn't in the community catalog yet, so installation is manual. Clone or copy the plugin folder, build it, and link it into your vault:

```
npm install
npm run build
ln -s /path/to/gtd-book-writing "/path/to/YourVault/.obsidian/plugins/gtd-book-writing"
```

Then open **Settings → Community plugins**, turn off Safe mode if needed, and enable **GTD Book Writing**. A book icon appears in the ribbon — that's the panel.

After rebuilding (`npm run dev` keeps `main.js` fresh), reload Obsidian with Cmd+R to pick up the new build.
