# Privadas
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_a_cidr
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "${var.project_name}-${local.env}-private-a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_b_cidr
  availability_zone = "${var.aws_region}b"

  tags = {
    Name = "${var.project_name}-${local.env}-private-b"
  }
}

# Publicas

resource "aws_subnet" "public_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.public_a_cidr
  availability_zone = "${var.aws_region}a"

  tags = {
    Project     = "${var.project_name}-pub-sub-a"
    Environment = local.env
  }
}

resource "aws_subnet" "public_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.public_b_cidr
  availability_zone = "${var.aws_region}b"

  tags = {
    Project     = "${var.project_name}-pub-sub-b"
    Environment = local.env
  }
}
