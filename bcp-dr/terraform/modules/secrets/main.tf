# Application secrets in Secret Manager, replacing `kubectl create secret`.
# Values are generated here, so they also live in the Terraform state — which
# is why the state bucket is private and versioned (see terraform/bootstrap).

resource "random_password" "generated" {
  for_each = toset(["jwt-secret", "internal-service-token", "bcdr-probe-password"])
  length   = 48
  special  = false
}

locals {
  values = {
    "db-password"            = var.db_password
    "jwt-secret"             = random_password.generated["jwt-secret"].result
    "internal-service-token" = random_password.generated["internal-service-token"].result
    "bcdr-probe-password"    = random_password.generated["bcdr-probe-password"].result
  }
}

resource "google_secret_manager_secret" "this" {
  for_each  = toset(keys(local.values))
  project   = var.project_id
  secret_id = "${var.prefix}-${each.key}"
  labels    = var.labels

  # Keep secret data in our region.
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

resource "google_secret_manager_secret_version" "this" {
  for_each    = google_secret_manager_secret.this
  secret      = each.value.id
  secret_data = local.values[each.key]
}
