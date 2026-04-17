from routes import json_search
import json
import time

t0 = time.time()
res = json_search("my boyfriend is very abusive and constantly cheats on me")
t1 = time.time()

print(f"Time taken: {t1 - t0:.3f}s")
print(json.dumps(res, indent=2))
