terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  # State lives in the bucket created by terraform/bootstrap. The bucket name
  # is supplied at init time: terraform init -backend-config=backend.hcl
  backend "gcs" {}
}
