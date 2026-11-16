# Bucket for database exports and archived BCDR incident reports.

resource "google_storage_bucket" "reports" {
  # checkov:skip=CKV_GCP_62: access is recorded by Cloud Audit Logs; a separate access-log bucket adds cost without value here
  project                     = var.project_id
  name                        = var.name
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = var.force_destroy
  labels                      = var.labels

  versioning {
    enabled = true
  }

  # Old object versions are kept for 30 days, then deleted.
  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 30
    }
    action {
      type = "Delete"
    }
  }
}
