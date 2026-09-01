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
  primaryKey,
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

export const salesDoctorAssignments = pgTable('sales_doctor_assignments', {
  salesId: integer('sales_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  doctorId: integer('doctor_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  assignedBy: integer('assigned_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.salesId, table.doctorId] }),
  doctorIdx: index('sales_doctor_assignments_doctor_idx').on(table.doctorId),
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
  caseId: text('case_id'),
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

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type IDesignOrder = typeof idesignOrders.$inferSelect
export type NewIDesignOrder = typeof idesignOrders.$inferInsert
export type OrderDraft = typeof orderDrafts.$inferSelect
export type OrderMessage = typeof orderMessages.$inferSelect
export type OrderMessageRead = typeof orderMessageReads.$inferSelect
export type OrderActivity = typeof orderActivities.$inferSelect
export type AdminUser = typeof adminUsers.$inferSelect
export type DoctorClinic = typeof doctorClinics.$inferSelect
export type SalesDoctorAssignment = typeof salesDoctorAssignments.$inferSelect
export type SharedLink = typeof sharedLinks.$inferSelect
export type LarkNotification = typeof larkNotifications.$inferSelect
