import math

from geoalchemy2.elements import WKTElement


def make_polygon_from_points(points: list[tuple[float, float]]) -> tuple[WKTElement, float]:
    """A real surveyed boundary: the farmer walks the edge of their plot and
    drops a pin at each corner, rather than us approximating a square around
    a single centre point (see make_square_polygon below, kept as the
    fallback for when walking isn't practical).

    Area is computed via the shoelace formula on an equirectangular
    projection centred at the boundary's mean latitude — accurate enough for
    plots at farm scale, without pulling in a full geodesic library.
    """
    if len(points) < 3:
        raise ValueError("A boundary needs at least 3 points.")
    ring = list(points)
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    wkt = "POLYGON((" + ", ".join(f"{lon} {lat}" for lat, lon in ring) + "))"

    mean_lat = sum(lat for lat, _ in points) / len(points)
    m_per_deg_lat = 111_320
    m_per_deg_lon = 111_320 * abs(math.cos(math.radians(mean_lat)))
    xy = [(lon * m_per_deg_lon, lat * m_per_deg_lat) for lat, lon in points]
    area_m2 = 0.0
    n = len(xy)
    for i in range(n):
        x1, y1 = xy[i]
        x2, y2 = xy[(i + 1) % n]
        area_m2 += x1 * y2 - x2 * y1
    area_ha = abs(area_m2) / 2 / 10_000
    return WKTElement(wkt, srid=4326), round(area_ha, 4)


_EARTH_RADIUS_M = 6_371_000


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points — used to flag a field photo
    taken somewhere other than the plot it claims to be of (B-photo-geo)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


def make_square_polygon(center_lat: float, center_lon: float, side_m: float) -> tuple[WKTElement, float]:
    """A small square plot around (center_lat, center_lon). Returns (geometry, area_ha).

    Used both for demo seeding and for real plot registration from a mobile
    GPS pin + an approximate side length — a reasonable stand-in for full
    polygon drawing (W-11, web) until that exists.
    """
    half = side_m / 2
    dlat = half / 111_320  # metres per degree latitude, ~constant
    dlon = half / (111_320 * abs(math.cos(math.radians(center_lat))))
    corners = [
        (center_lon - dlon, center_lat - dlat),
        (center_lon + dlon, center_lat - dlat),
        (center_lon + dlon, center_lat + dlat),
        (center_lon - dlon, center_lat + dlat),
        (center_lon - dlon, center_lat - dlat),
    ]
    wkt = "POLYGON((" + ", ".join(f"{lon} {lat}" for lon, lat in corners) + "))"
    area_ha = (side_m * side_m) / 10_000
    return WKTElement(wkt, srid=4326), round(area_ha, 4)
