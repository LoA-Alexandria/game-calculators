# Required repository settings

These GitHub settings enforce the contribution policy described by the repository. Files alone cannot prevent administrators from pushing directly to `main`.

## Main branch ruleset

In **Settings → Rules → Rulesets**, create an active branch ruleset named `Protect main` targeting the default branch. Configure it to:

- Restrict deletions.
- Block force pushes.
- Require a pull request before merging.
- Require at least one approving review.
- Dismiss stale approvals when new commits are pushed.
- Require approval of the most recent reviewable push.
- Require conversation resolution before merging.
- Require the `Test, lint, and build` status check.
- Prevent bypassing the ruleset. Add bypass actors only when an emergency release process genuinely needs them.

This makes approval come from another repository contributor with sufficient access. Add trusted contributors under **Settings → Collaborators and teams**, using the lowest role that lets them perform their work.

## Recommended repository settings

- Set `main` as the default branch.
- Enable automatic deletion of merged branches.
- Enable Dependabot security updates and private vulnerability reporting.
- Disable merge commits if the project prefers a linear history; allow squash merging.
- Set GitHub Pages source to **GitHub Actions**.
