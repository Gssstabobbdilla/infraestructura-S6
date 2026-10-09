resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-${local.env}-igw"
    Environment = local.env
    Project     = var.project_name
  }
}

resource "aws_eip" "nat_a" {
  domain = "vpc"

  tags = {
    Name        = "${var.project_name}-${local.env}-nat-a-eip"
    Environment = local.env
    Project     = var.project_name
  }
}

resource "aws_eip" "nat_b" {
  domain = "vpc"

  tags = {
    Name        = "${var.project_name}-${local.env}-nat-b-eip"
    Environment = local.env
    Project     = var.project_name
  }
}

# Cada subred privada sale por el NAT de su propia zona.
resource "aws_nat_gateway" "nat_a" {
  allocation_id     = aws_eip.nat_a.id
  subnet_id         = aws_subnet.public_a.id
  connectivity_type = "public"

  depends_on = [aws_internet_gateway.igw, aws_route_table_association.public_a]

  tags = {
    Name        = "${var.project_name}-${local.env}-nat-a"
    Environment = local.env
    Project     = var.project_name
  }
}

resource "aws_nat_gateway" "nat_b" {
  allocation_id     = aws_eip.nat_b.id
  subnet_id         = aws_subnet.public_b.id
  connectivity_type = "public"

  depends_on = [aws_internet_gateway.igw, aws_route_table_association.public_b]

  tags = {
    Name        = "${var.project_name}-${local.env}-nat-b"
    Environment = local.env
    Project     = var.project_name
  }
}
