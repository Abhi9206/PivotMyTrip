/**
 * NomadAI utility helpers
 */

/**
 * Format a distance in meters to a human-readable string.
 * < 1 km → "Xm", >= 1 km → "X.Xkm"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Format minutes to a human-readable duration string.
 * < 60 → "Xmin", >= 60 → "Xh Ymin"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}min`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function categoryEmoji(category: string): string {
  switch (category) {
    case 'culture':
    case 'history':
    case 'art':
      return '🏛️';
    case 'food':
      return '🍽️';
    case 'nature':
      return '🌿';
    case 'shopping':
      return '🛍️';
    case 'entertainment':
      return '🎭';
    case 'nightlife':
      return '🌙';
    case 'adventure':
      return '⛰️';
    case 'architecture':
      return '🏙️';
    case 'transport':
      return '🚌';
    case 'accommodation':
      return '🛌';
    default:
      return '📍';
  }
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generate a random short ID.
 */
export function shortId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Capitalize first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Debounce a function call.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
