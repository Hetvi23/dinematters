# Git Merge Instructions for Server Pull

## When You See Merge Message Editor

If you're in nano/vi showing a merge commit message:

### In Nano:
1. **Save**: Press `Ctrl+O` (Write Out)
2. **Confirm**: Press `Enter` to confirm filename
3. **Exit**: Press `Ctrl+X`

### In Vi/Vim:
1. **Save and Exit**: Press `Esc`, then type `:wq` and press `Enter`

## Accept Current Changes (Your Local Changes)

If you want to keep your current server changes:

```bash
# Abort the merge and keep your changes
git merge --abort

# Or if merge already started, accept your version
git checkout --ours .
git add .
git commit -m "Merge: Keep server changes"
```

## Accept Remote Changes (From GitHub)

If you want to accept all changes from GitHub:

```bash
# Accept their version
git checkout --theirs .
git add .
git commit -m "Merge: Accept remote changes"
```

## Complete Merge (Default Message)

If you just want to complete with default message:

```bash
# In nano: Ctrl+O, Enter, Ctrl+X
# Or use --no-edit flag to skip editor
git merge --no-edit
```

## Recommended: Pull with Strategy

```bash
# Pull and automatically merge (accepts default message)
git pull --no-edit

# Or pull and rebase (cleaner history)
git pull --rebase

# Or pull with merge strategy
git pull --strategy-option=ours  # Keep your changes
git pull --strategy-option=theirs # Accept remote changes
```
