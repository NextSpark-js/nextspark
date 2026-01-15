# /how-to:setup-email-providers

Interactive guide to configure email providers and transactional emails in NextSpark.

**Aliases:** `/how-to:email`, `/how-to:configure-email`

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/better-auth/SKILL.md` - Authentication integration with email

---

## Syntax

```
/how-to:setup-email-providers
/how-to:setup-email-providers --provider resend
/how-to:setup-email-providers --test
```

---

## Behavior

Guides the user through configuring email providers (Resend, Console) and understanding email templates for transactional emails.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding Email Providers
        └── Resend vs Console vs Auto mode

Step 2: Configure Environment Variables
        └── API keys, sender email, options

Step 3: Email Templates
        └── Verification, Password Reset, Team Invitation

Step 4: Sending Emails Programmatically
        └── EmailFactory and EmailProvider API

Step 5: Testing in Development
        └── Console provider, debugging tools
```

---

## Step 1: Understanding Email Providers

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: SETUP EMAIL PROVIDERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding Email Providers

NextSpark uses a provider-based email system
with automatic fallback and smart selection.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Available Providers:**

```
┌─────────────────────────────────────────────┐
│  RESEND (Production)                        │
│  ─────────────────────────────────────────  │
│  • Professional email delivery              │
│  • High deliverability                      │
│  • Analytics and tracking                   │
│  • Required for production                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  CONSOLE (Development)                      │
│  ─────────────────────────────────────────  │
│  • Logs emails to terminal                  │
│  • No real emails sent                      │
│  • Perfect for local development            │
│  • Extracts and displays links              │
└─────────────────────────────────────────────┘
```

**📋 Provider Selection Logic (Auto Mode):**

```typescript
// Default behavior when EMAIL_PROVIDER=auto or not set

if (NODE_ENV === 'development') {
  // Use Console provider (safe for testing)
  // Unless FORCE_RESEND_IN_DEV is set
}

if (NODE_ENV === 'production') {
  if (RESEND_API_KEY exists) {
    // Use Resend provider
  } else {
    // ERROR: API key required in production
  }
}
```

**📋 Key Files:**

```
packages/core/src/lib/email/
├── factory.ts       # EmailFactory singleton
├── types.ts         # TypeScript interfaces
├── templates.ts     # HTML email templates
├── index.ts         # Module exports
└── providers/
    ├── resend.ts    # Resend.com integration
    └── console.ts   # Console logging provider
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Configure Environment)
[2] I'm using a different email provider
[3] What's Resend and how do I sign up?
```

---

## Step 2: Configure Environment Variables

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Configure Environment Variables
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add these variables to your .env file:
```

**📋 Required Variables:**

```bash
# .env or .env.local

# Resend API Key (get from resend.com dashboard)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Sender email (must be verified domain in Resend)
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional: Sender name
RESEND_FROM_NAME=Your App Name
```

**📋 Optional Variables:**

```bash
# Provider selection: 'resend' | 'console' | 'auto' (default)
EMAIL_PROVIDER=auto

# Console provider log level: 'full' | 'summary' | 'links-only'
EMAIL_LOG_LEVEL=links-only

# Force Resend in development (useful for testing real emails)
FORCE_RESEND_IN_DEV=true

# App name (used in email templates)
NEXT_PUBLIC_APP_NAME=My Awesome App
```

**📋 Provider Configuration Matrix:**

| Environment | EMAIL_PROVIDER | RESEND_API_KEY | Result |
|-------------|----------------|----------------|--------|
| Development | auto | Not set | Console |
| Development | auto | Set | Console (unless FORCE_RESEND_IN_DEV) |
| Development | resend | Set | Resend |
| Development | console | Any | Console |
| Production | auto | Set | Resend |
| Production | auto | Not set | ERROR |
| Production | resend | Set | Resend |
| Production | console | Any | Console (not recommended) |

**📋 Getting a Resend API Key:**

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free)
3. Add and verify your domain
4. Create an API key in the dashboard
5. Copy the key to your `.env` file

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Email Templates)
[2] How do I verify my domain in Resend?
[3] Can I use SendGrid/Mailgun instead?
```

