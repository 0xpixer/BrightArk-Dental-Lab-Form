import { sql } from 'drizzle-orm'
import { orderMessageReads, orderMessages, orders } from '@/lib/db/schema'

export function hasUnreadOrderMessage(userId: number) {
  return unreadLatestOrderMessageCondition(userId).as('has_unread_message')
}

export function unreadLatestOrderMessageCondition(userId: number) {
  return sql<boolean>`exists (
    select 1
    from ${orderMessages} latest_message
    where latest_message.id = (
        select message.id
        from ${orderMessages} message
        where message.order_id = ${orders.id}
        order by message.created_at desc, message.id desc
        limit 1
      )
      and (latest_message.sender_id is null or latest_message.sender_id <> ${userId})
      and latest_message.created_at > coalesce(
        (
          select ${orderMessageReads.readAt}
          from ${orderMessageReads}
          where ${orderMessageReads.orderId} = ${orders.id}
            and ${orderMessageReads.userId} = ${userId}
        ),
        to_timestamp(0)
      )
  )`
}

export function latestOrderMessageAt() {
  return sql<Date | null>`(
    select message.created_at
    from ${orderMessages} message
    where message.order_id = ${orders.id}
    order by message.created_at desc, message.id desc
    limit 1
  )`
}
