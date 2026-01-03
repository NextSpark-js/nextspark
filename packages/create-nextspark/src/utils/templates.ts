import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ENV_TEMPLATE = `# NextSpark Environment Configuration
# Documentation: https://nextspark.dev/docs/configuration

# =============================================================================
# APP CONFIGURATION
# =============================================================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=My NextSpark App

# =============================================================================
# DATABASE
# =============================================================================
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/nextspark?schema=public"

# =============================================================================
# AUTHENTICATION (Better Auth)
# =============================================================================
# Generate a secure secret: openssl rand -base64 32
BETTER_AUTH_SECRET=your-super-secret-key-change-this
BETTER_AUTH_URL=http://localhost:3000

# =============================================================================
# EMAIL (Resend)
# =============================================================================
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com

# =============================================================================
# PAYMENTS (Stripe)
# =============================================================================
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here

# =============================================================================
# OAUTH PROVIDERS (Optional)
# =============================================================================
# Google OAuth
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# GitHub OAuth
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
`

export async function createEnvFile(projectPath: string): Promise<void> {
  const envPath = path.join(projectPath, '.env')
  const envExamplePath = path.join(projectPath, '.env.example')

  // Write both .env and .env.example
  await Promise.all([
    fs.writeFile(envPath, ENV_TEMPLATE, 'utf-8'),
    fs.writeFile(envExamplePath, ENV_TEMPLATE, 'utf-8'),
  ])
}

export async function getTemplateContent(templateName: string): Promise<string> {
  const templatePath = path.resolve(__dirname, '../../templates', templateName)
  return fs.readFile(templatePath, 'utf-8')
}
