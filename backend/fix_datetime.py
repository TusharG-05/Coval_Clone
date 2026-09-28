import re

file_path = "backend/src/backend/main.py"
with open(file_path, "r") as f:
    content = f.read()

# Add import for ZoneInfo if not present
if "from zoneinfo import ZoneInfo" not in content:
    content = content.replace("import datetime", "import datetime\nfrom zoneinfo import ZoneInfo")

# Replace datetime.datetime.now()
content = content.replace("datetime.datetime.now()", "datetime.datetime.now(ZoneInfo('Asia/Kolkata'))")

with open(file_path, "w") as f:
    f.write(content)
