---
name: const-deployment
description: "Deployment and IaC rules — Bicep as source of truth, idempotent scripts, human-in-loop gates, no secrets on disk"
metadata:
  type: reference
---

# Deployment & Infrastructure-as-Code Constitution

## Bicep Is the Source of Truth

- Every Azure resource is defined in a Bicep module under `infra/`. A resource that exists in Azure but not in Bicep is a bug.
- The state of `infra/` is always deployable. It reflects the current desired state of staging, not a historical snapshot.
- Before creating any resource via the portal or CLI, add it to Bicep first. The portal is for reading, not writing.
- `az deployment group what-if` must show zero changes before any "tidy" or "no-op" deploy is considered safe.

## No Hardcoded Infrastructure Values

- Subscription IDs, Resource Group names, and region literals are **never** hardcoded in scripts or Bicep files — they are parameters.
- Parameters have defaults for staging; they can be overridden for future environments.
- Container image tags and deployment names are parameters, not literals.

## Idempotency

- Re-running a deploy script with identical inputs must produce no changes and no errors.
- `az deployment group create --mode Incremental` — never `--mode Complete` on stateful resource groups.
- Resource updates that cannot be made idempotent (e.g., Container Apps env var changes) are documented explicitly and handled in the deploy script.
- The broken `deploy-phase4.ps1` pattern of "update image only" is replaced by `az deployment group create` + `az containerapp update` — both must run on every deploy.

## Human-in-Loop Confirmation Gates

The deploy orchestrator `scripts/deploy.ps1` pauses for `[y/N]` confirmation between each of these stages:

1. Build container images locally
2. Push images to ACR
3. Bicep deployment (`az deployment group create`)
4. Run DB migration job
5. Smoke test
6. Activate new Container Apps revision

No stage runs automatically after a preceding stage — the operator must confirm each step. The script prints what it is about to do before asking for confirmation.

## Stateful Resources Are Never Destroyed and Recreated

- Postgres, Storage Account, Key Vault, and Log Analytics Workspace are never deleted as part of a deploy.
- If a Bicep change would destroy-recreate a stateful resource, `what-if` will flag it — stop and redesign.
- Use additive migrations (new columns, new tables) rather than schema drops.

## Secrets at Rest

- Production secrets are stored in Azure Key Vault only. Never on local disk, never in `.env` files committed to git.
- `.env.example` files contain variable **names only** — no values, not even placeholder values.
- Key Vault secrets are referenced in Container Apps via `secretref:` + `keyvaultref:` + `identityref:`. The app code reads only `process.env` / `os.environ` — no live KV SDK calls at runtime.
- `scripts/deploy-outputs.json` must not contain secret values. Non-secret resource IDs are acceptable.

## ACR Security

- ACR admin credentials are disabled (`--admin-enabled false`). Image pulls use the UAMI via AcrPull role assignment only.
- Images are built locally or in a pipeline, pushed to `truepathacr`, and referenced by digest or tag in Container Apps.

## Do / Don't

| Do | Don't |
|---|---|
| Commit new Bicep before creating the Azure resource | Create resources in the portal and add Bicep later |
| Run `what-if` before every deploy | Trust memory that "nothing changed" |
| Pause for confirmation before each deploy stage | Chain stages silently without human gate |
| Store secrets in Key Vault, reference via `secretref:` | Write secret values into `.env` files or deploy scripts |
| Use `--mode Incremental` Bicep deployments | Use `--mode Complete` on a resource group with stateful resources |

## PR Checklist (deployment-related changes)

- [ ] New Azure resource has a Bicep module in `infra/`
- [ ] No subscription IDs, RG names, or regions hardcoded
- [ ] `az deployment group what-if` output reviewed and understood
- [ ] `.env.example` updated with new variable names (values not included)
- [ ] No secrets written to disk or script files
- [ ] `scripts/deploy.ps1` confirmation gates intact
