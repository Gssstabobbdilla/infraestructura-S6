# Cada workspace conserva su propio estado y selecciona una red diferente.
locals {
  environment_networks = {
    dev  = "10.0.0.0/16"
    qa   = "10.1.0.0/16"
    prod = "10.2.0.0/16"
  }

  # El fallback permite validar desde default; la VPC bloquea su despliegue.
  vpc_cidr       = coalesce(var.vpc_cidr, lookup(local.environment_networks, local.env, "10.0.0.0/16"))
  private_a_cidr = coalesce(var.priv_subnet_a_cidr, cidrsubnet(local.vpc_cidr, 8, 11))
  private_b_cidr = coalesce(var.priv_subnet_b_cidr, cidrsubnet(local.vpc_cidr, 8, 12))
  public_a_cidr  = coalesce(var.public_subnet_a_cidr, cidrsubnet(local.vpc_cidr, 8, 1))
  public_b_cidr  = coalesce(var.public_subnet_b_cidr, cidrsubnet(local.vpc_cidr, 8, 2))
}
