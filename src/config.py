import os
from pathlib import Path

_CURRENT_DIR = Path(__file__).resolve().parent
_DEFAULT_INIT_JSON = _CURRENT_DIR / "init.json"

INIT_JSON_PATH = Path(os.getenv("INIT_JSON_PATH", _DEFAULT_INIT_JSON))

