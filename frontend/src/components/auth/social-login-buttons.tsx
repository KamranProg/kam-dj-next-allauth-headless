"use client";

import { useState } from "react";
import { FaGoogle, FaFacebookF } from "react-icons/fa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Sends the browser to Google through the Next.js server, then back to /account/social/done. */
async function continueWithGoogle(): Promise<string | null> {
  const res = await fetch("/api/proxy/auth/provider/redirect", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "google",
      callback_url: `${window.location.origin}/account/social/done`,
      process: "login",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { location?: string };
  return res.ok && data.location ? data.location : null;
}

export function SocialLoginButtons() {
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setBusy(true);
    const location = await continueWithGoogle();
    if (location) {
      window.location.assign(location);
      return;
    }
    setBusy(false);
    toast.error("Could not start Google sign-in. Please try again.");
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
        <FaGoogle className="mr-2" /> {busy ? "Redirecting..." : "Continue with Google"}
      </Button>
      <Button variant="outline" className="w-full" onClick={() => alert("Sign in with Facebook")}>
        <FaFacebookF className="mr-2" /> Sign in with Facebook
      </Button>
    </div>
  );
}
