# Log groups (los nombres deben coincidir con los de las Lambdas)
resource "aws_cloudwatch_log_group" "upload_lambda" {
  name              = "/aws/lambda/${var.project_name}-${local.env}-upload"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "crop_lambda" {
  name              = "/aws/lambda/${var.project_name}-${local.env}-crop"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "apigateway" {
  name              = "/aws/apigateway/${var.project_name}-${local.env}"
  retention_in_days = 14
}

# Tópico SNS para las notificaciones
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${local.env}-alerts"
}

# Alarma: avisa si llega cualquier mensaje a la DLQ
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${var.project_name}-${local.env}-dlq-messages-alarm"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.dlq.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
