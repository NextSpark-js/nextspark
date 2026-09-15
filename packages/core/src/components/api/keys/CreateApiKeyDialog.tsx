"use client";

import { useMemo, useState } from 'react';
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
  return useMemo(() => {
    const appScopes = Object.keys(getAppApiScopes());
    if (appScopes.length === 0) return SCOPE_CATEGORIES;
    return {
      ...SCOPE_CATEGORIES,
      app: {
        name: 'Application',
        description: 'Scopes this application defines for its own routes',
        scopes: appScopes,
      },
    };
  }, []);
}

export function CreateApiKeyDialog({ open, onClose, onSuccess }: CreateApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const scopeCatalogue = useScopeCatalogue();
  const scopeLabels = useMemo(() => getApiScopes(), []);
  const [expiresAt, setExpiresAt] = useState('');
  const [expiryOption, setExpiryOption] = useState<'never' | '30d' | '90d' | '1y' | 'custom'>('never');

  const createApiKey = useMutation({
    mutationFn: async (data: { name: string; scopes: string[]; expiresAt?: string }) => {
      const response = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create API key');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success('API key created successfully');
      onSuccess(data.data);
      handleClose();
    },
    onError: (error) => {
      toast.error(`Failed to create API key: ${error.message}`);
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
      toast.error('Please enter a name for the API key');
      return;
    }
    
    if (selectedScopes.length === 0) {
      toast.error('Please select at least one scope');
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
          <DialogTitle>Create new API Key</DialogTitle>
          <DialogDescription>
            Create an API key to securely access the external endpoints.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">API Key Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My mobile app"
              maxLength={100}
              data-cy={sel('settings.apiKeys.createDialog.nameInput')}
            />
            <p className="text-xs text-muted-foreground">
              A descriptive name to identify this API key
            </p>
          </div>

          {/* Expiry Options */}
          <div className="space-y-2">
            <Label>Expiration</Label>
            <Select value={expiryOption} onValueChange={(value: typeof expiryOption) => setExpiryOption(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never expires</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
                <SelectItem value="1y">1 year</SelectItem>
                <SelectItem value="custom">Custom date</SelectItem>
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
              <Label>Permissions (Scopes)</Label>
              <p className="text-xs text-muted-foreground">
                Choose the permissions this API key will have
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You can only assign permissions that your current role allows. Permissions cannot be changed after creating the API key.
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
                          {category.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {category.description}
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
                            {scopeLabels[scope]}
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
                <Label>Selected permissions ({selectedScopes.length})</Label>
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
              <strong>Important:</strong> The API key will only be shown once after creation.
              Store it somewhere safe, as you won't be able to see it again.
            </AlertDescription>
          </Alert>
        </form>

        <DialogFooter data-cy={sel('settings.apiKeys.createDialog.footer')}>
          <Button variant="outline" onClick={handleClose} disabled={createApiKey.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createApiKey.isPending || selectedScopes.length === 0 || !name.trim()}
            data-cy={sel('settings.apiKeys.createDialog.submitButton')}
          >
            {createApiKey.isPending ? 'Creating...' : 'Create API Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
