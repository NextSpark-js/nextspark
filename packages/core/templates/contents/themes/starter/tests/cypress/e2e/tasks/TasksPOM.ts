/**
 * TasksPOM - Page Object Model for Tasks entity
 *
 * Extends DashboardEntityPOM with task-specific form handling and workflows.
 *
 * @example
 * // Instance usage with chaining
 * TasksPOM.create()
 *   .visitList()
 *   .waitForList()
 *   .clickAdd()
 *   .fillTaskForm({ title: 'New Task', priority: 'high' })
 *   .submitForm()
 *
 * // API-aware workflow
 * const tasks = new TasksPOM()
 * tasks.createTaskWithApiWait({
 *   title: 'New Task',
 *   description: 'Task description',
 *   status: 'todo',
 *   priority: 'high'
 * })
 */

import { DashboardEntityPOM } from '../../src/core/DashboardEntityPOM'
import entitiesConfig from '../../fixtures/entities.json'

export interface TaskFormData {
  title: string
  description?: string
  status?: 'todo' | 'in-progress' | 'review' | 'done' | 'blocked'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  estimatedHours?: string
  completed?: boolean
}

export class TasksPOM extends DashboardEntityPOM {
  constructor() {
    super(entitiesConfig.entities.tasks.slug)
  }

  // ============================================
  // FACTORY METHOD
  // ============================================

  static create(): TasksPOM {
    return new TasksPOM()
  }

  // ============================================
  // ENTITY-SPECIFIC FORM METHODS
  // ============================================

  /**
   * Fill task form with provided data
   * Only fills fields that are provided in the data object
   */
  fillTaskForm(data: TaskFormData) {
    if (data.title) {
      this.fillTextField('title', data.title)
    }
    if (data.description) {
      this.fillTextarea('description', data.description)
    }
    if (data.status) {
      this.selectOption('status', data.status)
    }
    if (data.priority) {
      this.selectOption('priority', data.priority)
    }
    if (data.dueDate) {
      this.fillTextField('dueDate', data.dueDate)
    }
    if (data.estimatedHours) {
      this.fillTextField('estimatedHours', data.estimatedHours)
    }
    return this
  }

  // ============================================
  // WORKFLOW METHODS
  // ============================================

  /**
   * Complete create flow without API waits
   */
  createTask(data: TaskFormData) {
    this.visitCreate()
    this.waitForForm()
    this.fillTaskForm(data)
    this.submitForm()
    return this
  }

  /**
   * Create task with API intercepts and waits
   * Deterministic: waits for actual API responses
   */
  createTaskWithApiWait(data: TaskFormData) {
    this.setupApiIntercepts()
    this.clickAdd()
    this.waitForForm()
    this.fillTaskForm(data)
    this.submitForm()
    this.api.waitForCreate()
    return this
  }

  /**
   * Create task from list page and wait for refresh
   */
  createTaskFromListWithApiWait(data: TaskFormData) {
    this.setupApiIntercepts()
    this.clickAdd()
    this.waitForForm()
    this.fillTaskForm(data)
    this.submitForm()
    this.api.waitForCreateAndRefresh()
    return this
  }

  /**
   * Update task with API waits
   */
  updateTaskWithApiWait(data: Partial<TaskFormData>) {
    this.fillTaskForm(data as TaskFormData)
    this.submitForm()
    this.api.waitForUpdate()
    return this
  }

  /**
   * Delete task with API waits
   * Flow: Navigate to detail -> Delete -> Confirm
   */
  deleteTaskWithApiWait(id: string) {
    this.visitDetailWithApiWait(id)
    this.clickDelete()
    this.confirmDelete()
    this.api.waitForDelete()
    return this
  }

  /**
   * Delete task by finding it in the list by name
   */
  deleteTaskByNameWithApiWait(name: string) {
    this.clickRowByText(name)
    this.waitForDetail()
    this.clickDelete()
    this.confirmDelete()
    this.api.waitForDelete()
    return this
  }

  // ============================================
  // FILTER METHODS
  // ============================================

  /**
   * Filter tasks by status
   */
  filterByStatus(status: string) {
    this.selectFilter('status', status)
    return this
  }

  /**
   * Filter tasks by priority
   */
  filterByPriority(priority: string) {
    this.selectFilter('priority', priority)
    return this
  }

  /**
   * Clear status filter
   */
  clearStatusFilter() {
    this.clearFilter('status')
    return this
  }

  /**
   * Clear priority filter
   */
  clearPriorityFilter() {
    this.clearFilter('priority')
    return this
  }

  // ============================================
  // ENTITY-SPECIFIC ASSERTIONS
  // ============================================

  /**
   * Assert task appears in list
   */
  assertTaskInList(title: string) {
    return this.assertInList(title)
  }

  /**
   * Assert task does not appear in list
   */
  assertTaskNotInList(title: string) {
    return this.assertNotInList(title)
  }

  /**
   * Assert task has specific status in list
   */
  assertTaskStatus(title: string, status: string) {
    cy.contains(this.selectors.rowGeneric, title)
      .should('contain.text', status)
    return this
  }

  /**
   * Assert task has specific priority in list
   */
  assertTaskPriority(title: string, priority: string) {
    cy.contains(this.selectors.rowGeneric, title)
      .should('contain.text', priority)
    return this
  }

  /**
   * Assert task count in list
   */
  assertTaskCount(count: number) {
    cy.get(this.selectors.rowGeneric).should('have.length', count)
    return this
  }

  /**
   * Assert no tasks in list
   */
  assertNoTasks() {
    cy.get(this.selectors.rowGeneric).should('not.exist')
    return this
  }
}

export default TasksPOM
