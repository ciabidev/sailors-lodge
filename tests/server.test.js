const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const request = require('supertest');
const { ChannelType, Collection, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const { ObjectId } = require('mongodb');

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-long-enough-for-signing';
process.env.PUBLIC_APP_URL = 'http://localhost:3002';
process.env.AUTH_DISCORD_ID = '123456789';
process.env.AUTH_DISCORD_SECRET = 'oauth-secret';
process.env.PRODUCTION_CLIENT_ID = '987654321098765432';

const { createApp, encodeDiscordToken, encodeSession } = require('../src/server/app');

function guild({ permissions = [] } = {}) {
  const channels = new Collection();
  const roles = new Collection();
  const server = {
    id: 'guild-1',
    name: 'Test Harbor',
    ownerId: 'owner',
    shardId: 0,
    memberCount: 12,
    iconURL: () => 'https://cdn.discordapp.com/icons/guild-1/icon.png',
    channels: { cache: channels },
    roles: { cache: roles },
    members: {
      fetch: async () => ({ permissions: new PermissionsBitField(permissions) }),
      fetchMe: async () => ({ id: 'bot' }),
      me: { id: 'bot' },
    },
  };
  channels.set('channel-1', {
    id: 'channel-1',
    name: 'parties',
    type: ChannelType.GuildText,
    rawPosition: 0,
    guild: server,
    permissionsFor: () => new PermissionsBitField(PermissionsBitField.All),
  });
  roles.set('role-1', {
    id: 'role-1',
    name: 'Party Ping',
    hexColor: '#ffffff',
    managed: false,
    position: 1,
  });
  return server;
}

function app({ ready = true, staticDir = 'missing-test-static-dir', server = null, guildFetch = null, db: dbOverrides = {}, modules = {} } = {}) {
  const cache = new Collection();
  if (server) cache.set(server.id, server);
  const client = {
    isReady: () => ready,
    uptime: 90_000,
    ws: { status: ready ? 0 : 5, ping: 42 },
    guilds: { cache, ...(guildFetch ? { fetch: guildFetch } : {}) },
    modules: {
      dockBotPerms: { missingLabels: async () => [] },
      dockLevels: {
        canManage: (level) => level === 'admin',
        explain: (level) => `${level} permissions`,
        get: (level) => ({ label: level }),
      },
      escapeMarkdown: (value) => value,
      ...modules,
    },
  };
  const db = { ready: Promise.resolve({}), ...dbOverrides };
  return createApp({ client, db, staticDir });
}

function sessionCookie() {
  return `sailors_session=${encodeSession({ id: '42', username: 'Captain', handle: 'captain', avatar: null })}`;
}

test('health reports bot and database readiness', async () => {
  const response = await request(app()).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok', discord: true, database: true });
});

test('health returns 503 while Discord is starting', async () => {
  const response = await request(app({ ready: false })).get('/api/health');
  assert.equal(response.status, 503);
  assert.equal(response.body.status, 'starting');
});

test('public status reports shard usage and connection health', async () => {
  const response = await request(app({ server: guild() })).get('/api/status');
  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.body, {
    operational: true,
    shards: [{ id: 0, operational: true, uptime: 90000, latency: 42, servers: 1, users: 12 }],
  });
});

test('protected API routes reject anonymous requests', async () => {
  const response = await request(app()).get('/api/me');
  assert.equal(response.status, 401);
});

test('signed sessions expose only the saved profile', async () => {
  const response = await request(app()).get('/api/me').set('Cookie', sessionCookie());
  assert.equal(response.status, 200);
  assert.equal(response.body.user.id, '42');
  assert.equal(response.body.user.username, 'Captain');
});

test('cross-origin mutations are rejected', async () => {
  const response = await request(app()).post('/auth/logout').set('Cookie', sessionCookie()).set('Origin', 'https://evil.example');
  assert.equal(response.status, 403);
});

test('OAuth uses PUBLIC_APP_URL for the Discord callback', async () => {
  const response = await request(app()).get('/auth/discord');
  assert.equal(response.status, 302);
  const authorize = new URL(response.headers.location);
  assert.equal(authorize.origin, 'https://discord.com');
  assert.equal(authorize.searchParams.get('redirect_uri'), 'http://localhost:3002/auth/discord/callback');
  assert.equal(authorize.searchParams.get('scope'), 'identify guilds');
});

