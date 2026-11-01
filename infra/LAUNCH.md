# Production launch: settings and first deploy

Run these from your own machine. You need the AWS CLI signed in to the production account
(region eu-north-1, Stockholm), Terraform 1.5 or later, pnpm, and `ssh` access to the server.

## 1. Gather the values

| What | Where to get it |
|------|-----------------|
| Neon connection string | Neon console, the production branch, "Connection string" with `?sslmode=require` |
| Upstash Redis REST URL and token | Upstash console, the database, "REST API" |
| Two JWT secrets | Run `openssl rand -hex 32` twice. The two values must be different |
| Stripe live secret key (`sk_live_…`) | Stripe dashboard, Developers > API keys |
| Stripe VAT rate id (`txr_…`), optional | Stripe dashboard > Tax rates > create "VAT", 20%, **exclusive**. Without it the backend adds VAT as its own line item |
| Your alert email address | Where alarm emails should go |
| Cloudflare API token | The domain's DNS is on Cloudflare. dash.cloudflare.com > My Profile > API Tokens > Create Token > Custom. Permissions: Zone: Zone Read and Zone: DNS Edit. Limit it to fraud-risk.co.uk |

Email needs no values: Terraform sets up Amazon SES and stores the SMTP login itself.

## 2. Terraform

Terraform keeps its state in an S3 bucket and a lock table, which must exist before
`terraform init`. Create them once:

```bash
aws s3api create-bucket --bucket stopfra-terraform-state --region eu-north-1 \
  --create-bucket-configuration LocationConstraint=eu-north-1
aws s3api put-bucket-versioning --bucket stopfra-terraform-state \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket stopfra-terraform-state \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket stopfra-terraform-state \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws dynamodb create-table --table-name stopfra-terraform-locks --region eu-north-1 \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST
```

Also create the server's SSH key pair `stopfra-prod-key` in eu-north-1 (EC2 > Key pairs),
and keep the .pem file safe.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # never commit this file
# Fill in neon_database_url, upstash_redis_rest_url/token, jwt_secret,
# jwt_refresh_secret, alert_emails and cloudflare_api_token. Leave mail_forward_to
# empty: incoming mail for the domain goes to Spacemail
# If you signed in with `aws login`, the AWS provider cannot read that session directly.
# Export short-lived credentials into this terminal first (prints nothing):
eval "$(aws configure export-credentials --format env)"
terraform init
terraform plan        # read it: it should only create resources
terraform apply
```

This creates the server, load balancer, dashboard hosting, backups bucket, alarms and SES
email. It also writes the database, JWT, Redis, S3 and SMTP settings to Parameter Store,
and adds the DNS records on Cloudflare: api and app, the certificate checks, the SES
records. It leaves the Spacemail MX, SPF, DKIM and DMARC records as they are.

Then, in your inbox, click the "AWS Notification - Subscription Confirmation" link so
alarm emails reach you.

## 3. Turn on email sending (SES)

1. Wait for the domain to verify, which can take up to an hour. Check with
   `terraform output ses_domain_verified`, which should print `true`.
2. A new SES account can only send to addresses you have verified yourself. To send to
   anyone, go to the SES console (Stockholm, eu-north-1), then Account dashboard >
   **Request production access**. Choose "Transactional", and describe the use as account
   emails: sign-up confirmation, password reset and password-changed notices. AWS usually
   answers within a day.

You can launch before access is granted, but until then sign-up only works for addresses
verified under SES > Identities.

## 4. Stripe webhook

In the Stripe dashboard, go to Developers > Webhooks > Add endpoint:

- URL: `https://api.fraud-risk.co.uk/api/v1/webhooks/stripe`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`,
  `payment_intent.succeeded`

Copy the signing secret (`whsec_…`) for the next step.

## 5. The remaining settings

```bash
./infra/scripts/setup-ssm-params.sh
```

Enter the Stripe secret key and webhook signing secret. Press Enter for everything else:
the defaults are correct, and values Terraform already stored are kept. On the first run
it generates `INBOUND_WEBHOOK_SECRET`; give that value to n8n if you use it.

Check that everything is there:

```bash
aws ssm get-parameters-by-path --path /fra/backend/ --region eu-north-1 --query 'Parameters[].Name'
```

The list should include SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM, STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, CORS_ORIGINS and WEB_APP_URL.

## Before the first deploy

- **Take a database snapshot first.** The first deploy runs migrations 025 (hashes stored
  refresh tokens) and 026 (email confirmation). Migration 025 cannot be undone: if you roll
  the code back afterwards, every user has to sign in again. In Neon, create a branch of the
  production database and keep it until the release is stable.
- **Read `terraform plan` before every `apply`.** On a fresh account it should only create
  resources.
- **Stripe test mode first.** Put an `sk_test_…` key and its webhook secret in step 5. The
  backend logs a warning (it will not refuse to start), and no real money moves. Buy a
  package with Stripe's published test card `4242 4242 4242 4242`, then switch to the live
  key and make one small real payment that you refund.
- **Real company details.** `apps/fra-web-dashboard/src/lib/legal.ts` still needs the
  company's legal name, address and registration number, and the privacy notice and terms
  need legal sign-off before real organisations sign up.
- **n8n.** If a workflow calls `/webhooks/assessment-submitted`, it must sign the raw body
  with `INBOUND_WEBHOOK_SECRET` and send `X-StopFRA-Signature: t=<unix seconds>,v1=<hex
  HMAC-SHA256 of "<t>.<body>">`. A plain shared-secret header is rejected. Without the secret
  the endpoint is off.
- **`NODE_ENV`.** `start.sh` defaults it to `production`. Do not override it on any server
  that real people can reach: outside production, sign-up returns the email confirmation
  token in its response.

## 6. Deploy

```bash
./infra/scripts/deploy-backend.sh      # builds, migrates, starts, installs the nightly backup
./infra/scripts/deploy-dashboard.sh
```

If a setting is missing, the backend refuses to start and logs which one. See
`sudo journalctl -u stopfra-backend -n 50` on the server.

## 7. Check it works

1. `curl https://api.fraud-risk.co.uk/api/v1/health` reports `"status":"ok"`.
2. Sign up on https://app.fraud-risk.co.uk with a real address. The confirmation email
   arrives, and the link signs you in.
3. Run the first backup on the server, then restore it into a spare Neon branch:

   ```bash
   sudo -u stopfra /opt/stopfra/backend/backup-database.sh
   ./infra/scripts/restore-database.sh latest "<spare branch connection string>"
   ```

   The backup alarm clears once this first backup has run.

### Frontend errors

Errors in users' browsers are sent to the API, written to the backend log and counted.
More than 5 in 15 minutes triggers the `frontend-errors` alarm email. To read them:

```bash
sudo journalctl -u stopfra-backend --since "-1h" | grep '"client-error"'
```

Each line has the message, stack, page path, browser and build commit. Emails, tokens
and query strings are removed before logging, and the IP address is never logged.
