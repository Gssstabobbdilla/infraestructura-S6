resource "aws_sqs_queue" "dlq" {
  name                      = "${var.project_name}-${local.env}-image-dlq"
  message_retention_seconds = 1209600 # 14 días
  sqs_managed_sse_enabled   = true

  tags = {
    Environment = local.env
    Project     = var.project_name
  }
}

resource "aws_sqs_queue" "main_queue" {
  name                       = "image-processor-${local.env}-image-queue"
  visibility_timeout_seconds = 360  # 6 minutos
  message_retention_seconds  = 86400 # 1 día
  receive_wait_time_seconds  = 20    # Long polling
  sqs_managed_sse_enabled    = true

  # Enviar mensajes fallidos a la DLQ después de 3 intentos
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = local.env
    Project     = var.project_name
  }
}