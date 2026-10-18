"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { isPendingMfa } from "@/lib/api-errors";

const MESSAGES: Record<string, string> = {
  signup_closed: "New accounts can't be created right now.",
  reauthentication_required: "Please sign in again to continue.",
  email_taken: "That email is already used by another account.",
  unverified_email: "Confirm your email with Google before linking this account.",
};

function SocialDone() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useAuth();
  const error = params.get("error");
  const failure = error ? (MESSAGES[error] ?? "Sign-in with Google did not complete.") : null;

  useEffect(() => {
    if (error) return;
    let active = true;
    // Django has finished the sign-in. Find out whether it is complete or still
    // waiting for a second factor, then go to the right page.
    (async () => {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!active) return;
      if (isPendingMfa(body)) {
        router.replace("/account/two-factor");
      } else if (res.ok) {
        await refreshUser();
        router.replace("/dashboard");
      } else {
        router.replace("/login?error=social_failed");
      }
    })();
    return () => {
      active = false;
    };
  }, [error, refreshUser, router]);

  return (
    <Card className="max-w-sm mx-auto mt-12">
      <CardHeader>
        <CardTitle className="text-xl">
          {failure ? "Sign-in failed" : "Signing you in..."}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {failure ? (
          <>
            <p>{failure}</p>
            <Link href="/login" className="text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SocialDonePage() {
  // useSearchParams needs a Suspense boundary so the page can be prerendered.
  return (
    <Suspense fallback={null}>
      <SocialDone />
    </Suspense>
  );
}
