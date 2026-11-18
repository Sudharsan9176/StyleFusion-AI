import os
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(BASE_DIR, '.env'))


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'change_this_secret')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'change_this_jwt_secret')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'fashion_store.db')}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = os.path.join(BASE_DIR, os.getenv('UPLOAD_FOLDER', 'uploads'))
    GENERATED_FOLDER = os.path.join(BASE_DIR, os.getenv('GENERATED_FOLDER', 'generated'))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

    HF_API_TOKEN = os.getenv('HF_API_TOKEN', '').strip() or None
    HF_MODEL_ID = os.getenv('HF_MODEL_ID', 'yisol/IDM-VTON').strip()
    HF_API_URL = os.getenv('HF_API_URL', '').strip() or None
