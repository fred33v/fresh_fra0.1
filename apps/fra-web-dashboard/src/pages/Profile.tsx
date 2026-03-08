import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { User, Mail, Shield, Building2, Pencil, Loader2 } from 'lucide-react';

interface ProfileUpdateResponse {
  userId: string;
  email: string;
  name: string;
  role: string;
  organisationId: string;
  department: string | null;
  createdAt: string;
}

export default function Profile() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  const displayName = profile?.full_name || user.name || 'User';

  const handleEditStart = () => {
    setName(displayName);
    setDepartment('');
    setIsEditing(true);
  };

  const handleSave = async () => {
    const updates: Record<string, string> = {};
    if (name.trim() && name.trim() !== displayName) updates.name = name.trim();
    if (department !== '') updates.department = department;

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await api.patch<ProfileUpdateResponse>('/api/v1/auth/profile', updates);
      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
      // Reload to reflect changes in the auth context
      window.location.reload();
    } catch (err: unknown) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
    setIsEditing(false);
  };

  const roleBadge = user.role === 'employer' ? 'Employer' : user.role === 'admin' ? 'Admin' : 'Participant';

  return (
    <Layout>
      <div className="container max-w-2xl py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary">
            <User className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <Badge variant="secondary" className="mt-2">{roleBadge}</Badge>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium">{roleBadge}</p>
              </div>
            </div>
            {profile?.organization_name && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Organisation</p>
                  <p className="font-medium">{profile.organization_name}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isEditing ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Edit Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Finance, HR, IT"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !name.trim()}
                  className="flex-1"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button variant="outline" className="w-full" onClick={handleEditStart}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>
    </Layout>
  );
}
