export interface WorkspaceItem {
  id: string;
  name: string;
  createdAt: number;
}

const STORAGE_KEY = 'mta_workspaces';

const safeParse = (value: string | null): WorkspaceItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is WorkspaceItem =>
          typeof item?.id === 'string' && typeof item?.name === 'string' && typeof item?.createdAt === 'number'
      );
    }
  } catch (error) {
    console.error('Failed to parse workspaces', error);
  }
  return [];
};

export const loadWorkspaces = (): WorkspaceItem[] => {
  if (typeof window === 'undefined') return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
};

export const saveWorkspaces = (workspaces: WorkspaceItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
};

export const findWorkspace = (workspaceId: string): WorkspaceItem | undefined => {
  const workspaces = loadWorkspaces();
  return workspaces.find((w) => w.id === workspaceId);
};
