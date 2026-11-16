# Workload name → Google service account email (goes into the Kubernetes
# ServiceAccount annotation iam.gke.io/gcp-service-account in overlays/gke).
output "workload_service_accounts" {
  value = { for k, sa in google_service_account.workload : k => sa.email }
}

output "controller_service_account" {
  value = google_service_account.controller.email
}
