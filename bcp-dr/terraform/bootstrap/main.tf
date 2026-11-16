# One-time setup: the bucket that stores the dev environment's Terraform state.
# Run once per project, before terraform/environments/dev. This config keeps
# its own (tiny) state locally, because the bucket can't store the state of
# the thing that creates it.
#
#   terraform init
#   terraform apply -var project_id=<your-project-id>

terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.11"
    }
  }
}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-south1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# The state holds generated secrets: private, versioned (to recover from a bad
# apply), never deleted by accident.
resource "google_storage_bucket" "tfstate" {
  # checkov:skip=CKV_GCP_62: access is recorded by Cloud Audit Logs; a separate access-log bucket adds cost without value here
  name                        = "${var.project_id}-tfstate"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 20
    }
    action {
      type = "Delete"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

output "state_bucket" {
  value = google_storage_bucket.tfstate.name
}
