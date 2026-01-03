"use client";

import { useState } from 'react';
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
import { API_SCOPES, SCOPE_CATEGORIES } from '../../../lib/api/keys';
import { createCyId } from '../../../lib/test';

interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (apiKey: { id: string; name: string; key: string; scopes: string[]; warning: string }) => void;
}

export function CreateApiKeyDialog({ open, onClose, onSuccess }: CreateApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-cy={createCyId('api-keys', 'dialog')}>
        <DialogHeader>
          <DialogTitle data-cy={createCyId('api-keys', 'dialog-title')}>Crear nueva API Key</DialogTitle>
          <DialogDescription>
            Crea una API key para acceder a los endpoints externos de forma segura.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6" data-cy={createCyId('api-keys', 'dialog-form')}>
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la API Key</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Mi aplicación móvil"
              maxLength={100}
              data-cy={createCyId('api-keys', 'dialog-name')}
            />
            <p className="text-xs text-muted-foreground">
              Un nombre descriptivo para identificar esta API key
            </p>
          </div>

          {/* Expiry Options */}
          <div className="space-y-2">
            <Label>Expiración</Label>
            <Select value={expiryOption} onValueChange={(value: typeof expiryOption) => setExpiryOption(value)}>
              <SelectTrigger data-cy={createCyId('api-keys', 'dialog-expiration')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent data-cy={createCyId('api-keys', 'dialog-expiration-options')}>
                <SelectItem value="never" data-cy={createCyId('api-keys', 'dialog-expiration-never')}>Nunca expira</SelectItem>
                <SelectItem value="30d" data-cy={createCyId('api-keys', 'dialog-expiration-30d')}>30 días</SelectItem>
                <SelectItem value="90d" data-cy={createCyId('api-keys', 'dialog-expiration-90d')}>90 días</SelectItem>
                <SelectItem value="1y" data-cy={createCyId('api-keys', 'dialog-expiration-1y')}>1 año</SelectItem>
                <SelectItem value="custom" data-cy={createCyId('api-keys', 'dialog-expiration-custom')}>Fecha personalizada</SelectItem>
              </SelectContent>
            </Select>

            {expiryOption === 'custom' && (
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                data-cy={createCyId('api-keys', 'dialog-expiration-date')}
              />
            )}
          </div>

          {/* Scopes Selection */}
          <div className="space-y-4" data-cy={createCyId('api-keys', 'dialog-scopes')}>
            <div>
              <Label>Permisos (Scopes)</Label>
              <p className="text-xs text-muted-foreground">
                Selecciona los permisos que tendrá esta API key
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Solo puedes asignar permisos que tu rol actual permite. Los permisos no se pueden cambiar después de crear la API key.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {Object.entries(SCOPE_CATEGORIES).map(([categoryKey, category]) => {
                const isFullySelected = isCategoryFullySelected(category.scopes);
                const isPartiallySelected = isCategoryPartiallySelected(category.scopes);

                return (
                  <div key={categoryKey} className="space-y-3" data-cy={createCyId('api-keys', `dialog-category-${categoryKey}`)}>
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
                        data-cy={createCyId('api-keys', `dialog-category-checkbox-${categoryKey}`)}
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
                            data-cy={createCyId('api-keys', `dialog-permission-${scope}`)}
                          />
                          <Label htmlFor={scope} className="text-sm">
                            <code className="text-xs bg-muted px-1 py-0.5 rounded mr-2">
                              {scope}
                            </code>
                            {API_SCOPES[scope as keyof typeof API_SCOPES]}
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
              <div className="space-y-2" data-cy={createCyId('api-keys', 'dialog-selected-scopes')}>
                <Label>Permisos seleccionados ({selectedScopes.length})</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedScopes.map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-xs" data-cy={createCyId('api-keys', `dialog-selected-${scope}`)}>
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Security Warning */}
          <Alert variant="destructive" data-cy={createCyId('api-keys', 'dialog-warning')}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> La API key se mostrará solo una vez después de crearla.
              Guárdala en un lugar seguro ya que no podrás verla nuevamente.
            </AlertDescription>
          </Alert>
        </form>

        <DialogFooter data-cy={createCyId('api-keys', 'dialog-footer')}>
          <Button variant="outline" onClick={handleClose} disabled={createApiKey.isPending} data-cy={createCyId('api-keys', 'dialog-cancel')}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createApiKey.isPending || selectedScopes.length === 0 || !name.trim()}
            data-cy={createCyId('api-keys', 'dialog-submit')}
          >
            {createApiKey.isPending ? 'Creando...' : 'Crear API Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
