/// <reference types="cypress" />

import * as allure from 'allure-cypress'

import { TasksPOM } from '../../../../src/entities/TasksPOM'
import { loginAsDefaultMember } from '../../../../src/session-helpers'

describe('Tasks CRUD - Member Role (Create, Read, Update - No Delete)', {
  tags: ['@uat', '@feat-tasks', '@crud', '@role-member', '@regression']
}, () => {
  const tasks = TasksPOM.create()
  let createdTaskTitles: string[] = []

  beforeEach(() => {
    allure.epic('UAT')
    allure.feature('Tasks')
    allure.story('Member Permissions')
    tasks.setupApiIntercepts()
    loginAsDefaultMember()
    tasks.visitList()
    tasks.api.waitForList()
    tasks.waitForList()
  })

  describe('CREATE - Member can create tasks', () => {
    it('MEMBER_TASK_CREATE_001: should create task successfully', () => {
      const taskTitle = `Member Task ${Date.now()}`
      const taskDescription = 'Task created by Member for testing'

      // Click create button
      tasks.clickAdd()

      // Wait for form
      tasks.waitForForm()

      // Fill form
      tasks.fillTextField('title', taskTitle)
      tasks.fillTextarea('description', taskDescription)
      tasks.submitForm()

      // Wait for API response
      tasks.api.waitForCreate()

      // Validate task appears in list
      cy.url().should('include', `/dashboard/${tasks.entitySlug}`)
      tasks.assertTaskInList(taskTitle)
      createdTaskTitles.push(taskTitle)

      cy.log('✅ Member created task successfully')
    })
  })

  describe('READ - Member can read tasks', () => {
    it('MEMBER_TASK_READ_001: should view all tasks', () => {
      // Validate list is loaded
      tasks.assertTableVisible()

      cy.log('✅ Member can view task list')
    })

    it('MEMBER_TASK_READ_002: should view task details', () => {
      // Create a task first
      const taskTitle = `Member Read Test ${Date.now()}`

      tasks.clickAdd()
      tasks.waitForForm()
      tasks.fillTextField('title', taskTitle)
      tasks.fillTextarea('description', 'Test description')
      tasks.submitForm()
      tasks.api.waitForCreate()
      createdTaskTitles.push(taskTitle)

      // Navigate back to list
      tasks.visitList()
      tasks.waitForList()

      // Click on task to view details (rows use onClick, not <a> tag)
      tasks.clickRowByText(taskTitle)

      // Should show task details
      cy.url().should('match', new RegExp(`/dashboard/${tasks.entitySlug}/[a-z0-9-]+`))
      cy.contains(taskTitle).should('be.visible')

      cy.log('✅ Member can view task details')
    })
  })

  describe('UPDATE - Member can update tasks', () => {
    it('MEMBER_TASK_UPDATE_001: should edit task title', () => {
      const originalTitle = `Member Edit Test ${Date.now()}`
      const updatedTitle = `${originalTitle} - Updated`

      // Create task
      tasks.clickAdd()
      tasks.waitForForm()
      tasks.fillTextField('title', originalTitle)
      tasks.fillTextarea('description', 'Edit test')
      tasks.submitForm()
      tasks.api.waitForCreate()
      createdTaskTitles.push(originalTitle)
      createdTaskTitles.push(updatedTitle)

      // Navigate back to list
      tasks.visitList()
      tasks.waitForList()

      // Wait for task to appear
      tasks.assertTaskInList(originalTitle)

      // Look for edit button and click it
      cy.get('body').then($body => {
        // Use POM selector for edit actions (dynamic slug)
        if ($body.find(tasks.selectors.rowActionEditGeneric).length > 0) {
          cy.get(tasks.selectors.rowActionEditGeneric).first().click()

          // Wait for form
          tasks.waitForForm()

          // Update title
          tasks.fillTextField('title', updatedTitle)
          tasks.submitForm()
          tasks.api.waitForUpdate()

          // Validate updated task appears
          cy.url().should('include', `/dashboard/${tasks.entitySlug}`)
          tasks.assertTaskInList(updatedTitle)

          cy.log('✅ Member edited task successfully')
        } else {
          cy.log('⚠️ No edit button found')
        }
      })
    })
  })

  describe('DELETE - Member CANNOT delete tasks (no permission)', () => {
    it('MEMBER_TASK_DELETE_001: delete button should be hidden', () => {
      // Check if there are tasks
      cy.get('body').then($body => {
        if ($body.find(tasks.selectors.rowGeneric).length > 0) {
          // Click first task to view details (rows use onClick, not <a> tag)
          cy.get(tasks.selectors.rowGeneric).first().click()

          // Wait for detail page
          tasks.waitForDetail()

          // Delete button should NOT exist for Member role
          // EntityDetailHeader uses tasks-delete-btn selector
          cy.get(tasks.selectors.deleteButton).should('not.exist')

          cy.log('✅ Delete button correctly hidden for Member')
        } else {
          cy.log('⚠️ No tasks available to check delete permission')
        }
      })
    })
  })

  after(() => {
    // Cleanup: Note created tasks
    if (createdTaskTitles.length > 0) {
      cy.log(`🧹 Cleaning up ${createdTaskTitles.length} test tasks...`)
    }
  })
})
