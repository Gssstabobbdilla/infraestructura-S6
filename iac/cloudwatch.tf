resource "aws_cloudwatch_metric_alarm" "dlq_messages_alarm" {
  alarm_name          = "dql_messages_alarm-${local.env}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  threshold           = 0
  alarm_description   = "Se dispara si hay mensajes estancados en la DLQ"
  statistic           = "Maximum"
  treat_missing_data  = "notBreaching"
  namespace           = "AWS/SQS"
  period              = 60

  dimensions = {
    QueueName = aws_sqs_queue.dlq.name
  }

  alarm_actions = [aws_sns_topic.dlq_alarm_topic.arn]
}
