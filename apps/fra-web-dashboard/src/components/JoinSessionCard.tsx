import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Quick action that asks for the facilitator's session code, then opens the live workshop. */
export function JoinSessionCard() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z0-9-]{4,32}$/.test(clean)) {
      setError('Enter the session code your facilitator gave you');
      return;
    }
    setOpen(false);
    navigate(`/workshop?session=${encodeURIComponent(clean)}`);
  };

  return (
    <>
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        role="button" tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-info" aria-hidden="true" />
          </div>
          <div>
            <div className="font-medium">Join Session</div>
            <div className="text-sm text-muted-foreground">Live workshop</div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Join a live session</DialogTitle>
              <DialogDescription>Your facilitator shows the session code on screen at the start of the workshop.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 py-4">
              <Label htmlFor="session-code">Session code</Label>
              <Input
                id="session-code" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                className="font-mono uppercase" value={code} aria-invalid={!!error}
                onChange={(e) => { setCode(e.target.value); setError(null); }}
              />
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit">Join</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
