# API Gateway HTTP
resource "aws_apigatewayv2_api" "http_api" {
  name = "${var.project_name}-${local.env}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age = 300
  }
}

resource "aws_apigatewayv2_stage" "api_stage" {
  api_id = aws_apigatewayv2_api.http_api.id
  name = "$default"
  auto_deploy = true
}