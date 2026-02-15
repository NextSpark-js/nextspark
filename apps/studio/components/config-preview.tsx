'use client'

import { Globe, Users, CreditCard, Shield, Layout, Puzzle, Palette } from 'lucide-react'
import type { StudioResult } from '@/lib/types'

interface ConfigPreviewProps {
  result: StudioResult
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'accent' | 'success' }) {
  const colors = {
    default: 'bg-bg-elevated text-text-secondary border-border',
    accent: 'bg-accent-muted text-accent border-accent/30',
    success: 'bg-success/10 text-success border-success/30',
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  )
}

function Section({ icon: Icon, title, children }: { icon: typeof Globe; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Icon className="h-4 w-4 text-accent" />
        {title}
      </div>
      <div className="pl-6 space-y-1">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-secondary">{value}</span>
    </div>
  )
}

export function ConfigPreview({ result }: ConfigPreviewProps) {
  const { analysis, wizardConfig } = result

  if (!analysis && !wizardConfig) return null

  return (
    <div className="space-y-5">
      {/* Analysis */}
      {analysis && (
        <Section icon={Globe} title="Analysis">
          <Row label="Preset" value={<Badge variant="accent">{analysis.preset.toUpperCase()}</Badge>} />
          <Row label="Confidence" value={`${(analysis.confidence * 100).toFixed(0)}%`} />
          <Row label="Team Mode" value={analysis.suggestedTeamMode} />
          <Row label="Billing" value={analysis.suggestedBilling} />
          {analysis.detectedFeatures.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {analysis.detectedFeatures.map((f) => (
                <Badge key={f}>{f}</Badge>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Project Config */}
      {wizardConfig && (
        <>
          <Section icon={Layout} title="Project">
            <Row label="Name" value={wizardConfig.projectName} />
            <Row label="Slug" value={wizardConfig.projectSlug} />
            <Row label="Type" value={wizardConfig.projectType} />
          </Section>

          <Section icon={Users} title="Team">
            <Row label="Mode" value={wizardConfig.teamMode} />
            <Row
              label="Roles"
              value={(wizardConfig.teamRoles || []).join(', ')}
            />
          </Section>

          <Section icon={CreditCard} title="Billing">
            <Row label="Model" value={wizardConfig.billingModel} />
            <Row label="Currency" value={(wizardConfig.currency || 'usd').toUpperCase()} />
          </Section>

          <Section icon={Shield} title="Auth">
            <Row label="Registration" value={wizardConfig.auth.registrationMode} />
            <Row label="Email+Password" value={wizardConfig.auth.emailPassword ? 'Yes' : 'No'} />
            <Row label="Google OAuth" value={wizardConfig.auth.googleOAuth ? 'Yes' : 'No'} />
          </Section>

          {result.theme && (
            <Section icon={Palette} title="Theme">
              <Row label="Selected" value={<Badge variant="accent">{result.theme}</Badge>} />
            </Section>
          )}

          {result.plugins && result.plugins.length > 0 && (
            <Section icon={Puzzle} title="Plugins">
              <div className="flex flex-wrap gap-1">
                {result.plugins.map((p) => (
                  <Badge key={p} variant="success">{p}</Badge>
                ))}
              </div>
            </Section>
          )}

          <Section icon={Globe} title="Locale">
            <Row label="Default" value={wizardConfig.defaultLocale} />
            <Row
              label="Supported"
              value={(wizardConfig.supportedLocales || []).join(', ')}
            />
          </Section>
        </>
      )}
    </div>
  )
}
