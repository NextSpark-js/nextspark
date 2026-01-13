"use client";

import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Alert, AlertDescription } from '../../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Copy, Eye, EyeOff, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { sel } from '../../../lib/test';

interface ApiKeyDisplayProps {
  apiKey: string;
  keyName?: string;
  warning?: string;
  onClose: () => void;
}

export function ApiKeyDisplay({ apiKey, keyName, warning, onClose }: ApiKeyDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success('API key copied to clipboard');
      
      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const maskedKey = apiKey.substring(0, 16) + '••••••••••••••••••••••••••••••••••••••••••••••••••••';

  return (
    <Card className="border-green-200 bg-green-50" data-cy={sel('settings.apiKeys.newKeyDisplay.container')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <CardTitle className="text-green-800">
              API Key creada exitosamente
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {keyName && (
          <CardDescription className="text-green-700">
            {keyName}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Warning Alert */}
        {warning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>¡Importante!</strong> {warning}
            </AlertDescription>
          </Alert>
        )}

        {/* API Key Display */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-green-800">
            Tu nueva API Key:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={isVisible ? 'text' : 'password'}
                value={isVisible ? apiKey : maskedKey}
                readOnly
                className="font-mono text-sm pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setIsVisible(!isVisible)}
              >
                {isVisible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              onClick={copyToClipboard}
              variant={copied ? "default" : "outline"}
              className="shrink-0"
              data-cy={sel('settings.apiKeys.newKeyDisplay.copyButton')}
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-green-800">
            Cómo usar tu API Key:
          </h4>
          
          <div className="space-y-2 text-sm">
            <div>
              <strong>1. Incluye la API key en el header Authorization:</strong>
              <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-xs overflow-x-auto">
                Authorization: Bearer {isVisible ? apiKey : 'sk_live_••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </div>
            </div>
            
            <div>
              <strong>2. Ejemplo con curl:</strong>
              <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-xs overflow-x-auto">
                {`curl -H "Authorization: Bearer ${isVisible ? apiKey : 'YOUR_API_KEY'}" \\
     https://yourapp.com/api/v1/users`}
              </div>
            </div>
            
            <div>
              <strong>3. Ejemplo con JavaScript:</strong>
              <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-xs overflow-x-auto">
                {`fetch('/api/v1/users', {
  headers: {
    'Authorization': 'Bearer ${isVisible ? apiKey : 'YOUR_API_KEY'}',
    'Content-Type': 'application/json'
  }
})`}
              </div>
            </div>
          </div>
        </div>

        {/* Security Tips */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-green-800">
            Consejos de seguridad:
          </h4>
          <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
            <li>Nunca compartas tu API key públicamente</li>
            <li>Guárdala como variable de entorno en tu aplicación</li>
            <li>Revoca la key inmediatamente si crees que está comprometida</li>
            <li>Usa HTTPS siempre al hacer requests a la API</li>
          </ul>
        </div>

        {/* Rate Limits Info */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-1">
            Límites de la API:
          </h4>
          <div className="text-sm text-blue-700 space-y-1">
            <div>• 1,000 requests por minuto</div>
            <div>• Headers de rate limiting incluidos en respuestas</div>
            <div>• Documentación completa disponible en /docs</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={copyToClipboard}
            variant={copied ? "default" : "outline"}
            className="flex-1"
          >
            <Copy className="h-4 w-4 mr-2" />
            {copied ? 'API Key Copiada!' : 'Copiar API Key'}
          </Button>
          <Button onClick={onClose} variant="outline">
            Entendido
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
