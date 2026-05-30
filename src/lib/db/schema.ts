import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  date,
  jsonb,
} from 'drizzle-orm/pg-core'

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNo: text('order_no').notNull().unique(),
  dateSent: timestamp('date_sent', { withTimezone: true, mode: 'date' }).notNull(),
  dentist: text('dentist').notNull(),
  clinic: text('clinic').notNull(),
  patientName: text('patient_name').notNull(),
  patientDob: date('patient_dob', { mode: 'string' }).notNull(),
  sex: text('sex'),
  dateRequired: date('date_required', { mode: 'string' }).notNull(),
  isRepair: boolean('is_repair').default(false).notNull(),
  isRedo: boolean('is_redo').default(false).notNull(),
  isUrgent: boolean('is_urgent').default(false).notNull(),
  oldOrderNo: text('old_order_no'),
  treatmentType: text('treatment_type'),
  treatmentData: jsonb('treatment_data'),
  toothSelection: jsonb('tooth_selection'),
  instructions: text('instructions'),
  fileUrls: jsonb('file_urls'),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
})

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
