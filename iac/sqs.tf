data "aws_caller_identity" "current" {}

resource "aws_sqs_queue" "dlq" {
  name                      = "${var.project_name}-${local.env}-image-dlq"
  message_retention_seconds = 1209600 
  sqs_managed_sse_enabled   = true

  tags = {
    Environment = local.env
    Project     = var.project_name
  }
}

resource "aws_sqs_queue" "main_queue" {
  name                       = "${var.project_name}-${local.env}-image-queue"
  visibility_timeout_seconds = 360  
  message_retention_seconds  = 86400 
  receive_wait_time_seconds  = 20    
  sqs_managed_sse_enabled    = true


  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = local.env
    Project     = var.project_name
  }
}

resource "aws_sqs_queue_policy" "sqs_policy" {
  queue_url = aws_sqs_queue.main_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { Service = "s3.amazonaws.com" }
        Action = "sqs:SendMessage"
        Resource = aws_sqs_queue.main_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_s3_bucket.images.arn
          }
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}