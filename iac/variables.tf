variable "project_name" {
  description = "Nombre base"
  type        = string
  default     = "image_processor"
}

locals {
  env = terraform.workspace
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "priv_subnet_a_cidr" {
  type    = string
  default = "10.0.11.0/24"
}

variable "priv_subnet_b_cidr" {
  type    = string
  default = "10.0.12.0/24"
}

variable "public_subnet_a_cidr" {
  type    = string
  default = "10.0.1.0/24"
}

variable "public_subnet_b_cidr" {
  type    = string
  default = "10.0.2.0/24"
}