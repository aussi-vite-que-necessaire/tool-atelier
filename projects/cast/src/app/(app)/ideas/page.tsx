import { requireUserId } from '@/lib/auth/session';
import { listIdeas } from '@/lib/db/repositories/ideas';
import { EmptyIdeasState } from './_components/empty-state';
import { IdeaCard } from './_components/idea-card';
import { IdeaCreateForm } from './_components/idea-create-form';

export default async function IdeasPage() {
  const userId = await requireUserId();
  const ideas = await listIdeas(userId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Idées ({ideas.length})</h1>
      </header>
      <IdeaCreateForm />
      {ideas.length === 0 ? (
        <EmptyIdeasState />
      ) : (
        <div className="space-y-4">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}
