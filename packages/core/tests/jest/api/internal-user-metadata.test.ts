/**
 * Tests for Internal User Metadata API
 * Tests the /api/internal/user-metadata endpoint used for creating default metadata
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/internal/user-metadata/route';
import { MetaService } from '@/core/lib/services/meta.service';

// Mock MetaService
jest.mock('@/core/lib/services/meta.service');

// MockNextRequest will be handled by the next/server mock

const mockMetaService = MetaService as jest.Mocked<typeof MetaService>;

describe('Internal User Metadata API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create default metadata for user successfully', async () => {
    mockMetaService.setEntityMeta.mockResolvedValue(undefined);

    const requestBody = {
      userId: 'test-user-123',
      metadata: {
        uiPreferences: {
          theme: 'light',
          sidebarCollapsed: false
        },
        securityPreferences: {
          twoFactorEnabled: false,
          loginAlertsEnabled: true
        },
        notificationsPreferences: {
          pushEnabled: true,
          loginAlertsEmail: true,
          loginAlertsPush: true,
          passwordChangesEmail: true,
          passwordChangesPush: true,
          suspiciousActivityEmail: true,
          suspiciousActivityPush: true,
          mentionsEmail: true,
          mentionsPush: true,
          projectUpdatesEmail: true,
          projectUpdatesPush: false,
          teamInvitesEmail: true,
          teamInvitesPush: true,
          newsletterEmail: false,
          newsletterPush: false,
          promotionsEmail: false,
          promotionsPush: false,
          featureAnnouncementsEmail: true,
          featureAnnouncementsPush: false
        }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe('Default metadata created successfully');

    // Verify that setEntityMeta was called for each metadata group
    expect(mockMetaService.setEntityMeta).toHaveBeenCalledTimes(3);

      expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
        'user',
        'test-user-123',
        'uiPreferences',
        {
          theme: 'light',
          sidebarCollapsed: false
        },
        'test-user-123' // userId is used as the RLS context
      );

    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user',
      'test-user-123',
      'securityPreferences',
      {
        twoFactorEnabled: false,
        loginAlertsEnabled: true
      },
      'test-user-123'
    );

    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user',
      'test-user-123',
      'notificationsPreferences',
      expect.objectContaining({
        pushEnabled: true,
        loginAlertsEmail: true,
        featureAnnouncementsEmail: true,
        promotionsEmail: false
      }),
      'test-user-123'
    );
  });

  test('should handle missing userId in request body', async () => {
    const requestBody = {
      // Missing userId
      metadata: {
        uiPreferences: { theme: 'light' }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe('User ID is required');

    expect(mockMetaService.setEntityMeta).not.toHaveBeenCalled();
  });

  test('should handle missing metadata in request body', async () => {
    const requestBody = {
      userId: 'test-user-123'
      // Missing metadata
    };

    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe('Metadata is required');

    expect(mockMetaService.setEntityMeta).not.toHaveBeenCalled();
  });

  test('should handle empty metadata object', async () => {
    mockMetaService.setEntityMeta.mockResolvedValue(undefined);

    const requestBody = {
      userId: 'test-user-123',
      metadata: {} // Empty metadata
    };

    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe('Default metadata created successfully');

    // Should not call setEntityMeta for empty metadata
    expect(mockMetaService.setEntityMeta).not.toHaveBeenCalled();
  });

  test('should handle partial metadata groups', async () => {
    mockMetaService.setEntityMeta.mockResolvedValue(undefined);

    const requestBody = {
      userId: 'test-user-123',
      metadata: {
        uiPreferences: {
          theme: 'dark'
        },
        // Only UI preferences, no security or notifications
      }
    };

    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);

    // Should only call setEntityMeta once for uiPreferences
    expect(mockMetaService.setEntityMeta).toHaveBeenCalledTimes(1);
    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user',
      'test-user-123',
      'uiPreferences',
      { theme: 'dark' },
      'test-user-123'
    );
  });

  test('should handle MetaService errors', async () => {
    mockMetaService.setEntityMeta.mockRejectedValueOnce(new Error('Database error'));

    const requestBody = {
      userId: 'test-user-123',
      metadata: {
        uiPreferences: { theme: 'light' }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe('Internal server error');

    expect(mockMetaService.setEntityMeta).toHaveBeenCalledTimes(1);
  });

  test('should handle malformed JSON in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid-json-{'
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe('Internal server error');

    expect(mockMetaService.setEntityMeta).not.toHaveBeenCalled();
  });

  test('should handle different userId formats', async () => {
    mockMetaService.setEntityMeta.mockResolvedValue(undefined);

    // Test with UUID format
    const uuidUserId = '550e8400-e29b-41d4-a716-446655440000';
    
    const requestBody = {
      userId: uuidUserId,
      metadata: {
        uiPreferences: { theme: 'light' }
      }
    };

    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);

    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user',
      uuidUserId,
      'uiPreferences',
      { theme: 'light' },
      uuidUserId
    );
  });

  test('should handle complex nested metadata structures', async () => {
    mockMetaService.setEntityMeta.mockResolvedValue(undefined);

    const realMetadataStructure = {
      uiPreferences: {
        theme: 'dark',
        sidebarCollapsed: true
      },
      securityPreferences: {
        twoFactorEnabled: true,
        loginAlertsEnabled: false
      },
      notificationsPreferences: {
        pushEnabled: true,
        loginAlertsEmail: true,
        loginAlertsPush: true,
        passwordChangesEmail: true,
        passwordChangesPush: true,
        suspiciousActivityEmail: true,
        suspiciousActivityPush: true,
        mentionsEmail: true,
        mentionsPush: true,
        projectUpdatesEmail: true,
        projectUpdatesPush: false,
        teamInvitesEmail: true,
        teamInvitesPush: true,
        newsletterEmail: false,
        newsletterPush: false,
        promotionsEmail: false,
        promotionsPush: false,
        featureAnnouncementsEmail: true,
        featureAnnouncementsPush: false
      }
    };

    const requestBody = {
      userId: 'test-user-123',
      metadata: realMetadataStructure
    };

    const request = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.success).toBe(true);

    expect(mockMetaService.setEntityMeta).toHaveBeenCalledTimes(3);

    // Verify real nested structures are preserved
    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user',
      'test-user-123',
      'uiPreferences',
      expect.objectContaining({
        theme: 'dark',
        sidebarCollapsed: true
      }),
      'test-user-123'
    );

    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user',
      'test-user-123',
      'securityPreferences',
      expect.objectContaining({
        twoFactorEnabled: true,
        loginAlertsEnabled: false
      }),
      'test-user-123'
    );

    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user',
      'test-user-123',
      'notificationsPreferences',
      expect.objectContaining({
        pushEnabled: true,
        loginAlertsEmail: true,
        passwordChangesEmail: true,
        suspiciousActivityEmail: true,
        mentionsEmail: true,
        projectUpdatesEmail: true,
        teamInvitesEmail: true,
        newsletterEmail: false,
        promotionsEmail: false,
        featureAnnouncementsEmail: true
      }),
      'test-user-123'
    );
  });

  test('should handle concurrent metadata creation requests', async () => {
    mockMetaService.setEntityMeta.mockResolvedValue(undefined);

    const user1RequestBody = {
      userId: 'user-1',
      metadata: { uiPreferences: { theme: 'light' } }
    };

    const user2RequestBody = {
      userId: 'user-2',
      metadata: { uiPreferences: { theme: 'dark' } }
    };

    const request1 = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user1RequestBody)
    });

    const request2 = new NextRequest('http://localhost:3000/api/internal/user-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user2RequestBody)
    });

    // Execute both requests concurrently
    const [response1, response2] = await Promise.all([
      POST(request1),
      POST(request2)
    ]);

    const responseData1 = await response1.json();
    const responseData2 = await response2.json();

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(responseData1.success).toBe(true);
    expect(responseData2.success).toBe(true);

    expect(mockMetaService.setEntityMeta).toHaveBeenCalledTimes(2);

    // Verify each user got their correct metadata
    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user', 'user-1', 'uiPreferences', { theme: 'light' }, 'user-1'
    );
    expect(mockMetaService.setEntityMeta).toHaveBeenCalledWith(
      'user', 'user-2', 'uiPreferences', { theme: 'dark' }, 'user-2'
    );
  });
});
