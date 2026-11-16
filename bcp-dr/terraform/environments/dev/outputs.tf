# Values needed by kubernetes/overlays/gke and for connecting kubectl.

output "get_credentials_command" {
  value = "gcloud container clusters get-credentials ${module.gke.name} --location ${module.gke.location} --project ${var.project_id} --dns-endpoint"
}

output "image_prefix" {
  value = module.artifact_registry.image_prefix
}

output "cloudsql_connection_name" {
  value = module.cloudsql.connection_name
}

output "cloudsql_private_ip" {
  value = module.cloudsql.private_ip
}

output "secret_ids" {
  value = module.secrets.secret_ids
}

output "workload_service_accounts" {
  value = module.iam.workload_service_accounts
}

output "controller_service_account" {
  value = module.iam.controller_service_account
}

output "reports_bucket" {
  value = module.storage.bucket_name
}
