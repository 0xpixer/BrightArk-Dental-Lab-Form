export function redactOrderForLabAdmin<T extends {
  email: unknown
  clinic: unknown
  address: unknown
  billingAddress: unknown
}>(order: T): Omit<T, 'email' | 'clinic' | 'address' | 'billingAddress'> {
  const { email: _email, clinic: _clinic, address: _address, billingAddress: _billingAddress, ...visibleOrder } = order
  return visibleOrder
}
