import { sql } from 'drizzle-orm'
import { orderMessageReads, orderMessages, orders } from '@/lib/db/schema'

export function hasUnreadOrderMessage(userId: number) {
  return sql<boolean>`exists (
    select 1
    from ${orderMessages}
    where ${orderMessages.orderId} = ${orders.id}
      and (${orderMessages.senderId} is null or ${orderMessages.senderId} <> ${userId})
      and ${orderMessages.createdAt} > coalesce(
        (
          select ${orderMessageReads.readAt}
          from ${orderMessageReads}
          where ${orderMessageReads.orderId} = ${orders.id}
            and ${orderMessageReads.userId} = ${userId}
        ),
        to_timestamp(0)
      )
  )`.as('has_unread_message')
}