---

## Step 3: Email Templates

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Email Templates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NextSpark includes professional email templates
for common transactional emails.
```

**📋 Available Templates:**

```
┌─────────────────────────────────────────────┐
│  1. EMAIL VERIFICATION                      │
│  ─────────────────────────────────────────  │
│  Sent: After user signup                    │
│  Contains: Verification link                │
│  Color: Purple gradient                     │
│  Function: emailTemplates.verifyEmail()     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  2. PASSWORD RESET                          │
│  ─────────────────────────────────────────  │
│  Sent: When user requests password reset    │
│  Contains: Reset link (expires in 1 hour)   │
│  Color: Pink gradient                       │
│  Function: emailTemplates.resetPassword()   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  3. TEAM INVITATION                         │
│  ─────────────────────────────────────────  │
│  Sent: When inviting a new team member      │
│  Contains: Accept invitation link           │
│  Color: Indigo gradient                     │
│  Function: emailTemplates.teamInvitation()  │
└─────────────────────────────────────────────┘
```

**📋 Template Data Types:**

```typescript
// Email Verification
interface VerificationEmailData {
  userName: string        // User's first name
  verificationUrl: string // Full verification URL with token
  appName: string         // Your app name
}

// Password Reset
interface PasswordResetEmailData {
  userName: string
  resetUrl: string
  appName: string
  expiresIn?: string      // e.g., "1 hour"
}

// Team Invitation
interface TeamInvitationEmailData {
  inviteeEmail: string
  inviterName: string
  teamName: string
  role: string            // e.g., "admin", "member"
  acceptUrl: string
  expiresIn: string       // e.g., "7 days"
  appName: string
}
```

**📋 Template Features:**

All templates include:
- Responsive design (600px width)
- Table-based layout (email client compatible)
- Action button with fallback text link
- Professional gradient styling
- Footer with app name and copyright
- Copy-paste URL fallback

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Sending Emails)
[2] Can I customize the template design?
[3] How do I add a new template?
```

---

## Step 4: Sending Emails Programmatically

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Sending Emails Programmatically
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use the EmailFactory to send emails from anywhere
in your application.
```

**📋 Basic Email Sending:**

```typescript
import { EmailFactory } from '@/core/lib/email'
import { emailTemplates } from '@/core/lib/email/templates'

// 1. Get the email service instance (singleton)
const emailService = EmailFactory.getInstance()

// 2. Create template content
const template = emailTemplates.verifyEmail({
  userName: 'John',
  verificationUrl: 'https://myapp.com/verify?token=abc123',
  appName: 'My App'
})

// 3. Send the email
const response = await emailService.send({
  to: 'user@example.com',
  subject: template.subject,
  html: template.html
})

// 4. Handle response
if (response.success) {
  console.log('Email sent! ID:', response.id)
} else {
  console.error('Failed:', response.error)
}
```

**📋 Email Options Interface:**

```typescript
interface EmailOptions {
  from?: string             // Override default sender
  to: string | string[]     // Single or multiple recipients
  subject: string
  html?: string             // HTML content
  text?: string             // Plain text fallback
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: EmailAttachment[]
  headers?: Record<string, string>
}
```

**📋 Real-World Example: Team Invitation:**

```typescript
// From: /api/v1/teams/[teamId]/members/route.ts

import { EmailFactory } from '@/core/lib/email'
import { createTeamInvitationEmail } from '@/core/lib/email/templates'

// In your API handler:
const emailProvider = EmailFactory.getInstance()

const emailContent = createTeamInvitationEmail(
  validatedData.email,           // inviteeEmail
  authResult.user!.email,        // inviterName
  team.name,                     // teamName
  validatedData.role,            // role
  acceptUrl,                     // acceptUrl
  '7 days'                       // expiresIn
)