test('bot setup invite targets the selected server', async () => {
  const response = await request(app()).get('/invite?guild_id=123456789012345678');
  assert.equal(response.status, 302);
  const authorize = new URL(response.headers.location);
  assert.equal(authorize.searchParams.get('guild_id'), '123456789012345678');
  assert.equal(authorize.searchParams.get('disable_guild_select'), 'true');
});

test('server selection includes manageable servers without the bot', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async (url) => {
    assert.equal(String(url), 'https://discord.com/api/v10/users/@me/guilds');
    return new Response(JSON.stringify([
      { id: 'guild-1', name: 'Installed Harbor', icon: null, owner: true, permissions: '0' },
      {
        id: '123456789012345678',
        name: 'Needs Setup Harbor',
        icon: null,
        owner: false,
        permissions: PermissionFlagsBits.ManageGuild.toString(),
      },
      { id: 'ignored', name: 'Member Only', icon: null, owner: false, permissions: '0' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const accessCookie = `sailors_discord_access=${encodeURIComponent(encodeDiscordToken('discord-token'))}`;
  const response = await request(app({ server: guild({ permissions: [PermissionFlagsBits.ManageGuild] }) }))
    .get('/api/guilds')
    .set('Cookie', [sessionCookie(), accessCookie]);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.guilds.map(({ id, installed }) => ({ id, installed })), [
    { id: 'guild-1', installed: true },
    { id: '123456789012345678', installed: false },
  ]);
});

test('frontend routes explain when the dashboard bundle is missing', async () => {
  const response = await request(app()).get('/dashboard/example/overview');
  assert.equal(response.status, 503);
  assert.match(response.body.error, /npm run build/);
});

test('production frontend serves the SPA for direct dashboard routes', async () => {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sailors-dashboard-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<main id="root">Sailor’s Lodge</main>');
  const response = await request(app({ staticDir })).get('/dashboard/example/settings');
  fs.rmSync(staticDir, { recursive: true, force: true });
  assert.equal(response.status, 200);
  assert.match(response.text, /Sailor’s Lodge/);
});

test('malformed cookies are ignored instead of crashing requests', async () => {
  const response = await request(app()).get('/api/me').set('Cookie', 'broken=%E0%A4%A');
  assert.equal(response.status, 401);
});

test('responses include baseline browser security headers', async () => {
  const response = await request(app()).get('/api/health');
  assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
});

test('direct guild API access requires a Discord management permission', async () => {
  const response = await request(app({ server: guild() }))
    .get('/api/guilds/guild-1')
    .set('Cookie', sessionCookie());
  assert.equal(response.status, 403);
});

test('Dock cards refresh missing guild banners from Discord', async () => {
  const server = guild({ permissions: [PermissionFlagsBits.ManageChannels] });
  const dockId = new ObjectId();
  let fetches = 0;
  const response = await request(app({
    server,
    guildFetch: async ({ guild: guildId, force }) => {
      fetches += 1;
      assert.equal(guildId, server.id);
      assert.equal(force, true);
      return {
        ...server,
        banner: 'banner-hash',
        bannerURL: () => 'https://cdn.discordapp.com/banners/guild-1/banner-hash.webp?size=1024',
      };
    },
    db: {
      getDocks: async () => [{
        _id: dockId,
        guildId: server.id,
        guildName: server.name,
        name: 'Expeditions',
        channelIds: ['channel-1'],
      }],
      getDockFollower: async () => null,
      countDockFollowers: async () => 0,
      countPendingDockFollowers: async () => 0,
    },
  }))
    .get(`/api/guilds/${server.id}/docks?view=discover`)
    .set('Cookie', sessionCookie());

  assert.equal(response.status, 200);
  assert.equal(fetches, 1);
  assert.equal(
    response.body.docks[0].guildBannerURL,
    'https://cdn.discordapp.com/banners/guild-1/banner-hash.webp?size=1024',
  );
});

test('invalid JSON is reported as a client error', async () => {
  const response = await request(app())
    .post('/auth/logout')
    .set('Cookie', sessionCookie())
    .set('Content-Type', 'application/json')
    .send('{');
  assert.equal(response.status, 400);
});

test('unknown API routes never fall through to the dashboard SPA', async () => {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sailors-dashboard-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<main id="root">Dashboard</main>');
  const response = await request(app({ staticDir }))
    .get('/api/not-a-route')
    .set('Cookie', sessionCookie());
  fs.rmSync(staticDir, { recursive: true, force: true });
  assert.equal(response.status, 404);
  assert.equal(response.type, 'application/json');
  assert.equal(response.body.error, 'API route not found.');
});

test('publishing channels cannot already receive another Dock', async () => {
  const server = guild({ permissions: [PermissionFlagsBits.ManageChannels] });
  const response = await request(app({
    server,
    db: {
      getDocksFromChannelId: async () => [],
      getDockFollowsForChannel: async () => [{ dockId: new ObjectId(), guildId: server.id }],
    },
  }))
    .post(`/api/guilds/${server.id}/docks`)
    .set('Cookie', sessionCookie())
    .send({
      name: 'Expeditions',
      description: '',
      channelIds: ['channel-1'],
      keywords: [],
      publishMode: 'all',
      accessMode: 'open',
      defaultLevel: 'passive',
      gatekeeperRoleId: null,
    });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /already receives a Dock/);
});

test('follower responses do not expose internal moderation fields', async () => {
  const server = guild({ permissions: [PermissionFlagsBits.ManageChannels] });
  const dockId = new ObjectId();
  const response = await request(app({
    server,
    db: {
      getDock: async () => ({ _id: dockId, guildId: server.id, name: 'Expeditions' }),
      getDockFollowers: async () => [{
        _id: new ObjectId(),
        dockId,
        guildId: 'guild-2',
        guildName: 'Other Harbor',
        channelIds: ['remote-channel'],
        keywordPings: {},
        level: 'passive',
        banned: false,
        bannedByUserId: 'private-moderator-id',
        serverBanOwnerGuildId: server.id,
      }],
    },
  }))
    .get(`/api/guilds/${server.id}/docks/${dockId}/followers`)
    .set('Cookie', sessionCookie());
  assert.equal(response.status, 200);
  assert.equal(response.body.followers[0].guildName, 'Other Harbor');
  assert.equal('bannedByUserId' in response.body.followers[0], false);
  assert.equal('serverBanOwnerGuildId' in response.body.followers[0], false);
});

test('dashboard follow requests notify Discord gatekeepers with approval actions', async () => {
  const server = guild({ permissions: [PermissionFlagsBits.ManageChannels] });
  const dockId = new ObjectId();
  const notices = [];
  let savedFollow = null;
  const response = await request(app({
    server,
    modules: {
      dockRelay: { relayAlert: async (payload) => notices.push(payload) },
    },
    db: {
      getDock: async () => ({
        _id: dockId,
        guildId: 'publisher',
        guildName: 'Publisher',
        name: 'Expeditions',
        keywords: [],
        accessMode: 'request',
        defaultLevel: 'passive',
        gatekeeperRoleId: null,
      }),
      getDockServerBan: async () => null,
      getDocksFromChannelId: async () => [],
      getDockFollower: async () => savedFollow,
      getDockFollowers: async () => [],
      setDockFollower: async (_dockId, guildId, update) => {
        savedFollow = { dockId, guildId, ...update, banned: false };
      },
    },
  }))
    .put(`/api/guilds/${server.id}/docks/${dockId}/follow`)
    .set('Cookie', sessionCookie())
    .send({
      channelIds: ['channel-1'],
      keywordPings: {},
      hostRoleIds: ['role-1'],
      pingOwnServer: true,
      shareVoiceInvites: true,
    });
  assert.equal(response.status, 200);
  assert.equal(response.body.follow.level, 'no-access');
  assert.deepEqual(response.body.follow.hostRoleIds, ['role-1']);
  assert.equal(response.body.follow.shareVoiceInvites, true);
  assert.equal(notices.length, 1);
  assert.deepEqual(notices[0].guildIds, ['publisher']);
  assert.equal(notices[0].components[1].components.length, 2);
});
