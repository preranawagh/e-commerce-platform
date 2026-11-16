output "network_id" {
  value = google_compute_network.vpc.id
}

output "network_name" {
  value = google_compute_network.vpc.name
}

output "subnet_id" {
  value = google_compute_subnetwork.gke.id
}

output "pods_range_name" {
  value = "pods"
}

output "services_range_name" {
  value = "services"
}

# Cloud SQL must wait for the peering to exist before it can take a private IP.
output "private_services_connection" {
  value = google_service_networking_connection.private_services.id
}
