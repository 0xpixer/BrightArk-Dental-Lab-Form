import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  date,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core'

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  fullName: text('full_name'),
  clinicName: text('clinic_name'),
  phone: text('phone'),
  address: text('address'),
  linkedDoctorId: integer('linked_doctor_id'),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  createdBy: integer('created_by'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
})

export const doctorClinics = pgTable('doctor_clinics', {
  id: serial('id').primaryKey(),
  doctorId: integer('doctor_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

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
  cloudDriveLink: text('cloud_drive_link'),
  submittedBy: integer('submitted_by').references(() => adminUsers.id),
  status: text('status').default('pending').notNull(),
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

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderDraft = typeof orderDrafts.$inferSelect
export type AdminUser = typeof adminUsers.$inferSelect
export type DoctorClinic = typeof doctorClinics.$inferSelect
export type SharedLink = typeof sharedLinks.$inferSelect
export type LarkNotification = typeof larkNotifications.$inferSelect
