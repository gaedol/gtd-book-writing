---
status: drafting
context: [draft]
wordGoal: 500
---
```gtd-scene
```

## Beats

- [x] The five-stage pipeline
- [x] Derived next actions
- [ ] Explicit tasks override the default
- [ ] What "stalled" means

## Draft

Every scene moves through a five-stage pipeline: `idea → outlined → drafting → revising → final`. The status lives in the scene's frontmatter and is the engine behind everything else.

The core GTD idea: a scene always has a **next action**. You usually don't write it yourself — the plugin derives it from the status. An `idea` scene's next action is "outline this scene"; an `outlined` scene's is "draft this scene", and so on.

When the derived action isn't specific enough, add an ordinary checkbox task to the scene ("- [ ] check the tide tables"). The **first open task always overrides** the derived default — so your next action is exactly as concrete as you need it to be, and never missing.

A scene with no resolvable next action — typically one with no status — is **stalled**. That's the one state the plugin treats as an error, because a project you can't act on is a project that quietly dies.
