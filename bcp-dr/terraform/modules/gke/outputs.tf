output "name" {
  value = google_container_cluster.this.name
}

output "location" {
  value = google_container_cluster.this.location
}

# Read from the cluster (not built from the project id) so anything using the
# pool waits until the cluster exists — the pool is created with it.
output "workload_pool" {
  value = google_container_cluster.this.workload_identity_config[0].workload_pool
}

output "node_service_account" {
  value = google_service_account.nodes.email
}
