# Claude Code conventions

## Git inspections: use `git -C <path>` instead of `cd <path> && git`

For read-only git checks (status, diff, log, show, blame, etc.), invoke git with `-C <path>` to point it at a directory rather than cd'ing first. Claude Code escalates every `cd … && git …` compound to a permission prompt (bare-repository-attack protection), and `git -C` avoids the compound entirely.

- Avoid: `cd <worktree> && git status && git diff --stat`
- Prefer: `git -C <worktree> status && git -C <worktree> diff --stat`
