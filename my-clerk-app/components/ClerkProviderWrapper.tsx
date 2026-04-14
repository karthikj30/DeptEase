"use client"

import React from "react";
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

export default function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <header style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999, padding: '0.5rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.95)', color: '#111', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
        <Show when="signed-out">
          <SignInButton />
          <SignUpButton />
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>
      <div style={{ paddingTop: 56 }}>{children}</div>
    </ClerkProvider>
  );
}
