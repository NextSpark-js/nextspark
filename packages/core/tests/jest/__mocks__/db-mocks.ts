// Mock functions para database operations

export function createMockQueryWithRLS<T>(returnData: T[]) {
  return jest.fn().mockResolvedValue(returnData);
}

export function createMockMutateWithRLS() {
  return jest.fn().mockResolvedValue(undefined);
}

// Mock de la configuración de entidades
export const mockEntityConfigs = {
  user: {
    metaTableName: 'user_metas',
    idColumn: 'userId',
    apiPath: 'users'
  },
  task: {
    metaTableName: 'task_metas',
    idColumn: 'taskId',
    apiPath: 'tasks'
  }
};

// Mock de user data para tests
export const mockUserData = {
  id: 'test-user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'member'
};

// Mock de metadata para tests - ESTRUCTURA REAL del sistema
export const mockUserMetadata = {
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
};

// Mock de schemas para tests
export const mockMetaSchemas = [
  {
    entityType: 'user',
    metaKey: 'uiPreferences',
    displayName: 'UI Preferences',
    dataType: 'json',
    defaultValue: '{"theme": "light", "sidebarCollapsed": false}',
    isRequired: false,
    validationRules: null
  },
  {
    entityType: 'user',
    metaKey: 'securityPreferences',
    displayName: 'Security Preferences',
    dataType: 'json',
    defaultValue: '{"twoFactorEnabled": false, "loginAlertsEnabled": true}',
    isRequired: false,
    validationRules: null
  },
  {
    entityType: 'user',
    metaKey: 'notificationsPreferences',
    displayName: 'Notification Preferences',
    dataType: 'json',
    defaultValue: '{"pushEnabled": true, "loginAlertsEmail": true}',
    isRequired: false,
    validationRules: null
  }
];
