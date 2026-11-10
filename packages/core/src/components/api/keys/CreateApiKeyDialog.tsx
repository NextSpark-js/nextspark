"use client";

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter,
  DialogHeader, 
  DialogTitle 
} from '../../ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../ui/select';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { SCOPE_CATEGORIES, getApiScopes, getAppApiScopes } from '../../../lib/api/keys';
import { sel } from '../../../lib/test';
import { withBasePath } from '../../../lib/base-path'

interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (apiKey: { id: string; name: string; key: string; scopes: string[]; warning: string }) => void;
}

/**
 * The scope catalogue this dialog offers: core's categories, plus one for whatever the app
 * declared in `api.scopes`. Without that last group an app-declared scope validated fine on the
 * server and was simply unreachable from the only screen that creates keys — so the person
 * creating one picked the wildcard instead.
 */
function useScopeCatalogue() {
  const t = useTranslations('settings.apiKeys.create');
  return useMemo(() => {
    const appScopes = Object.keys(getAppApiScopes());
    if (appScopes.length === 0) return SCOPE_CATEGORIES;
    return {
      ...SCOPE_CATEGORIES,
      app: {
        name: t('appScopeName'),
        description: t('appScopeDescription'),
        scopes: appScopes,
      },
    };
  }, [t]);
}

