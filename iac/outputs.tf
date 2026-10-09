output "api_gateway_url" {
  description = "URL base del API Gateway"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}