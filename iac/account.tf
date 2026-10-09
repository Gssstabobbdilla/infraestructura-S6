# Cuenta origen necesaria para restringir la politica S3 -> SQS.
data "aws_caller_identity" "current" {}
