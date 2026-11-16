variable "project_id" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "namespace" {
  type    = string
  default = "cloudresilience"
}

variable "cloudsql_instance" {
  type = string
}

variable "alert_email" {
  type        = string
  default     = null
  description = "Where alerts are emailed. Null = alerts show only in the console."
}

variable "uptime_host" {
  type        = string
  default     = null
  description = "Public IP or hostname of the Gateway. Null until the app is deployed."
}
