variable "project_id" {
  type = string
}

variable "name" {
  type = string
}

variable "zones" {
  type        = list(string)
  description = "Three zones of one region. The first also hosts the control plane."

  validation {
    condition     = length(var.zones) == 3
    error_message = "Give exactly three zones (one per simulated failure domain)."
  }
}

variable "network_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "pods_range_name" {
  type = string
}

variable "services_range_name" {
  type = string
}

variable "machine_type" {
  type    = string
  default = "e2-medium"
}

variable "nodes_per_zone" {
  type        = number
  default     = 1
  description = "0 pauses the cluster (no node cost); 1 is the normal size."
}

variable "spot" {
  type        = bool
  default     = false
  description = "Spot nodes cost ~50% less but Google may stop them at any time — never for measured experiment runs."
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "labels" {
  type    = map(string)
  default = {}
}
