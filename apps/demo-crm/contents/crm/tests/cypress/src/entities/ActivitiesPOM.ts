/**
 * Activities Page Object Model for CRM Theme
 *
 * Entity-specific POM for Activities.
 *
 * Usage:
 *   const activities = new ActivitiesPOM()
 *   activities.list.validateTableVisible()
 *   activities.form.selectOption('type', 'call')
 */

import { EntityList } from '../components/EntityList'
import { EntityForm } from '../components/EntityForm'
import { EntityDetail } from '../components/EntityDetail'

export class ActivitiesPOM {
  /** Generic list POM for activities */
  readonly list: EntityList

  /** Generic form POM for activities */
  readonly form: EntityForm

  /** Generic detail POM for activities */
  readonly detail: EntityDetail

  /** Activity entity slug */
  readonly slug = 'activities'

  constructor() {
    this.list = EntityList.for('activities')
    this.form = EntityForm.for('activities')
    this.detail = new EntityDetail('activities', 'activity', [])
  }

  // ============================================
  // NAVIGATION METHODS
  // ============================================

  /**
   * Visit the activities list page
   */
  visitList() {
    cy.visit('/dashboard/activities')
    this.list.waitForPageLoad()
    return this
  }

  /**
   * Visit activity detail page
   */
  visitDetail(activityId: string) {
    this.detail.visit(activityId)
    return this
  }

  /**
   * Visit create activity page
   */
  visitCreate() {
    this.form.visitCreate()
    return this
  }

  /**
   * Visit edit activity page
   */
  visitEdit(activityId: string) {
    this.form.visitEdit(activityId)
    return this
  }

  // ============================================
  // FORM HELPERS
  // ============================================

  /**
   * Fill activity form with common fields
   */
  fillActivityForm(data: {
    type?: string
    subject?: string
    description?: string
    dueDate?: string
    relatedTo?: string
    contactId?: string
    companyId?: string
    opportunityId?: string
  }) {
    if (data.type) {
      this.form.selectOption('type', data.type)
    }
    if (data.subject) {
      this.form.typeInField('subject', data.subject)
    }
    if (data.description) {
      this.form.typeInTextarea('description', data.description)
    }
    if (data.dueDate) {
      this.form.fillDate('dueDate', data.dueDate)
    }
    if (data.contactId) {
      this.form.selectOption('contactId', data.contactId)
    }
    if (data.companyId) {
      this.form.selectOption('companyId', data.companyId)
    }
    if (data.opportunityId) {
      this.form.selectOption('opportunityId', data.opportunityId)
    }
    return this
  }

  /**
   * Submit the activity form
   */
  submitForm() {
    this.form.submit()
    return this
  }

  /**
   * Mark activity as complete
   */
  markComplete() {
    cy.get('[data-cy="activity-complete-btn"]').click()
    return this
  }
}

export default ActivitiesPOM
