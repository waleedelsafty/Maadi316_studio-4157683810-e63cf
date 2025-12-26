
'use client';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  return (
    <main className="w-full max-w-4xl mx-auto">
      {children}
    </main>
  );
}
