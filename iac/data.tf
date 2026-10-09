# Cuenta que ejecuta Terraform; se utiliza en la politica S3 -> SQS.
data "aws_caller_identity" "current" {}

# Permite construir ARN compatibles con la particion de AWS utilizada.
data "aws_partition" "current" {}
