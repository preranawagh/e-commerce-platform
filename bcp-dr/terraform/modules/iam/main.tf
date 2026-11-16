# Least-privilege Google identities.
# - One per workload (each service + the migration Job), linked to its
#   Kubernetes ServiceAccount via Workload Identity — no key files.
#   Each can read only the secrets it uses, as in the kind setup.
# - One for the BCDR controller (Phase 6), limited to what runbooks need.

resource "google_service_account" "workload" {
  for_each     = var.workloads
  project      = var.project_id
  account_id   = "cr-${each.key}"
  display_name = "CloudResilience ${each.key}"
}

# Kubernetes ServiceAccount <namespace>/<name> may act as this identity.
resource "google_service_account_iam_member" "workload_identity" {
  for_each           = var.workloads
  service_account_id = google_service_account.workload[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.workload_pool}[${var.namespace}/${each.value.k8s_service_account}]"
}

resource "google_project_iam_member" "cloudsql_client" {
  for_each = { for k, w in var.workloads : k => w if w.cloudsql }
  project  = var.project_id
  role     = "roles/cloudsql.client"
  member   = "serviceAccount:${google_service_account.workload[each.key].email}"
}

locals {
  secret_grants = merge([
    for k, w in var.workloads : {
      for s in w.secrets : "${k}/${s}" => { workload = k, secret = s }
    }
  ]...)
}

resource "google_secret_manager_secret_iam_member" "workload" {
  for_each  = local.secret_grants
  project   = var.project_id
  secret_id = var.secret_ids[each.value.secret]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.workload[each.value.workload].email}"
}

# BCDR controller: observe and roll back workloads, fail over / restore Cloud
# SQL, read monitoring, and write incident reports to the reports bucket.
resource "google_service_account" "controller" {
  project      = var.project_id
  account_id   = "cr-bcdr-controller"
  display_name = "CloudResilience BCDR controller"
}

resource "google_project_iam_member" "controller" {
  for_each = toset([
    "roles/container.developer",
    "roles/cloudsql.admin",
    "roles/monitoring.viewer",
    "roles/logging.viewer",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.controller.email}"
}

resource "google_storage_bucket_iam_member" "controller_reports" {
  bucket = var.reports_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.controller.email}"
}