await emailProvider.send({
  to: validatedData.email,
  subject: emailContent.subject,
  html: emailContent.html
})
```

**📋 Better Auth Integration:**

Email sending is automatically handled by Better Auth for:
- Email verification (on signup)
- Password reset (on request)

```typescript
// In auth.ts - automatically configured
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  sendResetPassword: async ({ user, url, token }) => {
    const template = emailTemplates.resetPassword({
      userName: user.firstName || '',
      resetUrl: `${url}?token=${token}`,
      appName: process.env.NEXT_PUBLIC_APP_NAME || 'App',
      expiresIn: '1 hour'
    })

    await emailService.send({
      to: user.email,
      ...template
    })
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Testing)
[2] How do I send bulk emails?
[3] Can I add attachments?
```

---

## Step 5: Testing in Development

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Testing in Development
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Console provider makes testing easy by
logging emails to your terminal.
```

**📋 Console Output Modes:**

```bash
# Set in .env
EMAIL_LOG_LEVEL=links-only  # Default, shows links
EMAIL_LOG_LEVEL=summary     # Links + text preview
EMAIL_LOG_LEVEL=full        # Complete email content
```

**📋 Example Console Output (links-only):**

```
============================================================
📧 EMAIL INTERCEPTED (Console Provider)
============================================================
📮 To: user@example.com
📝 Subject: Verify Your Email Address
✉️  From: App <noreply@example.com>

🔗 Links in email:
   1. https://localhost:3000/verify?token=abc123xyz
============================================================
```

**📋 Testing Real Emails in Development:**

```bash
# Force Resend in development
FORCE_RESEND_IN_DEV=true

# Or explicitly set provider
EMAIL_PROVIDER=resend
```

**📋 Verify Provider Configuration:**

```typescript
// Test if email provider is properly configured
const provider = EmailFactory.getInstance()

// Some providers support verification
if (provider.verify) {
  const isReady = await provider.verify()
  console.log('Email provider ready:', isReady)
}
```

**📋 Common Issues:**

| Issue | Solution |
|-------|----------|
| "API key required in production" | Set RESEND_API_KEY |
| Emails not sending | Check EMAIL_PROVIDER setting |
| Links not working | Verify NEXT_PUBLIC_APP_URL |
| Template errors | Check template data types |

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• Email providers (Resend vs Console)
• Environment configuration
• Available email templates
• Programmatic email sending
• Testing in development

📚 Related tutorials:
   • /how-to:setup-authentication - Auth with email verification
   • /how-to:create-plugin - Create email notification plugins

🔙 Back to menu: /how-to:start
```

---

## Interactive Options

### "Can I use SendGrid/Mailgun instead?"

```
📋 Custom Email Providers:

Currently, NextSpark supports Resend out of the box.
To add a custom provider:

1. Create a new provider file:
   /packages/core/src/lib/email/providers/sendgrid.ts

2. Implement the EmailProvider interface:

   import { EmailProvider, EmailOptions, EmailResponse } from '../types'

   export class SendGridProvider implements EmailProvider {
     async send(options: EmailOptions): Promise<EmailResponse> {
       // Your SendGrid implementation
     }
   }

3. Register in factory.ts:

   if (providerName === 'sendgrid') {
     return new SendGridProvider(apiKey)
   }

4. Set environment:
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=your-key
```

### "How do I add a new template?"

```
📋 Creating Custom Templates:

1. Add template function to templates.ts:

   export function createWelcomeEmail(data: WelcomeEmailData) {
     return {
       subject: `Welcome to ${data.appName}!`,
       html: `
         <!DOCTYPE html>
         <html>
           <head>...</head>
           <body>
             <!-- Your HTML template -->
           </body>
         </html>
       `
     }
   }

2. Add type definition to types.ts:

   export interface WelcomeEmailData {
     userName: string
     appName: string
     dashboardUrl: string
   }

3. Use in your code:

   const template = createWelcomeEmail({
     userName: 'John',
     appName: 'My App',
     dashboardUrl: 'https://app.com/dashboard'
   })
```

---

## Related Commands

| Command | Description |
|---------|-------------|
| `/how-to:setup-authentication` | Configure Better Auth with email |
| `/how-to:create-plugin` | Create notification plugins |
| `/how-to:deploy` | Deploy with production email |
