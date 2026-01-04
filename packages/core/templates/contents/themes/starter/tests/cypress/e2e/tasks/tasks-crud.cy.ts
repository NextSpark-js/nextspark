/// <reference types="cypress" />

/**
 * Tasks CRUD Tests - Starter Theme
 *
 * Complete CRUD test suite for the Tasks entity.
 * Demonstrates:
 * - Login using session helpers
 * - Creating, reading, updating, and deleting tasks
 * - Filtering and searching tasks
 * - Using POM pattern for maintainability
 *
 * Run with: npx cypress run --spec "**/tasks-crud.cy.ts"
 */

import { TasksPOM, type TaskFormData } from './TasksPOM'
const TaskAPIController = require('./TaskAPIController')

describe('Tasks CRUD', () => {
  const tasks = new TasksPOM()
  let createdTaskIds: string[] = []

  beforeEach(() => {
    // Login as owner before each test
    cy.loginAsOwner()

    // Visit tasks list page
    tasks.visitList()
    tasks.waitForList()
  })

  afterEach(() => {
    // Cleanup: Delete any tasks created during tests
    if (createdTaskIds.length > 0) {
      cy.window().then((win) => {
        const teamId = win.localStorage.getItem('activeTeamId')
        createdTaskIds.forEach((id) => {
          cy.request({
            method: 'DELETE',
            url: `/api/v1/tasks/${id}`,
            headers: {
              'Content-Type': 'application/json',
              'x-team-id': teamId || ''
            },
            failOnStatusCode: false
          })
        })
        createdTaskIds = []
      })
    }
  })

  // ============================================================
  // CREATE
  // ============================================================
  describe('Create Task', () => {
    it('should create a new task with minimal data', () => {
      const taskData: TaskFormData = {
        title: `Test Task ${Date.now()}`
      }

      // Navigate to create form
      tasks.clickAdd()
      tasks.waitForForm()

      // Fill and submit form
      tasks.fillTaskForm(taskData)
      tasks.submitForm()

      // Should redirect to list and show new task
      tasks.waitForList()
      tasks.assertTaskInList(taskData.title)
    })

    it('should create a new task with all fields', () => {
      const taskData: TaskFormData = {
        title: `Full Task ${Date.now()}`,
        description: 'This is a complete task with all fields filled',
        status: 'in-progress',
        priority: 'high'
      }

      tasks.clickAdd()
      tasks.waitForForm()
      tasks.fillTaskForm(taskData)
      tasks.submitForm()

      tasks.waitForList()
      tasks.assertTaskInList(taskData.title)
    })

    it('should show validation error for empty title', () => {
      tasks.clickAdd()
      tasks.waitForForm()

      // Try to submit without filling title
      tasks.submitForm()

      // Form should still be visible (not submitted)
      tasks.assertFormVisible()
    })
  })

  // ============================================================
  // READ
  // ============================================================
  describe('Read/View Task', () => {
    let testTaskId: string

    beforeEach(() => {
      // Create a test task via API
      cy.createTask({
        title: `Read Test Task ${Date.now()}`,
        description: 'Task for testing read operations',
        status: 'todo',
        priority: 'medium'
      }).then((response) => {
        if (response.status === 201) {
          testTaskId = response.body.data.id
          createdTaskIds.push(testTaskId)
        }
      })
    })

    it('should display task in list', () => {
      // Refresh list to see new task
      tasks.visitList()
      tasks.waitForList()

      // Task should be visible in list
      cy.get(tasks.selectors.rowGeneric).should('exist')
    })

    it('should navigate to task detail page', () => {
      cy.then(() => {
        tasks.clickRow(testTaskId)
        tasks.waitForDetail()

        // Should be on detail page
        cy.url().should('include', `/dashboard/tasks/${testTaskId}`)
      })
    })

    it('should display task details correctly', () => {
      cy.then(() => {
        tasks.visitDetail(testTaskId)
        tasks.waitForDetail()

        // Verify task content is displayed
        cy.contains('Read Test Task').should('be.visible')
      })
    })
  })

  // ============================================================
  // UPDATE
  // ============================================================
  describe('Update Task', () => {
    let testTaskId: string
    let originalTitle: string

    beforeEach(() => {
      originalTitle = `Update Test Task ${Date.now()}`
      // Create a test task via API
      cy.createTask({
        title: originalTitle,
        description: 'Task for testing update operations',
        status: 'todo',
        priority: 'low'
      }).then((response) => {
        if (response.status === 201) {
          testTaskId = response.body.data.id
          createdTaskIds.push(testTaskId)
        }
      })
    })

    it('should update task title', () => {
      const newTitle = `Updated Task ${Date.now()}`

      cy.then(() => {
        // Navigate to edit page
        tasks.visitEdit(testTaskId)
        tasks.waitForForm()

        // Update title
        tasks.fillTextField('title', newTitle)
        tasks.submitForm()

        // Verify update
        tasks.waitForList()
        tasks.assertTaskInList(newTitle)
        tasks.assertTaskNotInList(originalTitle)
      })
    })

    it('should update task status', () => {
      cy.then(() => {
        tasks.visitEdit(testTaskId)
        tasks.waitForForm()

        // Change status
        tasks.selectOption('status', 'done')
        tasks.submitForm()

        tasks.waitForList()
        // Task should now show as done
        tasks.assertTaskInList(originalTitle)
      })
    })

    it('should update task priority', () => {
      cy.then(() => {
        tasks.visitEdit(testTaskId)
        tasks.waitForForm()

        // Change priority
        tasks.selectOption('priority', 'urgent')
        tasks.submitForm()

        tasks.waitForList()
        tasks.assertTaskInList(originalTitle)
      })
    })
  })

  // ============================================================
  // DELETE
  // ============================================================
  describe('Delete Task', () => {
    let testTaskId: string
    let taskTitle: string

    beforeEach(() => {
      taskTitle = `Delete Test Task ${Date.now()}`
      // Create a test task via API
      cy.createTask({
        title: taskTitle,
        description: 'Task for testing delete operations',
        status: 'todo',
        priority: 'medium'
      }).then((response) => {
        if (response.status === 201) {
          testTaskId = response.body.data.id
          // Don't add to createdTaskIds since we're testing delete
        }
      })
    })

    it('should delete task from detail page', () => {
      cy.then(() => {
        // Navigate to detail page
        tasks.visitDetail(testTaskId)
        tasks.waitForDetail()

        // Click delete and confirm
        tasks.clickDelete()
        tasks.confirmDelete()

        // Should redirect to list
        tasks.waitForList()

        // Task should not be in list
        tasks.assertTaskNotInList(taskTitle)
      })
    })

    it('should cancel delete operation', () => {
      cy.then(() => {
        tasks.visitDetail(testTaskId)
        tasks.waitForDetail()

        // Click delete but cancel
        tasks.clickDelete()
        tasks.cancelDelete()

        // Should still be on detail page
        cy.url().should('include', `/dashboard/tasks/${testTaskId}`)

        // Add to cleanup
        createdTaskIds.push(testTaskId)
      })
    })
  })

  // ============================================================
  // FILTER
  // ============================================================
  describe('Filter Tasks', () => {
    beforeEach(() => {
      // Create tasks with different statuses
      const statuses = ['todo', 'in-progress', 'done']
      const priorities = ['low', 'medium', 'high']

      statuses.forEach((status, index) => {
        cy.createTask({
          title: `Filter Test ${status} ${Date.now()}`,
          status: status,
          priority: priorities[index]
        }).then((response) => {
          if (response.status === 201) {
            createdTaskIds.push(response.body.data.id)
          }
        })
      })

      // Refresh list to see new tasks
      cy.reload()
      tasks.waitForList()
    })

    it('should filter tasks by status', () => {
      // Filter by "todo" status
      tasks.filterByStatus('todo')

      // Wait for filter to apply
      cy.wait(500)

      // Should show only todo tasks
      cy.get(tasks.selectors.rowGeneric).each(($row) => {
        cy.wrap($row).should('contain.text', 'todo')
      })
    })

    it('should filter tasks by priority', () => {
      // Filter by "high" priority
      tasks.filterByPriority('high')

      // Wait for filter to apply
      cy.wait(500)

      // Should show only high priority tasks
      cy.get(tasks.selectors.rowGeneric).each(($row) => {
        cy.wrap($row).should('contain.text', 'high')
      })
    })

    it('should clear filters', () => {
      // Apply filter
      tasks.filterByStatus('todo')
      cy.wait(500)

      // Clear filter
      tasks.clearStatusFilter()
      cy.wait(500)

      // Should show all tasks again
      cy.get(tasks.selectors.rowGeneric).should('have.length.at.least', 3)
    })
  })

  // ============================================================
  // SEARCH
  // ============================================================
  describe('Search Tasks', () => {
    const searchTerm = `Searchable${Date.now()}`

    beforeEach(() => {
      // Create a task with unique searchable term
      cy.createTask({
        title: `${searchTerm} Task`,
        description: 'Task for testing search',
        status: 'todo',
        priority: 'medium'
      }).then((response) => {
        if (response.status === 201) {
          createdTaskIds.push(response.body.data.id)
        }
      })

      // Create another task without the search term
      cy.createTask({
        title: `Regular Task ${Date.now()}`,
        description: 'Another task',
        status: 'todo',
        priority: 'low'
      }).then((response) => {
        if (response.status === 201) {
          createdTaskIds.push(response.body.data.id)
        }
      })

      // Refresh list
      cy.reload()
      tasks.waitForList()
    })

    it('should search tasks by title', () => {
      // Search for the unique term
      tasks.search(searchTerm)

      // Wait for search results
      cy.wait(500)

      // Should find the matching task
      tasks.assertTaskInList(searchTerm)
    })

    it('should show no results for non-matching search', () => {
      // Search for something that doesn't exist
      tasks.search('NonExistentTaskXYZ123')

      // Wait for search
      cy.wait(500)

      // Should show no results or empty state
      cy.get(tasks.selectors.rowGeneric).should('have.length', 0)
    })

    it('should clear search', () => {
      // Apply search
      tasks.search(searchTerm)
      cy.wait(500)

      // Clear search
      tasks.clearSearch()
      cy.wait(500)

      // Should show all tasks
      cy.get(tasks.selectors.rowGeneric).should('have.length.at.least', 2)
    })
  })
})
