"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";

export function NavBar() {
  const { user, isLoggedIn, loading } = useAuth();

  return (
    <header className="border-b px-6 py-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6">
      {/* Top: Logo and nav links stacked vertically */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6 sm:justify-start">
        <Link href="/" className="text-2xl font-bold">
          <span className="text-blue-600">Two</span>
          <span className="text-green-600">Words</span>
        </Link>

        <nav className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4 text-sm">
          <Link href="/about" className="hover:underline">
            About
          </Link>
          {isLoggedIn && (
            <>
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <Link href="/account/security" className="hover:underline">
                Security
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Bottom or right: Auth section */}
      <div className="flex justify-end sm:justify-end items-center gap-4 text-sm">
        {loading ? (
          <div className="flex gap-2" aria-label="Checking your session" role="status">
            <span className="h-8 w-16 animate-pulse rounded-md bg-muted" />
            <span className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          </div>
        ) : isLoggedIn && user ? (
          <>
            <span className="text-muted-foreground">{user.username ?? user.email}</span>
            <LogoutButton />
          </>
        ) : (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Sign up</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
