'use client'

import { useUserProfile } from '@nextsparkjs/core/hooks/useUserProfile'
import { useAuth } from '@nextsparkjs/core/hooks/useAuth'
import { setUserLocaleClient } from '@nextsparkjs/core/lib/locale-client'
import { I18N_CONFIG } from '@nextsparkjs/core/lib/config'
import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Label } from '@nextsparkjs/core/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nextsparkjs/core/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@nextsparkjs/core/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@nextsparkjs/core/components/ui/command'
import { Separator } from '@nextsparkjs/core/components/ui/separator'
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@nextsparkjs/core/components/ui/dialog'
import {
  Loader2, 
  User, 
  Mail, 
  Calendar,
  Globe,
  Clock,
  Languages,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  ChevronsUpDown
} from 'lucide-react'
import { profileSchema, ProfileFormData } from '@nextsparkjs/core/lib/validation'
import { countries, timezones } from '@nextsparkjs/core/lib/countries-timezones'
import { createTestId, createCyId } from '@nextsparkjs/core/lib/test'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'

// Language options
const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
] as const

function ProfilePage() {
  const { profile, isLoading, error } = useUserProfile()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const [updateSuccess, setUpdateSuccess] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [timezoneOpen, setTimezoneOpen] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)
  const t = useTranslations('settings')

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      country: '',
      timezone: '',
      language: I18N_CONFIG.defaultLocale,
    },
  })

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        country: profile.country || '',
        timezone: profile.timezone || '',
        language: profile.language || I18N_CONFIG.defaultLocale,
      })
    }
  }, [profile, reset])

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      setUpdateSuccess(true)
      setStatusMessage(t('profile.messages.updateSuccess'))
      setTimeout(() => {
        setUpdateSuccess(false)
        setStatusMessage('')
      }, 3000)
    },
    onError: (error) => {
      setStatusMessage(t('profile.messages.updateError', { error: error.message }))
    },
  })

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete account')
      }

      return response.json()
    },
    onSuccess: async () => {
      setStatusMessage(t('profile.messages.deleteSuccess'))
      // Clear all query data and sign out the user
      queryClient.clear()
      await signOut()
      // Redirect will happen automatically after signOut
    },
    onError: (error) => {
      setStatusMessage(t('profile.messages.deleteError', { error: error.message }))
    },
  })

  const onSubmit = useCallback(async (data: ProfileFormData) => {
    setStatusMessage(t('profile.messages.updating'))
    
    // Check if language changed
    const languageChanged = profile?.language !== data.language
    
    try {
      // Update profile with ALL fields (including language)
      await updateProfileMutation.mutateAsync(data)
      
      // If language changed, update app language after successful profile update
      if (languageChanged) {
        try {
          // Update cookie and reload to apply new language
          setUserLocaleClient(data.language)
          window.location.reload()
        } catch (error) {
          console.error('Error updating app language:', error)
        }
      }
    } catch {
      // Error handled by mutation onError
    }
  }, [updateProfileMutation, t, profile?.language])

  const handleDeleteAccount = useCallback(() => {
    setStatusMessage(t('profile.messages.deleting'))
    deleteAccountMutation.mutate()
    setDeleteDialogOpen(false)
  }, [deleteAccountMutation, t])

  const handleAdvancedToggle = useCallback(() => {
    const newState = !advancedOpen
    setAdvancedOpen(newState)
    setStatusMessage(newState ? t('profile.messages.advancedOpen') : t('profile.messages.advancedClosed'))
  }, [advancedOpen, t])



  const countryValue = watch('country')
  const timezoneValue = watch('timezone')
  const languageValue = watch('language')

  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center py-12"
        role="status"
        aria-label={t('profile.loading.aria')}
        {...createTestId('profile', 'loading') && { 'data-testid': createTestId('profile', 'loading') }}
        {...createCyId('profile', 'loading') && { 'data-cy': createCyId('profile', 'loading') }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{t('profile.loading.text')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert 
        className="max-w-md"
        variant="destructive"
        role="alert"
        {...createTestId('profile', 'error') && { 'data-testid': createTestId('profile', 'error') }}
        {...createCyId('profile', 'error') && { 'data-cy': createCyId('profile', 'error') }}
      >
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertDescription>
          {t('profile.error.message')}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        {...createTestId('profile', 'status', 'message') && { 'data-testid': createTestId('profile', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      <div
        className="max-w-4xl space-y-6"
        {...createTestId('profile', 'container') && { 'data-testid': createTestId('profile', 'container') }}
        data-cy="settings-profile"
      >
        {/* Header */}
        <header 
          {...createTestId('profile', 'header') && { 'data-testid': createTestId('profile', 'header') }}
          {...createCyId('profile', 'header') && { 'data-cy': createCyId('profile', 'header') }}
        >
          <h1 
            className="text-2xl font-bold"
            id="profile-heading"
            {...createTestId('profile', 'title') && { 'data-testid': createTestId('profile', 'title') }}
          >
            {t('profile.title')}
          </h1>
          <p 
            className="text-muted-foreground mt-1"
            {...createTestId('profile', 'description') && { 'data-testid': createTestId('profile', 'description') }}
          >
            {t('profile.description')}
          </p>
        </header>

        {/* Success Alert */}
        {updateSuccess && (
          <Alert 
            className="border-green-200 bg-green-50 text-green-800"
            role="status"
            aria-live="polite"
            {...createTestId('profile', 'success', 'alert') && { 'data-testid': createTestId('profile', 'success', 'alert') }}
            {...createCyId('profile', 'success') && { 'data-cy': createCyId('profile', 'success') }}
          >
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            <AlertDescription>
              {t('profile.success.message')}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {updateProfileMutation.error && (
          <Alert 
            variant="destructive"
            role="alert"
            aria-live="assertive"
            {...createTestId('profile', 'error', 'alert') && { 'data-testid': createTestId('profile', 'error', 'alert') }}
            {...createCyId('profile', 'error-alert') && { 'data-cy': createCyId('profile', 'error-alert') }}
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              {updateProfileMutation.error.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Single Column Layout */}
        <Card 
          className="max-w-4xl"
          {...createTestId('profile', 'form', 'card') && { 'data-testid': createTestId('profile', 'form', 'card') }}
          {...createCyId('profile', 'form') && { 'data-cy': createCyId('profile', 'form') }}
        >
            <CardHeader>
              <CardTitle 
                className="flex items-center gap-2"
                id="profile-form-title"
                {...createTestId('profile', 'form', 'title') && { 'data-testid': createTestId('profile', 'form', 'title') }}
              >
                <User className="h-5 w-5" aria-hidden="true" />
                {t('profile.form.title')}
              </CardTitle>
              <CardDescription
                {...createTestId('profile', 'form', 'description') && { 'data-testid': createTestId('profile', 'form', 'description') }}
              >
                {t('profile.form.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={handleSubmit(onSubmit)} 
                className="space-y-6"
                aria-labelledby="profile-form-title"
                {...createTestId('profile', 'form', 'element') && { 'data-testid': createTestId('profile', 'form', 'element') }}
                {...createCyId('profile', 'form-element') && { 'data-cy': createCyId('profile', 'form-element') }}
              >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t('profile.form.firstName')}</Label>
                  <Input
                    id="firstName"
                    data-cy="profile-first-name"
                    {...register('firstName')}
                    placeholder={t('profile.form.firstNamePlaceholder')}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">{t('profile.form.lastName')}</Label>
                  <Input
                    id="lastName"
                    data-cy="profile-last-name"
                    {...register('lastName')}
                    placeholder={t('profile.form.lastNamePlaceholder')}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              {/* Email, Auth and Verification - 50%, 25%, 25% Layout */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>{t('profile.form.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-cy="profile-email"
                      value={profile?.email || ''}
                      disabled
                      className="pl-10 bg-muted"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('profile.form.emailNote')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('profile.form.authMethod')}</Label>
                  <div className="flex items-center gap-3 py-2">
                    {profile?.authMethod === 'Google' ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    ) : (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{profile?.authMethod}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>{t('profile.form.verificationStatus')}</Label>
                  <div className="flex items-center gap-3 py-2">
                    <CheckCircle2 className={`h-4 w-4 ${profile?.emailVerified ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">
                      {profile?.emailVerified ? t('profile.form.verified') : t('profile.form.notVerified')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location and Preferences - 20%, 30%, 50% Layout */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-10">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="language">{t('profile.form.language')}</Label>
                  <Select
                    value={languageValue || ''}
                    onValueChange={(value: string) => {
                      if (value) {
                        setValue('language', value)
                      }
                    }}
                    {...createTestId('profile', 'language', 'select') && { 'data-testid': createTestId('profile', 'language', 'select') }}
                    {...createCyId('profile', 'language-select') && { 'data-cy': createCyId('profile', 'language-select') }}
                  >
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <SelectValue placeholder={t('profile.form.languagePlaceholder')} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((language) => (
                        <SelectItem key={language.value} value={language.value}>
                          {language.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.language && (
                    <p className="text-sm text-destructive">{errors.language.message}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="country">{t('profile.form.country')}</Label>
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryOpen}
                        className="w-full justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {countryValue
                            ? countries.find((country) => country.value === countryValue)?.label
                            : t('profile.form.countryPlaceholder')}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar país..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>No se encontraron países.</CommandEmpty>
                          <CommandGroup>
                            {countries.map((country) => (
                              <CommandItem
                                key={country.value}
                                value={country.label}
                                onSelect={() => {
                                  setValue('country', country.value === countryValue ? '' : country.value)
                                  setCountryOpen(false)
                                }}
                              >
                                {country.label}
                                <Check
                                  className={`ml-auto h-4 w-4 ${
                                    countryValue === country.value ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.country && (
                    <p className="text-sm text-destructive">{errors.country.message}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-5">
                  <Label htmlFor="timezone">{t('profile.form.timezone')}</Label>
                  <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={timezoneOpen}
                        className="w-full justify-between"
                        {...createTestId('profile', 'timezone', 'select') && { 'data-testid': createTestId('profile', 'timezone', 'select') }}
                        {...createCyId('profile', 'timezone-select') && { 'data-cy': createCyId('profile', 'timezone-select') }}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {timezoneValue
                            ? timezones.find((timezone) => timezone.value === timezoneValue)?.label
                            : t('profile.form.timezonePlaceholder')}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar timezone..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>No se encontraron timezones.</CommandEmpty>
                          <CommandGroup>
                            {timezones.map((timezone) => (
                              <CommandItem
                                key={timezone.value}
                                value={timezone.label}
                                onSelect={() => {
                                  setValue('timezone', timezone.value === timezoneValue ? '' : timezone.value)
                                  setTimezoneOpen(false)
                                }}
                              >
                                {timezone.label}
                                <Check
                                  className={`ml-auto h-4 w-4 ${
                                    timezoneValue === timezone.value ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.timezone && (
                    <p className="text-sm text-destructive">{errors.timezone.message}</p>
                  )}
                </div>
              </div>

              {/* Action Section - Button and Member Info */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">{t('profile.form.memberSince')}:</span>
                  <span>
                    {profile && new Date(profile.createdAt).toLocaleDateString('es-ES', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || updateProfileMutation.isPending}
                  aria-describedby="submit-help"
                  className="w-full md:w-auto"
                  {...createTestId('profile', 'submit', 'button') && { 'data-testid': createTestId('profile', 'submit', 'button') }}
                  {...createCyId('profile', 'submit') && { 'data-cy': createCyId('profile', 'submit') }}
                >
                  {(isSubmitting || updateProfileMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      {t('profile.form.updating')}
                    </>
                  ) : (
                    t('profile.form.updateButton')
                  )}
                </Button>
                <div id="submit-help" className="sr-only">
                  {(isSubmitting || updateProfileMutation.isPending) 
                    ? t('profile.form.submitHelpUpdating')
                    : t('profile.form.submitHelp')
                  }
                </div>
              </div>

              {/* Advanced Section */}
              <div className="mt-6">
                <Separator />
                <div className="mt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleAdvancedToggle}
                      className="w-full justify-between text-muted-foreground hover:text-foreground"
                      aria-expanded={advancedOpen}
                      aria-controls="advanced-options"
                      aria-label={advancedOpen ? t('profile.advanced.closeLabel') : t('profile.advanced.openLabel')}
                      {...createTestId('profile', 'advanced', 'toggle') && { 'data-testid': createTestId('profile', 'advanced', 'toggle') }}
                      {...createCyId('profile', 'advanced-toggle') && { 'data-cy': createCyId('profile', 'advanced-toggle') }}
                    >
                      {t('profile.advanced.title')}
                      {advancedOpen ? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  
                    {advancedOpen && (
                      <div 
                        id="advanced-options"
                        className="mt-4 space-y-4 border-t pt-4"
                        {...createTestId('profile', 'advanced', 'section') && { 'data-testid': createTestId('profile', 'advanced', 'section') }}
                        {...createCyId('profile', 'advanced-section') && { 'data-cy': createCyId('profile', 'advanced-section') }}
                      >
                        <div className="space-y-2">
                          <h4 
                            className="text-sm font-medium text-destructive"
                            id="danger-zone-heading"
                            {...createTestId('profile', 'danger', 'heading') && { 'data-testid': createTestId('profile', 'danger', 'heading') }}
                          >
                            {t('profile.danger.title')}
                          </h4>
                          <p 
                            className="text-xs text-muted-foreground"
                            {...createTestId('profile', 'danger', 'warning') && { 'data-testid': createTestId('profile', 'danger', 'warning') }}
                          >
                            {t('profile.danger.warning')}
                          </p>
                        
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                className="w-full gap-2"
                                disabled={deleteAccountMutation.isPending}
                                aria-describedby="danger-zone-heading"
                                {...createTestId('profile', 'delete', 'trigger') && { 'data-testid': createTestId('profile', 'delete', 'trigger') }}
                                {...createCyId('profile', 'delete-account') && { 'data-cy': createCyId('profile', 'delete-account') }}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                {t('profile.danger.deleteButton')}
                              </Button>
                            </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                {t('profile.danger.dialogTitle')}
                              </DialogTitle>
                              <DialogDescription asChild>
                                <div className="space-y-2">
                                  <div>
                                    {t('profile.danger.dialogDescription')}
                                  </div>
                                  <div className="font-medium text-foreground">
                                    {t('profile.danger.dialogWarning')}
                                  </div>
                                  <div>
                                    {t('profile.danger.dialogDetail')}
                                  </div>
                                </div>
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setDeleteDialogOpen(false)}
                                disabled={deleteAccountMutation.isPending}
                              >
                                {t('profile.actions.cancel')}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleDeleteAccount}
                                disabled={deleteAccountMutation.isPending}
                                className="gap-2"
                              >
                                {deleteAccountMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('profile.danger.deleting')}
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4" />
                                    {t('profile.danger.confirmDelete')}
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/profile/page.tsx', ProfilePage)