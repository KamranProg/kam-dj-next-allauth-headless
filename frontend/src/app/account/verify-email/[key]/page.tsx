"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { postAuth } from "@/lib/auth-client";

type State = { kind: "idle" } | { kind: "done" } | { kind: "error"; message: string };

export default function VerifyEmailPage() {
  const params = useParams<{ key: string }>();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  // The key in the emailed link is URL-encoded (it contains ":"); decode it first.
  // Confirming needs a click so link scanners that open the page cannot use up the key.
  function confirm() {
    startTransition(async () => {
      const result = await postAuth("verify-email", { key: decodeURIComponent(params.key) });
      setState(result.ok ? { kind: "done" } : { kind: "error", message: result.message });
    });
  }

  return (
    <Card className="max-w-sm mx-auto mt-12">
      <CardHeader>
        <CardTitle className="text-xl">Confirm your email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {state.kind === "done" ? (
          <p>Your email address is confirmed. You can sign in now.</p>
        ) : (
          <>
            <p>Confirm that this is your email address to finish creating your account.</p>
            {state.kind === "error" && <p className="text-red-600">{state.message}</p>}
            <Button className="w-full" onClick={confirm} disabled={isPending}>
              {isPending ? "Confirming..." : "Confirm email"}
            </Button>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Link href="/login" className="text-sm text-blue-600 hover:underline">
          Go to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
