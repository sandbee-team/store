const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
test.describe.configure({ mode: "serial" });
const email = `platform-ui-${Date.now()}@example.test`;
const password = "Local-UI-test-passphrase-2026";
let state;
async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: false }).click();
}

async function emailCode(request, purpose, recipient = email) {
  let code;
  await expect
    .poll(
      async () => {
        const messages = await (
          await request.get("http://localhost:8029/api/v1/messages")
        ).json();
        const message = messages.messages?.find(
          (m) =>
            m.To?.some((t) => t.Address === recipient) &&
            (purpose !== "reset" || /reset/i.test(m.Subject)),
        );
        if (!message) return false;
        const full = await (
          await request.get(
            `http://localhost:8029/api/v1/message/${message.ID}`,
          )
        ).json();
        code = /\b\d{6}\b/.exec(full.Text)?.[0];
        return Boolean(code);
      },
      { timeout: 20000 },
    )
    .toBe(true);
  return code;
}
test("signup, real SMTP email OTP, onboarding and unified app launcher", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to Sandbee Store" }),
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/login-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Alex Morgan");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  await page.getByLabel("Verification code").fill(await emailCode(request));
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await page.getByLabel("Workspace name").fill("Sandbee Studio");
  await page.screenshot({
    animations: "disabled",
    path: "test-results/onboarding-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Continue to services" }).click();
  await page
    .getByRole("button", { name: "Open workspace", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator(".recharts-surface")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  for (const [id, name] of [
    ["gst", "GSTIN"],
    ["ocr", "Document OCR"],
  ]) {
    await page.goto(`/apps/${id}`);
    const enable = page.getByRole("button", {
      name: `Enable ${name}`,
      exact: true,
    });
    await enable.click();
    await expect(
      page.getByText(`${name} enabled`, { exact: true }),
    ).toBeVisible();
  }
  await page.goto("/");
  state = await page.context().storageState();
});
test("token create/reveal/revoke works, secrets absent after reload", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto("/tokens");
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await page.getByLabel("Key name").fill("Browser test token");
  await choose(page, "Service", "Document OCR");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create key", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Save your key now" }),
  ).toBeVisible();
  await expect(page.locator(".secret-panel code")).toContainText("sb_ocr_");
  await page.reload();
  await expect(page.getByRole("heading", { name: "API keys" })).toBeVisible();
  await expect(page.locator(".secret-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke", exact: true }).click();
  await page
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
  await context.close();
});
test("studio sample runs native Linux extraction and shows readable result", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto("/apps/ocr");
  await page.getByRole("button", { name: /Try the sample/ }).click();
  await expect(
    page.getByText("1 document selected", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Extract document", exact: true })
    .click();
  await expect(page.locator(".extraction-fields")).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator(".extraction-fields")).toContainText("ABCPS1234D");
  await page.screenshot({
    animations: "disabled",
    path: "test-results/studio-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "JSON response", exact: true })
    .click();
  await expect(page.locator(".studio-output code")).toContainText(
    "not_verified",
  );
  await context.close();
});

test("global keys, app-specific keys and app activation have distinct UI flows", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto("/tokens");
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await page.getByLabel("Key name").fill("Shared backend key");
  await choose(page, "Service", "Global");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create key", exact: true })
    .click();
  await expect(page.locator(".secret-panel code")).toContainText("sb_all_");
  await page.goto("/apps/gst/keys");
  await page.getByRole("button", { name: "Create key", exact: true }).click();
  await page.getByRole("combobox", { name: "Service", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.getByRole("option", { name: "GSTIN", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Service", exact: true }),
  ).toHaveText("GSTIN");
  await page.getByLabel("Key name").fill("GST app key");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create key", exact: true })
    .click();
  await expect(page.locator(".secret-panel code")).toContainText("sb_gst_");
  await page.getByRole("button", { name: "Disable", exact: true }).click();
  await page.getByRole("button", { name: "Disable app", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Enable GSTIN", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enable GSTIN", exact: true }).click();
  await expect(page.getByText("GSTIN enabled", { exact: true })).toBeVisible();
  await context.close();
});

test("public developer guides render without JavaScript and fit mobile", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/developers/ocr");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("main")).toContainText("45 seconds");
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
    "href",
    "https://store.sandbee.in/developers/ocr",
  );
  await page.screenshot({
    animations: "disabled",
    path: "test-results/public-developers-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    animations: "disabled",
    path: "test-results/public-developers-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
test("documentation includes private package download and pinned key", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto("/docs");
  await expect(
    page.getByRole("heading", { name: /Local OCR quickstart/ }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download @sandbee\/ocr/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sandbee-ocr-0.1.0.tgz");
  const file = await download.path();
  expect((await fs.stat(file)).size).toBeGreaterThan(1000000);
  await expect(page.locator(".docs-content")).toContainText("BEGIN PUBLIC KEY");
  await page.screenshot({
    animations: "disabled",
    path: "test-results/docs-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "GST API", exact: true }).click();
  await expect(page.locator(".docs-content")).toContainText("/api/v1/gstin/");
  await context.close();
});
test("mobile routes fit viewport and app navigation works", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: state,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  for (const route of [
    "/",
    "/apps/gst",
    "/apps/ocr",
    "/tokens",
    "/docs",
    "/account",
    "/members",
    "/reports",
    "/billing",
    "/invitations",
    "/apps",
    "/settings/workspace",
    "/settings/security",
    "/apps/gst/usage",
    "/apps/ocr/guide",
  ]) {
    await page.goto(route);
    await expect(page.locator(".content .page-title")).toBeVisible();
    if (["/", "/reports", "/apps/gst/usage"].includes(route))
      await expect(page.locator(".recharts-surface")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path:
        "test-results/mobile-" +
        (route.replaceAll("/", "-") || "overview") +
        ".png",
      fullPage: true,
    });
  }
  await page.goto("/");
  await page.screenshot({
    animations: "disabled",
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Apps", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Apps", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Document OCR", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Document studio" }),
  ).toBeVisible();
  await context.close();
});
test("members invite through SMTP, join directly, and role changes restrict the UI", async ({
  browser,
  request,
}) => {
  const ownerContext = await browser.newContext({ storageState: state });
  const owner = await ownerContext.newPage();
  const teammate = `teammate-${Date.now()}@example.test`;
  await owner.goto("/members");
  await owner
    .getByRole("button", { name: "Invite member", exact: true })
    .click();
  await owner.getByLabel("Teammate email").fill(teammate);
  await owner
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(
    owner.getByText("Invitation sent.", { exact: true }),
  ).toBeVisible();
  const messages = await (
    await request.get("http://localhost:8029/api/v1/messages")
  ).json();
  expect(
    messages.messages.some(
      (m) =>
        m.To?.some((t) => t.Address === teammate) &&
        /invitation/i.test(m.Subject),
    ),
  ).toBe(true);
  const employeeContext = await browser.newContext();
  const employee = await employeeContext.newPage();
  await employee.goto("/");
  await employee
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await employee.getByLabel("Your name").fill("Sam Patel");
  await employee.getByLabel("Email address").fill(teammate);
  await employee.getByLabel("Password", { exact: true }).fill(password);
  await employee
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await employee
    .getByLabel("Verification code")
    .fill(await emailCode(request, undefined, teammate));
  await employee
    .getByRole("button", { name: "Verify email", exact: true })
    .click();
  await employee
    .getByRole("button", { name: "Join Sandbee Studio", exact: true })
    .click();
  await expect(
    employee.getByRole("heading", { name: "Dashboard" }),
  ).toBeVisible();
  await employee.goto("/tokens");
  await expect(
    employee.getByText("Shared backend key", { exact: true }),
  ).toHaveCount(0);
  await expect(
    employee.getByRole("button", { name: "Create key", exact: true }),
  ).toBeEnabled();
  await owner.reload();
  await expect(owner.getByText(teammate, { exact: true })).toBeVisible();
  await owner.screenshot({
    animations: "disabled",
    path: "test-results/members-desktop.png",
    fullPage: true,
  });
  await choose(owner, `Role for ${teammate}`, "Viewer");
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Change role", exact: true })
    .click();
  await expect(
    owner.getByRole("combobox", { name: `Role for ${teammate}` }),
  ).toHaveText("Viewer");
  await employee.reload();
  await expect(
    employee.getByRole("heading", { name: "API keys", exact: true }),
  ).toBeVisible();
  await expect(
    employee.getByRole("button", { name: "Create key", exact: true }),
  ).toHaveCount(0);
  await employee.goto("/apps/ocr");
  await expect(
    employee.getByRole("button", { name: "Extract document", exact: true }),
  ).toBeDisabled();
  await employee.goto("/members");
  await expect(
    employee.getByRole("heading", { name: "Members", exact: true }),
  ).toBeVisible();
  await expect(
    employee.getByRole("button", { name: "Invite member", exact: true }),
  ).toHaveCount(0);
  await employee.setViewportSize({ width: 390, height: 844 });
  await employee.screenshot({
    animations: "disabled",
    path: "test-results/members-mobile.png",
    fullPage: true,
  });
  await ownerContext.close();
  await employeeContext.close();
});

test("reports display real demo usage, change periods and export CSV", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto("/reports");
  await choose(page, "Report period", "Last 7 days");
  await expect(
    page.locator(".metric-strip").getByText("1", { exact: true }),
  ).toHaveCount(2);
  await expect(page.locator("tbody tr")).toHaveCount(7);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(await fs.readFile(await download.path(), "utf8")).toContain(
    "Date (UTC)",
  );
  await page.screenshot({
    animations: "disabled",
    path: "test-results/reports-desktop.png",
    fullPage: true,
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator(".recharts-surface")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/workspace-active-desktop.png",
    fullPage: true,
  });
  await context.close();
});

test("Store apps are grouped, sidebar minimizes and app navigation stays contextual", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto("/apps");
  await expect(
    page.getByRole("heading", { name: "Apps", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-category")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/store-apps-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Search apps").fill("no match");
  await expect(
    page.getByRole("heading", { name: "No matching apps" }),
  ).toBeVisible();
  await page.getByLabel("Search apps").fill("GST");
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  await page.getByRole("link", { name: "GSTIN", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "GSTIN navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Minimize sidebar" }).click();
  await expect(page.locator(".store-shell")).toHaveClass(/rail-small/);
  await page.reload();
  await expect(page.locator(".store-shell")).toHaveClass(/rail-small/);
  await page
    .getByRole("navigation", { name: "GSTIN navigation" })
    .getByRole("link", { name: "Usage", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "GSTIN usage" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(7);
  await page.getByRole("button", { name: "Older", exact: true }).click();
  await expect(
    page.getByText("8-14 of 30 days / CSV includes all days"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Newer", exact: true }).click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/store-app-minimized.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page
    .getByRole("navigation", { name: "GSTIN navigation" })
    .getByRole("link", { name: "Developer guide" })
    .click();
  await expect(page.locator(".docs-content")).toContainText("/api/v1/gstin/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Settings" })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Settings sections" }),
  ).toBeVisible();
  for (const tab of [
    "Workspace",
    "Members",
    "Invitations",
    "Security",
    "Profile",
  ]) {
    await page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("link", { name: tab, exact: true })
      .click();
    await expect(
      page
        .getByRole("navigation", { name: "Settings sections" })
        .getByRole("link", { name: tab, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.screenshot({
    path: "test-results/store-settings-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await context.close();
});

test("mobile navigation traps focus, closes with Escape, and hides closed links", async ({
  browser,
}) => {
  const context = await browser.newContext({
      storageState: state,
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator(".store-rail")).toHaveAttribute("inert", "");
  const open = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await open.click();
  await expect(
    page.getByRole("dialog", { name: "Store navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sandbee Store dashboard" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(".store-rail .rail-help")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await expect(page.locator(".store-rail")).toHaveAttribute("inert", "");
  await context.close();
});

test("billing, chart controls, branded assets and keyboard dropdowns work", async ({
  browser,
}) => {
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto("/billing");
  await expect(
    page.getByRole("heading", { name: "Billing", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No automatic charges")).toBeVisible();
  await expect(page.locator(".billing-balance > strong")).toHaveText(/0/);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/billing-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const favicon = await page.request.get("/favicon.svg");
  expect(favicon.ok()).toBeTruthy();
  expect(await favicon.text()).toContain("<svg");
  await page.goto("/reports");
  await page.evaluate(() => {
    window.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      window.cspViolations.push(event.violatedDirective),
    );
  });
  await expect(page.locator(".recharts-surface")).toBeVisible();
  await page.getByRole("button", { name: "Bar chart", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bar chart", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".recharts-bar")).toHaveCount(2);
  await expect(page.locator(".recharts-bar").last()).toBeVisible();
  await page.getByRole("combobox", { name: "Report period" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.screenshot({
    path: "test-results/report-dropdown-desktop.png",
    fullPage: false,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  await expect(
    page.getByRole("combobox", { name: "Report period" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Area chart", exact: true }).click();
  await page.screenshot({
    path: "test-results/reports-polished-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await context.close();
});

test("forgot password through SMTP OTP resets account and accepts new password", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to Sandbee Store" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    animations: "disabled",
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset code" }).click();
  await page
    .getByLabel("Verification code")
    .fill(await emailCode(request, "reset"));
  await page.getByRole("button", { name: "Verify reset code" }).click();
  const next = "New-browser-passphrase-2026";
  await page.getByLabel("New password").fill(next);
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test('branded boot feedback appears only while session loading is pending', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/auth/me', async (route) => { await gate; await route.continue(); });
  try {
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveText('Opening your workspace');
    await page.screenshot({ path: 'test-results/brand-loader-desktop.png', fullPage: true, animations: 'disabled' });
    release();
    await expect(page.getByRole('heading', { name: 'Sign in to Sandbee Store' })).toBeVisible();
    await expect(page.locator('.brand-loader')).toHaveCount(0);
  } finally { release(); await context.close(); }
});
