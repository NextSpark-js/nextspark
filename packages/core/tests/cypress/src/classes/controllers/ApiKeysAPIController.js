/**
 * ApiKeysAPIController - Controlador para interactuar con la API de API Keys
 * Encapsula todas las operaciones CRUD para los endpoints /api/v1/api-keys
 */
class ApiKeysAPIController {
  constructor(baseUrl = 'http://localhost:5173', apiKey = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.endpoints = {
      apiKeys: '/api/v1/api-keys',
      apiKeyById: (id) => `/api/v1/api-keys/${id}`
    };
  }

  /**
   * Configura la API key para las peticiones
   * @param {string} apiKey - API key válida
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    return this;
  }

  /**
   * Obtiene los headers por defecto para las peticiones
   * @param {Object} additionalHeaders - Headers adicionales
   * @returns {Object} Headers completos
   */
  getHeaders(additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders
    };

    // Agregar API key si está configurada
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * GET /api/v1/api-keys - Obtener lista de API keys
   * @param {Object} options - Opciones de consulta
   * @param {number} options.page - Número de página
   * @param {number} options.limit - Límite de resultados por página
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  getApiKeys(options = {}) {
    const { page, limit, headers: additionalHeaders, ...otherParams } = options;
    
    // Construir query parameters
    const queryParams = new URLSearchParams();
    if (page !== undefined) queryParams.append('page', page);
    if (limit !== undefined) queryParams.append('limit', limit);
    
    // Agregar otros parámetros
    Object.keys(otherParams).forEach(key => {
      if (otherParams[key] !== undefined) {
        queryParams.append(key, otherParams[key]);
      }
    });

    const url = `${this.baseUrl}${this.endpoints.apiKeys}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    return cy.request({
      method: 'GET',
      url: url,
      headers: this.getHeaders(additionalHeaders),
      failOnStatusCode: false
    });
  }

  /**
   * GET /api/v1/api-keys/{id} - Obtener API key específica por ID
   * @param {string} id - ID de la API key
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  getApiKeyById(id, options = {}) {
    const { headers: additionalHeaders } = options;
    
    return cy.request({
      method: 'GET',
      url: `${this.baseUrl}${this.endpoints.apiKeyById(id)}`,
      headers: this.getHeaders(additionalHeaders),
      failOnStatusCode: false
    });
  }

  /**
   * POST /api/v1/api-keys - Crear nueva API key
   * @param {Object} apiKeyData - Datos de la API key
   * @param {string} apiKeyData.name - Nombre de la API key
   * @param {string[]} apiKeyData.scopes - Scopes de la API key
   * @param {string} apiKeyData.expiresAt - Fecha de expiración (opcional)
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  createApiKey(apiKeyData, options = {}) {
    const { headers: additionalHeaders } = options;
    
    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}${this.endpoints.apiKeys}`,
      headers: this.getHeaders(additionalHeaders),
      body: apiKeyData,
      failOnStatusCode: false
    });
  }

  /**
   * PATCH /api/v1/api-keys/{id} - Actualizar API key
   * @param {string} id - ID de la API key
   * @param {Object} updateData - Datos a actualizar
   * @param {string} updateData.name - Nuevo nombre (opcional)
   * @param {string} updateData.status - Nuevo status (opcional): active, inactive, expired
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  updateApiKey(id, updateData, options = {}) {
    const { headers: additionalHeaders } = options;
    
    return cy.request({
      method: 'PATCH',
      url: `${this.baseUrl}${this.endpoints.apiKeyById(id)}`,
      headers: this.getHeaders(additionalHeaders),
      body: updateData,
      failOnStatusCode: false
    });
  }

  /**
   * DELETE /api/v1/api-keys/{id} - Revocar API key
   * @param {string} id - ID de la API key
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  deleteApiKey(id, options = {}) {
    const { headers: additionalHeaders } = options;
    
    return cy.request({
      method: 'DELETE',
      url: `${this.baseUrl}${this.endpoints.apiKeyById(id)}`,
      headers: this.getHeaders(additionalHeaders),
      failOnStatusCode: false
    });
  }

  /**
   * OPTIONS /api/v1/api-keys - CORS preflight para lista de API keys
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  optionsApiKeys(options = {}) {
    const { headers: additionalHeaders } = options;
    
    return cy.request({
      method: 'OPTIONS',
      url: `${this.baseUrl}${this.endpoints.apiKeys}`,
      headers: this.getHeaders(additionalHeaders),
      failOnStatusCode: false
    });
  }

  /**
   * OPTIONS /api/v1/api-keys/{id} - CORS preflight para API key específica
   * @param {string} id - ID de la API key
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  optionsApiKeyById(id, options = {}) {
    const { headers: additionalHeaders } = options;
    
    return cy.request({
      method: 'OPTIONS',
      url: `${this.baseUrl}${this.endpoints.apiKeyById(id)}`,
      headers: this.getHeaders(additionalHeaders),
      failOnStatusCode: false
    });
  }

  // ============================================
  // MÉTODOS DE UTILIDAD Y VALIDACIÓN
  // ============================================

  /**
   * Genera datos aleatorios para crear una API key de prueba
   * @param {Object} overrides - Datos específicos para sobrescribir
   * @returns {Object} Datos de API key generados
   */
  generateRandomApiKeyData(overrides = {}) {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    
    const defaultData = {
      name: `Cypress Test API Key ${timestamp}_${randomSuffix}`,
      scopes: ['users:read', 'tasks:read'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días
    };

    return { ...defaultData, ...overrides };
  }

  /**
   * Crea una API key de prueba y la devuelve
   * @param {Object} overrides - Datos específicos para la API key
   * @returns {Cypress.Chainable} Promesa que resuelve con los datos de la API key creada
   */
  createTestApiKey(overrides = {}) {
    const apiKeyData = this.generateRandomApiKeyData(overrides);
    
    return this.createApiKey(apiKeyData).then((response) => {
      if (response.status === 201 && response.body.success) {
        return response.body.data;
      } else {
        throw new Error(`Failed to create test API key: ${JSON.stringify(response.body)}`);
      }
    });
  }

  /**
   * Limpia una API key de prueba (la revoca)
   * @param {string} apiKeyId - ID de la API key a limpiar
   * @returns {Cypress.Chainable} Respuesta de la eliminación
   */
  cleanupTestApiKey(apiKeyId) {
    if (!apiKeyId) {
      cy.log('⚠️ No API key ID provided for cleanup');
      return cy.wrap(null);
    }

    cy.log(`🧹 Cleaning up API key: ${apiKeyId}`);
    
    return this.deleteApiKey(apiKeyId).then((response) => {
      if (response.status === 200) {
        cy.log(`✅ API key ${apiKeyId} cleaned up successfully`);
      } else {
        cy.log(`⚠️ Failed to cleanup API key ${apiKeyId}: ${response.status}`);
      }
      return response;
    });
  }

  /**
   * Limpia todas las API keys que contengan "Cypress" en el nombre
   * @returns {Cypress.Chainable} Promesa que resuelve cuando se completa la limpieza
   */
  cleanupAllCypressApiKeys() {
    cy.log('🧹 Starting cleanup of all Cypress API keys...');
    
    return this.getApiKeys().then((response) => {
      if (response.status !== 200 || !response.body.success) {
        cy.log('⚠️ Failed to get API keys for cleanup - Status:', response.status);
        return;
      }

      const cypressKeys = response.body.data.filter(apiKey => 
        apiKey.name && apiKey.name.toLowerCase().includes('cypress')
      );

      cy.log(`🔍 Total API keys found: ${response.body.data.length}`);
      cy.log(`🎯 Cypress API keys found: ${cypressKeys.length}`);

      if (cypressKeys.length === 0) {
        cy.log('✅ No Cypress API keys found to cleanup');
        return;
      }

      cy.log(`🧹 Found ${cypressKeys.length} Cypress API keys to cleanup:`);
      cypressKeys.forEach(key => {
        cy.log(`  - ${key.name} (${key.id})`);
      });

      // Limpiar todas las API keys secuencialmente para evitar problemas de promesas
      let cleanupChain = cy.wrap(null);
      
      cypressKeys.forEach((apiKey, index) => {
        cleanupChain = cleanupChain.then(() => {
          cy.log(`🗑️ [${index + 1}/${cypressKeys.length}] Deleting: ${apiKey.name} (${apiKey.id})`);
          
          return cy.request({
            method: 'DELETE',
            url: `${this.baseUrl}/api/v1/api-keys/${apiKey.id}`,
            headers: this.getHeaders(),
            failOnStatusCode: false
          }).then((deleteResponse) => {
            if (deleteResponse.status === 200) {
              cy.log(`✅ [${index + 1}/${cypressKeys.length}] Successfully deleted: ${apiKey.name}`);
            } else {
              cy.log(`⚠️ [${index + 1}/${cypressKeys.length}] Failed to delete: ${apiKey.name} - Status: ${deleteResponse.status}`);
            }
            return deleteResponse;
          });
        });
      });

      return cleanupChain.then(() => {
        cy.log(`✅ Cypress API keys cleanup completed - Processed ${cypressKeys.length} keys`);
      });
    });
  }

  // ============================================
  // MÉTODOS DE VALIDACIÓN DE RESPUESTAS
  // ============================================

  /**
   * Valida que una respuesta sea exitosa
   * @param {Object} response - Respuesta de la API
   * @param {number} expectedStatus - Código de estado esperado
   */
  validateSuccessResponse(response, expectedStatus = 200) {
    expect(response.status).to.eq(expectedStatus);
    expect(response.body).to.have.property('success', true);
    expect(response.body).to.have.property('data');
    expect(response.body).to.have.property('meta');
    expect(response.body.meta).to.have.property('timestamp');
  }

  /**
   * Valida que una respuesta sea de error
   * @param {Object} response - Respuesta de la API
   * @param {number} expectedStatus - Código de estado esperado
   * @param {string} expectedCode - Código de error esperado (opcional)
   */
  validateErrorResponse(response, expectedStatus, expectedCode = null) {
    expect(response.status).to.eq(expectedStatus);
    expect(response.body).to.have.property('success', false);
    expect(response.body).to.have.property('error');
    
    if (expectedCode) {
      expect(response.body).to.have.property('code', expectedCode);
    }
    
    // Meta es opcional en respuestas de error
    if (response.body.meta) {
      expect(response.body.meta).to.have.property('timestamp');
    }
  }

  /**
   * Valida la estructura de un objeto API key
   * @param {Object} apiKey - Objeto API key a validar
   * @param {boolean} isCreation - Si es una validación de creación (updatedAt puede no existir)
   */
  validateApiKeyObject(apiKey, isCreation = false) {
    expect(apiKey).to.be.an('object');
    expect(apiKey).to.have.property('id');
    expect(apiKey).to.have.property('name');
    expect(apiKey).to.have.property('keyPrefix');
    expect(apiKey).to.have.property('scopes');
    expect(apiKey).to.have.property('status');
    expect(apiKey).to.have.property('createdAt');
    
    // updatedAt puede no estar presente en respuestas de creación
    if (!isCreation) {
      expect(apiKey).to.have.property('updatedAt');
      expect(apiKey.updatedAt).to.be.a('string');
    }
    
    // Validar tipos
    expect(apiKey.id).to.be.a('string');
    expect(apiKey.name).to.be.a('string');
    expect(apiKey.keyPrefix).to.be.a('string');
    expect(apiKey.scopes).to.be.an('array');
    expect(apiKey.status).to.be.oneOf(['active', 'inactive', 'expired']);
    expect(apiKey.createdAt).to.be.a('string');
    
    // Validar formato del keyPrefix
    expect(apiKey.keyPrefix).to.match(/^sk_(test|live)_[a-f0-9]{8}$/);
    
    // Propiedades opcionales
    if (apiKey.lastUsedAt !== undefined && apiKey.lastUsedAt !== null) {
      expect(apiKey.lastUsedAt).to.be.a('string');
    }
    
    if (apiKey.expiresAt !== undefined && apiKey.expiresAt !== null) {
      expect(apiKey.expiresAt).to.be.a('string');
    }
  }

  /**
   * Valida la estructura de un objeto API key con estadísticas de uso
   * @param {Object} apiKey - Objeto API key con estadísticas a validar
   */
  validateApiKeyWithUsageStats(apiKey) {
    this.validateApiKeyObject(apiKey);
    
    // Validar estadísticas de uso (la API usa usage_stats, no usageStats)
    expect(apiKey).to.have.property('usage_stats');
    expect(apiKey.usage_stats).to.be.an('object');
    expect(apiKey.usage_stats).to.have.property('total_requests');
    expect(apiKey.usage_stats).to.have.property('last_24h');
    expect(apiKey.usage_stats).to.have.property('avg_response_time');
    
    // Validar tipos de estadísticas (pueden ser strings o números)
    if (apiKey.usage_stats.total_requests !== null) {
      expect(['string', 'number']).to.include(typeof apiKey.usage_stats.total_requests);
    }
    if (apiKey.usage_stats.last_24h !== null) {
      expect(['string', 'number']).to.include(typeof apiKey.usage_stats.last_24h);
    }
    
    // Propiedades opcionales en estadísticas
    if (apiKey.usage_stats.last_7d !== undefined) {
      if (apiKey.usage_stats.last_7d !== null) {
        expect(['string', 'number']).to.include(typeof apiKey.usage_stats.last_7d);
      }
    }
    
    if (apiKey.usage_stats.last_30d !== undefined) {
      if (apiKey.usage_stats.last_30d !== null) {
        expect(['string', 'number']).to.include(typeof apiKey.usage_stats.last_30d);
      }
    }
    
    if (apiKey.usage_stats.success_rate !== undefined) {
      if (apiKey.usage_stats.success_rate !== null) {
        expect(['string', 'number']).to.include(typeof apiKey.usage_stats.success_rate);
      }
    }
  }

  /**
   * Valida la estructura de una respuesta de lista (sin paginación)
   * @param {Object} response - Respuesta de la API
   */
  validateListResponse(response) {
    this.validateSuccessResponse(response, 200);
    expect(response.body.data).to.be.an('array');
    
    // La API de API Keys no implementa paginación actualmente
    // Solo valida que sea una lista válida
  }

  /**
   * Valida los scopes disponibles
   * @param {string[]} scopes - Array de scopes a validar
   */
  validateScopes(scopes) {
    const validScopes = [
      'users:read', 'users:write', 'users:delete',
      'tasks:read', 'tasks:write', 'tasks:delete',
      'admin:users', 'admin:tasks', 'admin:api-keys', 'admin:system'
    ];
    
    expect(scopes).to.be.an('array');
    scopes.forEach(scope => {
      expect(validScopes).to.include(scope, `Invalid scope: ${scope}`);
    });
  }

  /**
   * Valida el formato de fecha ISO
   * @param {string} dateString - Fecha en formato string
   * @returns {boolean} true si es válido, lanza error si no
   */
  validateISODate(dateString) {
    if (typeof dateString !== 'string') {
      throw new Error('Date string must be a string');
    }
    
    if (!dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/)) {
      throw new Error('Date string must match ISO format');
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error('Date string must be a valid date');
    }
    
    return true;
  }
}

// Exportar la clase para uso en Cypress
module.exports = ApiKeysAPIController;
