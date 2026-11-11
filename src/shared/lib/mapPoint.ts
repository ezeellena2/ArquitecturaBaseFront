// A point on the map: a location answer of a form (UB4-A) or a location received by WhatsApp (W1-A), the same in both.
export interface MapPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/** «-34.603722, -58.381592»: a point and six decimals, the same in every language. */
export function formatCoordinates(point: MapPoint): string {
  return point.latitude.toFixed(6) + ", " + point.longitude.toFixed(6);
}

/** The fixed destination of «Ver en el mapa»: Google Maps with the point, without asking any service. */
export function mapUrl(point: MapPoint): string {
  return "https://www.google.com/maps?q=" + point.latitude.toFixed(6) + "," + point.longitude.toFixed(6);
}
