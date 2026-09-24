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
 * Test IDs:
 * - TASKS_CRUD_001: Create Task
 * - TASKS_CRUD_002: Read/View Task
 * - TASKS_CRUD_003: Update Task
 * - TASKS_CRUD_004: Delete Task
 * - TASKS_CRUD_005: Filter Tasks
 * - TASKS_CRUD_006: Search Tasks
 *
 * Run with: npx cypress run --spec "**\/tasks-crud.cy.ts"
 */

import { TasksPOM, type TaskFormData } from '../../../../src/entities/TasksPOM'
const TaskAPIController = require('../../../api/entities/tasks/TaskAPIController')

describe('Tasks CRUD', { tags: ['@uat', '@tasks', '@crud'] }, () => {
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
    // Through the command rather than a request built here: it resolves the
    // team the API requires even before a dashboard visit has put it in
    // localStorage. Sending an empty `x-team-id` gets a 400 that nothing
    // reports, and the tasks survive into the next test, where a count of rows
    // then measures the leftovers instead of what that test created.
    createdTaskIds.forEach((id) => cy.deleteTask(id))
    createdTaskIds = []
  })

  // ============================================================
  // TASKS_CRUD_001: CREATE
  // ============================================================
  describe('TASKS_CRUD_001: Create Task', { tags: '@TASKS_CRUD_001' }, () => {
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

      // Saving lands on the detail page, so reaching the list is a separate
      // visit. What this test is about is the task existing and showing there.
      tasks.visitList()
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

      tasks.visitList()
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
  // TASKS_CRUD_002: READ
  // ============================================================
  describe('TASKS_CRUD_002: Read/View Task', { tags: '@TASKS_CRUD_002' }, () => {
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
        tasks.visitList()
        tasks.waitForList()

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
  // TASKS_CRUD_003: UPDATE
  // ============================================================
  describe('TASKS_CRUD_003: Update Task', { tags: '@TASKS_CRUD_003' }, () => {
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

        tasks.waitForDetail()

        // Verify update
        tasks.visitList()
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

        tasks.waitForDetail()

        tasks.visitList()
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

        tasks.waitForDetail()

        tasks.visitList()
        tasks.waitForList()
        tasks.assertTaskInList(originalTitle)
      })
    })
  })

  // ============================================================
  // TASKS_CRUD_004: DELETE
  // ============================================================
  describe('TASKS_CRUD_004: Delete Task', { tags: '@TASKS_CRUD_004' }, () => {
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
  // TASKS_CRUD_005: FILTER
  // ============================================================
  describe('TASKS_CRUD_005: Filter Tasks', { tags: '@TASKS_CRUD_005' }, () => {
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

      // The list, not a reload: `cy.reload()` keeps the current URL, so a filter
      // the previous test left in the query string is still applied here.
      tasks.visitList()
      tasks.waitForList()
    })

    it('should filter tasks by status', () => {
      tasks.filterByStatus('todo')

      // The filter travels in the URL, and waiting on that is what settles the
      // list: asserting row by row while the table is still refetching detaches
      // the very rows being checked.
      cy.url().should('include', 'status=todo')
      cy.get(tasks.selectors.rowGeneric).should('have.length.greaterThan', 0)

      // A row shows the option's label, never the stored value.
      cy.get(tasks.selectors.rowGeneric).each(($row) => {
        cy.wrap($row).should('contain.text', 'To Do')
      })
    })

    it('should filter tasks by priority', () => {
      tasks.filterByPriority('high')

      cy.url().should('include', 'priority=high')
      cy.get(tasks.selectors.rowGeneric).should('have.length.greaterThan', 0)

      cy.get(tasks.selectors.rowGeneric).each(($row) => {
        cy.wrap($row).should('contain.text', 'High')
      })
    })

    it('should clear filters', () => {
      tasks.filterByStatus('todo')
      // The filter travels in the URL, and waiting on that is what settles the
      // list — a fixed wait counts rows mid-refetch and sees a partial table.
      cy.url().should('include', 'status=todo')

      tasks.clearStatusFilter()
      cy.url().should('not.include', 'status=')

      // The three the beforeEach created: the starter seeds no tasks, so any
      // higher number would be counting on a previous run's leftovers.
      cy.get(tasks.selectors.rowGeneric).should('have.length.at.least', 3)
    })
  })

  // ============================================================
  // TASKS_CRUD_006: SEARCH
  // ============================================================
  describe('TASKS_CRUD_006: Search Tasks', { tags: '@TASKS_CRUD_006' }, () => {
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

      // The list, not a reload: a search or filter left in the query string by
      // the previous test would still be applied.
      tasks.visitList()
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
