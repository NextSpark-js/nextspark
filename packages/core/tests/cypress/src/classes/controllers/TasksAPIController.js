/**
 * TasksAPIController - Controlador para interactuar con la API de tareas
 * Encapsula todas las operaciones CRUD para los endpoints /api/v1/tasks
 */
class TasksAPIController {
  constructor(baseUrl = 'http://localhost:5173', apiKey = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.endpoints = {
      tasks: '/api/v1/tasks',
      taskById: (id) => `/api/v1/tasks/${id}`
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
   * GET /api/v1/tasks - Obtener lista de tareas
   * @param {Object} options - Opciones de consulta
   * @param {number} options.page - Número de página
   * @param {number} options.limit - Límite de resultados por página
   * @param {boolean} options.completed - Filtro por estado completado
   * @param {string} options.sort - Campo para ordenar (createdAt, title, updatedAt)
   * @param {string} options.order - Orden (asc, desc)
   * @param {string} options.search - Búsqueda en título y descripción
   * @param {string} options.userId - Filtro por ID de usuario
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  getTasks(options = {}) {
    const { page, limit, completed, sort, order, search, userId, metas, headers = {} } = options;
    
    // Construir query parameters
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    if (completed !== undefined) queryParams.append('completed', completed);
    if (sort) queryParams.append('sort', sort);
    if (order) queryParams.append('order', order);
    if (search) queryParams.append('search', search);
    if (userId) queryParams.append('userId', userId);
    if (metas) queryParams.append('metas', metas);
    
    const url = `${this.baseUrl}${this.endpoints.tasks}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return cy.request({
      method: 'GET',
      url: url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * GET /api/v1/tasks?userId={userId} - Obtener tareas de un usuario específico
   * @param {string} userId - ID o email del usuario
   * @param {Object} options - Opciones adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  getTasksByUser(userId, options = {}) {
    return this.getTasks({ ...options, userId });
  }

  /**
   * POST /api/v1/tasks - Crear nueva tarea
   * @param {Object} taskData - Datos de la tarea
   * @param {string} taskData.title - Título de la tarea
   * @param {string} taskData.description - Descripción de la tarea (opcional)
   * @param {boolean} taskData.completed - Estado completado (opcional, default: false)
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  createTask(taskData, options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'POST',
      url: `${this.baseUrl}${this.endpoints.tasks}`,
      headers: this.getHeaders(headers),
      body: taskData,
      failOnStatusCode: false
    });
  }

  /**
   * GET /api/v1/tasks/{id} - Obtener tarea específica por ID
   * @param {string} taskId - ID de la tarea
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  getTaskById(taskId, options = {}) {
    const { metas, headers = {} } = options;
    
    // Construir query parameters
    const queryParams = new URLSearchParams();
    if (metas) queryParams.append('metas', metas);
    
    const url = `${this.baseUrl}${this.endpoints.taskById(taskId)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    return cy.request({
      method: 'GET',
      url: url,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * PATCH /api/v1/tasks/{id} - Actualizar tarea
   * @param {string} taskId - ID de la tarea
   * @param {Object} updateData - Datos a actualizar
   * @param {string} updateData.title - Título de la tarea (opcional)
   * @param {string} updateData.description - Descripción de la tarea (opcional)
   * @param {boolean} updateData.completed - Estado completado (opcional)
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  updateTask(taskId, updateData, options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'PATCH',
      url: `${this.baseUrl}${this.endpoints.taskById(taskId)}`,
      headers: this.getHeaders(headers),
      body: updateData,
      failOnStatusCode: false
    });
  }

  /**
   * DELETE /api/v1/tasks/{id} - Eliminar tarea
   * @param {string} taskId - ID de la tarea
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  deleteTask(taskId, options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'DELETE',
      url: `${this.baseUrl}${this.endpoints.taskById(taskId)}`,
      headers: this.getHeaders(headers),
      failOnStatusCode: false
    });
  }

  /**
   * OPTIONS /api/v1/tasks - CORS preflight para lista de tareas
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  optionsTasks(options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'OPTIONS',
      url: `${this.baseUrl}${this.endpoints.tasks}`,
      headers: headers,
      failOnStatusCode: false
    });
  }

  /**
   * OPTIONS /api/v1/tasks/{id} - CORS preflight para tarea específica
   * @param {string} taskId - ID de la tarea
   * @param {Object} options - Opciones adicionales
   * @param {Object} options.headers - Headers adicionales
   * @returns {Cypress.Chainable} Respuesta de Cypress
   */
  optionsTaskById(taskId, options = {}) {
    const { headers = {} } = options;
    
    return cy.request({
      method: 'OPTIONS',
      url: `${this.baseUrl}${this.endpoints.taskById(taskId)}`,
      headers: headers,
      failOnStatusCode: false
    });
  }

  // ========== MÉTODOS DE UTILIDAD ==========

  /**
   * Genera datos de tarea aleatorios para testing
   * @param {Object} overrides - Datos específicos para sobrescribir
   * @returns {Object} Datos de tarea generados
   */
  generateRandomTaskData(overrides = {}) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    
    const taskTitles = [
      'Complete project documentation',
      'Review pull request',
      'Fix bug in authentication',
      'Update dependencies',
      'Write unit tests',
      'Deploy to staging',
      'Meeting with team',
      'Code review session',
      'Database optimization',
      'UI/UX improvements'
    ];
    
    const taskDescriptions = [
      'This task needs to be completed as soon as possible',
      'Important task for the project milestone',
      'Critical bug that affects user experience',
      'Routine maintenance task',
      'Enhancement to improve system performance',
      'Collaborative task requiring team input',
      'Research and development task',
      'Quality assurance and testing task',
      'Documentation and knowledge sharing task',
      'Test task for automation'
    ];
    
    const randomTitle = taskTitles[Math.floor(Math.random() * taskTitles.length)];
    const randomDescription = taskDescriptions[Math.floor(Math.random() * taskDescriptions.length)];
    
    return {
      title: `${randomTitle} ${randomId}`,
      description: `${randomDescription} cypress`,
      completed: Math.random() > 0.7, // 30% chance of being completed
      ...overrides
    };
  }

  /**
   * Crea una tarea de prueba y retorna sus datos
   * @param {Object} taskData - Datos de la tarea (opcional)
   * @returns {Cypress.Chainable} Promise que resuelve con los datos de la tarea creada
   */
  createTestTask(taskData = {}) {
    const testTaskData = this.generateRandomTaskData(taskData);
    
    return this.createTask(testTaskData).then((response) => {
      if (response.status === 201) {
        return { ...testTaskData, ...response.body.data };
      }
      throw new Error(`Failed to create test task: ${response.body?.error || 'Unknown error'}`);
    });
  }

  /**
   * Limpia una tarea de prueba (la elimina)
   * @param {string} taskId - ID de la tarea
   * @returns {Cypress.Chainable} Respuesta de eliminación
   */
  cleanupTestTask(taskId) {
    return this.deleteTask(taskId);
  }

  /**
   * Crea múltiples tareas de prueba
   * @param {number} count - Número de tareas a crear
   * @param {Object} baseData - Datos base para las tareas
   * @returns {Cypress.Chainable} Array de tareas creadas
   */
  createMultipleTestTasks(count = 5, baseData = {}) {
    const tasks = [];
    
    for (let i = 0; i < count; i++) {
      const taskData = this.generateRandomTaskData({
        ...baseData,
        title: `${baseData.title || 'Test Task'} ${i + 1}`
      });
      tasks.push(this.createTask(taskData));
    }
    
    return cy.wrap(Promise.all(tasks)).then((responses) => {
      return responses.map((response, index) => {
        if (response.status === 201) {
          return response.body.data;
        }
        throw new Error(`Failed to create test task ${index + 1}`);
      });
    });
  }

  /**
   * Limpia múltiples tareas de prueba
   * @param {Array} taskIds - Array de IDs de tareas
   * @returns {Cypress.Chainable} Respuestas de eliminación
   */
  cleanupMultipleTestTasks(taskIds) {
    const deletePromises = taskIds.map(id => this.deleteTask(id));
    return cy.wrap(Promise.all(deletePromises));
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
    expect(response.body).to.have.property('meta');
    expect(response.body.meta).to.have.property('timestamp');
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
    
    // Meta es opcional en respuestas de error
    if (response.body.meta) {
      expect(response.body.meta).to.have.property('timestamp');
    }
    
    if (expectedErrorCode) {
      expect(response.body).to.have.property('code', expectedErrorCode);
    }
  }

  /**
   * Valida la estructura de un objeto tarea
   * @param {Object} task - Objeto tarea
   */
  validateTaskObject(task) {
    expect(task).to.have.property('id');
    expect(task).to.have.property('title');
    expect(task).to.have.property('createdAt');
    expect(task).to.have.property('updatedAt');
    
    // Validar tipos
    expect(task.id).to.be.a('string');
    expect(task.title).to.be.a('string');
    
    // Validar que title no esté vacío
    expect(task.title.trim()).to.not.be.empty;
    
    // Validar estructura del usuario (puede ser objeto user o string userId)
    if (task.user) {
      // Estructura completa con objeto user
      expect(task.user).to.be.an('object');
      expect(task.user).to.have.property('id');
      expect(task.user).to.have.property('email');
      expect(task.user.id).to.be.a('string');
      expect(task.user.email).to.be.a('string');
    } else if (task.userId) {
      // Estructura simple con userId
      expect(task.userId).to.be.a('string');
    } else {
      throw new Error('Task must have either user object or userId property');
    }
    
    // description puede ser null o string
    if (task.description !== null && task.description !== undefined) {
      expect(task.description).to.be.a('string');
    }
    
    // completed puede no existir por defecto
    if (task.completed !== undefined) {
      expect(task.completed).to.be.a('boolean');
    }
  }

  /**
   * Valida la estructura de respuesta paginada
   * @param {Object} response - Respuesta de la API
   */
  validatePaginatedResponse(response) {
    this.validateSuccessResponse(response);
    expect(response.body.data).to.be.an('array');
    expect(response.body.meta).to.have.property('pagination');
    
    const pagination = response.body.meta.pagination;
    expect(pagination).to.have.property('page');
    expect(pagination).to.have.property('limit');
    expect(pagination).to.have.property('total');
    expect(pagination).to.have.property('pages');
    expect(pagination).to.have.property('has_next');
    expect(pagination).to.have.property('has_prev');
  }

  /**
   * Valida que las tareas estén ordenadas correctamente
   * @param {Array} tasks - Array de tareas
   * @param {string} sortField - Campo de ordenamiento
   * @param {string} order - Orden (asc, desc)
   */
  validateTasksSorting(tasks, sortField, order = 'desc') {
    if (tasks.length < 2) return; // No se puede validar orden con menos de 2 elementos
    
    for (let i = 0; i < tasks.length - 1; i++) {
      const current = tasks[i][sortField];
      const next = tasks[i + 1][sortField];
      
      if (order === 'desc') {
        expect(current >= next).to.be.true;
      } else {
        expect(current <= next).to.be.true;
      }
    }
  }

  /**
   * Valida que las tareas cumplan con el filtro de completado
   * @param {Array} tasks - Array de tareas
   * @param {boolean} completedFilter - Filtro aplicado
   */
  validateCompletedFilter(tasks, completedFilter) {
    tasks.forEach(task => {
      expect(task.completed).to.eq(completedFilter);
    });
  }

  /**
   * Valida que las tareas contengan el término de búsqueda
   * @param {Array} tasks - Array de tareas
   * @param {string} searchTerm - Término de búsqueda
   */
  validateSearchResults(tasks, searchTerm) {
    tasks.forEach(task => {
      const titleMatch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
      const descriptionMatch = task.description && 
        task.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      expect(titleMatch || descriptionMatch).to.be.true;
    });
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

      it('should reject request with expired API key', () => {
        const originalApiKey = this.apiKey;
        this.setApiKey('expired_key');
        
        testFunction().then((response) => {
          this.validateErrorResponse(response, 401, 'API_KEY_EXPIRED');
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

  /**
   * Ejecuta tests completos de CRUD para tareas
   */
  testTasksCRUD() {
    describe('Tasks CRUD Operations', () => {
      let createdTaskId;

      it('should create a new task', () => {
        const taskData = this.generateRandomTaskData();
        
        this.createTask(taskData).then((response) => {
          this.validateSuccessResponse(response, 201);
          this.validateTaskObject(response.body.data);
          
          expect(response.body.data.title).to.eq(taskData.title);
          expect(response.body.data.description).to.eq(taskData.description);
          expect(response.body.data.completed).to.eq(taskData.completed || false);
          
          createdTaskId = response.body.data.id;
        });
      });

      it('should get the created task', () => {
        this.getTaskById(createdTaskId).then((response) => {
          this.validateSuccessResponse(response);
          this.validateTaskObject(response.body.data);
          expect(response.body.data.id).to.eq(createdTaskId);
        });
      });

      it('should update the task', () => {
        const updateData = {
          title: 'Updated Task Title',
          completed: true
        };
        
        this.updateTask(createdTaskId, updateData).then((response) => {
          this.validateSuccessResponse(response);
          this.validateTaskObject(response.body.data);
          
          expect(response.body.data.title).to.eq(updateData.title);
          expect(response.body.data.completed).to.eq(updateData.completed);
        });
      });

      it('should delete the task', () => {
        this.deleteTask(createdTaskId).then((response) => {
          this.validateSuccessResponse(response);
          expect(response.body.data.deleted).to.be.true;
          expect(response.body.data.id).to.eq(createdTaskId);
        });
      });

      it('should return 404 for deleted task', () => {
        this.getTaskById(createdTaskId).then((response) => {
          this.validateErrorResponse(response, 404, 'TASK_NOT_FOUND');
        });
      });
    });
  }
}

// Exportar la clase para uso en tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TasksAPIController;
}

// Para uso global en Cypress
if (typeof window !== 'undefined') {
  window.TasksAPIController = TasksAPIController;
}
