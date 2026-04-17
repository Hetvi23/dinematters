import math

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the straight-line distance between two points on Earth using the Haversine formula.
    Returns distance in kilometers.
    """
    if None in [lat1, lon1, lat2, lon2]:
        return 0
    
    try:
        lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    except ValueError:
        return 0

    R = 6371.0  # Earth radius in KM

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2)**2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def estimate_road_distance(straight_distance, multiplier=1.25):
    """
    Apply a circuity factor to estimate actual road distance from straight-line distance.
    1.25 is a standard multiplier for Indian urban areas.
    """
    return straight_distance * multiplier
