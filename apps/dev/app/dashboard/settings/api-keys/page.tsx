"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@nextsparkjs/core/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card';
import { Badge } from '@nextsparkjs/core/components/ui/badge';
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert';
import { Skeleton } from '@nextsparkjs/core/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@nextsparkjs/core/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@nextsparkjs/core/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  Key,
  MoreVertical,
  Plus,
  Trash2,
  Activity
} from 'lucide-react';
import { CreateApiKeyDialog } from '@nextsparkjs/core/components/api/keys/CreateApiKeyDialog';
import { ApiKeyDisplay } from '@nextsparkjs/core/components/api/keys/ApiKeyDisplay';
import { toast } from 'sonner';
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { sel } from '@nextsparkjs/core/selectors'

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  status: 'active' | 'inactive' | 'expired';
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  usage_stats: {
    total_requests: number;
    last_24h: number;
    avg_response_time: number | null;
  };
}

interface NewApiKeyResponse {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  warning: string;
}

function ApiKeysPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newApiKey, setNewApiKey] = useState<NewApiKeyResponse | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch API keys
  const { data: apiKeys, isLoading, error } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await fetch('/api/v1/api-keys');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch API keys');
      }
      const result = await response.json();
      return result.data;
    }
  });

  // Revoke API key mutation
  const revokeApiKey = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke API key');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`API key "${data.data.name}" has been revoked`);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error) => {
      toast.error(`Failed to revoke API key: ${error.message}`);
    }
  });

  // Toggle API key status
  const toggleApiKey = useMutation({
    mutationFn: async ({ keyId, status }: { keyId: string; status: 'active' | 'inactive' }) => {
      const response = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update API key');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const statusText = data.data.status === 'active' ? 'activated' : 'deactivated';
      toast.success(`API key "${data.data.name}" has been ${statusText}`);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error) => {
      toast.error(`Failed to update API key: ${error.message}`);
    }
  });

  const handleCreateSuccess = (apiKeyData: NewApiKeyResponse) => {
    setNewApiKey(apiKeyData);
    setShowCreateDialog(false);
    queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScopeColor = (scope: string) => {
    if (scope === '*') return 'destructive';
    if (scope.includes('admin')) return 'secondary';
    if (scope.includes('write') || scope.includes('delete')) return 'default';
    return 'outline';
  };

  if (error) {
    const isPermissionError = error.message.includes('Insufficient permissions');

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Gestiona las API keys para integración externa
          </p>
        </div>
        <Alert variant={isPermissionError ? "default" : "destructive"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isPermissionError ? (
              <div>
                <strong>Acceso restringido</strong>
                <p className="mt-1">
                  Solo los administradores pueden gestionar API keys.
                  Contacta a un administrador si necesitas acceso a esta funcionalidad.
                </p>
              </div>
            ) : (
              `Error loading API keys: ${error.message}`
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-cy={sel('settings.apiKeys.container')}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" data-cy={sel('settings.apiKeys.header')}>API Keys</h1>
          <p className="text-muted-foreground">
            Gestiona las API keys para integración externa
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-cy={sel('settings.apiKeys.createButton')}>
          <Plus className="h-4 w-4 mr-2" />
          Crear API Key
        </Button>
      </div>

      {/* New API Key Display */}
      {newApiKey && (
        <ApiKeyDisplay
          apiKey={newApiKey.key}
          keyName={newApiKey.name}
          warning={newApiKey.warning}
          onClose={() => setNewApiKey(null)}
        />
      )}

      {/* API Keys List */}
      <div className="grid gap-4" data-cy={sel('settings.apiKeys.list.container')}>
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} data-cy={sel('settings.apiKeys.list.skeleton')}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : apiKeys?.length === 0 ? (
          <Card data-cy={sel('settings.apiKeys.list.empty')}>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
              <p className="text-muted-foreground text-center mb-4">
                No tienes API keys creadas. Crea una para empezar a usar la API externa.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} data-cy={sel('settings.apiKeys.createButton')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera API Key
              </Button>
            </CardContent>
          </Card>
        ) : (
          apiKeys?.map((apiKey) => (
            <Card key={apiKey.id} data-cy={sel('settings.apiKeys.row.container', { id: apiKey.id })}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2" data-cy={sel('settings.apiKeys.row.name', { id: apiKey.id })}>
                      {apiKey.name}
                      {apiKey.status !== 'active' && (
                        <Badge variant="secondary" data-cy={sel('settings.apiKeys.row.status', { id: apiKey.id })}>
                          {apiKey.status === 'inactive' ? 'Inactiva' : 'Expirada'}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs" data-cy={sel('settings.apiKeys.row.prefix', { id: apiKey.id })}>
                      {apiKey.keyPrefix}••••••••••••••••••••••••••••••••••••••••••••••••••••
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 w-6 p-0"
                        onClick={() => copyToClipboard(apiKey.keyPrefix)}
                        data-cy={sel('settings.apiKeys.row.copyPrefix', { id: apiKey.id })}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={apiKey.status === 'active' ? "default" : "secondary"} data-cy={sel('settings.apiKeys.row.status', { id: apiKey.id })}>
                      {apiKey.status === 'active' ? 'Activa' : apiKey.status === 'inactive' ? 'Inactiva' : 'Expirada'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" data-cy={sel('settings.apiKeys.row.menu.trigger', { id: apiKey.id })}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" data-cy={sel('settings.apiKeys.row.menu.content', { id: apiKey.id })}>
                        <DropdownMenuItem
                          onClick={() => setSelectedKey(apiKey.id)}
                          data-cy={sel('settings.apiKeys.row.menu.viewDetails', { id: apiKey.id })}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleApiKey.mutate({
                            keyId: apiKey.id,
                            status: apiKey.status === 'active' ? 'inactive' : 'active'
                          })}
                          disabled={toggleApiKey.isPending}
                          data-cy={sel('settings.apiKeys.row.menu.toggle', { id: apiKey.id })}
                        >
                          {apiKey.status === 'active' ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Desactivar
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Activar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => revokeApiKey.mutate(apiKey.id)}
                          disabled={revokeApiKey.isPending}
                          className="text-destructive"
                          data-cy={sel('settings.apiKeys.row.menu.revoke', { id: apiKey.id })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Revocar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Scopes */}
                  <div data-cy={sel('settings.apiKeys.row.scopes', { id: apiKey.id })}>
                    <strong className="text-sm">Permisos:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {apiKey.scopes.map((scope) => (
                        <Badge
                          key={scope}
                          variant={getScopeColor(scope)}
                          className="text-xs"
                          data-cy={sel('settings.apiKeys.row.scope', { id: apiKey.id, scope })}
                        >
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Usage Stats */}
                  <div className="grid grid-cols-3 gap-4 text-sm" data-cy={sel('settings.apiKeys.row.stats.container', { id: apiKey.id })}>
                    <div data-cy={sel('settings.apiKeys.row.stats.totalRequests', { id: apiKey.id })}>
                      <div className="text-muted-foreground">Total requests</div>
                      <div className="font-semibold">{apiKey.usage_stats.total_requests.toLocaleString()}</div>
                    </div>
                    <div data-cy={sel('settings.apiKeys.row.stats.last24h', { id: apiKey.id })}>
                      <div className="text-muted-foreground">Últimas 24h</div>
                      <div className="font-semibold">{apiKey.usage_stats.last_24h.toLocaleString()}</div>
                    </div>
                    <div data-cy={sel('settings.apiKeys.row.stats.avgTime', { id: apiKey.id })}>
                      <div className="text-muted-foreground">Tiempo promedio</div>
                      <div className="font-semibold">
                        {apiKey.usage_stats.avg_response_time
                          ? `${Math.round(apiKey.usage_stats.avg_response_time)}ms`
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="text-sm text-muted-foreground space-y-1" data-cy={sel('settings.apiKeys.row.metadata.container', { id: apiKey.id })}>
                    <div data-cy={sel('settings.apiKeys.row.metadata.createdAt', { id: apiKey.id })}>Creada: {formatDate(apiKey.createdAt)}</div>
                    {apiKey.lastUsedAt && (
                      <div data-cy={sel('settings.apiKeys.row.metadata.lastUsed', { id: apiKey.id })}>Ultimo uso: {formatDate(apiKey.lastUsedAt)}</div>
                    )}
                    {apiKey.expiresAt && (
                      <div data-cy={sel('settings.apiKeys.row.metadata.expiresAt', { id: apiKey.id })}>Expira: {formatDate(apiKey.expiresAt)}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create API Key Dialog */}
      <CreateApiKeyDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* API Key Details Dialog */}
      {selectedKey && (
        <ApiKeyDetailsDialog
          keyId={selectedKey}
          open={!!selectedKey}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}

// Componente para mostrar detalles de API key
function ApiKeyDetailsDialog({
  keyId,
  open,
  onClose
}: {
  keyId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: keyDetails, isLoading } = useQuery({
    queryKey: ['api-key-details', keyId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/api-keys/${keyId}`);
      if (!response.ok) throw new Error('Failed to fetch API key details');
      const result = await response.json();
      return result.data;
    },
    enabled: open
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-cy={sel('settings.apiKeys.detailsDialog.container')}>
        <DialogHeader>
          <DialogTitle data-cy={sel('settings.apiKeys.detailsDialog.title')}>Detalles de API Key</DialogTitle>
          <DialogDescription>
            Estadísticas de uso y configuración
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4" data-cy={sel('settings.apiKeys.detailsDialog.loading')}>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : keyDetails ? (
          <div className="space-y-6" data-cy={sel('settings.apiKeys.detailsDialog.content')}>
            {/* Basic Info */}
            <div data-cy={sel('settings.apiKeys.detailsDialog.basicInfo.container')}>
              <h4 className="font-semibold mb-2">Información básica</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nombre:</span>
                  <div className="font-medium" data-cy={sel('settings.apiKeys.detailsDialog.basicInfo.name')}>{keyDetails.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <div>
                    <Badge variant={keyDetails.status === 'active' ? "default" : "secondary"} data-cy={sel('settings.apiKeys.detailsDialog.basicInfo.status')}>
                      {keyDetails.status === 'active' ? 'Activa' : keyDetails.status === 'inactive' ? 'Inactiva' : 'Expirada'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Statistics */}
            <div data-cy={sel('settings.apiKeys.detailsDialog.stats.container')}>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Estadísticas de uso
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total de requests:</span>
                  <div className="font-medium" data-cy={sel('settings.apiKeys.detailsDialog.stats.totalRequests')}>{keyDetails.usage_stats.total_requests.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Ultimas 24 horas:</span>
                  <div className="font-medium" data-cy={sel('settings.apiKeys.detailsDialog.stats.last24h')}>{keyDetails.usage_stats.last_24h.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Ultimos 7 dias:</span>
                  <div className="font-medium" data-cy={sel('settings.apiKeys.detailsDialog.stats.last7d')}>{keyDetails.usage_stats.last_7d.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Ultimos 30 dias:</span>
                  <div className="font-medium" data-cy={sel('settings.apiKeys.detailsDialog.stats.last30d')}>{keyDetails.usage_stats.last_30d.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tiempo promedio:</span>
                  <div className="font-medium" data-cy={sel('settings.apiKeys.detailsDialog.stats.avgTime')}>
                    {keyDetails.usage_stats.avg_response_time
                      ? `${Math.round(keyDetails.usage_stats.avg_response_time)}ms`
                      : 'N/A'
                    }
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tasa de exito:</span>
                  <div className="font-medium" data-cy={sel('settings.apiKeys.detailsDialog.stats.successRate')}>
                    {keyDetails.usage_stats.success_rate
                      ? `${Math.round(keyDetails.usage_stats.success_rate)}%`
                      : 'N/A'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default getTemplateOrDefaultClient('app/dashboard/settings/api-keys/page.tsx', ApiKeysPage)
