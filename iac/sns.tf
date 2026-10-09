# Tópico SNS para las notificaciones
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${local.env}-alerts"
}
