import type { LatLng } from './types';

/**
 * Geocode the user's start location using Nominatim.
 * Appends destination city for accuracy (prevents wrong-country results).
 */
export async function geocodeStartLocation(
  location: string,
  destination?: string,
): Promise<LatLng | null> {
  if (!location.trim()) return null;

  // Combine with destination city for much better accuracy
  const query = destination ? `${location}, ${destination}` : location;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'NomadAI/1.0' },
    });
    if (!resp.ok) return null;
    const results = await resp.json();
    if (!results.length) {
      // If no result with destination context, try without
      if (destination) return geocodeStartLocation(location);
      return null;
    }
    return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}
