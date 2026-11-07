/** Current time for server-side date filters; called once per request. */
export function currentDate(): Date {
  return new Date()
}
