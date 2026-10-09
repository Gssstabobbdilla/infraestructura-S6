resource "aws_sns_topic" "dlq_alarm_topic" {
  name = "dlq_alarm-${local.env}-topic"
}

resource "aws_sns_topic_subscription" "user_updates_sqs_target" {
  topic_arn            = aws_sns_topic.dlq_alarm_topic.arn
  protocol             = "email"
  endpoint             = "gustavo1324737@gmail.com"
}
