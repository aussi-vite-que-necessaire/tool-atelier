import { FileText } from 'lucide-react';

export function EmptyPostsState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileText className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">Aucun post pour le moment</p>
        <p className="text-muted-foreground text-sm">
          Donne un titre ci-dessus pour créer ton premier post.
        </p>
      </div>
    </div>
  );
}
