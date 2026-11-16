variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name" {
  type        = string
  description = "Globally unique bucket name."
}

variable "force_destroy" {
  type        = bool
  default     = false
  description = "Allow `terraform destroy` to delete a bucket that still holds objects."
}

variable "labels" {
  type    = map(string)
  default = {}
}
