variable "project_name" {
  description = "Nombre base"
  type        = string
  default     = "image_processor"
}

variable "aws_region" {
  description = "Region para el despliegue"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Perfil AWS local. Si es null, utiliza AWS_PROFILE o la cadena de credenciales estandar."
  type        = string
  default     = null
}

locals {
  env = terraform.workspace
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR opcional; por defecto se selecciona automaticamente segun el workspace."
  default     = null
}

variable "priv_subnet_a_cidr" {
  type    = string
  default = null
}

variable "priv_subnet_b_cidr" {
  type    = string
  default = null
}

variable "public_subnet_a_cidr" {
  type    = string
  default = null
}

variable "public_subnet_b_cidr" {
  type    = string
  default = null
}
