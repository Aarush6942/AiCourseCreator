import { Card, CardContent } from '@/components/ui/card';
import { BookX } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-xl">
        <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-6 text-primary">
            <BookX className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground mb-3">
            Page Not Found
          </h1>
          <p className="text-muted-foreground mb-8 text-lg">
            This part of the library seems to be missing. The lesson you're looking for could not be found.
          </p>
          <Button asChild className="rounded-full px-8" size="lg">
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}