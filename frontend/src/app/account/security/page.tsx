"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { callProxy, postAuth, type ApiCallResult } from "@/lib/auth-client";
import { flowIds } from "@/lib/api-errors";

type Authenticator = { type: string; unused_code_count?: number };
type Setup = { secret: string; url: string };

const AUTHENTICATORS = "account/authenticators";

function readAuthenticators(res: ApiCallResult) {
  const list = ((res.data as { data?: Authenticator[] })?.data ?? []) as Authenticator[];
  return {
    totpOn: list.some((a) => a.type === "totp"),
    unused: list.find((a) => a.type === "recovery_codes")?.unused_code_count ?? 0,
  };
}

function readCodes(res: ApiCallResult): string[] {
  return (res.data as { data?: { unused_codes?: string[] } })?.data?.unused_codes ?? [];
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [passwordLinkSent, setPasswordLinkSent] = useState(false);
  const [totpOn, setTotpOn] = useState(false);
  const [unused, setUnused] = useState(0);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when allauth wants the password again; `retry` repeats the interrupted action.
  const [reauth, setReauth] = useState<{ retry: () => void } | null>(null);
  const [password, setPassword] = useState("");

  function applyAuthenticators(res: ApiCallResult) {
    const state = readAuthenticators(res);
    setTotpOn(state.totpOn);
    setUnused(state.unused);
    setLoaded(true);
  }

  useEffect(() => {
    let active = true;
    callProxy(AUTHENTICATORS).then((res) => {
      if (!active) return;
      const state = readAuthenticators(res);
      setTotpOn(state.totpOn);
      setUnused(state.unused);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  /** True when the call needs a fresh password; remembers how to retry afterwards. */
  function needsPassword(res: ApiCallResult, retry: () => void) {
    if (res.status === 401 && flowIds(res.data).includes("reauthenticate")) {
      setReauth({ retry });
      return true;
    }
    return false;
  }

  async function startSetup() {
    setBusy(true);
    const res = await callProxy(`${AUTHENTICATORS}/totp`);
    setBusy(false);
    // allauth answers 404 ("not set up yet") and puts the secret in `meta`.
    const meta = (res.data as { meta?: { secret?: string; totp_url?: string } })?.meta;
    if (meta?.secret && meta.totp_url) setSetup({ secret: meta.secret, url: meta.totp_url });
    else if (needsPassword(res, startSetup)) return;
    else toast.error(res.message || "Could not start the setup.");
  }

  async function activate() {
    setBusy(true);
    const res = await callProxy(`${AUTHENTICATORS}/totp`, "POST", { code: code.trim() });
    if (needsPassword(res, activate)) return setBusy(false);
    if (!res.ok) {
      setBusy(false);
      toast.error(res.message);
      return;
    }
    const recovery = await callProxy(`${AUTHENTICATORS}/recovery-codes`);
    setCodes(readCodes(recovery));
    setSetup(null);
    setCode("");
    applyAuthenticators(await callProxy(AUTHENTICATORS));
    setBusy(false);
    toast.success("Authenticator app turned on.");
  }

  async function deactivate() {
    setBusy(true);
    const res = await callProxy(`${AUTHENTICATORS}/totp`, "DELETE");
    if (needsPassword(res, deactivate)) return setBusy(false);
    if (!res.ok) toast.error(res.message);
    else {
      setCodes(null);
      applyAuthenticators(await callProxy(AUTHENTICATORS));
      toast.success("Authenticator app turned off.");
    }
    setBusy(false);
  }

  async function showCodes() {
    setBusy(true);
    const res = await callProxy(`${AUTHENTICATORS}/recovery-codes`);
    if (needsPassword(res, showCodes)) return setBusy(false);
    if (res.ok) setCodes(readCodes(res));
    else toast.error(res.message);
    setBusy(false);
  }

  async function regenerate() {
    setBusy(true);
    const res = await callProxy(`${AUTHENTICATORS}/recovery-codes`, "POST", {});
    if (needsPassword(res, regenerate)) return setBusy(false);
    if (!res.ok) toast.error(res.message);
    else {
      const fresh = await callProxy(`${AUTHENTICATORS}/recovery-codes`);
      setCodes(readCodes(fresh));
      applyAuthenticators(await callProxy(AUTHENTICATORS));
      toast.success("New recovery codes created. The old ones no longer work.");
    }
    setBusy(false);
  }

  // Accounts created through Google have no password. Setting one needs the mailbox, not just
  // a signed-in session, so it goes through the emailed reset link rather than an in-page form.
  async function emailPasswordLink() {
    if (!user) return;
    setBusy(true);
    const res = await postAuth("password/request", { email: user.email });
    setBusy(false);
    if (res.ok) setPasswordLinkSent(true);
    else toast.error(res.message);
  }

  async function confirmPassword() {
    if (!reauth) return;
    setBusy(true);
    const res = await postAuth("reauthenticate", { password });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    const { retry } = reauth;
    setReauth(null);
    setPassword("");
    retry();
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold">Security</h1>

      {reauth && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirm your password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              For your safety, enter your password again to change these settings.
            </p>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button onClick={confirmPassword} disabled={busy || !password}>
              Confirm password
            </Button>
          </CardContent>
        </Card>
      )}

      {user?.hasPassword === false && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {passwordLinkSent ? (
              <p>
                We sent a link to <strong>{user.email}</strong>. Open it to choose a password; you
                can then sign in with it as well as with Google.
              </p>
            ) : (
              <>
                <p>
                  You signed in with Google, so this account has no password yet. To also sign in
                  with an email and password, we will email you a link to choose one.
                </p>
                <Button onClick={emailPasswordLink} disabled={busy}>
                  Email me a link to set a password
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Authenticator app</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!loaded ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : totpOn ? (
            <>
              <p>
                Two-factor authentication is <strong>on</strong>. You will be asked for a code from
                your authenticator app each time you sign in.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={showCodes} disabled={busy}>
                  Show recovery codes ({unused} left)
                </Button>
                <Button variant="outline" onClick={regenerate} disabled={busy}>
                  Generate new codes
                </Button>
                <Button variant="outline" onClick={deactivate} disabled={busy}>
                  Turn off
                </Button>
              </div>
            </>
          ) : setup ? (
            <div className="space-y-3">
              <p>
                Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy
                and others), then enter the 6-digit code it shows.
              </p>
              <div className="bg-white p-3 inline-block rounded-md">
                <QRCodeSVG value={setup.url} size={168} />
              </div>
              <p>
                Can&apos;t scan it? Enter this key manually:{" "}
                <code data-testid="totp-secret" className="break-all">
                  {setup.secret}
                </code>
              </p>
              <Input
                placeholder="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={activate} disabled={busy || !code.trim()}>
                  Activate
                </Button>
                <Button variant="ghost" onClick={() => setSetup(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p>
                Add a second step to signing in. After your password, you will enter a code from an
                authenticator app on your phone.
              </p>
              <Button onClick={startSetup} disabled={busy}>
                Set up authenticator app
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {codes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recovery codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Keep these somewhere safe. Each code works once if you lose access to your
              authenticator app.
            </p>
            <ul data-testid="recovery-codes" className="grid grid-cols-2 gap-1 font-mono">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
