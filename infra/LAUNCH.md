# Production launch: settings and first deploy

Run these from your own machine. You need the AWS CLI signed in to the production account
(region eu-west-2), Terraform 1.5 or later, pnpm, and `ssh` access to the server.

## 1. Gather the values

| What | Where to get it |
|------|-----------------|
| Neon connection string | Neon console, the production branch, "Connection string" with `?sslmode=require` |
| Upstash Redis REST URL and token | Upstash console, the database, "REST API" |
| Two JWT secrets | Run `openssl rand -hex 32` twice. The two values must be different |
| Stripe live secret key (`sk_live_…`) | Stripe dashboard, Developers > API keys |
| Your alert email address | Where alarm emails should go |
| Cloudflare API token | The domain's DNS is on Cloudflare. dash.cloudflare.com > My Profile > API Tokens > Create Token > Custom. Permissions: Zone: Zone Read and Zone: DNS Edit. Limit it to fraud-risk.co.uk |

Email needs no values: Terraform sets up Amazon SES and stores the SMTP login itself.

## 2. Terraform

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # never commit this file
# Fill in neon_database_url, upstash_redis_rest_url/token, jwt_secret,
# jwt_refresh_secret, alert_emails and cloudflare_api_token. Leave mail_forward_to
# empty: incoming mail for the domain goes to Spacemail
terraform init
terraform plan        # read it: it should only create resources
terraform apply
```

This creates the server, load balancer, dashboard hosting, backups bucket, alarms and SES
email. It also writes the database, JWT, Redis, S3 and SMTP settings to Parameter Store,
and adds the DNS records on Cloudflare: api and app, the certificate checks, the SES
records and DMARC. It leaves the Spacemail MX and SPF records as they are.

Then, in your inbox, click the "AWS Notification - Subscription Confirmation" link so
alarm emails reach you.

## 3. Turn on email sending (SES)

1. Wait for the domain to verify, which can take up to an hour. Check with
   `terraform output ses_domain_verified`, which should print `true`.
2. A new SES account can only send to addresses you have verified yourself. To send to
   anyone, go to the SES console (London, eu-west-2), then Account dashboard >
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
aws ssm get-parameters-by-path --path /fra/backend/ --region eu-west-2 --query 'Parameters[].Name'
```

The list should include SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM, STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, CORS_ORIGINS and WEB_APP_URL.

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
