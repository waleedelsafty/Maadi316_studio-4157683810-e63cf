
'use client';

// This layout is no longer needed as the settings layout is now handled by src/app/settings/layout.tsx
// We will just render the children directly.
export default function DeveloperSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
