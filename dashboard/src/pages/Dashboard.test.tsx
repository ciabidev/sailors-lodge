import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

const guild = {
  id: 'guild-1',
  name: 'Test Harbor',
  icon: 'https://cdn.discordapp.com/icons/guild-1/current.png',
  owner: true,
  manageGuild: true,
  manageChannels: true,
  installed: true,
  roles: [],
  channels: [{ id: 'local-channel', name: 'dock-feed' }],
};

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderDashboard(entry = '/dashboard/guild-1/docks') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:guildId/:section" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Dashboard Docks', () => {
  it('links overview Dock stats to their corresponding tabs', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return Promise.resolve(json({ user: { id: '42', username: 'Captain', handle: 'captain', avatar: null } }));
      }
      if (url === '/api/guilds') return Promise.resolve(json({ guilds: [guild] }));
      if (url === '/api/guilds/guild-1') {
        return Promise.resolve(json({
          guild,
          settings: { lfgRoleId: null, keywordPingsEnabled: true, pingGroups: [] },
          counts: { published: 2, following: 3, pendingFollowing: 1, bans: 0 },
        }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }));

    renderDashboard('/dashboard/guild-1/overview');

    expect(await screen.findByRole('link', { name: /Published Docks/ })).toHaveAttribute(
      'href',
      '/dashboard/guild-1/docks#published',
    );
    expect(screen.getByRole('link', { name: /^Following/ })).toHaveAttribute(
      'href',
      '/dashboard/guild-1/docks#following',
    );
  });

  it('edits ping group keywords as comma or newline-separated text', async () => {
    let saved: unknown;
    const configuredGuild = {
      ...guild,
      roles: [{ id: 'role-1', name: 'Hunters', color: '#ffffff' }],
    };
    const settings = {
      lfgRoleId: null,
      keywordPingsEnabled: true,
      pingGroups: [{ name: 'Boss hunts', roleId: 'role-1', allowedRoles: [], keywords: ['dragon'] }],
    };
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/me') {
        return Promise.resolve(json({ user: { id: '42', username: 'Captain', handle: 'captain', avatar: null } }));
      }
      if (url === '/api/guilds') return Promise.resolve(json({ guilds: [configuredGuild] }));
      if (url === '/api/guilds/guild-1') {
        return Promise.resolve(json({
          guild: configuredGuild,
          settings,
          counts: { published: 0, following: 0, pendingFollowing: 0, bans: 0 },
        }));
      }
      if (url === '/api/guilds/guild-1/settings' && init?.method === 'PATCH') {
        saved = JSON.parse(String(init.body));
        return Promise.resolve(json({ settings: { ...settings, ...(saved as object) } }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }));

    renderDashboard('/dashboard/guild-1/pings');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Ping keywords'), {
      target: { value: 'dragon,\nluck party\ndragon' },
    });

    expect(screen.getByText(/2\/25/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));

    await waitFor(() => expect(saved).toMatchObject({
      pingGroups: [{ keywords: ['dragon', 'luck party'] }],
    }));
  });

  it('lists installed and setup-ready admin servers', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return Promise.resolve(json({ user: { id: '42', username: 'Captain', handle: 'captain', avatar: null } }));
      }
      if (url === '/api/guilds') {
        return Promise.resolve(json({ guilds: [
          guild,
          {
            ...guild,
            id: '123456789012345678',
            name: 'Uncharted Harbor',
            icon: null,
            installed: false,
          },
        ] }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }));

    renderDashboard('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Ready to manage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Needs setup' })).toBeInTheDocument();
    expect(screen.getByText('Test Harbor')).toBeInTheDocument();
    expect(screen.getByText('Uncharted Harbor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/dashboard/guild-1/overview',
    );
    expect(screen.getByRole('link', { name: 'Setup' })).toHaveAttribute(
      'href',
      '/invite?guild_id=123456789012345678',
    );
  });

  it('shows publisher icons and explicit forwarding and follower details', async () => {
    const fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me') {
        return Promise.resolve(json({ user: { id: '42', username: 'Captain', handle: 'captain', avatar: null } }));
      }
      if (url === '/api/guilds') return Promise.resolve(json({ guilds: [guild] }));
      if (url === '/api/guilds/guild-1') {
        return Promise.resolve(json({
          guild,
          settings: { lfgRoleId: null, keywordPingsEnabled: true, pingGroups: [] },
          counts: { published: 0, following: 0, pendingFollowing: 0, bans: 0 },
        }));
      }
      if (url.startsWith('/api/guilds/guild-1/docks?')) {
        return Promise.resolve(json({
          docks: [{
            id: '507f1f77bcf86cd799439011',
            name: 'Expeditions',
            description: '',
            guildId: 'publisher',
            guildName: 'Grand Navy',
            guildIconURL: 'https://cdn.discordapp.com/icons/publisher/live.png',
            guildBannerURL: 'https://cdn.discordapp.com/banners/publisher/live.png',
            channelIds: ['publisher-channel'],
            channelNames: ['expeditions'],
            keywords: ['dark sea'],
            publishMode: 'all',
            accessMode: 'open',
            defaultLevel: 'passive',
            gatekeeperRoleId: null,
            official: false,
            followerCount: 2,
            pendingFollowerCount: 0,
            blocked: false,
            blockedReason: null,
            follow: {
              guildId: guild.id,
              guildName: guild.name,
              guildIconURL: guild.icon,
              channelIds: ['local-channel'],
              keywordPings: {},
              pingOwnServer: true,
              level: 'passive',
              banned: false,
            },
          }],
        }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetch);

    const { container } = renderDashboard();

    const followerCount = await screen.findByText('2 followers');
    const publisher = screen.getByText('by Grand Navy');
    expect(followerCount.compareDocumentPosition(publisher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      container.querySelector('[style*="https://cdn.discordapp.com/banners/publisher/live.png"]'),
    ).toBeInTheDocument();
    expect(screen.getByText('Every message')).toBeInTheDocument();
    expect(screen.getByText('Delivers to #dock-feed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Following' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Discover Docks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Following' })).toHaveAttribute(
      'href',
      '/dashboard/guild-1/docks#following',
    );
    expect(screen.queryByText('No description provided.')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        container.querySelector('img[src="https://cdn.discordapp.com/icons/publisher/live.png"]'),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish Dock' }));
    expect(screen.getByLabelText('Publish mode')).toHaveValue('all');
    expect(screen.getByText('Every message in a publishing channel will be forwarded.')).toBeInTheDocument();
  });

  it('opens follower management and updates follower access', async () => {
    const requests: Array<{ url: string; method: string; body?: unknown }> = [];
    const dock = {
      id: '507f1f77bcf86cd799439011',
      name: 'Home Dock',
      description: 'Local parties',
      guildId: guild.id,
      guildName: guild.name,
      guildIconURL: guild.icon,
      channelIds: ['local-channel'],
      channelNames: ['dock-feed'],
      keywords: ['dark sea'],
      publishMode: 'all',
      accessMode: 'request',
      defaultLevel: 'passive',
      gatekeeperRoleId: null,
      official: false,
      followerCount: 1,
      pendingFollowerCount: 0,
      blocked: false,
      blockedReason: null,
      follow: {
        guildId: guild.id,
        guildName: guild.name,
        guildIconURL: guild.icon,
        channelIds: ['local-channel'],
        keywordPings: {},
        pingOwnServer: true,
        level: 'passive',
        banned: false,
      },
    };
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      requests.push({
        url,
        method,
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
      });
      if (url === '/api/me') {
        return Promise.resolve(json({ user: { id: '42', username: 'Captain', handle: 'captain', avatar: null } }));
      }
      if (url === '/api/guilds') return Promise.resolve(json({ guilds: [guild] }));
      if (url === '/api/guilds/guild-1') {
        return Promise.resolve(json({
          guild,
          settings: { lfgRoleId: null, keywordPingsEnabled: true, pingGroups: [] },
          counts: { published: 1, following: 0, pendingFollowing: 0, bans: 0 },
        }));
      }
      if (url.startsWith('/api/guilds/guild-1/docks?')) {
        return Promise.resolve(json({ docks: [dock] }));
      }
      if (url.endsWith(`/docks/${dock.id}/followers`) && method === 'GET') {
        return Promise.resolve(json({
          followers: [{
            guildId: 'follower',
            guildName: 'Follower Harbor',
            guildIconURL: null,
            channelIds: ['remote'],
            keywordPings: {},
            pingOwnServer: true,
            level: 'passive',
            banned: false,
          }, {
            guildId: 'pending-follower',
            guildName: 'Requesting Harbor',
            guildIconURL: null,
            channelIds: ['remote'],
            keywordPings: {},
            pingOwnServer: true,
            level: 'no-access',
            banned: false,
          }],
        }));
      }
      if (url.includes(`/docks/${dock.id}/followers/`) && method === 'PATCH') {
        const id = url.split('/').at(-1)!;
        const level = JSON.parse(String(init?.body)).level;
        return Promise.resolve(json({
          follower: {
            guildId: id,
            guildName: id === 'follower' ? 'Follower Harbor' : 'Requesting Harbor',
            guildIconURL: null,
            channelIds: ['remote'],
            keywordPings: {},
            pingOwnServer: true,
            level,
            banned: false,
          },
        }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    }));

    renderDashboard();
    fireEvent.click(await screen.findByRole('link', { name: 'Published' }));
    expect(await screen.findByRole('heading', { name: 'Published Docks' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Server settings' }));
    expect(await screen.findByRole('heading', { name: 'Server settings' })).toBeInTheDocument();
    expect(screen.getByText('Host roles')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Ping roles for local messages' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Manage Followers' }));

    expect(await screen.findByRole('heading', { name: 'Manage followers' })).toBeInTheDocument();
    expect(await screen.findByText('Follower Harbor')).toBeInTheDocument();
    expect(screen.getByText('Requesting Harbor')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Access level for Follower Harbor'), {
      target: { value: 'sender' },
    });
    await waitFor(() => {
      expect(requests).toContainEqual({
        url: `/api/guilds/guild-1/docks/${dock.id}/followers/follower`,
        method: 'PATCH',
        body: { level: 'sender' },
      });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => {
      expect(requests).toContainEqual({
        url: `/api/guilds/guild-1/docks/${dock.id}/followers/pending-follower`,
        method: 'PATCH',
        body: { level: 'passive' },
      });
    });
  });
});
