/**
 * UserAPIController - Controlador para interactuar con la API de usuarios
 * Encapsula todas las operaciones CRUD para los endpoints /api/v1/users
 */
class UserAPIController {
  constructor(baseUrl = 'http://localhost:5173', apiKey = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.endpoints = {
      users: '/api/v1/users',
      userById: (id) => `/api/v1/users/${id}`
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

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * GET /api/v1/users - Obtener lista de usuarios
   * @param {Object} options - Opciones de consulta
   * @param {number} options.page - Número de página
   * @param {number} options.limit - Límite de resultados por página
   * @param {string} options.role - Filtro por rol
   * @param {string} options.metas - Parámetro de metadatos ('all', 'key1,key2', etc.)
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  getUsers(options = {}) {
    const { page, limit, role, metas, headers = {} } = options;
    
    // Construir query parameters
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (role) queryParams.append('role', role);
    if (metas) queryParams.append('metas', metas);
    
    const url = `${this.baseUrl}${this.endpoints.users}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return cy.request({
      method: 'GET',
      url: url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * POST /api/v1/users - Crear nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @param {string} userData.email - Email del usuario (obligatorio)
   * @param {string} userData.firstName - Nombre del usuario (obligatorio)
   * @param {string} userData.lastName - Apellido del usuario (obligatorio)
   * @param {string} userData.country - País del usuario (obligatorio, min 2 chars)
   * @param {string} userData.image - URL de imagen del usuario (opcional)
   * @param {string} userData.language - Idioma del usuario (opcional, default: "en")
   * @param {string} userData.timezone - Zona horaria del usuario (opcional, default: "UTC")
   * @param {string} userData.role - Rol del usuario (opcional, default: "member", allowed: ["member", "colaborator"])
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  createUser(userData, options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}${this.endpoints.users}`,
      headers: this.getHeaders(headers),
      body: userData,
      failOnStatusCode: false
    });
  }

