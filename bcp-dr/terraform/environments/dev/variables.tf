variable "project_id" {
  type        = string
  description = "Google Cloud project id, e.g. cloudresilience-dev-12345."
}

variable "region" {
  type    = string
  default = "asia-south1" # Mumbai
}

variable "zones" {
  type        = list(string)
  default     = ["asia-south1-a", "asia-south1-b", "asia-south1-c"]
  description = "Three zones of the region; the first hosts the GKE control plane."
}

# --- GKE ---

variable "node_machine_type" {
  type    = string
  default = "e2-medium"
}

variable "nodes_per_zone" {
  type        = number
  default     = 1
  description = "Set to 0 between work sessions to stop paying for nodes."
}

variable "spot_nodes" {
  type    = bool
  default = false
}

# --- Cloud SQL ---

variable "db_tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "db_high_availability" {
  type        = bool
  default     = true
  description = "Regional (HA) instance. Can be false while building, true for experiments."
}

variable "db_deletion_protection" {
  type        = bool
  default     = true
  description = "Set false only to deliberately destroy the database (e.g. Scenario 6)."
}

# --- Other ---

variable "reports_force_destroy" {
  type    = bool
  default = false
}

variable "alert_email" {
  type    = string
  default = null
}

variable "uptime_host" {
  type    = string
  default = null
}
