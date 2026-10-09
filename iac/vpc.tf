resource "aws_vpc" "main" {
  cidr_block           = local.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  lifecycle {
    precondition {
      condition     = contains(keys(local.environment_networks), local.env)
      error_message = "Selecciona dev, qa o prod con terraform workspace select -or-create ENTORNO antes de desplegar."
    }
  }

  tags = {
    Name = "${var.project_name}-${local.env}-vpc"
  }
}
