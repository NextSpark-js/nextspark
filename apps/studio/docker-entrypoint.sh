#!/bin/sh
# Fix ownership of mounted volumes (runs as root, then drops to studio)
chown -R studio:studio /app/studio-projects 2>/dev/null || true
exec su-exec studio "$@"
