# Basic alerting: database down, pods restarting, and (once the app has a
# public IP) an uptime check on the web front door.
# These are for operators; the BCDR controller does its own detection.

resource "google_monitoring_notification_channel" "email" {
  count        = var.alert_email == null ? 0 : 1
  project      = var.project_id
  display_name = "CloudResilience alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

locals {
  channels = google_monitoring_notification_channel.email[*].id
}

resource "google_monitoring_alert_policy" "db_down" {
  project               = var.project_id
  display_name          = "Cloud SQL instance down (${var.cloudsql_instance})"
  combiner              = "OR"
  notification_channels = local.channels

  conditions {
    display_name = "database/up is 0"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.cloudsql_instance}\" AND metric.type = \"cloudsql.googleapis.com/database/up\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "60s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MIN"
      }
    }
  }
}

resource "google_monitoring_alert_policy" "pod_restarts" {
  project               = var.project_id
  display_name          = "Pods restarting in ${var.namespace}"
  combiner              = "OR"
  notification_channels = local.channels

  conditions {
    display_name = "more than 3 container restarts in 10 minutes"
    condition_threshold {
      filter          = "resource.type = \"k8s_container\" AND resource.labels.cluster_name = \"${var.cluster_name}\" AND resource.labels.namespace_name = \"${var.namespace}\" AND metric.type = \"kubernetes.io/container/restart_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = 3
      duration        = "0s"
      aggregations {
        alignment_period     = "600s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.namespace_name"]
      }
    }
  }
}

# Added after the app is deployed and has a public address (set uptime_host).
resource "google_monitoring_uptime_check_config" "web" {
  count        = var.uptime_host == null ? 0 : 1
  project      = var.project_id
  display_name = "CloudResilience web front door"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/healthz"
    port         = 80
    use_ssl      = false
    validate_ssl = false
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.uptime_host
    }
  }
}
