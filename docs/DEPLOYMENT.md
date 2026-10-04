# Production deployment (GCP)

This file is public. Real project IDs, IP addresses, account names and bucket names are replaced with `<PLACEHOLDERS>`. The real values are in the team's private notes.

Verified on 2026-10-03 by read-only inspection of the VM and the GCP project.
This file holds no secrets. Passwords and keys are in the `.env` file on the VM.

## Summary

Brisk HRMS runs as a Docker Compose stack on one Compute Engine VM.
Nginx on the VM terminates TLS and proxies to the stack.
The stack serves two Frappe sites from one bench:

- `hrms.briskflow.ai`
- `crm.briskflow.ai`

## Where it runs

| Item            | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| GCP project     | `<GCP_PROJECT_ID>`                                     |
| VM              | `brisk-hrms`, `e2-medium` (2 shared vCPU, 4 GB), zone `asia-south1-a`. Resized from `e2-standard-2` on 2026-10-03          |
| Static IP       | `brisk-hrms-ip` = `<STATIC_IP>`                             |
| Disk            | `brisk-hrms`, 100 GB `pd-balanced` (root file system: 49 GB) |
| Service account | `<VM_SERVICE_ACCOUNT>` |
| Network         | `default` VPC, network tag `brisk-hrms`                      |
| Firewall        | `brisk-hrms-http` (80) and `brisk-hrms-https` (443) from the internet |
| SSH             | Port 22 is open to IAP only (`allow-ssh-iap`)                |
| Image registry  | `<REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/brisk-hrms` |

## Request path

Internet → nginx (ports 80 and 443) → upstream `brisk_frappe` → `frontend` container.

- Nginx site file: `/etc/nginx/sites-enabled/brisk-hrms`.
- The TLS certificate is from Let's Encrypt. Certbot manages it.

## Production stack

Compose project: `brisk-hrms`. Directory on the VM: `<DEPLOY_DIR>` (a user's home directory; see the private notes).

Image: `erpnext-hrms-crm:v16-briskrew-20261004` (ERPNext v16, HRMS from this fork's `version-16-briskrew` branch, CRM). The image tag is the `IMAGE=` line in `.env` on the VM. Rollback image: `v16-20260901` (upstream HRMS).

| Container     | Role                       |
| ------------- | -------------------------- |
| `frontend`    | Web server on port 8080 (localhost only) |
| `backend`     | Gunicorn application server |
| `scheduler`   | Scheduled jobs             |
| `websocket`   | Realtime events            |
| `queue-short` | Short background jobs      |
| `queue-long`  | Long background jobs       |
| `mariadb`     | `mariadb:10.11` database   |
| `redis-cache` | `redis:6.2-alpine`         |
| `redis-queue` | `redis:6.2-alpine`         |

Docker volumes: `brisk-hrms_sites`, `_mariadb-data`, `_logs`, `_redis-cache-data`, `_redis-queue-data`.

## Build and deploy a new version

No CI/CD pipeline deploys to the VM. A person deploys by hand.

Installed app versions after the 2026-10-04 deploy: Frappe 16.36.1, ERPNext 16.37.0, HRMS 16.20.1 (fork branch `version-16-briskrew`, upstream `version-16` plus the briskrew UI), CRM 1.86.0.
Before that deploy: HRMS came from upstream `frappe/hrms` `version-16`. The fork's `develop` branch is HRMS 17.0.0-dev and must not go to production.
`apps.json` for the current image: ERPNext `version-16`, HRMS `https://github.com/BriskflowAI/brisk-hrms` branch `main`, CRM `main`. The current image was built from `version-16-briskrew`. Since 2026-10-04 `main` is the default branch and starts at the same commit (`8be72fd86`). `develop` is the HRMS 17-dev line and must not go to production.

Build files are on the VM in `<DEPLOY_DIR>`: `apps.json`, `cloudbuild.yaml`, `compose.yaml`, `nginx-brisk-hrms.conf`.

1. Clone `https://github.com/frappe/frappe_docker`. Copy `apps.json` into its root.
2. Build on Cloud Build, not on the VM. The VM is too small to build and serve at once:
   `gcloud builds submit --config=cloudbuild.yaml . --project=<GCP_PROJECT_ID> --substitutions=_FRAPPE_BRANCH=version-16,_TAG="v16-$(date +%Y%m%d)"`
3. Rehearse the migration on a throwaway VM with last night's backup. Pick the dated backup folder, not the old `stack-b-*` files. Take a backup and a disk snapshot.
4. On the VM, change the `IMAGE=` line in `.env`. Run `sudo docker compose pull`, then `sudo docker compose up -d`.
5. Run `bench --site <site> migrate` for both sites inside the `backend` container.
6. Check the login. To roll back, set the old tag and run `up -d` again.

## Access

```bash
gcloud compute ssh brisk-hrms \
  --zone asia-south1-a \
  --project <GCP_PROJECT_ID> \
  --tunnel-through-iap
```

Direct SSH to the public IP is refused. Use `sudo` for Docker commands.

## Backups

| Layer      | Detail                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| Site data  | Root cron at 02:30 UTC runs `/opt/brisk-backups/backup-frappe-sites.sh` |
| Log        | `/var/log/brisk-frappe-backup.log`                                     |
| Destination | `gs://<BACKUP_BUCKET>/production-stack/{hrms,crm}/<timestamp>/`    |
| Bucket     | `ASIA-SOUTH1`. Class changes to Nearline at 30 days and Coldline at 90 days. Objects are deleted at 365 days. |
| Disk       | Snapshot policy `brisk-hrms-daily-snapshots`: daily at 03:00, 7 days kept |

The last verified run was 2026-10-03 02:30 UTC. Both sites completed.

**Not verified:** a restore from either backup layer.

## Swap

The VM has a 2 GB swap file at `/swapfile` (added 2026-10-03). `/etc/fstab` mounts it at boot. `vm.swappiness=10` is set in `/etc/sysctl.d/99-swap.conf`.

## Monitoring

The Google Cloud Ops Agent runs on the VM. It sends logs and metrics to Cloud Logging and Cloud Monitoring.

## Known risks

- The compose project lives in one user's home directory on the VM.
- The VM is a single point of failure. The database runs in one container on one disk.
- The dev Compose project `deploy-*` was removed on 2026-10-03. Do not run `docker/docker-compose.yml` on this VM.
- `/opt/brisk-backups` holds old script copies (`.bak`, `.save`). Remove them.
- The disk is 100 GB but the root file system is 49 GB. The snapshots show a 50 GB source disk.
