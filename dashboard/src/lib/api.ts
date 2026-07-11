export type User = { id: string; username: string; handle: string; avatar: string | null };
export type Role = { id: string; name: string; color: string };
export type Channel = { id: string; name: string };
export type GuildSummary = { id: string; name: string; icon: string | null; owner: boolean; manageGuild: boolean; manageChannels: boolean };
export type PingGroup = { name: string; roleId: string; allowedRoles: string[]; keywords: string[] };
export type Settings = { lfgRoleId: string | null; keywordPingsEnabled: boolean; pingGroups: PingGroup[] };
export type Guild = GuildSummary & { roles: Role[]; channels: Channel[] };
export type GuildData = { guild: Guild; settings: Settings; counts: { published: number; following: number; bans: number } };
export type Follow = { guildId: string; guildName: string; channelIds: string[]; keywordPings: Record<string, string[]>; pingOwnServer: boolean; level: string; banned: boolean };
export type Dock = { id: string; name: string; description: string; guildId: string; guildName: string; guildIconURL: string | null; channelIds: string[]; keywords: string[]; publishMode: 'all' | 'manual'; accessMode: 'open' | 'request'; defaultLevel: string; gatekeeperRoleId: string | null; official: boolean; followerCount: number; follow: Follow | null };
export type Follower = Follow & { banReason?: string; bannedAt?: string };
export type Ban = { targetGuildId: string; targetGuildName: string; reason: string; bannedAt: string };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.method && options.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error || 'Something went wrong.');
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const getMe = () => api<{ user: User }>('/api/me');
export const getGuilds = () => api<{ guilds: GuildSummary[] }>('/api/guilds');
export const getGuild = (id: string) => api<GuildData>(`/api/guilds/${id}`);
export const saveSettings = (id: string, settings: Partial<Settings>) => api<{ settings: Settings }>(`/api/guilds/${id}/settings`, { method: 'PATCH', body: JSON.stringify(settings) });
export const getDocks = (id: string, view: string, query = '') => api<{ docks: Dock[] }>(`/api/guilds/${id}/docks?view=${view}&q=${encodeURIComponent(query)}`);
export const createDock = (id: string, dock: Partial<Dock>) => api<{ dock: Dock }>(`/api/guilds/${id}/docks`, { method: 'POST', body: JSON.stringify(dock) });
export const updateDock = (id: string, dockId: string, dock: Partial<Dock>) => api<{ dock: Dock }>(`/api/guilds/${id}/docks/${dockId}`, { method: 'PATCH', body: JSON.stringify(dock) });
export const deleteDock = (id: string, dockId: string) => api<void>(`/api/guilds/${id}/docks/${dockId}`, { method: 'DELETE' });
export const saveFollow = (id: string, dockId: string, follow: Partial<Follow>) => api<{ follow: Follow }>(`/api/guilds/${id}/docks/${dockId}/follow`, { method: 'PUT', body: JSON.stringify(follow) });
export const deleteFollow = (id: string, dockId: string) => api<void>(`/api/guilds/${id}/docks/${dockId}/follow`, { method: 'DELETE' });
export const getFollowers = (id: string, dockId: string) => api<{ followers: Follower[] }>(`/api/guilds/${id}/docks/${dockId}/followers`);
export const setFollowerLevel = (id: string, dockId: string, followerId: string, level: string) => api<{ follower: Follower }>(`/api/guilds/${id}/docks/${dockId}/followers/${followerId}`, { method: 'PATCH', body: JSON.stringify({ level }) });
export const removeFollower = (id: string, dockId: string, followerId: string) => api<void>(`/api/guilds/${id}/docks/${dockId}/followers/${followerId}`, { method: 'DELETE' });
export const getBans = (id: string) => api<{ bans: Ban[] }>(`/api/guilds/${id}/bans`);
export const addBan = (id: string, target: string, reason: string) => api<{ ban: Ban }>(`/api/guilds/${id}/bans/${target}`, { method: 'PUT', body: JSON.stringify({ reason }) });
export const removeBan = (id: string, target: string) => api<void>(`/api/guilds/${id}/bans/${target}`, { method: 'DELETE' });
