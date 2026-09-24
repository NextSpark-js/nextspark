/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { TasksPOM } from '../../../../src/entities/TasksPOM'
import { loginAsDefaultOwner } from '../../../../src/session-helpers'

describe('Tasks CRUD - Owner Role (Full Access)', {
  tags: ['@uat', '@feat-tasks', '@crud', '@role-owner', '@regression']
}, () => {
  const tasks = TasksPOM.create()

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Tasks')
    allure.story('Owner Permissions')
    tasks.setupApiIntercepts()
    loginAsDefaultOwner()
    tasks.visitList()
    tasks.api.waitForList()
    tasks.waitForList()
  })

  describe('CREATE - Owner can create tasks', { tags: '@smoke' }, () => {
    it('OWNER_TASK_CREATE_001: should create new task successfully', { tags: '@smoke' }, () => {
      allure.severity('critical')
      const taskTitle = `Owner Task ${Date.now()}`

      // Click create button
      tasks.clickAdd()

      // Validate form is visible
      tasks.waitForForm()

      // Fill required field
      tasks.fillTextField('title', taskTitle)

      // Submit form
      tasks.submitForm()

      // Wait for API response
      tasks.api.waitForCreate()

      // Validate redirect to list
      cy.url().should('include', `/dashboard/${tasks.entitySlug}`)

      // Validate task appears in list
      tasks.assertTaskInList(taskTitle)

      cy.log('✅ Owner created task successfully')
    })

    it('OWNER_TASK_CREATE_002: should create task with all fields', () => {
      const taskTitle = `Full Task ${Date.now()}`
      const taskDescription = 'Task with all fields filled'

      // Click create button
      tasks.clickAdd()

      // Validate form is visible
      tasks.waitForForm()

      // Fill all fields
      tasks.fillTextField('title', taskTitle)
      tasks.fillTextarea('description', taskDescription)

      // Submit form
      tasks.submitForm()

      // Wait for API response
      tasks.api.waitForCreate()

      // Validate task appears in list
      cy.url().should('include', `/dashboard/${tasks.entitySlug}`)
      tasks.assertTaskInList(taskTitle)

      cy.log('✅ Owner created full task successfully')
    })
  })

  describe('READ - Owner can read tasks', { tags: '@smoke' }, () => {
    it('OWNER_TASK_READ_001: should view task list', { tags: '@smoke' }, () => {
      allure.severity('critical')
      // Validate list is visible
      tasks.assertTableVisible()

      cy.log('✅ Owner can view task list')
    })

    it('OWNER_TASK_READ_002: should view task details', () => {
      // Check if there are tasks to view
      cy.get('body').then($body => {
        if ($body.find(tasks.selectors.rowGeneric).length > 0) {
          // Click the first task row (navigation via onClick, not <a> tag)
          cy.get(tasks.selectors.rowGeneric).first().click()

          // Should navigate to detail page
          cy.url().should('match', new RegExp(`/dashboard/${tasks.entitySlug}/[a-z0-9-]+`))

          cy.log('✅ Owner can view task details')
        } else {
          cy.log('⚠️ No tasks available to view details')
        }
      })
    })
  })

  describe('UPDATE - Owner can update tasks', () => {
    it('OWNER_TASK_UPDATE_001: should edit task successfully', () => {
      // Check if there are tasks to edit
      cy.get('body').then($body => {
        // Use POM selector for edit actions (dynamic slug)
        if ($body.find(tasks.selectors.rowActionEditGeneric).length > 0) {
          // Click edit button on first task
          cy.get(tasks.selectors.rowActionEditGeneric).first().click()

          // Validate form is visible
          tasks.waitForForm()

          // Update title
          const updatedTitle = `Updated Task ${Date.now()}`
          tasks.fillTextField('title', updatedTitle)

          // Submit form
          tasks.submitForm()

          // Wait for API response
          tasks.api.waitForUpdate()

          // Validate update
          cy.url().should('include', `/dashboard/${tasks.entitySlug}`)
          tasks.assertTaskInList(updatedTitle)

          cy.log('✅ Owner updated task successfully')
        } else {
          cy.log('⚠️ No tasks available to edit')
        }
      })
    })
  })

  describe('DELETE - Owner can delete tasks', () => {
    it('OWNER_TASK_DELETE_001: should delete task successfully', () => {
      // First, create a task to delete
      const taskTitle = `Delete Test ${Date.now()}`

      tasks.clickAdd()
      tasks.waitForForm()
      tasks.fillTextField('title', taskTitle)
      tasks.submitForm()
      tasks.api.waitForCreate()

      // Navigate back to list and wait for it to load
      tasks.visitList()
      tasks.waitForList()

      // Wait for task to appear in the list
      tasks.assertTaskInList(taskTitle)

      // Delete the task
      // Two-step delete: EntityDetailHeader AlertDialog -> EntityDetailWrapper Dialog
      tasks.clickRowByText(taskTitle)
      tasks.waitForDetail()

      // Step 1: Click delete button to open EntityDetailHeader's AlertDialog
      tasks.clickDelete()

      // Step 2: Click confirm in EntityDetailHeader's AlertDialog
      // This triggers onDelete which opens EntityDetailWrapper's Dialog
      cy.get(tasks.selectors.deleteConfirm).should('be.visible').click()

      // Step 3: Click confirm in EntityDetailWrapper's Dialog to actually delete
      cy.get(tasks.selectors.parentDeleteConfirm).should('be.visible').click()

      // Wait for delete API response (deterministic)
      tasks.api.waitForDelete()

      // Navigate to list and verify deletion
      tasks.visitList()
      tasks.api.waitForList()
      tasks.waitForList()
      tasks.assertTaskNotInList(taskTitle)

      cy.log('✅ Owner deleted task successfully')
    })
  })

  after(() => {
    cy.log('✅ Tasks CRUD tests completed')
  })
})
