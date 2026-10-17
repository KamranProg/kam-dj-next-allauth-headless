import { expect, test, type Page } from "@playwright/test";
import {
  PASSWORD,
  confirmEmail,
  fillAndSubmit,
  logout,
  register,
  signIn,
  uniqueEmail,
} from "./helpers";
import { totpCode } from "./totp";

/** Register, confirm and sign in a new user, then turn on the authenticator app. */
async function userWithMfa(page: Page) {
  const email = uniqueEmail();
  await register(page, email);
  await confirmEmail(page, email);
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/account/security");
  await page.getByRole("button", { name: "Set up authenticator app" }).click();
  const secret = (await page.getByTestId("totp-secret").textContent()) ?? "";
  await fillAndSubmit(
    [[page.getByPlaceholder("6-digit code"), totpCode(secret)]],
    page.getByRole("button", { name: "Activate" })
  );

  const codes = page.getByTestId("recovery-codes").locator("li");
  await expect(codes).toHaveCount(10);
  const recoveryCodes = await codes.allTextContents();

  await logout(page);
  return { email, secret, recoveryCodes };
}

async function startSignIn(page: Page, email: string) {
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/account\/two-factor/);
}

test("turn on two-factor authentication and sign in with an authenticator code", async ({
  page,
}) => {
  const { email, secret } = await userWithMfa(page);

  await startSignIn(page, email);
  await fillAndSubmit(
    [[page.getByPlaceholder("Code"), totpCode(secret)]],
    page.getByRole("button", { name: "Verify" })
  );
  await expect(page).toHaveURL(/\/dashboard/);
});

test("the password alone is not enough, and a wrong code is rejected", async ({ page }) => {
  const { email } = await userWithMfa(page);

  await startSignIn(page, email);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  await startSignIn(page, email);
  await fillAndSubmit(
    [[page.getByPlaceholder("Code"), "000000"]],
    page.getByRole("button", { name: "Verify" })
  );
  await expect(page.getByText("Incorrect code")).toBeVisible();
  await expect(page).toHaveURL(/\/account\/two-factor/);
});

test("a recovery code replaces the app code, once", async ({ page }) => {
  const { email, recoveryCodes } = await userWithMfa(page);

  await startSignIn(page, email);
  await fillAndSubmit(
    [[page.getByPlaceholder("Code"), recoveryCodes[0]]],
    page.getByRole("button", { name: "Verify" })
  );
  await expect(page).toHaveURL(/\/dashboard/);

  await logout(page);
  await startSignIn(page, email);
  await fillAndSubmit(
    [[page.getByPlaceholder("Code"), recoveryCodes[0]]],
    page.getByRole("button", { name: "Verify" })
  );
  await expect(page.getByText("Incorrect code")).toBeVisible();
});

test("turning two-factor authentication off restores plain sign-in", async ({ page }) => {
  const { email, secret } = await userWithMfa(page);

  await startSignIn(page, email);
  await fillAndSubmit(
    [[page.getByPlaceholder("Code"), totpCode(secret)]],
    page.getByRole("button", { name: "Verify" })
  );
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/account/security");
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("button", { name: "Set up authenticator app" })).toBeVisible();

  await logout(page);
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard/);
});
