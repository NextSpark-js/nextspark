"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('settings.apiKeys.display');
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success(t('copiedToast'));
      
      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const shownKey = isVisible ? apiKey : 'YOUR_API_KEY';
  const curlExample = `curl -H "Authorization: Bearer ${shownKey}" \\
     https://yourapp.com/api/v1/users`;
  const fetchExample = `fetch('/api/v1/users', {
  headers: {
    'Authorization': 'Bearer ${shownKey}',
    'Content-Type': 'application/json'
  }
})`;
  const maskedKey = apiKey.substring(0, 16) + '••••••••••••••••••••••••••••••••••••••••••••••••••••';

  return (
    <Card className="border-green-200 bg-green-50" data-cy={sel('settings.apiKeys.newKeyDisplay.container')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <CardTitle className="text-green-800">
              {t('created')}
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
              <strong>{t('important')}</strong> {warning}
            </AlertDescription>
          </Alert>
        )}

        {/* API Key Display */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-green-800">
            {t('yourKey')}
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
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-green-800">
            {t('howToUse')}
          </h4>

          <div className="space-y-2 text-sm">
            <div>
              <strong>{t('stepHeader')}</strong>
              <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-xs overflow-x-auto">
                Authorization: Bearer {isVisible ? apiKey : 'sk_live_••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </div>
            </div>

            <div>
              <strong>{t('stepCurl')}</strong>
              <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-xs overflow-x-auto">
                {curlExample}
              </div>
            </div>

            <div>
              <strong>{t('stepJavaScript')}</strong>
              <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-xs overflow-x-auto">
                {fetchExample}
              </div>
            </div>
          </div>
        </div>

        {/* Security Tips */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-green-800">
            {t('securityTips')}
          </h4>
          <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
            <li>{t('tipShare')}</li>
            <li>{t('tipStore')}</li>
            <li>{t('tipRevoke')}</li>
            <li>{t('tipHttps')}</li>
          </ul>
        </div>

        {/* Rate Limits Info */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-1">
            {t('limits')}
          </h4>
          <div className="text-sm text-blue-700 space-y-1">
            <div>• {t('limitRate')}</div>
            <div>• {t('limitHeaders')}</div>
            <div>• {t('limitDocs')}</div>
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
            {copied ? t('keyCopied') : t('copyKey')}
          </Button>
          <Button onClick={onClose} variant="outline">
            {t('gotIt')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
