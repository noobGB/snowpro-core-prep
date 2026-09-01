#!/bin/sh
# Runs as root (the image's default USER, overriding the old build-time `USER node`) specifically
# so this script can fix /data's ownership before dropping to the real runtime user. A cloud
# platform's freshly-attached volume (confirmed on Railway, issue #91) or a freshly-created local
# bind-mount host folder can both come up owned by a UID that doesn't match this image's `node`
# user — chown unconditionally on every boot rather than trying to detect the mismatch first; it's
# a no-op cost-wise for this app's small SQLite-backed data dir either way.
#
# /app and /content are NOT touched here — both get their correct ownership baked in at build time
# (see Dockerfile) and neither is ever a fresh volume mount target, so neither has this problem.
set -e

chown -R node:node /data

exec su-exec node "$@"
