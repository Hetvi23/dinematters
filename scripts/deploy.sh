#!/bin/bash
set -e

# ============================================================
# DineMatters Robust Deployment Script (V2 - Repo Controlled)
# ============================================================

BENCH_PATH="/home/frappe/frappe-bench"
APP_PATH="${BENCH_PATH}/apps/dinematters"
SITE="backend.dinematters.com"
GIT_BRANCH="${1:-main}"

echo "============================================================"
echo "DineMatters Robust Deployment — Site: $SITE | Branch: $GIT_BRANCH"
echo "============================================================"

# ─── 1. Inject site_config.json (Database Shield) ─────────────────────────
if [ -n "$SITE_CONFIG_JSON" ]; then
    echo "Synchronizing site_config.json with Database Shield..."
    
    # Ensure jq is available
    if ! command -v jq &> /dev/null; then
        echo "Installing jq for configuration merging..."
        sudo apt-get update -qq && sudo apt-get install -y jq -qq
    fi
    
    # Merge strategy: Update all keys EXCEPT critical database credentials which are server-owned
    MERGE_CMD='.[0] as $server | .[1] as $secret | ($server * $secret) + {
        db_name: ($server.db_name // $secret.db_name),
        db_password: ($server.db_password // $secret.db_password),
        db_host: ($server.db_host // $secret.db_host),
        db_type: ($server.db_type // $secret.db_type),
        encryption_key: ($server.encryption_key // $secret.encryption_key)
    }'
    
    SITE_DIR="$BENCH_PATH/sites/$SITE"
    CONFIG_FILE="$SITE_DIR/site_config.json"
    
    if [ -f "$CONFIG_FILE" ]; then
        jq -s "$MERGE_CMD" "$CONFIG_FILE" <(echo "$SITE_CONFIG_JSON") > "$CONFIG_FILE.tmp"
        mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
        echo "Configuration synchronized successfully."
    else
        echo "Warning: site_config.json not found at $CONFIG_FILE. Skipping merge."
    fi
fi

# ─── 2. Robust Code Update (Force Sync) ────────────────────────────────────
echo "Synchronizing repository (Hard Reset)..."
cd "$APP_PATH"

# Clear any local noise before fetching
git reset --hard HEAD
git clean -fd

# Identify remote
REMOTE=$(git remote | grep -E "upstream|origin" | head -1 || echo "origin")
echo "Fetching from $REMOTE..."
git fetch "$REMOTE" "$GIT_BRANCH"

# Force reset to target branch
git reset --hard "$REMOTE/$GIT_BRANCH"
echo "Code synced to $(git rev-parse --short HEAD)"

# ─── 3. Backend Setup ────────────────────────────────────────────────────────
echo "Installing Python dependencies & Migrating..."
cd "$BENCH_PATH"
./env/bin/pip install -e apps/dinematters --quiet
bench --site "$SITE" migrate
bench --site "$SITE" enable-scheduler || true

# ─── 4. Frontend Build (Merchant Dashboard) ──────────────────────────────────
echo "Building Merchant Dashboard..."
cd "$APP_PATH/frontend"

# Use yarn if available, fallback to npm
if [ -f "yarn.lock" ]; then
    yarn install --frozen-lockfile --quiet
    yarn build
else
    npm install --quiet
    npm run build
fi

# ─── 5. Production Assets & Cache ───────────────────────────────────────────
echo "Finalizing production assets..."
cd "$BENCH_PATH"
bench build --app dinematters
bench --site "$SITE" clear-cache

# ─── 6. Service Restart ──────────────────────────────────────────────────────
echo "Restarting services..."
if command -v supervisorctl &> /dev/null; then
    sudo supervisorctl restart all || bench restart
else
    bench restart
fi

echo "============================================================"
echo "DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "============================================================"
