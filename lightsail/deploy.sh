#!/usr/bin/env bash
# Polly — deploy the web container to a Lightsail container service.
#
#   ./lightsail/deploy.sh
#
# Prerequisites:
#   - docker, AWS CLI, and the lightsailctl plugin (for push-container-image)
#   - AWS credentials with Lightsail access (aws configure / env vars)
#   - .env.production in the repo root with the real values from
#     lightsail/ENV_CHECKLIST.md (never commit it)
#   - lightsail/containers.json + lightsail/public-endpoint.json (templates)
#
# What it does:
#   1. Creates the container service if it does not exist yet.
#   2. Builds the image (Dockerfile at the repo root).
#   3. Pushes it to the service's registry as label "web".
#   4. Deploys it, injecting the env vars from .env.production and
#      using :polly-web.web.latest (Lightsail resolves "latest" to the
#      highest pushed version).
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-polly-web}"
LABEL="${LABEL:-web}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for cmd in docker aws python3; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "missing required command: $cmd" >&2; exit 1; }
done
[ -f .env.production ] || { echo ".env.production not found — copy .env.example and fill in the real values (see lightsail/ENV_CHECKLIST.md)" >&2; exit 1; }

# Create the service if needed (idempotent).
if ! aws lightsail get-container-services --service-name "$SERVICE_NAME" >/dev/null 2>&1; then
  echo "Creating Lightsail container service $SERVICE_NAME ..."
  aws lightsail create-container-service \
    --service-name "$SERVICE_NAME" --power small --scale 1
fi

echo "Building image ..."
docker build -t polly-web:latest .

echo "Pushing image to Lightsail ..."
aws lightsail push-container-image \
  --service-name "$SERVICE_NAME" --label "$LABEL" --image polly-web:latest

echo "Deploying ..."
python3 - "$SERVICE_NAME" <<'PYEOF'
import json, sys

service = sys.argv[1]
env = {}
with open(".env.production") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

required = ["DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
missing = [k for k in required if not env.get(k) or env[k].startswith("REPLACE_ME") or "your-" in env[k] or "placeholder" in env[k].lower()]
if missing:
    print(f"Missing or placeholder values in .env.production: {', '.join(missing)}", file=sys.stderr)
    sys.exit(1)

with open("lightsail/containers.json") as f:
    containers = json.load(f)

containers["web"]["environment"] = {
    "NODE_ENV": "production",
    "DATABASE_URL": env["DATABASE_URL"],
    "DIRECT_URL": env["DIRECT_URL"],
    "NEXT_PUBLIC_SUPABASE_URL": env["NEXT_PUBLIC_SUPABASE_URL"],
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    "SUPABASE_SERVICE_ROLE_KEY": env["SUPABASE_SERVICE_ROLE_KEY"],
}
with open("/tmp/polly-containers.json", "w") as f:
    json.dump(containers, f)
print("Wrote /tmp/polly-containers.json")
PYEOF

aws lightsail create-container-service-deployment \
  --service-name "$SERVICE_NAME" \
  --containers file:///tmp/polly-containers.json \
  --public-endpoint file://lightsail/public-endpoint.json

echo "Deploy requested. Watch it with:"
echo "  aws lightsail get-container-service-deployments --service-name $SERVICE_NAME"
echo "Then add the public URL to the Supabase redirect URLs (see lightsail/ENV_CHECKLIST.md step 1.6)."
