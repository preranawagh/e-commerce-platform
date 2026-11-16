# Terraform — Google Cloud environment

Everything the app needs on Google Cloud, built with one command and removed with another.

```text
terraform/
├── bootstrap/            one-time: private, versioned bucket for Terraform state
├── environments/dev/     wires the modules together for the dev project
└── modules/
    ├── network/          VPC, subnet (+ pod/Service ranges), Cloud NAT, private access for Cloud SQL
    ├── gke/              GKE Standard: control plane in zone a, one e2-medium node in each of 3 zones
    ├── cloudsql/         PostgreSQL 16, HA (standby in another zone), backups + 7-day PITR, private IP only
    ├── artifact-registry/ Docker repository for the 7 images
    ├── secrets/          Secret Manager: DB password, JWT secret, internal token, probe password
    ├── iam/              one Google identity per workload (Workload Identity) + the BCDR controller
    ├── storage/          bucket for DB exports and incident reports
    └── monitoring/       alerts: DB down, pods restarting; uptime check once the app has an IP
```

## First time

Prerequisites: a Google Cloud project with billing (and a budget alert), Terraform ≥ 1.9, and gcloud logged in with `gcloud auth application-default login`.

```bash
cd terraform/bootstrap
terraform init
terraform apply -var project_id=<project-id>

cd ../environments/dev
cp terraform.tfvars.example terraform.tfvars   # set project_id
cp backend.hcl.example backend.hcl             # set bucket = <project-id>-tfstate
terraform init -backend-config=backend.hcl
terraform plan -out=dev.tfplan                 # review what will be created
terraform apply dev.tfplan                     # ~15–20 min, Cloud SQL is the slow part
```

Then connect kubectl (the exact command is in the outputs):

```bash
terraform output -raw get_credentials_command
```

## Saving money between sessions

| Action | How | Saves |
| --- | --- | --- |
| Pause nodes | `nodes_per_zone = 0` in `terraform.tfvars`, then `terraform apply` | Node cost (the cluster itself is free) |
| Stop the database | `gcloud sql instances patch cloudresilience-pg --activation-policy=NEVER` (`ALWAYS` to start) | Cloud SQL compute; storage is still billed |
| Remove everything | `terraform destroy` (set `db_deletion_protection = false` and apply first) | All of it; the state bucket stays |

## Notes

- Terraform state contains generated secrets. It is stored only in the private state bucket and is git-ignored locally.
- `db_deletion_protection` defaults to `true` so the database can't be destroyed by accident; turn it off only on purpose (Scenario 6).
- The GKE control plane is reached through its DNS endpoint (Google sign-in + IAM), so no home IP address has to be allow-listed. Its single-zone control plane is a known limitation of the free-tier-friendly setup; the nodes and the database span three zones.
