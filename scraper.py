import requests
import json
import re
import os

# Danh sách ID cầu thủ trên Understat (Có thể thêm hàng loạt vào đây)
PLAYERS = [
    {"id": 447, "name": "De Bruyne"},
    {"id": 1228, "name": "Bruno Fernandes"},
    {"id": 8456, "name": "Odegaard"}
]

def fetch_understat_data():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    for player in PLAYERS:
        pid = player["id"]
        print(f"⏳ Đang lấy data của {player['name']} (ID: {pid})...")
        url = f"https://understat.com/player/{pid}"
        
        try:
            res = requests.get(url, headers=headers)
            res.raise_for_status()
            
            # Bóc tách biến groupsData giấu trong HTML
            match = re.search(r"var groupsData\s*=\s*JSON\.parse\('(.*?)'\)", res.text)
            
            if match:
                hex_data = match.group(1)
                # Giải mã \x22 về dấu nháy kép
                decoded = re.sub(r'\\x([0-9a-fA-F]{2})', lambda m: chr(int(m.group(1), 16)), hex_data)
                
                json_data = json.loads(decoded)
                
                # Lưu file ngay tại thư mục gốc để Github Pages và JS dễ đọc
                filename = f"data_{pid}.json"
                with open(filename, "w", encoding="utf-8") as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=4)
                print(f"✅ Thành công: Đã lưu {filename}")
            else:
                print(f"❌ Không tìm thấy data cho {player['name']}")
                
        except Exception as e:
            print(f"⚠️ Lỗi kết nối ID {pid}: {e}")

if __name__ == "__main__":
    fetch_understat_data()