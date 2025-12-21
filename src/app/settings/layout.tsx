'use client';

import { usePathname } from 'next/navigation';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  const getTitle = () => {
    if (pathname.includes('general')) return 'General Settings';
    if (pathname.includes('buildings')) return 'Manage Buildings';
    return 'Settings';
  }

  return (
    <main className="w-full max-w-4xl mx-auto">
      <div className="flex items-center mb-8">
        <h1 className="text-3xl font-bold">{getTitle()}</h1>
      </div>
      {children}
    </main>
  );
}