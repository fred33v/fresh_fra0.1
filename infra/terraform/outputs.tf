# ============================================================
# Stop FRA - Terraform Outputs
# ============================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "ec2_public_ip" {
  description = "EC2 backend public IP"
  value       = aws_instance.backend.public_ip
}

output "ec2_instance_id" {
  description = "EC2 backend instance ID"
  value       = aws_instance.backend.id
}

output "alb_dns_name" {
  description = "API ALB DNS name"
  value       = aws_lb.api.dns_name
}

output "api_url" {
  description = "API endpoint URL"
  value       = "https://${var.api_subdomain}.${var.domain_name}"
}

output "s3_uploads_bucket" {
  description = "S3 uploads bucket name"
  value       = aws_s3_bucket.uploads.id
}

output "s3_dashboard_bucket" {
  description = "S3 dashboard bucket name"
  value       = aws_s3_bucket.dashboard.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for dashboard"
  value       = aws_cloudfront_distribution.dashboard.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.dashboard.domain_name
}

output "dashboard_url" {
  description = "Web dashboard URL"
  value       = "https://${var.dashboard_subdomain}.${var.domain_name}"
}
