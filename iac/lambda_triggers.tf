# Lambda consulta SQS y entrega hasta cinco mensajes a Crop Lambda.
# Los mensajes exitosos se eliminan; los fallidos se reintentan individualmente.
resource "aws_lambda_event_source_mapping" "crop_sqs" {
  event_source_arn                   = aws_sqs_queue.main_queue.arn
  function_name                      = aws_lambda_function.crop.arn
  enabled                            = true
  batch_size                         = 5
  maximum_batching_window_in_seconds = 0
  function_response_types            = ["ReportBatchItemFailures"]

  depends_on = [aws_iam_role_policy.crop_permissions]
}
