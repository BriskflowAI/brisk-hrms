# Keeping the fork in step with Frappe HR

briskrew lives in a fork of [frappe/hrms](https://github.com/frappe/hrms). The Frappe HR server
code is unchanged, so new upstream fixes and features should flow in regularly. This page covers
how they come in, where conflicts can happen, and what to check before merging.

## The routine

1. **Every Monday** the `Upstream sync` workflow (`.github/workflows/upstream-sync.yml`) merges
   `frappe/hrms` `develop` into a branch named `sync/upstream-<date>` and opens a pull request to
   `develop`. It also starts the `briskrew` checks on that branch.
2. **The `briskrew` checks** (`.github/workflows/briskrew.yml`) build the three front ends
   (employee app, roster, briskrew) and run briskrew's server tests against Frappe, ERPNext and
   Payments `develop`. They run on every pull request, on every push to `develop` and weekly, so a
   breaking change in Frappe or ERPNext shows up even in weeks with no sync.
3. **Before merging a sync pull request**, run the screen audit (below) on a codespace built
   from the sync branch.
4. **Merge it with a merge commit**, not a squash, so the next sync only brings new commits.

To sync by hand (for example to pick up an urgent fix):

```bash
git remote add upstream https://github.com/frappe/hrms   # once
git fetch upstream develop
git checkout -b sync/upstream-$(date -u +%F) origin/develop
git merge upstream/develop
```

## When the merge conflicts

The workflow then fails and lists the conflicting files. Resolve them on your machine with the
commands above. Conflicts can only happen in the files the fork changes. Every other file is
upstream's own, so a conflict there means something went wrong; take upstream's version.

**briskrew's own folders.** Upstream never touches these, so they don't conflict:

- `flow/`: the briskrew app (Vue)
- `hrms/briskrew/`: its server endpoints and tests
- `hrms/public/briskrew/`: logo, fonts and print styles
- `.devcontainer/`: the codespace
- `.github/workflows/briskrew.yml` and `upstream-sync.yml`

**Upstream files the fork changes.** Keep both sides:

| File | What the fork changed |
|---|---|
| `hrms/patches.txt` | Adds `hrms.patches.v16_0.apply_briskrew_branding`. Keep upstream's new patches **above** it, in their order |
| `hrms/hooks.py` | briskrew tile on the apps screen, sign-in page look and favicon, HR roles land on `/flow`, email footer line |
| `hrms/install.py` | Applies the branding after install |
| `hrms/patches/v16_0/apply_briskrew_branding.py` | New patch (fork only) |
| `hrms/www/flow.py` | Context for the briskrew page (boot, site name, realtime port) |
| `hrms/templates/emails/email_footer.html` | briskrew email footer |
| `hrms/hr/print_style/briskrew/`, `hrms/payroll/print_format/salary_slip_briskrew/` | Print style and salary slip format (fork only) |
| `package.json` (root) | `install-flow-deps`, `dev-flow` and `build-flow` scripts; `build` also builds briskrew |
| `.gitignore` | Ignores the built briskrew files |
| `frontend/index.html`, `frontend/tailwind.config.js`, `frontend/vite.config.js` | briskrew name, colours and fonts for the employee app |
| `frontend/src/main.js`, `frontend/src/theme/briskrew.css` | Loads the briskrew theme |
| `frontend/src/components/BaseLayout.vue`, `InstallPrompt.vue`, `BriskrewMark.vue` | briskrew mark and name |
| `frontend/src/views/Login.vue` | briskrew login |

To list these files again (they change as the fork grows):

```bash
git diff --stat upstream/develop...origin/develop -- . ':!flow' ':!hrms/briskrew' \
  ':!hrms/public/briskrew' ':!.devcontainer'
```

## What to check after a sync

On a codespace built from the sync branch (see `.devcontainer/README.md` for refreshing):

```bash
cd ~/frappe-bench
bench --site briskrew.localhost migrate
(cd apps/hrms && yarn install && yarn build)

# briskrew's server tests
for t in apps/hrms/hrms/briskrew/test_*.py; do
  bench --site briskrew.localhost run-tests --module "hrms.briskrew.$(basename "$t" .py)"
done

# Screen audit: opens every audited record type in briskrew (list, new record, an existing
# record, report) and lists any desk script feature briskrew doesn't support yet.
# Needs the site on http://127.0.0.1:8000 with Administrator / admin, and Playwright.
for g in priority performance hiring shifts; do
  AUDIT_OUT=/tmp/audit-$g.json node apps/hrms/flow/scripts/audit-priority-screens.cjs $g
done
```

The audit should report **0 issues**. Anything it lists is usually a new desk API that upstream
form scripts started using. Add it to `flow/src/engine/compat.js` and record it in
`flow/inventory/priority-coverage.md`.

Also open a few screens by hand: Home, Inbox, an Employee record, a Leave Application, a list in
the Report view, and the Org chart.

## GitHub Actions on the fork

Actions must be on for any of this to run (**Settings → Actions → General**):

- **Allow all actions and reusable workflows.**
- Under **Workflow permissions**, tick **Allow GitHub Actions to create and approve pull requests**,
  so the sync workflow can open its pull request. If the box is greyed out, the organization
  decides: an owner turns it on under **Organization settings → Actions → General → Workflow
  permissions**. Until then the sync still pushes its branch, and the run's summary links to open
  the pull request by hand.

The fork also carries upstream's own workflows. Turn these off in the **Actions** tab (select the
workflow, then **••• → Disable workflow**), because they release, publish or tidy up frappe/hrms and
make no sense on the fork:

- Build and Upload Assets
- Build Container Image
- Create weekly release pull requests
- Generate Semantic Release
- Release Notes
- Regenerate POT file (translatable strings)
- Close Stale PRs
- Pull Request Labeler
- Review translation PRs

Upstream's **CI**, **Patch** and **Linters** can stay on. They run the full Frappe HR test suite on
pull requests, which is slow (about 30–60 minutes) but catches a sync that breaks Frappe HR itself.
Disabling them in the Actions tab doesn't change any file, so it causes no conflicts later.
