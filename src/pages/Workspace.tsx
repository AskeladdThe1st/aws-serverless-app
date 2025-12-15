import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Folder, Sparkles } from 'lucide-react';
import { WorkspaceItem, findWorkspace, loadWorkspaces } from '@/lib/workspaces';

const WorkspacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [workspace, setWorkspace] = useState<WorkspaceItem | null>(null);

  const fallbackName = useMemo(() => 'Workspace', []);

  useEffect(() => {
    const fromState = (location.state as { workspace?: WorkspaceItem })?.workspace;
    if (fromState) {
      setWorkspace(fromState);
      return;
    }
    if (id) {
      const stored = findWorkspace(id) || loadWorkspaces().find((w) => w.id === id);
      if (stored) {
        setWorkspace(stored);
      }
    }
  }, [id, location.state]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border bg-sidebar-bg/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Math Tutor Agent</p>
            <h1 className="text-lg font-semibold">{workspace?.name || fallbackName}</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/')}>Back to chats</Button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Folder className="h-5 w-5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Workspace overview</p>
            <p className="text-sm">Keep course materials, linked chats, and modes organized here.</p>
          </div>
        </div>

        <Separator className="bg-sidebar-border" />

        <Card className="border-sidebar-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Workspace shell</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              This page will host your course folders, linked chats, uploads, and study modes.
              Click chats in the sidebar to return to conversations.
            </p>
            <p className="text-muted-foreground/80">
              Future updates will add materials, practice modes, and workspace tools without changing this layout.
            </p>
          </CardContent>
        </Card>

        {!workspace && (
          <Card className="border-sidebar-border bg-muted/30">
            <CardContent className="py-6 flex items-center gap-3 text-sm text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span>Use the sidebar to create a workspace and return here to see its details.</span>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default WorkspacePage;
