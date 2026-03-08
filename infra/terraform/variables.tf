# ============================================================
# Stop FRA - Production Infrastructure Variables
# ============================================================

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-west-2" # London
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project identifier used in resource naming"
  type        = string
  default     = "stopfra"
}

# --- Networking ---

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# --- Database (Neon) ---

variable "neon_database_url" {
  description = "Neon PostgreSQL connection string (postgresql://user:pass@ep-xxx.eu-west-2.aws.neon.tech/stopfra?sslmode=require)"
  type        = string
  sensitive   = true
}

# --- EC2 ---

variable "ec2_instance_type" {
  description = "EC2 instance type for backend"
  type        = string
  default     = "t3.small"
}

variable "ec2_key_name" {
  description = "SSH key pair name for EC2 access"
  type        = string
}

# --- Domain ---

variable "domain_name" {
  description = "Root domain name"
  type        = string
  default     = "fraud-risk.co.uk"
}

variable "api_subdomain" {
  description = "API subdomain"
  type        = string
  default     = "api"
}

variable "dashboard_subdomain" {
  description = "Web dashboard subdomain"
  type        = string
  default     = "app"
}

# --- S3 ---

variable "s3_upload_prefix" {
  description = "S3 key prefix for uploads"
  type        = string
  default     = "uploads/"
}

variable "s3_download_prefix" {
  description = "S3 key prefix for downloads"
  type        = string
  default     = "downloads/"
}

variable "s3_url_expires_seconds" {
  description = "Pre-signed URL expiry in seconds"
  type        = number
  default     = 3600
}

variable "s3_max_upload_bytes" {
  description = "Maximum upload file size in bytes"
  type        = number
  default     = 10485760 # 10MB
}

variable "s3_allowed_content_types" {
  description = "Comma-separated list of allowed upload MIME types"
  type        = string
  default     = "application/pdf,image/png,image/jpeg"
}

# --- Upstash Redis ---

variable "upstash_redis_rest_url" {
  description = "Upstash Redis REST URL"
  type        = string
  sensitive   = true
}

variable "upstash_redis_rest_token" {
  description = "Upstash Redis REST token"
  type        = string
  sensitive   = true
}

# --- JWT ---

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "JWT refresh token signing secret"
  type        = string
  sensitive   = true
}

# --- Tags ---

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default = {
    Project     = "StopFRA"
    ManagedBy   = "Terraform"
  }
}
