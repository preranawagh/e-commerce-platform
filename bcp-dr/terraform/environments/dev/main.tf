# CloudResilience dev environment on Google Cloud: everything the app needs,
# built (and torn down) with one command.

provider "google" {
  project        = var.project_id
  region         = var.region
  default_labels = local.labels
}

locals {
  name   = "cloudresilience"
  labels = { project = "cloudresilience", environment = "dev", managed-by = "terraform" }

  # Which Google identity each workload gets and what it may read — mirrors the
  # least-privilege secrets of the Kubernetes manifests.
  workloads = {
    "user-service"         = { k8s_service_account = "user-service", cloudsql = true, secrets = ["db-password", "jwt-secret", "internal-service-token"] }
    "product-service"      = { k8s_service_account = "product-service", cloudsql = true, secrets = ["db-password", "jwt-secret"] }
    "inventory-service"    = { k8s_service_account = "inventory-service", cloudsql = true, secrets = ["db-password", "jwt-secret", "internal-service-token"] }
    "order-service"        = { k8s_service_account = "order-service", cloudsql = true, secrets = ["db-password", "jwt-secret", "internal-service-token"] }
    "notification-service" = { k8s_service_account = "notification-service", cloudsql = true, secrets = ["db-password", "jwt-secret", "internal-service-token"] }
    "db-migrate"           = { k8s_service_account = "db-migrate", cloudsql = true, secrets = ["db-password", "bcdr-probe-password"] }
  }
}

# APIs the project needs. Left enabled on destroy, so a destroy → apply cycle
# (Scenario 6) doesn't wait for APIs to switch back on.
resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "iam.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

module "network" {
  source     = "../../modules/network"
  project_id = var.project_id
  region     = var.region
  name       = local.name
  depends_on = [google_project_service.apis]
}

module "gke" {
  source              = "../../modules/gke"
  project_id          = var.project_id
  name                = local.name
  zones               = var.zones
  network_id          = module.network.network_id
  subnet_id           = module.network.subnet_id
  pods_range_name     = module.network.pods_range_name
  services_range_name = module.network.services_range_name
  machine_type        = var.node_machine_type
  nodes_per_zone      = var.nodes_per_zone
  spot                = var.spot_nodes
  labels              = local.labels
}

module "cloudsql" {
  source                      = "../../modules/cloudsql"
  project_id                  = var.project_id
  region                      = var.region
  name                        = "${local.name}-pg"
  network_id                  = module.network.network_id
  private_services_connection = module.network.private_services_connection
  tier                        = var.db_tier
  running                     = var.db_running
  high_availability           = var.db_high_availability
  deletion_protection         = var.db_deletion_protection
  labels                      = local.labels
}

module "artifact_registry" {
  source     = "../../modules/artifact-registry"
  project_id = var.project_id
  region     = var.region
  name       = local.name
  labels     = local.labels
  depends_on = [google_project_service.apis]
}

module "secrets" {
  source      = "../../modules/secrets"
  project_id  = var.project_id
  region      = var.region
  prefix      = local.name
  db_password = module.cloudsql.database_password
  labels      = local.labels
  depends_on  = [google_project_service.apis]
}

module "storage" {
  source        = "../../modules/storage"
  project_id    = var.project_id
  region        = var.region
  name          = "${var.project_id}-reports"
  force_destroy = var.reports_force_destroy
  labels        = local.labels
  depends_on    = [google_project_service.apis]
}

module "iam" {
  source         = "../../modules/iam"
  project_id     = var.project_id
  workload_pool  = module.gke.workload_pool
  workloads      = local.workloads
  secret_ids     = module.secrets.secret_ids
  reports_bucket = module.storage.bucket_name
}

module "monitoring" {
  source            = "../../modules/monitoring"
  project_id        = var.project_id
  cluster_name      = module.gke.name
  cloudsql_instance = module.cloudsql.instance_name
  alert_email       = var.alert_email
  uptime_host       = var.uptime_host
}
