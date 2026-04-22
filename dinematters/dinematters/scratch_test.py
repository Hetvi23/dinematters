import requests
import json

def test_osrm():
    # Restaurant (Vikhroli)
    lat1, lon1 = 19.1141947, 72.9361624
    # Customer (Kanjurmarg East)
    lat2, lon2 = 19.1306, 72.9360
    
    print(f"Testing OSRM from {lat1},{lon1} to {lat2},{lon2}")
    
    url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
    try:
        res = requests.get(url, timeout=10)
        data = res.json()
        print("--- OSRM Response ---")
        print(json.dumps(data, indent=2))
        
        if data.get("code") == "Ok":
            dist_km = data["routes"][0]["distance"] / 1000.0
            print(f"Real Road Distance: {dist_km:.2f} km")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_osrm()