export function CreateApiKeyDialog({ open, onClose, onSuccess }: CreateApiKeyDialogProps) {
  const t = useTranslations('settings.apiKeys.create');
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const scopeCatalogue = useScopeCatalogue();
  const scopeLabels = useMemo(() => getApiScopes(), []);
  // What core's scopes and categories say, in the language of the interface (the English text is the one in lib/api/keys);
  // the scopes an app declares keep the description the app wrote.
  const tScopes = useTranslations('settings.apiKeys.scopeLabels');
  const tCategories = useTranslations('settings.apiKeys.scopeCategories');
  const [expiresAt, setExpiresAt] = useState('');
  const [expiryOption, setExpiryOption] = useState<'never' | '30d' | '90d' | '1y' | 'custom'>('never');

  const createApiKey = useMutation({
    mutationFn: async (data: { name: string; scopes: string[]; expiresAt?: string }) => {
      const response = await fetch(withBasePath('/api/v1/api-keys'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('createFailed'));
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(t('created'));
      onSuccess(data.data);
      handleClose();
    },
    onError: (error) => {
      toast.error(t('createFailedWithMessage', { message: error.message }));
    }
  });

  const handleClose = () => {
    setName('');
    setSelectedScopes([]);
    setExpiresAt('');
    setExpiryOption('never');
    onClose();
  };

  const handleScopeToggle = (scope: string, checked: boolean) => {
    if (checked) {
      setSelectedScopes(prev => [...prev, scope]);
    } else {
      setSelectedScopes(prev => prev.filter(s => s !== scope));
    }
  };

  const handleCategoryToggle = (categoryScopes: string[], checked: boolean) => {
    if (checked) {
      setSelectedScopes(prev => [...new Set([...prev, ...categoryScopes])]);
    } else {
      setSelectedScopes(prev => prev.filter(s => !categoryScopes.includes(s)));
    }
  };

  const calculateExpiryDate = (option: string): string | undefined => {
    if (option === 'never') return undefined;
    if (option === 'custom') return expiresAt || undefined;
    
    const now = new Date();
    switch (option) {
      case '30d':
        now.setDate(now.getDate() + 30);
        break;
      case '90d':
        now.setDate(now.getDate() + 90);
        break;
      case '1y':
        now.setFullYear(now.getFullYear() + 1);
        break;
    }
    return now.toISOString();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    
    if (selectedScopes.length === 0) {
      toast.error(t('scopeRequired'));
      return;
    }

    const expiryDate = calculateExpiryDate(expiryOption);
    
    createApiKey.mutate({
      name: name.trim(),
      scopes: selectedScopes,
      expiresAt: expiryDate
    });
  };

  const isCategoryFullySelected = (categoryScopes: string[]) => {
    return categoryScopes.every(scope => selectedScopes.includes(scope));
  };

  const isCategoryPartiallySelected = (categoryScopes: string[]) => {
    return categoryScopes.some(scope => selectedScopes.includes(scope)) && 
           !isCategoryFullySelected(categoryScopes);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-cy={sel('settings.apiKeys.createDialog.container')}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('nameLabel')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={100}
              data-cy={sel('settings.apiKeys.createDialog.nameInput')}
            />
            <p className="text-xs text-muted-foreground">
              {t('nameHelp')}
            </p>
          </div>

          {/* Expiry Options */}
          <div className="space-y-2">
            <Label>{t('expiration')}</Label>
            <Select value={expiryOption} onValueChange={(value: typeof expiryOption) => setExpiryOption(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">{t('expiry.never')}</SelectItem>
                <SelectItem value="30d">{t('expiry.days30')}</SelectItem>
                <SelectItem value="90d">{t('expiry.days90')}</SelectItem>
                <SelectItem value="1y">{t('expiry.year1')}</SelectItem>
                <SelectItem value="custom">{t('expiry.custom')}</SelectItem>
              </SelectContent>
            </Select>

            {expiryOption === 'custom' && (
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            )}
          </div>

          {/* Scopes Selection */}
          <div className="space-y-4" data-cy={sel('settings.apiKeys.createDialog.scopesContainer')}>
            <div>
              <Label>{t('permissions')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('permissionsHelp')}
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t('permissionsNotice')}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {Object.entries(scopeCatalogue).map(([categoryKey, category]) => {
                const isFullySelected = isCategoryFullySelected(category.scopes);
                const isPartiallySelected = isCategoryPartiallySelected(category.scopes);

                return (
                  <div key={categoryKey} className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${categoryKey}`}
                        checked={isFullySelected}
                        ref={(el: HTMLButtonElement | null) => {
                          if (el && 'indeterminate' in el) (el as unknown as HTMLInputElement).indeterminate = isPartiallySelected;
                        }}
                        onCheckedChange={(checked: boolean | 'indeterminate') =>
                          handleCategoryToggle(category.scopes, checked as boolean)
                        }
                      />
                      <div>
                        <Label
                          htmlFor={`category-${categoryKey}`}
                          className="font-medium"
                        >
                          {tCategories.has(`${categoryKey}.name`) ? tCategories(`${categoryKey}.name`) : category.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {tCategories.has(`${categoryKey}.description`) ? tCategories(`${categoryKey}.description`) : category.description}
                        </p>
                      </div>
                    </div>

                    <div className="ml-6 space-y-2">
                      {category.scopes.map((scope) => (
                        <div key={scope} className="flex items-center space-x-2">
                          <Checkbox
                            id={scope}
                            checked={selectedScopes.includes(scope)}
                            onCheckedChange={(checked: boolean | 'indeterminate') =>
                              handleScopeToggle(scope, checked as boolean)
                            }
                            data-cy={sel('settings.apiKeys.createDialog.scopeOption', { scope })}
                          />
                          <Label htmlFor={scope} className="text-sm">
                            <code className="text-xs bg-muted px-1 py-0.5 rounded mr-2">
                              {scope}
                            </code>
                            {tScopes.has(scope) ? tScopes(scope) : scopeLabels[scope]}
                          </Label>
                        </div>
                      ))}
                    </div>

                    {categoryKey !== 'system' && <Separator />}
                  </div>
                );
              })}
            </div>

            {/* Selected Scopes Summary */}
            {selectedScopes.length > 0 && (
              <div className="space-y-2">
                <Label>{t('selectedPermissions', { count: selectedScopes.length })}</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedScopes.map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-xs">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Security Warning */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{t('important')}</strong> {t('importantNotice')}
            </AlertDescription>
          </Alert>
        </form>

        <DialogFooter data-cy={sel('settings.apiKeys.createDialog.footer')}>
          <Button variant="outline" onClick={handleClose} disabled={createApiKey.isPending}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createApiKey.isPending || selectedScopes.length === 0 || !name.trim()}
            data-cy={sel('settings.apiKeys.createDialog.submitButton')}
          >
            {createApiKey.isPending ? t('creating') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
