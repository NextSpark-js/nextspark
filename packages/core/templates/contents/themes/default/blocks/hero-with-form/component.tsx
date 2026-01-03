'use client'

import React from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Checkbox } from '@nextsparkjs/core/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import { cn } from '@nextsparkjs/core/lib/utils'
import { buildSectionClasses } from '@nextsparkjs/core/types/blocks'
import { sel } from '../../lib/selectors'
import type { HeroWithFormBlockProps } from './schema'

/**
 * Hero With Form Block Component
 *
 * Props from 3-tab structure:
 * - Content: title, subtitle, backgroundImage, form fields
 * - Design: backgroundColor, overlayOpacity
 * - Advanced: className, id
 */
export function HeroWithFormBlock({
  // Base content props
  title,
  subtitle,
  backgroundImage,
  // Form content props
  formTitle = 'Get Started',
  formSubtitle,
  firstNamePlaceholder = 'First Name',
  lastNamePlaceholder = 'Last Name',
  emailPlaceholder = 'Email',
  phonePlaceholder = 'Phone',
  areaOfInterestPlaceholder = 'Area of Interest',
  areaOfInterestOptions,
  consentCheckboxLabel,
  submitButtonText = 'Submit',
  legalDisclaimer,
  termsLinkText = 'Terms of Service',
  termsLinkUrl,
  privacyLinkText = 'Privacy Policy',
  privacyLinkUrl,
  formAction,
  // Design props
  backgroundColor,
  overlayOpacity = '40',
  // Advanced props
  className,
  id,
}: HeroWithFormBlockProps) {
  // Build section classes with background and custom className
  const sectionClasses = buildSectionClasses(
    'relative min-h-screen',
    { backgroundColor, className }
  )

  // Calculate overlay opacity class
  const overlayClass = overlayOpacity === '0'
    ? 'bg-transparent'
    : `bg-black/${overlayOpacity}`

  // Parse area of interest options (handle both \n and actual newlines)
  const areaOptions = areaOfInterestOptions
    ? areaOfInterestOptions
        .split(/\\n|\n/)
        .map((opt: string) => opt.trim())
        .filter(Boolean)
    : []

  return (
    <section id={id} className={sectionClasses} data-cy={sel('blocks.heroWithForm.container')}>
      {/* Background Image with overlay - full coverage */}
      <div className="absolute inset-0">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className={cn('absolute inset-0', overlayClass)} />
      </div>

      {/* Content Container */}
      <div className="container relative z-10 mx-auto px-4 py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 min-h-screen items-center">

          {/* Left: Title/Subtitle - vertically centered, bottom aligned on mobile */}
          <div className="text-white order-2 lg:order-1 flex flex-col justify-end lg:justify-center pb-8 lg:pb-0">
            {title && (
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold italic mb-4 leading-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-lg lg:text-xl xl:text-2xl opacity-90 max-w-lg">
                {subtitle}
              </p>
            )}
          </div>

          {/* Right: Form Card - centered vertically */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end items-start lg:items-center pt-8 lg:pt-0">
            <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-md">
              {/* Form Header */}
              {formTitle && (
                <h2 className="text-xl font-bold text-center text-primary mb-2">
                  {formTitle}
                </h2>
              )}
              {formSubtitle && (
                <p className="text-sm text-center text-muted-foreground mb-6">
                  {formSubtitle}
                </p>
              )}

              {/* Form */}
              <form action={formAction} method="POST" className="space-y-4">
                <Input
                  placeholder={firstNamePlaceholder}
                  name="firstName"
                  required
                  data-cy={sel('blocks.heroWithForm.form.firstname')}
                />

                <Input
                  placeholder={lastNamePlaceholder}
                  name="lastName"
                  required
                  data-cy={sel('blocks.heroWithForm.form.lastname')}
                />

                <Input
                  type="email"
                  placeholder={emailPlaceholder}
                  name="email"
                  required
                  data-cy={sel('blocks.heroWithForm.form.email')}
                />

                <Input
                  type="tel"
                  placeholder={phonePlaceholder}
                  name="phone"
                  data-cy={sel('blocks.heroWithForm.form.phone')}
                />

                {areaOptions.length > 0 && (
                  <Select name="areaOfInterest">
                    <SelectTrigger data-cy={sel('blocks.heroWithForm.form.area')}>
                      <SelectValue placeholder={areaOfInterestPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {areaOptions.map((option: string, index: number) => (
                        <SelectItem key={index} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {consentCheckboxLabel && (
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent"
                      name="consent"
                      className="mt-0.5"
                      data-cy={sel('blocks.heroWithForm.form.consent')}
                    />
                    <label
                      htmlFor="consent"
                      className="text-sm text-muted-foreground leading-tight cursor-pointer"
                    >
                      {consentCheckboxLabel}
                    </label>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  data-cy={sel('blocks.heroWithForm.form.submit')}
                >
                  {submitButtonText}
                </Button>
              </form>

              {/* Legal Disclaimer */}
              {(legalDisclaimer || termsLinkUrl || privacyLinkUrl) && (
                <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                  {legalDisclaimer && <span>{legalDisclaimer} </span>}
                  {termsLinkUrl && (
                    <>
                      <a
                        href={termsLinkUrl}
                        className="underline hover:text-primary"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {termsLinkText}
                      </a>
                      {privacyLinkUrl && <span> y </span>}
                    </>
                  )}
                  {privacyLinkUrl && (
                    <a
                      href={privacyLinkUrl}
                      className="underline hover:text-primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {privacyLinkText}
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
