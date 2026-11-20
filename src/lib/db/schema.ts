import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  date,
  jsonb,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  fullName: text('full_name'),
  clinicName: text('clinic_name'),
  phone: text('phone'),
  address: text('address'),
  country: text('country'),
  city: text('city'),
  /** Free-text sales rep the doctor named at sign-up; a hint for admins, never an assignment. */
  salesReferral: text('sales_referral'),
  linkedDoctorId: integer('linked_doctor_id'),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  createdBy: integer('created_by'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true, mode: 'date' }),
})

export const pendingRegistrations = pgTable('pending_registrations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  clinicName: text('clinic_name').notNull(),
  address: text('address').notNull(),
  phone: text('phone'),
  country: text('country'),
  city: text('city'),
  salesReferral: text('sales_referral'),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({ expiresIdx: index('pending_registrations_expires_idx').on(table.expiresAt) }))

export const signupRateLimits = pgTable('signup_rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({ expiresIdx: index('signup_rate_limits_expires_idx').on(table.expiresAt) }))

export const pendingPasswordResets = pgTable('pending_password_resets', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => ({
  userIdx: uniqueIndex('pending_password_resets_user_idx').on(table.userId),
  expiresIdx: index('pending_password_resets_expires_idx').on(table.expiresAt),
}))

export const doctorClinics = pgTable('doctor_clinics', {
  id: serial('id').primaryKey(),
  doctorId: integer('doctor_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const salesDoctorAssignments = pgTable('sales_doctor_assignments', {
  salesId: integer('sales_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  doctorId: integer('doctor_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  assignedBy: integer('assigned_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.salesId, table.doctorId] }),
  doctorIdx: index('sales_doctor_assignments_doctor_idx').on(table.doctorId),
}))

export const salesDirectorAssignments = pgTable('sales_director_assignments', {
  directorId: integer('director_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  salesId: integer('sales_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  assignedBy: integer('assigned_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.directorId, table.salesId] }),
  salesIdx: index('sales_director_assignments_sales_idx').on(table.salesId),
}))

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNo: text('order_no').notNull().unique(),
  dateSent: timestamp('date_sent', { withTimezone: true, mode: 'date' }).notNull(),
  dentist: text('dentist').notNull(),
  clinic: text('clinic').notNull(),
  email: text('email').notNull(),
  altEmail: text('alt_email'),
  phone: text('phone'),
  address: text('address'),
  billingAddress: text('billing_address'),
  patientName: text('patient_name').notNull(),
  patientDob: date('patient_dob', { mode: 'string' }),
  patientAge: text('patient_age'),
  sex: text('sex'),
  dateRequired: date('date_required', { mode: 'string' }),
  isRepair: boolean('is_repair').default(false).notNull(),
  isRedo: boolean('is_redo').default(false).notNull(),
  isUrgent: boolean('is_urgent').default(false).notNull(),
  oldOrderNo: text('old_order_no'),
  treatmentType: text('treatment_type'),
  treatmentData: jsonb('treatment_data'),
  toothSelection: jsonb('tooth_selection'),
  instructions: text('instructions'),
  fileUrls: jsonb('file_urls'),
  productionFileUrls: jsonb('production_file_urls'),
  cloudDriveLink: text('cloud_drive_link'),
  cloudDriveLinks: jsonb('cloud_drive_links'),
  submittedBy: integer('submitted_by').references(() => adminUsers.id),
  status: text('status').default('pending').notNull(),
  notes: text('notes'),
  statusUpdatedAt: timestamp('status_updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  submittedByIdx: index('orders_submitted_by_idx').on(table.submittedBy),
}))

export const idesignOrders = pgTable('idesign_orders', {
  id: serial('id').primaryKey(),
  sourceKey: text('source_key').unique(),
  salespersonName: text('salesperson_name').notNull(),
  salesAccountId: integer('sales_account_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  country: text('country').notNull(),
  patientName: text('patient_name').notNull(),
  sourceUpdatedOn: date('source_updated_on', { mode: 'string' }),
  sourceCreatedOn: date('source_created_on', { mode: 'string' }),
  doctorName: text('doctor_name').notNull(),
  doctorAccountId: integer('doctor_account_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  latestProgress: text('latest_progress').notNull(),
  category: text('category').notNull(),
  purchasedProducts: text('purchased_products'),
  originalCurrency: text('original_currency'),
  originalPrice: text('original_price'),
  discount: text('discount'),
  totalAmount: text('total_amount'),
  paymentCurrency: text('payment_currency'),
  actualPayment: text('actual_payment'),
  paymentStatus: text('payment_status').notNull(),
  invoiceNo: text('invoice_no'),
  invoiceDate: date('invoice_date', { mode: 'string' }),
  paymentDate: date('payment_date', { mode: 'string' }),
  shippedDate: date('shipped_date', { mode: 'string' }),
  trackingNo: text('tracking_no'),
  deliveredDate: date('delivered_date', { mode: 'string' }),
  totalSteps: text('total_steps'),
  producedSteps: text('produced_steps'),
  salesCommissionRate: text('sales_commission_rate'),
  attributedMonth: text('attributed_month'),
  salesCommission: text('sales_commission'),
  orderNo: text('order_no'),
  dueDate: date('due_date', { mode: 'string' }),
  invoiceFileUrl: text('invoice_file_url'),
  invoiceFileName: text('invoice_file_name'),
  paymentLink: text('payment_link'),
  // Finance rows created automatically for new orders link back to their source (one row per order).
  caseId: integer('case_id').references((): AnyPgColumn => idesignCases.id, { onDelete: 'set null' }),
  dentalOrderId: integer('dental_order_id').references(() => orders.id, { onDelete: 'set null' }),
  assignmentUpdatedBy: integer('assignment_updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  assignmentUpdatedAt: timestamp('assignment_updated_at', { withTimezone: true, mode: 'date' }),
  createdBy: integer('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index('idesign_orders_category_idx').on(table.category),
  progressIdx: index('idesign_orders_progress_idx').on(table.latestProgress),
  doctorNameIdx: index('idesign_orders_doctor_name_idx').on(table.doctorName),
  createdOnIdx: index('idesign_orders_created_on_idx').on(table.sourceCreatedOn),
  salesAccountIdx: index('idesign_orders_sales_account_idx').on(table.salesAccountId),
  doctorAccountIdx: index('idesign_orders_doctor_account_idx').on(table.doctorAccountId),
  caseIdx: uniqueIndex('idesign_orders_case_idx').on(table.caseId),
  dentalOrderIdx: uniqueIndex('idesign_orders_dental_order_idx').on(table.dentalOrderId),
}))

export const idesignCases = pgTable('idesign_cases', {
  id: serial('id').primaryKey(),
  importedOrderId: integer('imported_order_id').references(() => idesignOrders.id, { onDelete: 'cascade' }),
  orderNo: text('order_no').notNull().unique(),
  orderType: text('order_type').default('clear_aligner').notNull(),
  patientName: text('patient_name').notNull(),
  gender: text('gender'),
  dateOfBirth: date('date_of_birth', { mode: 'string' }),
  fileUrls: jsonb('file_urls').notNull().default({}),
  dentitionStage: text('dentition_stage'),
  chiefComplaints: jsonb('chief_complaints').notNull().default([]),
  extractionTeeth: jsonb('extraction_teeth').notNull().default([]),
  lockedTeeth: jsonb('locked_teeth').notNull().default([]),
  attachmentRestrictedTeeth: jsonb('attachment_restricted_teeth').notNull().default([]),
  iprRestrictedTeeth: jsonb('ipr_restricted_teeth').notNull().default([]),
  reserveSpaceTeeth: jsonb('reserve_space_teeth').notNull().default([]),
  reserveSpaceGaps: jsonb('reserve_space_gaps').notNull().default([]),
  maxillaryMidline: text('maxillary_midline'),
  mandibularMidline: text('mandibular_midline'),
  leftRelationship: text('left_relationship'),
  rightRelationship: text('right_relationship'),
  posteriorExpansionNotAllowed: jsonb('posterior_expansion_not_allowed').notNull().default({}),
  iprNotAllowed: jsonb('ipr_not_allowed').notNull().default({}),
  molarDistalizationNotAllowed: jsonb('molar_distalization_not_allowed').notNull().default({}),
  remarks: text('remarks'),
  currentEditableUrl: text('current_editable_url'),
  planReviewStatus: text('plan_review_status').default('no_plan').notNull(),
  latestProgress: text('latest_progress').default('Entering Info').notNull(),
  createdBy: integer('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  doctorAccountId: integer('doctor_account_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  salesAccountId: integer('sales_account_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  importedOrderIdx: uniqueIndex('idesign_cases_imported_order_idx').on(table.importedOrderId),
  doctorAccountIdx: index('idesign_cases_doctor_account_idx').on(table.doctorAccountId),
  salesAccountIdx: index('idesign_cases_sales_account_idx').on(table.salesAccountId),
  createdAtIdx: index('idesign_cases_created_at_idx').on(table.createdAt),
}))

export const idesignTreatmentPlans = pgTable('idesign_treatment_plans', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').references(() => idesignCases.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),
  summary: text('summary'),
  editableUrl: text('editable_url'),
  status: text('status').default('published').notNull(),
  createdBy: integer('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  approvedBy: integer('approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  caseVersionIdx: uniqueIndex('idesign_treatment_plans_case_version_idx').on(table.caseId, table.versionNumber),
  casePublishedIdx: index('idesign_treatment_plans_case_published_idx').on(table.caseId, table.publishedAt),
}))

export const idesignCaseActivities = pgTable('idesign_case_activities', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').references(() => idesignCases.id, { onDelete: 'cascade' }).notNull(),
  eventType: text('event_type').notNull(),
  detail: text('detail').notNull(),
  actorId: integer('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  actorRole: text('actor_role').notNull(),
  actorName: text('actor_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  caseCreatedIdx: index('idesign_case_activities_case_created_idx').on(table.caseId, table.createdAt),
}))

export const idesignTreatmentCourses = pgTable('idesign_treatment_courses', {
  id: serial('id').primaryKey(),
  caseId: integer('case_id').references(() => idesignCases.id, { onDelete: 'cascade' }).notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  totalSteps: integer('total_steps').notNull(),
  defaultDurationDays: integer('default_duration_days').default(10).notNull(),
  currentStep: integer('current_step').default(1).notNull(),
  originalEstimatedFinish: date('original_estimated_finish', { mode: 'string' }).notNull(),
  currentEstimatedFinish: date('current_estimated_finish', { mode: 'string' }).notNull(),
  nextSuggestedChange: date('next_suggested_change', { mode: 'string' }),
  timezone: text('timezone').default('Asia/Jakarta').notNull(),
  status: text('status').default('active').notNull(),
  createdBy: integer('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  caseIdx: uniqueIndex('idesign_treatment_courses_case_idx').on(table.caseId),
  reminderIdx: index('idesign_treatment_courses_reminder_idx').on(table.status, table.nextSuggestedChange),
}))

export const idesignTreatmentSteps = pgTable('idesign_treatment_steps', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').references(() => idesignTreatmentCourses.id, { onDelete: 'cascade' }).notNull(),
  stepNumber: integer('step_number').notNull(),
  durationDays: integer('duration_days').notNull(),
  suggestedStartDate: date('suggested_start_date', { mode: 'string' }).notNull(),
  suggestedEndDate: date('suggested_end_date', { mode: 'string' }).notNull(),
  actualStartDate: date('actual_start_date', { mode: 'string' }),
  status: text('status').default('scheduled').notNull(),
  confirmedBy: integer('confirmed_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true, mode: 'date' }),
}, (table) => ({
  courseStepIdx: uniqueIndex('idesign_treatment_steps_course_step_idx').on(table.courseId, table.stepNumber),
}))

export const idesignNotifications = pgTable('idesign_notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  caseId: integer('case_id').references(() => idesignCases.id, { onDelete: 'cascade' }).notNull(),
  eventType: text('event_type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  dedupeKey: text('dedupe_key').notNull(),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  dedupeIdx: uniqueIndex('idesign_notifications_dedupe_idx').on(table.userId, table.dedupeKey),
  userCreatedIdx: index('idesign_notifications_user_created_idx').on(table.userId, table.createdAt),
}))

export const orderActivities = pgTable('order_activities', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  eventType: text('event_type').notNull(),
  detail: text('detail').notNull(),
  actorId: integer('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  actorRole: text('actor_role').notNull(),
  actorName: text('actor_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const orderDrafts = pgTable('order_drafts', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  formData: jsonb('form_data').notNull(),
  fileUrls: jsonb('file_urls').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const orderMessages = pgTable('order_messages', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  senderId: integer('sender_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  senderRole: text('sender_role').notNull(),
  message: text('message'),
  imageUrl: text('image_url'),
  imageName: text('image_name'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  latestByOrderIdx: index('order_messages_latest_by_order_idx').on(table.orderId, table.createdAt, table.id),
}))

export const orderMessageReads = pgTable('order_message_reads', {
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.orderId, table.userId] }),
}))

export const sharedLinks = pgTable('shared_links', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  token: text('token').notNull().unique(),
  createdBy: integer('created_by').references(() => adminUsers.id),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  downloadCount: integer('download_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const larkNotifications = pgTable('lark_notifications', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull().unique(),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedBy: integer('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export const sidebarBanners = pgTable('sidebar_banners', {
  id: serial('id').primaryKey(),
  imageUrl: text('image_url').notNull(),
  linkUrl: text('link_url'),
  altText: text('alt_text').default('BrightArk promotion').notNull(),
  position: integer('position').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  positionIdx: index('sidebar_banners_position_idx').on(table.position),
}))

/**
 * Mini CRM: one row per (sales rep, doctor). Rows either come from a registered doctor
 * assigned to the rep (source 'registered') or were added by the rep (source 'sales').
 * A sales-added row is linked to the doctor's account by email once the doctor registers.
 */
export const crmDoctors = pgTable('crm_doctors', {
  id: serial('id').primaryKey(),
  salesId: integer('sales_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  doctorAccountId: integer('doctor_account_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  clinicName: text('clinic_name'),
  country: text('country'),
  city: text('city'),
  address: text('address'),
  specialty: text('specialty'),
  avatarUrl: text('avatar_url'),
  /** KA | Non-KA | OEM | Distributor (shown as "Tag"). */
  accountType: text('account_type'),
  contractUrl: text('contract_url'),
  contractFileName: text('contract_file_name'),
  contractUploadedAt: timestamp('contract_uploaded_at', { withTimezone: true, mode: 'date' }),
  status: text('status').default('lead').notNull(),
  source: text('source').default('sales').notNull(),
  nextFollowUp: date('next_follow_up', { mode: 'string' }),
  notes: text('notes'),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  createdBy: integer('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  salesIdx: index('crm_doctors_sales_idx').on(table.salesId),
  accountIdx: index('crm_doctors_account_idx').on(table.doctorAccountId),
  followUpIdx: index('crm_doctors_follow_up_idx').on(table.nextFollowUp),
  salesAccountUnique: uniqueIndex('crm_doctors_sales_account_unique').on(table.salesId, table.doctorAccountId),
  salesEmailUnique: uniqueIndex('crm_doctors_sales_email_unique').on(table.salesId, sql`lower(${table.email})`),
}))

export const crmActivities = pgTable('crm_activities', {
  id: serial('id').primaryKey(),
  crmDoctorId: integer('crm_doctor_id').references(() => crmDoctors.id, { onDelete: 'cascade' }).notNull(),
  authorId: integer('author_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  kind: text('kind').default('note').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  doctorIdx: index('crm_activities_doctor_idx').on(table.crmDoctorId, table.createdAt),
}))

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type IDesignOrder = typeof idesignOrders.$inferSelect
export type NewIDesignOrder = typeof idesignOrders.$inferInsert
export type IDesignCase = typeof idesignCases.$inferSelect
export type NewIDesignCase = typeof idesignCases.$inferInsert
export type IDesignTreatmentPlan = typeof idesignTreatmentPlans.$inferSelect
export type IDesignCaseActivity = typeof idesignCaseActivities.$inferSelect
export type IDesignTreatmentCourse = typeof idesignTreatmentCourses.$inferSelect
export type IDesignTreatmentStep = typeof idesignTreatmentSteps.$inferSelect
export type IDesignNotification = typeof idesignNotifications.$inferSelect
export type OrderDraft = typeof orderDrafts.$inferSelect
export type OrderMessage = typeof orderMessages.$inferSelect
export type OrderMessageRead = typeof orderMessageReads.$inferSelect
export type OrderActivity = typeof orderActivities.$inferSelect
export type AdminUser = typeof adminUsers.$inferSelect
export type DoctorClinic = typeof doctorClinics.$inferSelect
export type SalesDoctorAssignment = typeof salesDoctorAssignments.$inferSelect
export type SalesDirectorAssignment = typeof salesDirectorAssignments.$inferSelect
export type SharedLink = typeof sharedLinks.$inferSelect
export type LarkNotification = typeof larkNotifications.$inferSelect
export type SidebarBanner = typeof sidebarBanners.$inferSelect
export type AppSetting = typeof appSettings.$inferSelect
export type CrmDoctor = typeof crmDoctors.$inferSelect
export type CrmActivity = typeof crmActivities.$inferSelect

/**
 * Per-account Finance page lock for doctors and clinic staff. A missing row means the account has not
 * gone through the first-visit setup yet. staffVisible only matters on a doctor's row: it lets the
 * doctor's linked clinic staff open Finance (hidden by default).
 */
export const financeAccess = pgTable('finance_access', {
  userId: integer('user_id').primaryKey().references(() => adminUsers.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash'),
  /** Bumped on every password change so older unlock tokens stop working. */
  passwordVersion: integer('password_version').default(0).notNull(),
  staffVisible: boolean('staff_visible').default(false).notNull(),
  setupAt: timestamp('setup_at', { withTimezone: true, mode: 'date' }),
  failedAttempts: integer('failed_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
  resetTokenHash: text('reset_token_hash'),
  resetExpiresAt: timestamp('reset_expires_at', { withTimezone: true, mode: 'date' }),
  resetSentAt: timestamp('reset_sent_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

/**
 * Clear aligner production progress, one row per case. Aligners are produced in batches of 10 stages;
 * the next batch is due 80 days after the current one was delivered. deliveredBatch is 1 for stages 1-10,
 * 2 for 11-20, and so on; RETAINER_BATCH (src/lib/idesign/production.ts) marks the retainer as delivered.
 */
export const alignerProduction = pgTable('aligner_production', {
  caseId: integer('case_id').primaryKey().references(() => idesignCases.id, { onDelete: 'cascade' }),
  totalStages: integer('total_stages'),
  deliveredBatch: integer('delivered_batch'),
  batchDeliveredOn: date('batch_delivered_on', { mode: 'string' }),
  /** The batch the due reminder was sent for; a reminder goes out once per order per batch. */
  notifiedBatch: integer('notified_batch'),
  notifiedAt: timestamp('notified_at', { withTimezone: true, mode: 'date' }),
  updatedBy: integer('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})
