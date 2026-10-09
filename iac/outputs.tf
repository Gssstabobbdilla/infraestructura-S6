output "environment" {
  description = "Workspace activo del despliegue."
  value       = local.env
}

output "api_url" {
  description = "URL base de la API HTTP; la ruta upload debe ser implementada."
  value       = aws_apigatewayv2_api.http_api.api_endpoint
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
