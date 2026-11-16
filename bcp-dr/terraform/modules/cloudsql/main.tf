# Cloud SQL for PostgreSQL with high availability (a standby in a second zone
# that Google promotes automatically) and point-in-time recovery.
# Private IP only; connections must be encrypted.

resource "google_sql_database_instance" "this" {
  # checkov:skip=CKV_GCP_79: PostgreSQL 16 matches the local Compose/kind stack the app was tested on
  # checkov:skip=CKV_GCP_6: encrypted connections are required (ssl_mode ENCRYPTED_ONLY); client certificates are not used
  # checkov:skip=CKV2_GCP_13: log_duration would log every probe query (every 0.5 s during experiments); slow queries are covered by Query Insights
  project             = var.project_id
  name                = var.name
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = var.deletion_protection

  settings {
    edition           = "ENTERPRISE"
    tier              = var.tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10
    disk_autoresize   = true
    user_labels       = var.labels

    ip_configuration {
      ipv4_enabled    = false # no public IP
      private_network = var.network_id
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "20:30" # UTC = 02:00 IST
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
      }
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 21
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled = true
    }

    # Audit-friendly logging (CIS PostgreSQL), and IAM sign-in for operators.
    # Written out one by one so security scanners can read them.
    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }
    database_flags {
      name  = "cloudsql.enable_pgaudit"
      value = "on"
    }
    database_flags {
      name  = "pgaudit.log"
      value = "ddl,role"
    }
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }
    database_flags {
      name  = "log_connections"
      value = "on"
    }
    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
    database_flags {
      name  = "log_hostname"
      value = "on"
    }
    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }
    database_flags {
      name  = "log_min_messages"
      value = "warning"
    }
    database_flags {
      name  = "log_min_error_statement"
      value = "error"
    }
    database_flags {
      name  = "log_statement"
      value = "ddl"
    }
    database_flags {
      name  = "log_temp_files"
      value = "0"
    }
    database_flags {
      name  = "log_min_duration_statement"
      value = "-1"
    }
  }

  depends_on = [var.private_services_connection]
}

resource "google_sql_database" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.this.name
  name     = var.database_name
}

resource "random_password" "app" {
  length  = 32
  special = false
}

resource "google_sql_user" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.this.name
  name     = var.database_user
  password = random_password.app.result
}
