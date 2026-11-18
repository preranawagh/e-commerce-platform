variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name" {
  type = string
}

variable "network_id" {
  type = string
}

variable "private_services_connection" {
  type        = string
  description = "Only used to make the instance wait for the VPC peering."
}

variable "tier" {
  type        = string
  default     = "db-custom-1-3840" # 1 vCPU, 3.75 GB — smallest dedicated-core machine
  description = "Machine type. Shared-core tiers have no SLA and are not used for HA experiments."
}

variable "running" {
  type        = bool
  default     = true
  description = "false stops the instance between work sessions (data and backups are kept)."
}

variable "high_availability" {
  type    = bool
  default = true
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "database_name" {
  type    = string
  default = "cloudresilience"
}

variable "database_user" {
  type    = string
  default = "cloudresilience"
}

variable "labels" {
  type    = map(string)
  default = {}
}
