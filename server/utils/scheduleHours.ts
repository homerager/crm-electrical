const SHIFT_DEFAULT_HOURS: Record<string, number> = {
  FULL_DAY: 8,
  MORNING: 4,
  AFTERNOON: 4,
}

export function getScheduleHours(shift: string, customHours?: number | null): number {
  if (customHours != null && customHours > 0) return customHours
  return SHIFT_DEFAULT_HOURS[shift] ?? 8
}
