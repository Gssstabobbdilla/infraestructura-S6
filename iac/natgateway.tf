resource "aws_eip" "nat_a" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.igw]

  tags = {
    Project = "${local.env}-eip-nat-a"
  }
}

resource "aws_eip" "nat_b" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.igw]

  tags = {
    Project = "${local.env}-eip-nat-b"
  }
}

# NAT GATEWAYS
resource "aws_nat_gateway" "ngw_a" {
  allocation_id     = aws_eip.nat_a.id
  subnet_id         = aws_subnet.public_a.id
  connectivity_type = "public"
  depends_on        = [aws_route_table_association.public_a]

  tags = {
    Project = "${local.env}-nat-gw-a"
  }
}

resource "aws_nat_gateway" "ngw_b" {
  allocation_id     = aws_eip.nat_b.id
  subnet_id         = aws_subnet.public_b.id
  connectivity_type = "public"
  depends_on        = [aws_route_table_association.public_b]

  tags = {
    Project = "${local.env}-nat-gw-b"
  }
}
