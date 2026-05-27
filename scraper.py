from curl_cffi import requests
import json
import re
import os

# Danh sách ID cầu thủ trên Understat
PLAYERS = [
    {"id": 447, "name": "De Bruyne"},
    {"id": 1228, "name": "Bruno Fernandes"},
    {"id": 8456, "name": "Odegaard"}
]

def fetch_understat_data():
    for player in PLAYERS:
        pid = player["id"]
        print(f"⏳ Đang lấy data của {player['name']} (ID: {pid})...")
        url = f"https://understat.com/player/{pid}"
        
        try:
            # VŨ KHÍ TỐI THƯỢNG: Giả lập trọn vẹn vân tay của Google Chrome 110
            # Đánh lừa hoàn toàn tường lửa Cloudflare
            res = requests.get(url, impersonate="chrome110")
            
            # Bóc tách biến groupsData giấu trong HTML
            match = re.search(r"var groupsData\s*=\s*JSON\.parse\('(.*?)'\)", res.text)
            
            if match:
                hex_data = match.group(1)
                # Giải mã \x22 về dấu nháy kép
                decoded = re.sub(r'\\x([0-9a-fA-F]{2})', lambda m: chr(int(m.group(1), 16)), hex_data)
                
                json_data = json.loads(decoded)
                
                # Lưu file json
                filename = f"data_{pid}.json"
                with open(filename, "w", encoding="utf-8") as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=4)
                print(f"✅ Thành công: Đã lưu {filename}")
            else:
                print(f"❌ Vẫn không thấy data. Cloudflare gắt quá!")
                
        except Exception as e:
            print(f"⚠️ Lỗi kết nối ID {pid}: {e}")

if __name__ == "__main__":
    fetch_understat_data()