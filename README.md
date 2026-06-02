# nrs — NPM Registry Switcher

Manage multiple npm registry profiles and switch between them instantly.

NRS stores named `.npmrc` configurations in a dedicated directory (`~/.nrs/`) and lets you list, create, switch, and delete profiles. Switching copies the selected profile's content into your `~/.npmrc` file.

## Installation

```bash
npm install -g nrs-cli
```

## Usage

### List profiles

```bash
nrs list
```

Displays all saved profiles, sorted alphabetically. The active profile is marked with `*`.

### List profiles with registry URLs

```bash
nrs list full
```

Displays all profiles with their registry URL shown in brackets.

```
* work [https://registry.internal.company.com/]
  oss [https://registry.npmjs.org/]
```

### Switch profile

```bash
nrs use <name>
```

Switches to the named profile. Supports prefix matching — `nrs use wo` resolves to `work` if it's the only match.

If the current `.npmrc` has been modified externally since the last switch, NRS will prompt for confirmation before overwriting.

### Create or update a profile

```bash
nrs <name> set registry="<url>"
```

Creates a new profile or overwrites an existing one with the given registry URL.

```bash
# Examples
nrs work set registry="https://registry.internal.company.com/"
nrs oss set registry="https://registry.npmjs.org/"
```

### Delete a profile

```bash
nrs delete <name>
```

Removes the named profile from the store. If the deleted profile was active, the active state is cleared.

### Rename a profile

```bash
nrs rename <old> <new>
```

Renames an existing profile. The content is preserved and the old name is removed. If the renamed profile was active, the active marker updates to the new name.

If the destination name already exists, NRS will prompt for confirmation before overwriting (in interactive mode) or error out (in non-interactive/CI mode).

### Copy a profile

```bash
nrs copy <source> <target>
```

Duplicates a profile under a new name. The source profile remains unchanged and the active marker is not affected.

If the target name already exists, NRS will prompt for confirmation before overwriting (in interactive mode) or error out (in non-interactive/CI mode).

### Help

```bash
nrs help
```

Displays available commands and flags.

### Version

```bash
nrs --version
```

Displays the current version.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NRS_STORE` | Directory where profiles are stored | `~/.nrs/` |
| `NRS_NPMRC` | Path to the `.npmrc` file NRS manages | `~/.npmrc` |

## Requirements

- Node.js >= 20.0.0

## License

MIT
