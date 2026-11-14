# Words on screen

Everything the app shows follows these rules: labels, buttons, tooltips, messages,
settings and the changelog. They're the template's defaults. An app made from it adds its
own words to the table.

## Plain words

Write for someone who has never seen the app and doesn't know how it's built. Name things
by what a person does with them, not by how they work.

| Technical term | People see | Notes |
|---|---|---|
| Document, file, record | **Note** in the example; the app's own word | `documentType.noun` in code, so the word lives in one place |
| Library, data folder | **Your notes** | The page; **Where your work is saved** in Settings |
| Trash, bin, soft delete | **Recently removed** | Kept 30 days. **Remove** moves something there; **Remove for good** is the only thing that can't be undone |
| Delete | **Remove** | |
| Duplicate | **Copy** | |
| Draft, autosave, crash recovery | **You left some work unsaved** / **Pick up where I left off** | |
| Dirty, unsaved changes | **Unsaved** | A dot beside the name in the title bar |
| Backup archive, zip | **Backup** | "A backup is one .zip file…" is fine where the file is the point |
| Restore, import | **Restore** / **Bring back** | |
| S3, bucket, endpoint | **Cloud backup**, **Bucket**, **Storage address** | Only in cloud setup, where people bring these words with them |
| Credentials, secret key | **Keys** | The secret is never shown again once saved |
| Command palette | **Search or run** | |
| Keybinding, hotkey | **Shortcut** / **Keys** | |
| JSON, schema, version mismatch | *(never shown)* | "Made by a newer version of the app. Update it to open this." |
| Bindings, service, IPC | *(never shown)* | |

## Button voice

One verb per button. The verb names the outcome.

| Don't write | Write |
|---|---|
| OK | Name the outcome: **Save**, **Export**, **Got it** |
| Apply | What it does: **Rename**, **Restore 2 notes** |
| Confirm | **Remove for good**, **Replace** |
| Submit | **Save**, **Open GitHub** |
| Reset | **Restore default**, **Reset this page** |
| Yes / No | The two outcomes: **Replace** / **Keep them** |

A button that starts a dialog ends with an ellipsis: **Export…**, **Save a copy…**.

## Error voice

A message says what didn't happen, why if it's known, and what to do next. The person is
never blamed, and nothing technical is shown unless it helps them act.

> "Couldn't back up to D:\Backups: the folder isn't there. Plug the drive in, or choose
> another folder in Settings, Backup."

## Sentences

- Short sentences, in the second person: "Your work is saved", not "The work has been saved".
- Sentence case everywhere: **Recently removed**, not **Recently Removed**.
- No exclamation marks, no "simply" or "just", no "please" in labels.
- Numbers as digits: "3 notes", "Removed 2 notes".
