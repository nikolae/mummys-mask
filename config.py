import os

PORT = int(os.environ.get("PORT", 5050))
DB_PATH = os.environ.get("DB_PATH", "/data/mummys_mask.db")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"
