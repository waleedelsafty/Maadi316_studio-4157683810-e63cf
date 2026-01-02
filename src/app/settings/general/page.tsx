
'use client';

import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

export default function GeneralSettingsPage() {
  const user = useUser();
  
  if (!user) {
    return null; // Or a loading spinner
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>Update your profile details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <label>Display Name</label>
            <Input defaultValue={user?.displayName || ''} />
        </div>
        <div className="space-y-2">
            <label>Email</label>
            <Input defaultValue={user?.email || ''} disabled />
        </div>
        <div className="space-y-2">
            <label>Phone Number</label>
            <Input placeholder="Your phone number" />
        </div>
        <Button>Save Changes</Button>
      </CardContent>
    </Card>
  );
}
