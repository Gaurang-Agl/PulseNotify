#!/usr/bin/env python
"""Django command-line utility."""
import os
import sys

from decouple import config


def main():
    """Run administrative tasks."""
    os.environ.setdefault(
        "DJANGO_SETTINGS_MODULE",
        config(
            "DJANGO_SETTINGS_MODULE",
            default="config.settings.local",
        ),
    )

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Is it installed and "
            "available on your Python path?"
        ) from exc

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
