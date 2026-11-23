# Docker repository for the seven images (five services, migrate, frontend).

resource "google_artifact_registry_repository" "images" {
  # checkov:skip=CKV_GCP_84: Google-managed encryption; customer-managed keys are optional in the roadmap (§4)
  project       = var.project_id
  location      = var.region
  repository_id = var.name
  format        = "DOCKER"
  description   = "CloudResilience application images"
  labels        = var.labels

  # Tags stay mutable (the default) so a tag like "dev" can move on each push;
  # no docker_config block, since the API doesn't echo the default back.

  # No automatic deletes: a pushed tag points to an image index whose platform
  # image and attestation are untagged, so an "untagged" delete rule could break
  # tagged images. Storage for a few versions costs only a few rupees a month.
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }
}
