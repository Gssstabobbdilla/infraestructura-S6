# Solo el servicio Lambda puede asumir estos roles.
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "upload_role" {
  name               = "${var.project_name}-${local.env}-upload-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = {
    Environment = local.env
    Project     = var.project_name
  }
}

resource "aws_iam_role" "crop_role" {
  name               = "${var.project_name}-${local.env}-crop-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = {
    Environment = local.env
    Project     = var.project_name
  }
}

# Incluye permisos de interfaces de red para VPC y escritura de logs.
resource "aws_iam_role_policy_attachment" "upload_vpc_access" {
  role       = aws_iam_role.upload_role.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "crop_vpc_access" {
  role       = aws_iam_role.crop_role.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Upload puede guardar originales, sin leer ni eliminar objetos.
data "aws_iam_policy_document" "upload_permissions" {
  statement {
    sid       = "WriteUploadedImages"
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.images.arn}/uploads/*"]
  }
}

resource "aws_iam_role_policy" "upload_permissions" {
  name   = "${var.project_name}-${local.env}-upload-permissions"
  role   = aws_iam_role.upload_role.id
  policy = data.aws_iam_policy_document.upload_permissions.json
}

# Crop lee originales, guarda resultados y consume solo la cola principal.
data "aws_iam_policy_document" "crop_permissions" {
  statement {
    sid       = "ReadUploadedImages"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.images.arn}/uploads/*"]
  }

  statement {
    sid       = "WriteProcessedImages"
    effect    = "Allow"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.images.arn}/processed/*"]
  }

  statement {
    sid    = "ConsumeImageQueue"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ChangeMessageVisibility"
    ]
    resources = [aws_sqs_queue.main_queue.arn]
  }
}

resource "aws_iam_role_policy" "crop_permissions" {
  name   = "${var.project_name}-${local.env}-crop-permissions"
  role   = aws_iam_role.crop_role.id
  policy = data.aws_iam_policy_document.crop_permissions.json
}
