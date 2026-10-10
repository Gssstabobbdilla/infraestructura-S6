# cloudwatch.tf

resource "aws_cloudwatch_metric_alarm" "dlq_messages_alarm" {
  alarm_name = "dlq-messages-alarm-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods = 1
  metric_name = "ApproximateNumberOfMessagesVisible"
  namespace = "AWS/SQS"
  period = 60
  statistic = "Sum"
  threshold = 0
  alarm_description   = "Alarma cuando hay mensajes en la DLQ"

  dimensions = {
    QueueName = aws_sqs_queue.dlq.name
  }

  tags = {
    Environment = var.environment
  }
}