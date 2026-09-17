import math

from geoalchemy2.elements import WKTElement


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
