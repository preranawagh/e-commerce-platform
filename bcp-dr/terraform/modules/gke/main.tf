# GKE Standard, multi-zonal: the control plane lives in one zone (so the
# free-tier credit covers its fee), and the nodes are spread over three zones.
# Standard (not Autopilot) because the node-failure scenario needs real nodes
# we can stop. Single-zone control plane is a documented limitation.

# Identity the nodes run as: only logging, metrics and image pulls.
resource "google_service_account" "nodes" {
  project      = var.project_id
  account_id   = "${var.name}-nodes"
  display_name = "GKE nodes (${var.name})"
}

resource "google_project_iam_member" "nodes" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
    "roles/artifactregistry.reader",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.nodes.email}"
}

resource "google_container_cluster" "this" {
  # checkov:skip=CKV_GCP_12: NetworkPolicies are enforced by Dataplane V2 (datapath_provider below), not the legacy network_policy addon
  # checkov:skip=CKV_GCP_69: the GKE metadata server is enabled on the node pool (workload_metadata_config)
  # checkov:skip=CKV_GCP_65: Google Groups for RBAC needs a Workspace domain; access is per-user IAM
  # checkov:skip=CKV_GCP_66: Binary Authorization needs an image-signing pipeline; planned with CI (roadmap §4)
  project  = var.project_id
  name     = var.name
  location = var.zones[0] # zonal control plane
  # Nodes in all three zones.
  node_locations = slice(var.zones, 1, length(var.zones))

  network    = var.network_id
  subnetwork = var.subnet_id

  # No default node pool: on current GKE versions, omitting initial_node_count
  # and node_config creates the cluster without one. The pool is managed below.

  deletion_protection = var.deletion_protection

  release_channel {
    channel = "REGULAR"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  # Nodes have private IPs only.
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
  }

  # kubectl reaches the control plane through its DNS endpoint, which is
  # protected by Google sign-in + IAM, so no home IP has to be allow-listed.
  # The IP endpoint stays on for Google-internal use but accepts no public
  # address ranges.
  control_plane_endpoints_config {
    dns_endpoint_config {
      allow_external_traffic = true
    }
  }

  master_authorized_networks_config {
    gcp_public_cidrs_access_enabled = false
  }

  # Dataplane V2 enforces the NetworkPolicies from kubernetes/network-policies.
  datapath_provider = "ADVANCED_DATAPATH"

  # Pod-to-pod traffic on the same node also shows up in VPC flow logs.
  enable_intranode_visibility = true

  # No legacy client certificates; kubectl signs in with Google credentials.
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }

  # Pods get Google identities through Workload Identity (no key files).
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Google's managed Gateway API controller replaces Envoy Gateway on GKE.
  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = false
    }
  }

  maintenance_policy {
    daily_maintenance_window {
      start_time = "21:30" # UTC = 03:00 IST
    }
  }

  resource_labels = var.labels
}

resource "google_container_node_pool" "default" {
  project  = var.project_id
  name     = "default"
  cluster  = google_container_cluster.this.id
  location = google_container_cluster.this.location

  # Per zone, so 1 → three nodes. Set to 0 to pause the cluster between sessions.
  node_count = var.nodes_per_zone

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  node_config {
    machine_type    = var.machine_type
    spot            = var.spot
    disk_type       = "pd-balanced"
    disk_size_gb    = 30
    service_account = google_service_account.nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
    labels          = var.labels

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  depends_on = [google_project_iam_member.nodes]
}
