# ReqRes API Automation — Apidog + Azure DevOps

End-to-end API test suite for [reqres.in](https://reqres.in) using **Apidog CLI** and **Azure Pipelines**.  
Covers authentication and user CRUD, generates HTML + JUnit reports, and runs automatically on every push.

---

## Project Structure

```
/
├── apis/
│   ├── openapi.yaml          # OpenAPI 3.0 spec (source of truth)
│   ├── collection.json       # Postman-compatible collection with test scripts
│   └── test-scenarios.js     # Documented test assertions (reference)
├── environments/
│   ├── production.json       # Environment variables — Production
│   └── local.json            # Environment variables — Local/Dev
├── reports/                  # Generated HTML/JUnit reports (git-ignored)
├── azure-pipelines.yml       # CI/CD pipeline definition
├── package.json              # npm scripts for local runs
└── README.md
```

---

## APIs Under Test

| Method   | Endpoint         | Purpose                     |
|----------|------------------|-----------------------------|
| `POST`   | `/login`         | Authenticate, extract token |
| `GET`    | `/users?page=1`  | List users (paginated)      |
| `GET`    | `/users/{id}`    | Get single user             |
| `GET`    | `/users/999`     | 404 — user not found        |
| `POST`   | `/users`         | Create user                 |
| `PUT`    | `/users/{id}`    | Full update                 |
| `PATCH`  | `/users/{id}`    | Partial update              |
| `DELETE` | `/users/{id}`    | Delete user                 |

---

## Prerequisites

| Tool              | Install command                            |
|-------------------|--------------------------------------------|
| Node.js ≥ 18      | [nodejs.org](https://nodejs.org)           |
| apidog-cli        | `npm install -g apidog-cli`                |
| Redocly CLI       | `npm install -g @redocly/cli`              |
| Apidog account    | [apidog.com](https://apidog.com) (free)    |

---

## Local Setup

### 1 — Clone and install tools

```bash
git clone https://github.com/<your-org>/apidog-azure-demo.git
cd apidog-azure-demo
npm run install:tools
```

### 2 — Verify apidog-cli

```bash
apidog --version
# apidog-cli/x.x.x
```

### 3 — Run tests locally (collection file, no cloud account needed)

```bash
npm test
# Runs collection.json against environments/local.json
# Generates reports/report-local.html
```

### 4 — Run tests against Apidog cloud project

```bash
export APIDOG_ACCESS_TOKEN=<your-token>
export APIDOG_PROJECT_ID=<your-project-id>
npm run test:prod
```

Get your access token: **Apidog → Account Settings → API Access Tokens**.

### 5 — Lint the OpenAPI spec

```bash
npm run lint:spec
```

### 6 — Preview the spec in a browser

```bash
npm run preview:spec
# Opens http://localhost:8080
```

---

## Token Extraction Flow

The login test automatically extracts the bearer token and stores it as an
environment variable so all subsequent requests can use it:

```javascript
// POST /login — Tests tab
pm.test("Response has token", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("token");
  pm.expect(json.token).to.be.a("string").and.not.empty;
});

// Store for downstream requests
const token = pm.response.json().token;
pm.environment.set("authToken", token);
```

Downstream requests then reference `{{authToken}}` in their `Authorization` header:

```
Authorization: Bearer {{authToken}}
```

---

## Environment Variables

Variables are defined in `environments/*.json` and can be overridden via
pipeline secret variables in Azure DevOps.

| Variable                 | Description                         | Secret |
|--------------------------|-------------------------------------|--------|
| `baseUrl`                | API base URL                        | No     |
| `authToken`              | Populated at runtime by login test  | Yes    |
| `firstUserId`            | Overwritten by list-users test      | No     |
| `createdUserId`          | Populated by create-user test       | No     |
| `defaultUserEmail`       | Test account email                  | No     |
| `defaultUserPassword`    | Test account password               | Yes    |
| `responseTimeThreshold`  | Max acceptable response time (ms)   | No     |

---

## Azure DevOps Setup

### Step 1 — Push repo to Azure Repos (or GitHub)

```bash
git init
git add .
git commit -m "chore: initial API automation project"

# Azure Repos
git remote add origin https://dev.azure.com/<org>/<project>/_git/<repo>
git push -u origin main

# — OR — GitHub
git remote add origin https://github.com/<org>/<repo>.git
git push -u origin main
```

### Step 2 — Create pipeline secret variables

1. Go to **Azure DevOps → Pipelines → Library → + Variable Group**
2. Create group named `apidog-secrets`
3. Add the following variables and mark them secret:

   | Name                    | Value                             |
   |-------------------------|-----------------------------------|
   | `APIDOG_ACCESS_TOKEN`   | Your Apidog API access token      |
   | `APIDOG_PROJECT_ID`     | Your Apidog project ID            |

4. Link the variable group to your pipeline:
   **Edit pipeline → Variables → Variable groups → Link variable group**

### Step 3 — Create the pipeline

1. **Azure DevOps → Pipelines → New Pipeline**
2. Select your repository source (Azure Repos Git or GitHub)
3. Choose **"Existing Azure Pipelines YAML file"**
4. Select `/azure-pipelines.yml`
5. Click **Save and Run**

### Step 4 — GitHub integration (optional)

If your repo is on GitHub, install the **Azure Pipelines** GitHub App:

1. Go to [github.com/apps/azure-pipelines](https://github.com/apps/azure-pipelines)
2. Install on your repository
3. In Azure DevOps, create a service connection:  
   **Project Settings → Service Connections → New → GitHub**
4. Authorize with OAuth or PAT

Azure Pipelines will now post build status checks on every PR.

---

## Pipeline Stages

```
Validate ──► Test ──► Summary
  │            │
  │            ├── Runs full collection (Apidog cloud)
  │            ├── Publishes HTML report as artifact
  │            └── Publishes JUnit XML to Tests tab
  │
  └── Lints openapi.yaml with Redocly
```

### Download the HTML report

After a pipeline run:  
**Azure DevOps → Pipelines → [run] → Artifacts → api-test-reports → report-[buildId].html**

---

## Test Assertions Reference

Every request in `collection.json` includes assertions. Key examples:

```javascript
// ── Status code ──────────────────────────────────────────────────
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});

// ── Response time ────────────────────────────────────────────────
pm.test("Response time < 2000ms", () => {
  pm.expect(pm.response.responseTime).to.be.below(2000);
});

// ── JSON schema shape ────────────────────────────────────────────
pm.test("Pagination fields present", () => {
  pm.expect(pm.response.json())
    .to.have.all.keys("page", "per_page", "total", "total_pages", "data");
});

// ── Array content ────────────────────────────────────────────────
pm.test("Each user has required fields", () => {
  pm.response.json().data.forEach(user => {
    pm.expect(user).to.have.all.keys("id", "email", "first_name", "last_name", "avatar");
    pm.expect(user.email).to.match(/@/);
  });
});

// ── Token extraction and environment persistence ──────────────────
const token = pm.response.json().token;
pm.environment.set("authToken", token);
pm.test("Token stored", () => {
  pm.expect(pm.environment.get("authToken")).to.equal(token);
});
```

---

## Importing into Apidog UI

1. Open Apidog → your project → **Import**
2. Choose **OpenAPI / Swagger** and upload `apis/openapi.yaml`  
   — or —  
   Choose **Postman Collection** and upload `apis/collection.json`
3. Map to the **Production** environment
4. Run the collection from the UI to verify everything passes before pushing

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `apidog: command not found` | `npm install -g apidog-cli` then restart terminal |
| `401 Unauthorized` on cloud run | Check `APIDOG_ACCESS_TOKEN` is set and not expired |
| `APIDOG_PROJECT_ID not found` | Copy the numeric ID from Apidog → Project Settings |
| Tests pass locally but fail in CI | Confirm pipeline variable group is linked; check secret variable masking |
| HTML report not generated | Ensure `reports/` directory exists; pipeline creates it automatically |
| Redocly lint errors | Fix the flagged lines in `apis/openapi.yaml`, re-run `npm run lint:spec` |

---

## Contributing

1. Create a feature branch: `git checkout -b feature/my-test`
2. Add/update API definitions in `apis/`
3. Run `npm test` locally — all assertions must pass
4. Push and open a PR — the pipeline runs automatically
5. Merge once the Azure Pipelines status check is green
