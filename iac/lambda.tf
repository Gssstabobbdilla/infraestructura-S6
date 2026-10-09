locals {
  lambda_build_dir = "${path.module}/../lambdas/.build"
}

resource "aws_lambda_function" "upload" {
  function_name    = "${var.project_name}-${local.env}-upload"
  role             = aws_iam_role.upload_role.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  architectures    = ["x86_64"]
  memory_size      = 256
  timeout          = 30
  filename         = "${local.lambda_build_dir}/upload.zip"
  source_code_hash = filebase64sha256("${local.lambda_build_dir}/upload.zip")

  environment {
    variables = {
      S3_BUCKET     = aws_s3_bucket.images.id
      UPLOAD_PREFIX = "uploads/"
    }
  }

  vpc_config {
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.lambda_sg_upload.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.upload_vpc_access,
    aws_iam_role_policy.upload_permissions,
    aws_cloudwatch_log_group.upload_lambda
  ]
}

resource "aws_lambda_function" "crop" {
  function_name    = "${var.project_name}-${local.env}-crop"
  role             = aws_iam_role.crop_role.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  architectures    = ["x86_64"]
  memory_size      = 512
  timeout          = 60
  filename         = "${local.lambda_build_dir}/crop.zip"
  source_code_hash = filebase64sha256("${local.lambda_build_dir}/crop.zip")

  environment {
    variables = {
      S3_BUCKET        = aws_s3_bucket.images.id
      UPLOAD_PREFIX    = "uploads/"
      PROCESSED_PREFIX = "processed/"
    }
  }

  vpc_config {
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.lambda_sg_crop.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.crop_vpc_access,
    aws_iam_role_policy.crop_permissions,
    aws_cloudwatch_log_group.crop_lambda
  ]
}
