from decouple import AutoConfig, Csv

from .base import *

production_config = AutoConfig(search_path=BASE_DIR)

DEBUG = False

ALLOWED_HOSTS = production_config(
    "ALLOWED_HOSTS",
    default="",
    cast=Csv(),
)

if not ALLOWED_HOSTS:
    raise RuntimeError(
        "Set ALLOWED_HOSTS in the production environment."
    )

CSRF_TRUSTED_ORIGINS = production_config(
    "CSRF_TRUSTED_ORIGINS",
    default="",
    cast=Csv(),
)

SECURE_SSL_REDIRECT = production_config(
    "SECURE_SSL_REDIRECT",
    default=True,
    cast=bool,
)

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
