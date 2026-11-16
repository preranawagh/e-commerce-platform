output "repository_id" {
  value = google_artifact_registry_repository.images.repository_id
}

# Image prefix, e.g. asia-south1-docker.pkg.dev/my-project/cloudresilience
output "image_prefix" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}
