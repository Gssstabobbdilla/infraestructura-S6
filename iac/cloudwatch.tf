resource "aws_cloudwatch_metric_alarm" "dlq_messages_alarm" {
  alarm_name   = "dql_messages_alarm-${local.env}"
  comparison_operator = "ApproximateNumberOfMessagesVisible"
  evaluation_periods  = 1
  metric_name = "ApproximateNumberOfMessagesVisible"
  threshold  = 0
  alarm_description = "Se dispara si hay mensajes estancados en la DLQ"
  statistic = "Sum"
  namespace  = "AWS/SQS"
  period = 60
  
  dimensions = {
    QueueName = aws_sqs_queue.dlq
  }

  alarm_actions = [aws_sns_topic.dlq_alarm_topic.arn]
}