  /**
   * GET /api/v1/users/{id} - Obtener usuario específico por ID o email
   * @param {string} identifier - ID o email del usuario
   * @param {Object} options - Opciones adicionales
   * @param {string} options.metas - Parámetro de metadatos ('all', 'key1,key2', etc.)
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  getUserById(identifier, options = {}) {
    const { metas, headers = {} } = options;
    
    // Construir query parameters si hay metas
    const queryParams = new URLSearchParams();
    if (metas) queryParams.append('metas', metas);
    
    const url = `${this.baseUrl}${this.endpoints.userById(identifier)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return cy.request({
      method: 'GET',
      url: url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * PATCH /api/v1/users/{id} - Actualizar usuario
   * @param {string} identifier - ID o email del usuario
   * @param {Object} updateData - Datos a actualizar
   * @param {string} updateData.firstName - Nombre del usuario (opcional)
   * @param {string} updateData.lastName - Apellido del usuario (opcional)
   * @param {string} updateData.language - Idioma del usuario (opcional)
   * @param {string} updateData.role - Rol del usuario (opcional, allowed: ["member", "colaborator", "admin"])
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  updateUser(identifier, updateData, options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'PATCH',
      url: `${this.baseUrl}${this.endpoints.userById(identifier)}`,
      headers: this.getHeaders(headers),
      body: updateData,
      failOnStatusCode: false
    });
  }

  /**
   * DELETE /api/v1/users/{id} - Eliminar usuario
   * @param {string} identifier - ID o email del usuario
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  deleteUser(identifier, options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'DELETE',
      url: `${this.baseUrl}${this.endpoints.userById(identifier)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * OPTIONS /api/v1/users - CORS preflight para lista de usuarios
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  optionsUsers(options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'OPTIONS',
      url: `${this.baseUrl}${this.endpoints.users}`,
      headers: headers,
      failOnStatusCode: false
    });
  }

  /**
   * OPTIONS /api/v1/users/{id} - CORS preflight para usuario específico
   * @param {string} identifier - ID o email del usuario
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  optionsUserById(identifier, options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'OPTIONS',
      url: `${this.baseUrl}${this.endpoints.userById(identifier)}`,
      headers: headers,
      failOnStatusCode: false
    });
  }

  // ========== MÉTODOS DE UTILIDAD ==========

  /**
   * Genera datos de usuario aleatorios para testing
   * @param {Object} overrides - Datos específicos para sobrescribir
   * @returns {Object} Datos de usuario generados
   */
  generateRandomUserData(overrides = {}) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    
    return {
      email: `testuser_${timestamp}_${randomId}@tmt.dev`,
      firstName: `TestUser${randomId}`,
      lastName: `Cypress`,
      country: `US`, // Campo obligatorio
      role: 'member',
      language: 'en',
      timezone: 'UTC',
      ...overrides
    };
  }

  /**
   * Crea un usuario de prueba y retorna sus datos
   * @param {Object} userData - Datos del usuario (opcional)
   * @returns {Cypress.Chainable} Promise que resuelve con los datos del usuario creado
   */
  createTestUser(userData = {}) {
    const testUserData = this.generateRandomUserData(userData);
    
    return this.createUser(testUserData).then((response) => {
      if (response.status === 201) {
        return { ...testUserData, ...response.body.data };
      }
      throw new Error(`Failed to create test user: ${response.body?.error || 'Unknown error'}`);
    });
  }

  /**
   * Limpia un usuario de prueba (lo elimina)
   * @param {string} identifier - ID o email del usuario
   * @returns {Cypress.Chainable} Respuesta de eliminación
   */
  cleanupTestUser(identifier) {
    return this.deleteUser(identifier);
  }

  // ========== MÉTODOS DE VALIDACIÓN ==========

  /**
   * Valida la estructura de respuesta exitosa
   * @param {Object} response - Respuesta de la API
   * @param {number} expectedStatus - Status code esperado
   */
  validateSuccessResponse(response, expectedStatus = 200) {
    expect(response.status).to.eq(expectedStatus);
    expect(response.body).to.have.property('success', true);
    expect(response.body).to.have.property('data');
    expect(response.body).to.have.property('info');
    expect(response.body.info).to.have.property('timestamp');
  }

  /**
   * Valida la estructura de respuesta de error
   * @param {Object} response - Respuesta de la API
   * @param {number} expectedStatus - Status code esperado
   * @param {string} expectedErrorCode - Código de error esperado (opcional)
   */
  validateErrorResponse(response, expectedStatus, expectedErrorCode = null) {
    expect(response.status).to.eq(expectedStatus);
    expect(response.body).to.have.property('success', false);
    expect(response.body).to.have.property('error');

    // Info es opcional en respuestas de error
    if (response.body.info) {
      expect(response.body.info).to.have.property('timestamp');
    }

    if (expectedErrorCode) {
      expect(response.body).to.have.property('code', expectedErrorCode);
    }
  }

  /**
   * Valida la estructura de un objeto usuario
   * @param {Object} user - Objeto usuario
   * @param {boolean} allowMetas - Si permite la propiedad metas adicional
   */
  validateUserObject(user, allowMetas = false) {
    // Propiedades básicas obligatorias
    const requiredKeys = [
      'id', 'email', 'name', 'firstName', 'lastName', 
      'image', 'country', 'timezone', 'language', 'role',
      'emailVerified', 'createdAt', 'updatedAt'
    ];
    
    // Si allowMetas es true, agregar metas a las claves permitidas
    if (allowMetas && user.hasOwnProperty('metas')) {
      requiredKeys.push('metas');
    }
    
    // Validar que tenga todas las propiedades requeridas
    requiredKeys.forEach(key => {
      expect(user).to.have.property(key);
    });
    
    // Validar tipos
    expect(user.id).to.be.a('string');
    expect(user.email).to.be.a('string');
    expect(user.firstName).to.be.a('string');
    expect(user.role).to.be.oneOf(['member', 'colaborator', 'admin', 'superadmin']);
    expect(user.emailVerified).to.be.a('boolean');
    
    // Campos que pueden ser null o string
    if (user.name !== null) {
      expect(user.name).to.be.a('string');
    }
    if (user.lastName !== null) {
      expect(user.lastName).to.be.a('string');
    }
    if (user.country !== null) {
      expect(user.country).to.be.a('string');
    }
    if (user.timezone !== null) {
      expect(user.timezone).to.be.a('string');
    }
    if (user.language !== null) {
      expect(user.language).to.be.a('string');
    }
    
    // image puede ser null o string
    if (user.image !== null) {
      expect(user.image).to.be.a('string');
    }
    
    // Si hay metas, validar que sea un objeto
    if (user.hasOwnProperty('metas')) {
      expect(user.metas).to.be.an('object');
    }
    
    // Validar valores por defecto si no se especificaron
    if (user.language && !user.language.length) {
      expect(user.language).to.eq('en');
    }
    if (user.timezone && !user.timezone.length) {
      expect(user.timezone).to.eq('UTC');
    }
  }

  /**
   * Valida la estructura de respuesta paginada
   * @param {Object} response - Respuesta de la API
   */
  validatePaginatedResponse(response) {
    this.validateSuccessResponse(response);
    expect(response.body.data).to.be.an('array');

    // La API usa 'info' en lugar de 'meta.pagination'
    const info = response.body.info;
    expect(info).to.have.property('page');
    expect(info).to.have.property('limit');
    expect(info).to.have.property('total');
    expect(info).to.have.property('totalPages');
  }

  // ========== MÉTODOS DE TESTING ESPECÍFICOS ==========

  /**
   * Ejecuta una serie de tests de autenticación
   * @param {Function} testFunction - Función que ejecuta la petición
   */
  testAuthentication(testFunction) {
    describe('Authentication Tests', () => {
      it('should reject request without API key', () => {
        const originalApiKey = this.apiKey;
        this.setApiKey(null);
        
        testFunction().then((response) => {
          this.validateErrorResponse(response, 401, 'MISSING_API_KEY');
        });
        
        this.setApiKey(originalApiKey);
      });

      it('should reject request with invalid API key', () => {
        const originalApiKey = this.apiKey;
        this.setApiKey('invalid_key');
        
        testFunction().then((response) => {
          this.validateErrorResponse(response, 401, 'INVALID_API_KEY');
        });
        
        this.setApiKey(originalApiKey);
      });
    });
  }

  /**
   * Ejecuta tests de rate limiting
   * @param {Function} testFunction - Función que ejecuta la petición
   * @param {number} maxRequests - Número máximo de requests antes del rate limit
   */
  testRateLimit(testFunction, maxRequests = 100) {
    it('should handle rate limiting', () => {
      const requests = [];
      
      // Hacer muchas peticiones rápidamente
      for (let i = 0; i < maxRequests + 10; i++) {
        requests.push(testFunction());
      }
      
      // Al menos una debería ser rate limited
      cy.wrap(Promise.all(requests)).then((responses) => {
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        expect(rateLimitedResponses.length).to.be.greaterThan(0);
      });
    });
  }
}

// Exportar la clase para uso en tests
module.exports = UserAPIController;

// Para uso global en Cypress
if (typeof window !== 'undefined') {
  window.UserAPIController = UserAPIController;
}
