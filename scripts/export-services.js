"use strict";
const fs = require("node:fs");
const path = require("node:path");
const source = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || path.join(source, "../sandbee-services"));
if (fs.existsSync(output)) throw Error("Choose an empty, new export directory.");
const lock = JSON.parse(fs.readFileSync(path.join(source, "package-lock.json")));
for (const [folder, service, port] of [["gst-api", "gst", 8095], ["ocr-api", "ocr-license", 8097]]) {
  const dest = path.join(output, folder);
  const releaseVariable = '${RELEASE_TAG:-local}';
  const portVariable = '${HOST_PORT:-' + port + '}';
  fs.mkdirSync(dest, { recursive: true });
  const inputs = [`services/${service}`, "services/shared/http.js", "backend/shared", "backend/infrastructure/rate-limit-store.js"];
  if (service === "gst") inputs.push("services/shared/control-client.js");
  for (const input of inputs) {
    const target = path.join(dest, input);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(source, input), target, { recursive: true,
      filter: p => !["__pycache__", "node_modules"].includes(path.basename(p)) && !p.endsWith(".pyc") });
  }
  const dependencies = {};
  for (const name of ["dotenv", "express", "express-rate-limit", "helmet", "lru-cache", "zod", ...(service === "gst" ? ["mongodb"] : [])])
    dependencies[name] = lock.packages[`node_modules/${name}`].version;
  fs.writeFileSync(path.join(dest, "package.json"), JSON.stringify({ name: `sandbee-${folder}`, version: "1.0.0", private: true, engines: { node: ">=22" },
    scripts: { start: `node services/${service}/server.js` }, dependencies }, null, 2) + "\n");
  const runtime = service === "gst"
    ? "FROM python:3.12-slim-bookworm AS runtime\nCOPY --from=dependencies /usr/local/bin/node /usr/local/bin/node\nWORKDIR /app\nCOPY services/gst/requirements.txt ./services/gst/requirements.txt\nRUN pip install --no-cache-dir -r services/gst/requirements.txt && useradd --uid 10001 --create-home app\nENV GST_PYTHON=python3 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1\n"
    : "FROM node:22-bookworm-slim AS runtime\nWORKDIR /app\n";
  fs.writeFileSync(path.join(dest, "Dockerfile"), `FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
${runtime}ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=dependencies /app/node_modules ./node_modules
COPY backend ./backend
COPY services ./services
COPY package.json ./
USER ${service === "gst" ? "app" : "node"}
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s CMD ["node","-e","fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "services/${service}/server.js"]
`);
  fs.writeFileSync(path.join(dest, "compose.production.yaml"), `name: sandbee-${folder}
services:
  app:
    image: sandbee-${folder}:${releaseVariable}
    build: .
    env_file: .env
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 3000
    ports: ["127.0.0.1:${portVariable}:3000"]
    restart: unless-stopped
    init: true
    stop_grace_period: ${service === "gst" ? 80 : 25}s
    mem_limit: ${service === "gst" ? "1g" : "256m"}
    cpus: 1
    pids_limit: 120
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
`);
  const key = service === "gst" ? "GST_SERVICE_SECRET" : "OCR_LICENSE_SERVICE_SECRET";
  fs.writeFileSync(path.join(dest, ".env.example"), `# Copy to .env. SERVICE_SECRET must match ${key} in Store.
CONTROL_URL=https://store.sandbee.in
SERVICE_SECRET=replace-with-matching-store-service-secret
TRUST_PROXY=1
HOST_PORT=${port}
${service === "gst" ? "MONGODB_URI=\nMONGODB_DB=sandbee_gst_data\n" : ""}`);
  fs.writeFileSync(path.join(dest, ".dockerignore"), "node_modules\n.git\n.env*\n*.log\n__pycache__\n**/__pycache__\n");
  fs.writeFileSync(path.join(dest, ".gitignore"), "node_modules/\n.env\n.env.*\n!.env.example\n*.log\n__pycache__/\n");
  fs.writeFileSync(path.join(dest, "README.md"), `# Sandbee ${folder}

Standalone backend only. No login/signup, frontend, React, customer password database or private signing key is shipped here.

Domain: https://${service === "gst" ? "gstapi" : "ocrapi"}.sandbee.in. Local upstream: 127.0.0.1:${port}.

${service === "gst" ? "GET /api/v1/gstin/:gstin accepts a scoped GST or global Store bearer key. Persistent GST cache uses its dedicated MongoDB and a bounded process-local LRU. Authorization and account usage belong to Store." : "POST /api/v1/ocr/license accepts an OCR or global Store bearer key and installationId, label, platform JSON. Store validates the workspace, key and installation, and returns a signed 60-second lease. This API holds no signing key or database credential. No document uploads or extraction API are exposed."}

1. Copy .env.example to .env and set the matching Store credential (${key}); never reuse another service secret.
2. ${service === "gst" ? "Set your GST data Mongo URI and DB. Preserve old data separately during migration." : "No Mongo/Gmail configuration is required here."}
3. Run docker compose -f compose.production.yaml config --quiet, then docker compose -f compose.production.yaml up -d --build.
4. Point the domain's HTTPS proxy at the local upstream; replace forwarded headers. TRUST_PROXY=1 assumes one trusted proxy.
5. Check /api/health, a real Store-issued key, wrong-scope and revoked keys. / and unknown routes return JSON 404 intentionally.

Keep user login, onboarding, workspace settings and key generation in Store. Follow the launch kit migration guide before replacing legacy routes. A health response is not proof of downstream authorization or GST portal availability.
`);
}
console.log(`Backend-only exports ready: ${output}. Run npm install --package-lock-only --ignore-scripts in each folder before building.`);
