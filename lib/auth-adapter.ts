export type CurrentActor = {
  id: string | null;
  name: string;
  source: 'header' | 'anonymous';
};

export async function getCurrentActor(req?: Request): Promise<CurrentActor> {
  const headerName =
    req?.headers.get('x-user-name') ||
    req?.headers.get('x-rn-user-name') ||
    req?.headers.get('x-actor-name') ||
    '';

  const name = headerName.trim() || 'Anonymous';
  return {
    id: null,
    name,
    source: headerName.trim() ? 'header' : 'anonymous',
  };
}
