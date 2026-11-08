#!/usr/bin/env bash
# V51.9.173 — one-time Google Cloud setup for AI Guru (Cloud Run + Cloud SQL PostgreSQL + Cloud Storage).
# Run it in Google Cloud Shell (console.cloud.google.com → the >_ button), from the app's folder:
#   PROJECT_ID=your-project-id bash scripts/cloud/setup-google-cloud.sh
# It asks for the admin password, the database password and your Gemini key; nothing is written to the repo.
# Safe to run again: steps that are already done are skipped.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID, e.g. PROJECT_ID=ai-guru-12345}"
REGION="${REGION:-asia-south1}"           # Mumbai
SQL_INSTANCE="${SQL_INSTANCE:-ai-guru-db}"
DB_NAME="${DB_NAME:-aiguru}"
DB_USER="${DB_USER:-aiguru}"
SQL_TIER="${SQL_TIER:-db-f1-micro}"       # the smallest; db-g1-small when classes grow
BUCKET="${BUCKET:-ai-guru-files-$PROJECT_ID}"
REPO="${REPO:-ai-guru}"
SA="ai-guru-run@$PROJECT_ID.iam.gserviceaccount.com"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
secret() { # name, value — creates the secret or adds a new version
  if gcloud secrets describe "$1" >/dev/null 2>&1; then printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else printf '%s' "$2" | gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null; fi
}

gcloud config set project "$PROJECT_ID" >/dev/null

say "1/7 Turning on the Google Cloud services AI Guru uses"
gcloud services enable run.googleapis.com sqladmin.googleapis.com storage.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com iam.googleapis.com iamcredentials.googleapis.com

say "2/7 The app's own account (it may use the database, the bucket and the secrets — nothing else)"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || gcloud iam service-accounts create ai-guru-run --display-name="AI Guru on Cloud Run"
for role in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role="$role" --condition=None >/dev/null
done

say "3/7 PostgreSQL database ($SQL_TIER, PostgreSQL 16, $REGION) — this step takes about 10 minutes the first time"
if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=enterprise --tier="$SQL_TIER" \
    --region="$REGION" --storage-size=10GB --storage-auto-increase --backup-start-time=20:30 --enable-point-in-time-recovery
fi
gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1 || gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"
read -rsp "Choose a database password (at least 16 characters): " DB_PASS; echo
gcloud sql users describe "$DB_USER" --instance="$SQL_INSTANCE" >/dev/null 2>&1 \
  && gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" \
  || gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS"
ENC_PASS=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$DB_PASS")
secret ai-guru-database-url "postgresql://$DB_USER:$ENC_PASS@/$DB_NAME?host=/cloudsql/$PROJECT_ID:$REGION:$SQL_INSTANCE"

say "4/7 Cloud Storage bucket for PDFs, photos, voices and videos (private)"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null
# V51.9.179: large PDFs go from the browser straight into the bucket with a 15-minute signed link.
#  - the app signs those links with its own account (needs "Service Account Token Creator" on itself)
#  - the browser may PUT to the bucket (CORS); the link itself is the permission
#  - uploads that were never indexed are deleted after 1 day
gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:$SA" --role=roles/iam.serviceAccountTokenCreator >/dev/null
CFG=$(mktemp -d)
cat > "$CFG/cors.json" <<'JSON'
[{"origin": ["*"], "method": ["PUT"], "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
JSON
cat > "$CFG/lifecycle.json" <<'JSON'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 1, "matchesPrefix": ["uploads/"]}}]}
JSON
gcloud storage buckets update "gs://$BUCKET" --cors-file="$CFG/cors.json" --lifecycle-file="$CFG/lifecycle.json" >/dev/null
rm -rf "$CFG"

say "5/7 Admin sign-in and keys (kept in Secret Manager, never in the code)"
read -rp  "Admin username: " ADMIN_U
read -rsp "Admin password (at least 12 characters): " ADMIN_P; echo
read -rsp "Gemini API key (Enter to skip): " GEM; echo
secret ai-guru-admin-username "$ADMIN_U"
secret ai-guru-admin-password "$ADMIN_P"
secret ai-guru-session-secret "$(openssl rand -hex 32)"
[ -n "${GEM:-}" ] && secret ai-guru-gemini-key "$GEM"

say "6/7 A place to keep the app's images"
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1 || gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
for role in roles/cloudbuild.builds.builder roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$CB" --role="$role" --condition=None >/dev/null
done

say "7/7 Building AI Guru and putting it live (about 15–25 minutes)"
gcloud builds submit --config cloudbuild.yaml --substitutions="_REGION=$REGION,_SQL_INSTANCE=$SQL_INSTANCE,_BUCKET=$BUCKET,_REPO=$REPO"

if [ -n "${GEM:-}" ]; then
  gcloud run services update ai-guru --region="$REGION" --update-secrets=GEMINI_API_KEY=ai-guru-gemini-key:latest >/dev/null
fi

URL=$(gcloud run services describe ai-guru --region="$REGION" --format='value(status.url)')
say "Done. AI Guru is live at: $URL"
echo "Bucket: $BUCKET   Database: $PROJECT_ID:$REGION:$SQL_INSTANCE"
say "Daily fee reminders (V51.9.186)"
PROJECT_ID="$PROJECT_ID" REGION="$REGION" bash "$(dirname "$0")/setup-daily-reminders.sh" || echo "Daily reminders not set up — run scripts/cloud/setup-daily-reminders.sh later."
echo "Next: copy your existing data (docs/DEPLOY-GOOGLE-CLOUD.md, step 7) and connect GitHub for automatic deploys (step 9)."
