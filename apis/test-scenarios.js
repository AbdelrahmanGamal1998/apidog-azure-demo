// ─────────────────────────────────────────────────────────────────────────────
// Apidog Pre/Post request scripts — paste these into each request's
// "Tests" tab inside the Apidog UI, or reference them from apidog-cli runs.
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /login ──────────────────────────────────────────────────────────────
const loginTests = `
// Status code is 200
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});

// Response time under 2 s
pm.test("Response time < 2000ms", () => {
  pm.expect(pm.response.responseTime).to.be.below(2000);
});

// Body contains token
pm.test("Response has token", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("token");
  pm.expect(json.token).to.be.a("string").and.not.empty;
});

// Extract token into environment variable for downstream requests
const token = pm.response.json().token;
pm.environment.set("authToken", token);
pm.test("Token stored in environment", () => {
  pm.expect(pm.environment.get("authToken")).to.equal(token);
});
`;

// ── POST /login — 400 bad credentials ────────────────────────────────────────
const loginBadTests = `
pm.test("Status code is 400", () => {
  pm.response.to.have.status(400);
});

pm.test("Error message present", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("error");
  pm.expect(json.error).to.include("Missing password");
});
`;

// ── GET /users?page=1 ─────────────────────────────────────────────────────────
const listUsersTests = `
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("Pagination fields present", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.all.keys("page", "per_page", "total", "total_pages", "data");
});

pm.test("Data is an array with items", () => {
  const data = pm.response.json().data;
  pm.expect(data).to.be.an("array").and.not.empty;
});

pm.test("Each user has required fields", () => {
  pm.response.json().data.forEach(user => {
    pm.expect(user).to.have.all.keys("id", "email", "first_name", "last_name", "avatar");
    pm.expect(user.email).to.match(/@/);
  });
});

// Store first user id for the single-user test
pm.environment.set("firstUserId", pm.response.json().data[0].id);
`;

// ── GET /users/:id ────────────────────────────────────────────────────────────
const getSingleUserTests = `
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("User id matches requested id", () => {
  const id = parseInt(pm.environment.get("firstUserId"));
  pm.expect(pm.response.json().data.id).to.equal(id);
});

pm.test("Email is valid format", () => {
  const email = pm.response.json().data.email;
  pm.expect(email).to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
});
`;

// ── GET /users/999 (not found) ────────────────────────────────────────────────
const userNotFoundTests = `
pm.test("Status code is 404", () => {
  pm.response.to.have.status(404);
});

pm.test("Body is empty object", () => {
  pm.expect(pm.response.json()).to.deep.equal({});
});
`;

// ── POST /users ───────────────────────────────────────────────────────────────
const createUserTests = `
pm.test("Status code is 201", () => {
  pm.response.to.have.status(201);
});

pm.test("Created user has id and createdAt", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("id");
  pm.expect(json).to.have.property("createdAt");
  pm.expect(json.name).to.equal(pm.request.body.raw ? JSON.parse(pm.request.body.raw).name : "");
});

pm.environment.set("createdUserId", pm.response.json().id);
`;

// ── PUT /users/:id ────────────────────────────────────────────────────────────
const updateUserTests = `
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("updatedAt field is present", () => {
  pm.expect(pm.response.json()).to.have.property("updatedAt");
});

pm.test("Job reflects the update", () => {
  pm.expect(pm.response.json().job).to.equal(
    JSON.parse(pm.request.body.raw).job
  );
});
`;

// ── DELETE /users/:id ─────────────────────────────────────────────────────────
const deleteUserTests = `
pm.test("Status code is 204", () => {
  pm.response.to.have.status(204);
});

pm.test("Body is empty", () => {
  pm.expect(pm.response.text()).to.be.empty;
});
`;

module.exports = {
  loginTests,
  loginBadTests,
  listUsersTests,
  getSingleUserTests,
  userNotFoundTests,
  createUserTests,
  updateUserTests,
  deleteUserTests,
};
