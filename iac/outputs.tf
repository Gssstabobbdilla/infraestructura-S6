output "environment" {
  description = "Workspace activo del despliegue."
  value       = local.env
}

output "network_cidrs" {
  description = "Red seleccionada y subredes calculadas para el workspace activo."
  value = {
    vpc       = local.vpc_cidr
    private_a = local.private_a_cidr
    private_b = local.private_b_cidr
    public_a  = local.public_a_cidr
    public_b  = local.public_b_cidr
  }
}

output "api_url" {
  description = "URL base de la API HTTP."
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "upload_url" {
  description = "Endpoint POST para cargar una imagen de hasta 4 MiB."
  value       = "${aws_apigatewayv2_api.http_api.api_endpoint}/upload"
  depends_on  = [aws_apigatewayv2_stage.api_stage]
}

output "images_bucket_name" {
  description = "Nombre del bucket privado de imagenes."
  value       = aws_s3_bucket.images.id
}

output "images_bucket_arn" {
  description = "ARN del bucket de imagenes."
  value       = aws_s3_bucket.images.arn
}

output "image_queue_url" {
  description = "URL de la cola principal de procesamiento."
  value       = aws_sqs_queue.main_queue.url
}

output "image_queue_arn" {
  description = "ARN de la cola para conectar el trigger de Crop Lambda."
  value       = aws_sqs_queue.main_queue.arn
}

output "dlq_url" {
  description = "URL de la cola de mensajes fallidos."
  value       = aws_sqs_queue.dlq.url
}

output "upload_role_arn" {
  description = "ARN del rol que debe utilizar Upload Lambda."
  value       = aws_iam_role.upload_role.arn
}

output "crop_role_arn" {
  description = "ARN del rol que debe utilizar Crop Lambda."
  value       = aws_iam_role.crop_role.arn
}
