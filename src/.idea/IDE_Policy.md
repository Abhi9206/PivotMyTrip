# IDE Policy (JetBrains) - NomadAI

## Purpose
This policy standardizes IDE metadata handling for JetBrains IDEs (PyCharm/IntelliJ/WebStorm family) in this repository.

Goals:
- Keep team-shared IDE behavior consistent.
- Avoid noisy/personal diffs.
- Prevent accidental leakage of local paths, account info, or deployment data.

## Scope
Applies to:
- `NomadAI/.idea/*`
- `/.idea/*` (repo root)

When in conflict, `NomadAI/.idea` is the canonical project-level IDE config for this codebase.

## Commit Rules (Allowlist First)

### Commit (shared, stable project config)
- `NomadAI/.idea/modules.xml`
- `NomadAI/.idea/NomadAI.iml` (if module/interpreter policy is team-approved)
- `NomadAI/.idea/misc.xml` (only if no user-specific absolute paths are introduced)
- `NomadAI/.idea/vcs.xml`
- `NomadAI/.idea/inspectionProfiles/Project_Default.xml`
- `NomadAI/.idea/inspectionProfiles/profiles_settings.xml`

### Do NOT commit (local/session-specific)
- `NomadAI/.idea/workspace.xml`
- `NomadAI/.idea/shelf/`
- `NomadAI/.idea/httpRequests/`
- `NomadAI/.idea/dataSources/`
- `NomadAI/.idea/dataSources.local.xml`

### Restricted (commit only with explicit team approval)
- `NomadAI/.idea/deployment.xml`
  - Allowed only if sanitized and intentionally shared.
  - Must not contain credentials, private endpoints, or personal server labels.

## Required Ignore Rules
Ensure these are present in `NomadAI/.idea/.gitignore` and mirrored in `/.idea/.gitignore` when applicable:

- `/workspace.xml`
- `/shelf/`
- `/httpRequests/`
- `/dataSources/`
- `/dataSources.local.xml`

## Security & Privacy Guardrails
- Never commit IDE files containing account IDs, tokens, local usernames, or machine-specific absolute paths unless explicitly approved.
- Treat `workspace.xml` as private local state.
- Do not commit changelist snapshots for generated content (for example `node_modules` artifacts surfaced by IDE state).
- If `deployment.xml` changes, reviewer must confirm there is no sensitive data.

## Pull Request Rules
For `.idea` changes:
- PR must explain why the change is required for team-wide behavior.
- Reject accidental diffs to `workspace.xml` and other local-only files.
- If `NomadAI.iml` or `misc.xml` changes interpreter/tool paths, verify it does not force a single developer machine path.
- Keep IDE-only PRs separate from feature PRs when practical.

## Onboarding (JetBrains)
1. Open `NomadAI` as the project root.
2. Let IDE import `NomadAI/.idea` shared settings.
3. Configure local interpreter/SDK as needed (without committing local-only overrides).
4. Install dependencies from:
   - `NomadAI/requirements.txt`
   - `NomadAI/client/package.json`
5. Confirm Git mapping is correct in `NomadAI/.idea/vcs.xml`.

## Troubleshooting
- If IDE behavior looks wrong, first delete local `workspace.xml` and reopen the project.
- If inspections differ across teammates, verify `inspectionProfiles` files are synced.
- If unexpected `.idea` files appear in Git, update ignore rules and unstage local-only files.

## Ownership & Updates
- Policy owner: project maintainers.
- Review cadence: when JetBrains version or team workflow changes.
- Any exception requires maintainer approval in PR notes.
