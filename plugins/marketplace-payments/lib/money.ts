/**
 * MercadoPago takes and returns amounts in major units (12.34); everything else in the plugin is in integer minor
 * units. The conversion happens at that boundary only.
 */

const MERCADOPAGO_CURRENCY_DECIMALS: Record<string, number> = {
  ARS: 2,
  BRL: 2,
  CLP: 0,
  COP: 2,
  MXN: 2,
  PEN: 2,
  UYU: 2,
}

function decimalsOf(currency: string): number {
  const decimals = MERCADOPAGO_CURRENCY_DECIMALS[currency.toUpperCase()]
  if (decimals === undefined) throw new RangeError(`Currency ${currency} is not supported by MercadoPago`)
  return decimals
}

export function minorToMajor(cents: number, currency: string): number {
  return cents / 10 ** decimalsOf(currency)
}

export function majorToMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** decimalsOf(currency))
}
