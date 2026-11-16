variable "project_id" {
  type = string
}

variable "workload_pool" {
  type        = string
  description = "<project>.svc.id.goog"
}

variable "namespace" {
  type    = string
  default = "cloudresilience"
}

variable "workloads" {
  description = "Workload name → its Kubernetes ServiceAccount, whether it uses Cloud SQL, and which secrets (short names) it may read."
  type = map(object({
    k8s_service_account = string
    cloudsql            = bool
    secrets             = list(string)
  }))
}

variable "secret_ids" {
  type        = map(string)
  description = "Short secret name → Secret Manager secret id."
}

variable "reports_bucket" {
  type = string
}
