# Docker repository for the seven images (five services, migrate, frontend).

resource "google_artifact_registry_repository" "images" {
  # checkov:skip=CKV_GCP_84: Google-managed encryption; customer-managed keys are optional in the roadmap (§4)
  project       = var.project_id
  location      = var.region
  repository_id = var.name
  format        = "DOCKER"
  description   = "CloudResilience application images"
  labels        = var.labels

  docker_config {
    immutable_tags = false # tags like "dev" are moved on each push
  }

  # Keep storage (and cost) small: drop untagged images after a week,
  # always keep the 5 newest versions of each image.
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s"
    }
  }

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }
}
