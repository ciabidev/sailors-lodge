const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const Sentry = require('@sentry/node');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { ObjectId } = require('mongodb');
const dockNotifications = require('./dockNotifications');

const SESSION_COOKIE = 'sailors_session';
const ACCESS_COOKIE = 'sailors_discord_access';
const STATE_COOKIE = 'sailors_oauth_state';
const COOKIE_TTL = 7 * 24 * 60 * 60;
const levels = ['no-access', 'passive', 'sender', 'contributor', 'admin'];
const activeLevels = levels.slice(1);

function isActiveFollow(follow) {
  return Boolean(follow && !follow.banned && activeLevels.includes(follow.level || 'passive'));
}

function appUrl() {
  return (
    process.env.PUBLIC_APP_URL
    || process.env.APP_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || 'http://localhost:3002'
  ).replace(/\/$/, '');
}

function secret() {
  const value = process.env.AUTH_SECRET || '';
  return process.env.NODE_ENV === 'production' && value.length < 32 ? '' : value;
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function hasValidSignature(value, signature) {
  if (!value || !signature || !secret()) return false;
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function encodeSession(user) {
  const payload = Buffer.from(JSON.stringify({ ...user, expiresAt: Date.now() + COOKIE_TTL * 1000 }))
    .toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value) {
  if (!value || !secret()) return null;
  const [payload, signature] = value.split('.');
  if (!hasValidSignature(payload, signature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function cookies(req) {
  const values = Object.create(null);
  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    try {
      const key = decodeURIComponent(part.slice(0, separator).trim());
      if (key) values[key] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      // Ignore malformed cookies instead of failing the whole request.
    }
  }
  return values;
}

function encodeDiscordToken(token) {
  if (!token || !secret()) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(secret()).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

function decodeDiscordToken(value) {
  if (!value || !secret()) return null;
  try {
    const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !encrypted) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(secret()).digest(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

function oauthGuildJson(guild, installed) {
  let permissions = 0n;
  try {
    permissions = BigInt(guild.permissions || 0);
  } catch {
    // Invalid permissions are treated as no permissions.
  }
  const owner = Boolean(guild.owner);
  const admin = owner || (permissions & PermissionFlagsBits.Administrator) !== 0n;
  const manageGuild = admin || (permissions & PermissionFlagsBits.ManageGuild) !== 0n;
  if (!manageGuild) return null;
  const extension = guild.icon?.startsWith('a_') ? 'gif' : 'png';
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${extension}?size=128` : null,
    owner,
    manageGuild,
    manageChannels: admin || (permissions & PermissionFlagsBits.ManageChannels) !== 0n,
    installed,
  };
}

function setCookie(res, name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function clearCookie(res, name) {
  setCookie(res, name, '', 0);
}

function cleanUser(user) {
  return {
    id: user.id,
    username: user.global_name || user.username,
    handle: user.handle || user.username,
    avatar: user.avatar?.startsWith?.('http')
      ? user.avatar
      : user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : null,
  };
}

function jsonError(res, status, error, details) {
  return res.status(status).json({ error, ...(details ? { details } : {}) });
}

function isObjectId(value) {
  return typeof value === 'string' && ObjectId.isValid(value) && new ObjectId(value).toString() === value;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanStrings(values, max = 25, maxLength = 100) {
  if (!Array.isArray(values)) return null;
  if (values.some((value) => typeof value !== 'string')) return null;
  const cleaned = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (cleaned.some((value) => value.length > maxLength)) return null;
  return cleaned.length <= max ? cleaned : null;
}

function shardStatus(client) {
  const guilds = [...client.guilds.cache.values()];
  const shards = client.ws?.shards?.size
    ? [...client.ws.shards.values()]
    : [{ id: client.shard?.ids?.[0] ?? 0, ping: client.ws?.ping, status: client.ws?.status }];
  const uptime = Math.max(0, Math.round(client.uptime || 0));

  return shards.map((shard) => {
    const id = Number(shard.id) || 0;
    const shardGuilds = guilds.filter((guild) => (Number(guild.shardId) || 0) === id);
    return {
      id,
      operational: Boolean(client.isReady?.()) && shard.status === 0,
      uptime,
      latency: Number.isFinite(shard.ping) ? Math.max(0, Math.round(shard.ping)) : null,
      servers: shardGuilds.length,
      users: shardGuilds.reduce((count, guild) => count + (Number(guild.memberCount) || 0), 0),
    };
  }).sort((a, b) => a.id - b.id);
}

function followerJson(follow, client = null) {
  const guild = client?.guilds.cache.get(follow.guildId);
  return {
    guildId: follow.guildId,
    guildName: guild?.name || follow.guildName || follow.guildId,
    guildIconURL: guild?.iconURL({ size: 128 }) || follow.guildIconURL || null,
    channelIds: follow.channelIds || [],
    keywordPings: isRecord(follow.keywordPings) ? follow.keywordPings : {},
    pingOwnServer: follow.pingOwnServer !== false,
    level: follow.level || 'passive',
    banned: Boolean(follow.banned),
    ...(follow.banReason ? { banReason: follow.banReason } : {}),
    ...(follow.bannedAt ? { bannedAt: follow.bannedAt } : {}),
  };
}

function banJson(ban) {
  return {
    targetGuildId: ban.targetGuildId,
    targetGuildName: ban.targetGuildName || ban.targetGuildId,
    reason: ban.reason || 'No reason provided',
    bannedAt: ban.bannedAt || ban.createdAt || null,
  };
}

function dockJson(client, dock, options = {}) {
  const publisher = options.publisher || client.guilds.cache.get(dock.guildId);
  const channelNames = (dock.channelIds || []).map((id) =>
    publisher?.channels.cache.get(id)?.name || null,
  );
  const follow = options.follow || null;
  return {
    id: dock._id.toString(),
    name: dock.name,
    description: dock.description || '',
    guildId: dock.guildId,
    guildName: publisher?.name || dock.guildName || dock.guildId,
    guildIconURL: publisher?.iconURL({ size: 128 }) || dock.guildIconURL || null,
    guildBannerURL: publisher?.bannerURL({ size: 1024 }) || null,
    channelIds: dock.channelIds || [],
    channelNames,
    keywords: dock.keywords || [],
    publishMode: dock.publishMode || 'manual',
    accessMode: dock.accessMode || 'open',
    defaultLevel: dock.defaultLevel || 'passive',
    gatekeeperRoleId: dock.gatekeeperRoleId || null,
    official: Boolean(dock.official),
    followerCount: options.followerCount || 0,
    pendingFollowerCount: options.pendingFollowerCount || 0,
    blocked: Boolean(options.ban || follow?.banned),
    blockedReason: options.ban?.reason || follow?.banReason || null,
    follow: follow ? followerJson(follow, client) : null,
  };
}

async function getPublisher(client, guildId) {
  const cached = client.guilds.cache.get(guildId);
  if (cached?.banner || typeof client.guilds.fetch !== 'function') return cached;
  return client.guilds.fetch({ guild: guildId, force: true }).catch(() => cached);
}

async function memberAccess(client, guildId, userId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return null;
  const owner = guild.ownerId === userId;
  const admin = member.permissions.has(PermissionFlagsBits.Administrator);
  return {
    guild,
    member,
    owner,
    manageGuild: owner || admin || member.permissions.has(PermissionFlagsBits.ManageGuild),
    manageChannels: owner || admin || member.permissions.has(PermissionFlagsBits.ManageChannels),
  };
}

function validateDock(body, guild) {
  if (!isRecord(body)) return { error: 'Dock settings must be a JSON object.' };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const channelIds = cleanStrings(body.channelIds, 10, 32);
  const keywords = cleanStrings(body.keywords || [], 25, 100);
  if (!name || name.length > 150) return { error: 'Dock names must be between 1 and 150 characters.' };
  if (description.length > 500) return { error: 'Dock descriptions cannot exceed 500 characters.' };
  if (!channelIds?.length) return { error: 'Choose between 1 and 10 publishing channels.' };
  if (!keywords) return { error: 'Docks can have at most 25 unique keywords.' };
  if (!['all', 'manual'].includes(body.publishMode)) return { error: 'Invalid publishing mode.' };
  if (!['open', 'request'].includes(body.accessMode)) return { error: 'Invalid access mode.' };
  if (!activeLevels.includes(body.defaultLevel || 'passive')) return { error: 'Invalid default follower level.' };
  const channels = channelIds.map((id) => guild.channels.cache.get(id));
  if (channels.some((channel) => !channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type))) {
    return { error: 'Every publishing channel must be a text or announcement channel in this server.' };
  }
  if (body.gatekeeperRoleId !== null && body.gatekeeperRoleId !== undefined && typeof body.gatekeeperRoleId !== 'string') return { error: 'Choose a valid gatekeeper role.' };
  if (body.gatekeeperRoleId && !guild.roles.cache.has(body.gatekeeperRoleId)) return { error: 'The gatekeeper role no longer exists.' };
  return {
    value: {
      name,
      description,
      channelIds,
      keywords,
      publishMode: body.publishMode,
      accessMode: body.accessMode,
      defaultLevel: body.defaultLevel || 'passive',
      gatekeeperRoleId: body.gatekeeperRoleId || null,
    },
  };
}

function createApp({ client, db, staticDir = path.join(__dirname, '../../dist/dashboard') }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy': [
        "default-src 'self'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net",
        "connect-src 'self'",
        "form-action 'self' https://discord.com",
      ].join('; '),
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    if (process.env.NODE_ENV === 'production') {
      res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use((error, _req, res, next) => {
    if (error?.type === 'entity.too.large') return jsonError(res, 413, 'Request body is too large.');
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return jsonError(res, 400, 'Request body must be valid JSON.');
    }
    return next(error);
  });
  app.use('/brand', express.static(path.join(__dirname, '../../static'), { maxAge: '1d' }));
  app.use((req, _res, next) => {
    const requestCookies = cookies(req);
    req.user = decodeSession(requestCookies[SESSION_COOKIE]);
    req.discordAccessToken = decodeDiscordToken(requestCookies[ACCESS_COOKIE]);
    next();
  });

  app.get('/api/health', async (_req, res) => {
    const database = await db.ready;
    res.status(client.isReady?.() && database ? 200 : 503).json({
      status: client.isReady?.() && database ? 'ok' : 'starting',
      discord: Boolean(client.isReady?.()),
      database: Boolean(database),
    });
  });

  app.get('/api/status', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const shards = shardStatus(client);
    res.json({ operational: shards.length > 0 && shards.every((shard) => shard.operational), shards });
  });

  app.get('/invite', (req, res) => {
    const clientId = process.env.DEV_MODE === 'true' ? process.env.DEV_CLIENT_ID : process.env.PRODUCTION_CLIENT_ID;
    if (!clientId) return jsonError(res, 503, 'The bot invite is not configured.');
    const query = new URLSearchParams({ client_id: clientId, scope: 'bot applications.commands' });
    if (/^\d{17,20}$/.test(String(req.query.guild_id || ''))) {
      query.set('guild_id', String(req.query.guild_id));
      query.set('disable_guild_select', 'true');
    }
    return res.redirect(`https://discord.com/oauth2/authorize?${query}`);
  });

  app.use('/auth', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/auth/discord', (_req, res) => {
    const clientId = process.env.AUTH_DISCORD_ID;
    if (!clientId || !process.env.AUTH_DISCORD_SECRET || !secret()) {
      return jsonError(res, 503, 'Discord sign-in is not configured.');
    }
    const state = crypto.randomBytes(24).toString('base64url');
    setCookie(res, STATE_COOKIE, `${state}.${sign(state)}`, 600);
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'identify guilds',
      state,
      redirect_uri: `${appUrl()}/auth/discord/callback`,
    });
    return res.redirect(`https://discord.com/oauth2/authorize?${query}`);
  });

  app.get('/auth/discord/callback', async (req, res, next) => {
    try {
      const saved = cookies(req)[STATE_COOKIE];
      const [savedState, signature] = (saved || '').split('.');
      if (!hasValidSignature(savedState, signature) || savedState !== req.query.state) {
        return jsonError(res, 400, 'Discord sign-in state was invalid or expired.');
      }
      clearCookie(res, STATE_COOKIE);
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: String(req.query.code || ''),
          client_id: process.env.AUTH_DISCORD_ID,
          client_secret: process.env.AUTH_DISCORD_SECRET,
          redirect_uri: `${appUrl()}/auth/discord/callback`,
        }),
      });
      if (!response.ok) return jsonError(res, 401, 'Discord sign-in could not be completed.');
      const token = await response.json();
      const profileResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!profileResponse.ok) return jsonError(res, 401, 'Discord profile could not be loaded.');
      setCookie(
        res,
        SESSION_COOKIE,
        encodeSession(cleanUser(await profileResponse.json())),
        COOKIE_TTL,
      );
      setCookie(
        res,
        ACCESS_COOKIE,
        encodeDiscordToken(token.access_token),
        Math.min(COOKIE_TTL, Number(token.expires_in) || COOKIE_TTL),
      );
      return res.redirect('/dashboard');
    } catch (error) {
      return next(error);
    }
  });

  app.post('/auth/logout', (req, res) => {
    const origin = req.get('origin');
    if (origin && origin !== appUrl() && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):(3002|5173)$/.test(origin))) return jsonError(res, 403, 'Cross-origin request blocked.');
    clearCookie(res, SESSION_COOKIE);
    clearCookie(res, ACCESS_COOKIE);
    return res.status(204).end();
  });

  const api = express.Router();
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.user) return jsonError(res, 401, 'Sign in with Discord to continue.');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && origin !== appUrl() && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):(3002|5173)$/.test(origin))) return jsonError(res, 403, 'Cross-origin request blocked.');
      if (!req.is('application/json')) return jsonError(res, 415, 'Use application/json for this request.');
    }
    return next();
  });

  api.get('/me', (req, res) => res.json({ user: cleanUser(req.user) }));

  api.get('/guilds', async (req, res, next) => {
    try {
      if (req.discordAccessToken) {
        const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: `Bearer ${req.discordAccessToken}` },
        });
        if (response.status === 401) {
          clearCookie(res, SESSION_COOKIE);
          clearCookie(res, ACCESS_COOKIE);
          return jsonError(res, 401, 'Your Discord session expired. Sign in again to refresh your servers.');
        }
        if (!response.ok) return jsonError(res, 502, 'Discord could not load your servers. Try again shortly.');
        const discordGuilds = await response.json();
        const guilds = (Array.isArray(discordGuilds) ? discordGuilds : [])
          .map((guild) => oauthGuildJson(guild, client.guilds.cache.has(guild.id)))
          .filter(Boolean)
          .sort((a, b) => Number(b.installed) - Number(a.installed) || a.name.localeCompare(b.name));
        return res.json({ guilds });
      }
      clearCookie(res, SESSION_COOKIE);
      return jsonError(res, 401, 'Sign in again to load every server you manage.');
    } catch (error) {
      return next(error);
    }
  });

  async function withGuild(req, res, permission = null) {
    const access = await memberAccess(client, req.params.guildId, req.user.id);
    if (!access) {
      jsonError(res, 404, 'That server is unavailable or Sailor’s Lodge is not installed.');
      return null;
    }
    if (permission && !access[permission]) {
      jsonError(res, 403, `You need ${permission === 'manageGuild' ? 'Manage Server' : 'Manage Channels'} in Discord.`);
      return null;
    }
    if (!permission && !access.manageGuild && !access.manageChannels) {
      jsonError(res, 403, 'You need Manage Server or Manage Channels in Discord.');
      return null;
    }
    return access;
  }

  async function missingBotPermissions(channels) {
    return client.modules.dockBotPerms?.missingLabels
      ? client.modules.dockBotPerms.missingLabels(channels)
      : [];
  }

  async function sourceChannelConflict(channelId, dockId, guildId) {
    const follows = await db.getDockFollowsForChannel(channelId);
    return follows.some((follow) =>
      !dockId || follow.dockId.toString() !== dockId.toString() || follow.guildId !== guildId,
    );
  }

  function validateKeywordPings(body, guild, dock) {
    if (!isRecord(body)) return { error: 'Follow settings must be a JSON object.' };
    if ('pingOwnServer' in body && typeof body.pingOwnServer !== 'boolean') {
      return { error: 'Own-server pings must be on or off.' };
    }
    const input = body.keywordPings ?? {};
    if (!isRecord(input)) return { error: 'Keyword pings must be an object.' };
    const keywordPings = Object.create(null);
    for (const [keyword, roleIds] of Object.entries(input)) {
      if (!dock.keywords?.includes(keyword)) {
        return { error: `“${keyword}” is not a keyword for this Dock.` };
      }
      const roles = cleanStrings(roleIds, 25, 32);
      if (!roles || roles.some((id) => !guild.roles.cache.has(id))) {
        return { error: 'A selected ping role no longer exists.' };
      }
      keywordPings[keyword] = roles;
    }
    return { value: { keywordPings, pingOwnServer: body.pingOwnServer !== false } };
  }

  async function managedDock(req, res, access) {
    if (!isObjectId(req.params.dockId)) {
      jsonError(res, 400, 'Invalid Dock ID.');
      return null;
    }
    const dock = await db.getDock(req.params.dockId);
    if (!dock) {
      jsonError(res, 404, 'That Dock no longer exists.');
      return null;
    }
    if (dock.guildId !== access.guild.id) {
      const follow = await db.getDockFollower(dock._id, access.guild.id);
      if (!isActiveFollow(follow) || follow.level !== 'admin') {
        jsonError(res, 403, 'Admin Dock access is required.');
        return null;
      }
    }
    return dock;
  }

  async function dockAdminGuildIds(dockId, excludedGuildId = null) {
    return (await db.getDockFollowers(dockId))
      .filter((follow) => follow.guildId !== excludedGuildId && isActiveFollow(follow) && follow.level === 'admin')
      .map((follow) => follow.guildId);
  }

  api.get('/guilds/:guildId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res);
      if (!access) return;
      const settings = await db.getSettings(access.guild.id);
      const [published, followed, bans] = await Promise.all([
        db.getPublishedDocksForGuild(access.guild.id),
        db.getFollowedDocksForGuild(access.guild.id),
        db.getDockServerBans(access.guild.id),
      ]);
      const externalDocks = followed.filter((dock) => dock.guildId !== access.guild.id);
      const follows = await Promise.all(
        externalDocks.map((dock) => db.getDockFollower(dock._id, access.guild.id)),
      );
      return res.json({
        guild: {
          id: access.guild.id,
          name: access.guild.name,
          icon: access.guild.iconURL({ size: 128 }),
          owner: access.owner,
          manageGuild: access.manageGuild,
          manageChannels: access.manageChannels,
          installed: true,
          roles: access.guild.roles.cache
            .filter((role) => role.id !== access.guild.id && !role.managed)
            .sort((a, b) => b.position - a.position)
            .map((role) => ({ id: role.id, name: role.name, color: role.hexColor })),
          channels: access.guild.channels.cache
            .filter((channel) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type))
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .map((channel) => ({ id: channel.id, name: channel.name })),
        },
        settings: {
          lfgRoleId: settings.lfgRoleId || null,
          keywordPingsEnabled: settings.keywordPingsEnabled !== false,
          pingGroups: settings.pingGroups || [],
        },
        counts: {
          published: published.length,
          following: follows.filter(isActiveFollow).length,
          pendingFollowing: follows.filter((follow) => follow?.level === 'no-access' && !follow.banned).length,
          bans: bans.length,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  api.patch('/guilds/:guildId/settings', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageGuild');
      if (!access) return;
      const body = req.body || {};
      if (!isRecord(body)) return jsonError(res, 400, 'Server settings must be a JSON object.');
      const update = {};
      if ('keywordPingsEnabled' in body) {
        if (typeof body.keywordPingsEnabled !== 'boolean') return jsonError(res, 400, 'Keyword pings must be on or off.');
        update.keywordPingsEnabled = body.keywordPingsEnabled;
      }
      if ('lfgRoleId' in body) {
        if (body.lfgRoleId !== null && !access.guild.roles.cache.has(body.lfgRoleId)) return jsonError(res, 400, 'The selected LFG role no longer exists.');
        update.lfgRoleId = body.lfgRoleId;
      }
      if ('pingGroups' in body) {
        if (!Array.isArray(body.pingGroups) || body.pingGroups.length > 25) return jsonError(res, 400, 'Ping groups must be a list of at most 25 groups.');
        const seen = new Set();
        update.pingGroups = [];
        for (const group of body.pingGroups) {
          if (!isRecord(group)) return jsonError(res, 400, 'Every ping group must be an object.');
          const name = typeof group.name === 'string' ? group.name.trim() : '';
          const key = name.toLowerCase();
          const allowedRoles = cleanStrings(group.allowedRoles || [], 25, 32);
          const keywords = cleanStrings(group.keywords || [], 25, 100);
          if (!name || name.length > 100 || seen.has(key)) return jsonError(res, 400, 'Every ping group needs a unique name up to 100 characters.');
          if (typeof group.roleId !== 'string') return jsonError(res, 400, `Choose a ping role for “${name}”.`);
          if (!access.guild.roles.cache.has(group.roleId)) return jsonError(res, 400, `The ping role for “${name}” no longer exists.`);
          if (!allowedRoles || allowedRoles.some((id) => !access.guild.roles.cache.has(id))) return jsonError(res, 400, `An allowed role for “${name}” no longer exists.`);
          if (!keywords) return jsonError(res, 400, `“${name}” has too many keywords.`);
          seen.add(key);
          update.pingGroups.push({ name, roleId: group.roleId, allowedRoles, keywords });
        }
      }
      const settings = await db.setSettings(access.guild.id, update);
      return res.json({ settings: { lfgRoleId: settings.lfgRoleId || null, keywordPingsEnabled: settings.keywordPingsEnabled !== false, pingGroups: settings.pingGroups || [] } });
    } catch (error) {
      return next(error);
    }
  });

  api.get('/guilds/:guildId/docks', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const view = ['published', 'following', 'discover'].includes(req.query.view) ? req.query.view : 'discover';
      let docks = view === 'published'
        ? await db.getPublishedDocksForGuild(access.guild.id)
        : view === 'following'
          ? await db.getFollowedDocksForGuild(access.guild.id)
          : await db.getDocks();
      if (view === 'following') docks = docks.filter((dock) => dock.guildId !== access.guild.id);
      const search = String(req.query.q || '').trim().toLowerCase().slice(0, 100);
      if (search) {
        docks = docks.filter((dock) => {
          const publisher = client.guilds.cache.get(dock.guildId);
          const channelNames = (dock.channelIds || [])
            .map((id) => publisher?.channels.cache.get(id)?.name)
            .filter(Boolean);
          return `${dock.name} ${publisher?.name || dock.guildName} ${dock.description} ${channelNames.join(' ')}`
            .toLowerCase()
            .includes(search);
        });
      }
      const publishers = new Map(await Promise.all(
        [...new Set(docks.map((dock) => dock.guildId))]
          .map(async (guildId) => [guildId, await getPublisher(client, guildId)]),
      ));
      const items = await Promise.all(docks.map(async (dock) => {
        const [follow, followerCount, pendingFollowerCount, ban] = await Promise.all([
          db.getDockFollower(dock._id, access.guild.id),
          db.countDockFollowers(dock._id, dock.guildId),
          db.countPendingDockFollowers(dock._id, dock.guildId),
          dock.guildId === access.guild.id
            ? null
            : db.getDockServerBan(dock.guildId, access.guild.id),
        ]);
        return dockJson(client, dock, {
          follow,
          followerCount,
          pendingFollowerCount,
          ban,
          publisher: publishers.get(dock.guildId),
        });
      }));
      return res.json({ docks: items });
    } catch (error) {
      return next(error);
    }
  });

  api.post('/guilds/:guildId/docks', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const validation = validateDock(req.body || {}, access.guild);
      if (validation.error) return jsonError(res, 400, validation.error);
      for (const channelId of validation.value.channelIds) {
        if ((await db.getDocksFromChannelId(channelId)).length) return jsonError(res, 409, `#${access.guild.channels.cache.get(channelId).name} already publishes a Dock.`);
        if (await sourceChannelConflict(channelId, null, access.guild.id)) return jsonError(res, 409, `#${access.guild.channels.cache.get(channelId).name} already receives a Dock and cannot also be a publishing channel.`);
      }
      const value = validation.value;
      const channels = value.channelIds.map((id) => access.guild.channels.cache.get(id));
      const missing = await missingBotPermissions(channels);
      if (missing.length) return jsonError(res, 400, `The bot is missing permissions in the selected channels: ${missing.join(', ')}.`);
      const result = await db.createDock(value.name, access.guild.id, access.guild.name, value.channelIds, value.description, value.keywords, value.publishMode, value.accessMode, value.defaultLevel);
      await db.updateDock(result.insertedId, { $set: { gatekeeperRoleId: value.gatekeeperRoleId, guildIconURL: access.guild.iconURL({ size: 128 }) } });
      await db.setDockFollower(result.insertedId, access.guild.id, { guildName: access.guild.name, channelIds: value.channelIds, keywordPings: {} });
      const dock = await db.getDock(result.insertedId);
      return res.status(201).json({ dock: dockJson(client, dock) });
    } catch (error) {
      return next(error);
    }
  });

  async function ownerDock(req, res, access) {
    if (!isObjectId(req.params.dockId)) {
      jsonError(res, 400, 'Invalid Dock ID.');
      return null;
    }
    const dock = await db.getDock(req.params.dockId);
    if (!dock || dock.guildId !== access.guild.id) {
      jsonError(res, 404, 'That published Dock was not found.');
      return null;
    }
    return dock;
  }

  api.patch('/guilds/:guildId/docks/:dockId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const dock = await ownerDock(req, res, access);
      if (!dock) return;
      const validation = validateDock(req.body || {}, access.guild);
      if (validation.error) return jsonError(res, 400, validation.error);
      for (const channelId of validation.value.channelIds) {
        const conflicts = await db.getDocksFromChannelId(channelId);
        if (conflicts.some((item) => item._id.toString() !== dock._id.toString())) return jsonError(res, 409, `#${access.guild.channels.cache.get(channelId).name} already publishes a Dock.`);
        if (await sourceChannelConflict(channelId, dock._id, access.guild.id)) return jsonError(res, 409, `#${access.guild.channels.cache.get(channelId).name} already receives another Dock and cannot also be a publishing channel.`);
      }
      const channels = validation.value.channelIds.map((id) => access.guild.channels.cache.get(id));
      const missing = await missingBotPermissions(channels);
      if (missing.length) return jsonError(res, 400, `The bot is missing permissions in the selected channels: ${missing.join(', ')}.`);
      const updated = await db.updateDock(dock._id, { $set: validation.value, $unset: { channelNames: '' } });
      await db.setDockFollower(dock._id, access.guild.id, { channelIds: validation.value.channelIds });
      await db.pruneDockKeywordPings(dock._id, validation.value.keywords);
      if (dock.defaultLevel !== validation.value.defaultLevel) {
        const details = client.modules.dockLevels.get(validation.value.defaultLevel);
        await dockNotifications.relayText(
          client,
          dock._id,
          `The default access level for **${dockNotifications.escape(client, dock.name)}** is now **${details.label}**.\n-# Updated from the dashboard by ${dockNotifications.escape(client, access.guild.name)}`,
        );
      }
      return res.json({ dock: dockJson(client, updated) });
    } catch (error) {
      return next(error);
    }
  });

  api.delete('/guilds/:guildId/docks/:dockId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const dock = await ownerDock(req, res, access);
      if (!dock) return;
      await dockNotifications.relayText(
        client,
        dock._id,
        `**${dockNotifications.escape(client, dock.name)}** was deleted from the dashboard by **${dockNotifications.escape(client, access.guild.name)}**.`,
      );
      await db.removeDock(dock._id);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  api.put('/guilds/:guildId/docks/:dockId/home-pings', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const dock = await ownerDock(req, res, access);
      if (!dock) return;
      const validation = validateKeywordPings(req.body, access.guild, dock);
      if (validation.error) return jsonError(res, 400, validation.error);
      const existing = await db.getDockFollower(dock._id, access.guild.id);
      await db.setDockFollower(dock._id, access.guild.id, {
        guildName: access.guild.name,
        channelIds: existing?.channelIds?.length ? existing.channelIds : dock.channelIds,
        keywordPings: validation.value.keywordPings,
      });
      return res.json({ follow: followerJson(await db.getDockFollower(dock._id, access.guild.id), client) });
    } catch (error) {
      return next(error);
    }
  });

  api.patch('/guilds/:guildId/docks/:dockId/default-level', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const dock = await managedDock(req, res, access);
      if (!dock) return;
      if (!isRecord(req.body) || !activeLevels.includes(req.body.level)) {
        return jsonError(res, 400, 'Choose a valid default follower level.');
      }
      const level = req.body.level;
      await db.updateDock(dock._id, { $set: { defaultLevel: level } });
      const details = client.modules.dockLevels.get(level);
      await dockNotifications.relayText(
        client,
        dock._id,
        `The default access level for **${dockNotifications.escape(client, dock.name)}** is now **${details.label}**.\n-# Updated from the dashboard by ${dockNotifications.escape(client, access.guild.name)}`,
      );
      return res.json({ defaultLevel: level });
    } catch (error) {
      return next(error);
    }
  });

  api.put('/guilds/:guildId/docks/:dockId/follow', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      if (!isObjectId(req.params.dockId)) return jsonError(res, 400, 'Invalid Dock ID.');
      const dock = await db.getDock(req.params.dockId);
      if (!dock) return jsonError(res, 404, 'That Dock no longer exists.');
      if (dock.guildId === access.guild.id) return jsonError(res, 400, 'Use Home pings to configure a Dock published by this server.');
      if (!isRecord(req.body)) return jsonError(res, 400, 'Follow settings must be a JSON object.');
      const ban = await db.getDockServerBan(dock.guildId, access.guild.id);
      if (ban) return jsonError(res, 403, 'This server is banned from that publisher’s Docks.');
      const channelIds = cleanStrings(req.body.channelIds, 1, 32);
      const channel = channelIds?.length ? access.guild.channels.cache.get(channelIds[0]) : null;
      if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return jsonError(res, 400, 'Choose a valid text or announcement receiving channel.');
      if ((await db.getDocksFromChannelId(channelIds[0])).length) return jsonError(res, 409, 'A Dock publishing channel cannot also receive Docks.');
      const missing = await missingBotPermissions(channel);
      if (missing.length) return jsonError(res, 400, `The bot is missing permissions in #${channel.name}: ${missing.join(', ')}.`);
      const pingValidation = validateKeywordPings(req.body, access.guild, dock);
      if (pingValidation.error) return jsonError(res, 400, pingValidation.error);
      const existing = await db.getDockFollower(dock._id, access.guild.id);
      if (existing?.banned) return jsonError(res, 403, 'This server is banned from that publisher’s Docks.');
      await db.setDockFollower(dock._id, access.guild.id, {
        guildName: access.guild.name,
        channelIds,
        ...pingValidation.value,
        level: existing?.level || (dock.accessMode === 'request' ? 'no-access' : dock.defaultLevel),
      });
      const follow = await db.getDockFollower(dock._id, access.guild.id);
      if (!existing) {
        const adminGuildIds = await dockAdminGuildIds(dock._id, access.guild.id);
        if (dock.accessMode === 'request') {
          await dockNotifications.relayFollowRequest(client, dock, {
            guildId: access.guild.id,
            guildName: access.guild.name,
            channelId: channel.id,
          }, { guildIds: [...new Set([dock.guildId, ...adminGuildIds])] });
        } else {
          await dockNotifications.relayText(
            client,
            dock._id,
            `**${dockNotifications.escape(client, access.guild.name)}** is now following **${dockNotifications.escape(client, dock.name)}**.\n-# Access level: ${client.modules.dockLevels.get(dock.defaultLevel).label}. ${client.modules.dockLevels.explain(dock.defaultLevel)}`,
            { guildIds: [...new Set([dock.guildId, access.guild.id, ...adminGuildIds])] },
          );
        }
      }
      return res.json({ follow: followerJson(follow, client) });
    } catch (error) {
      return next(error);
    }
  });

  api.delete('/guilds/:guildId/docks/:dockId/follow', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      if (!isObjectId(req.params.dockId)) return jsonError(res, 400, 'Invalid Dock ID.');
      const dock = await db.getDock(req.params.dockId);
      if (!dock) return jsonError(res, 404, 'That Dock no longer exists.');
      if (dock.guildId === access.guild.id) return jsonError(res, 400, 'Publishers cannot unfollow their own Dock.');
      const follow = await db.getDockFollower(dock._id, access.guild.id);
      if (!follow) return jsonError(res, 404, 'This server is not following that Dock.');
      await dockNotifications.relayText(
        client,
        dock._id,
        `**${dockNotifications.escape(client, access.guild.name)}** stopped following **${dockNotifications.escape(client, dock.name)}** from the dashboard.`,
        { guildIds: [dock.guildId, access.guild.id] },
      );
      await db.removeDockFollower(dock._id, access.guild.id);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  api.get('/guilds/:guildId/docks/:dockId/followers', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const dock = await managedDock(req, res, access);
      if (!dock) return;
      const followers = (await db.getDockFollowers(dock._id)).filter((item) => item.guildId !== dock.guildId);
      return res.json({ followers: followers.map((item) => followerJson(item, client)) });
    } catch (error) {
      return next(error);
    }
  });

  api.patch('/guilds/:guildId/docks/:dockId/followers/:followerGuildId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      if (!isRecord(req.body) || !activeLevels.includes(req.body.level)) return jsonError(res, 400, 'Choose a valid follower level.');
      const dock = await managedDock(req, res, access);
      if (!dock) return;
      const follower = await db.getDockFollower(dock._id, req.params.followerGuildId);
      if (!follower || follower.guildId === dock.guildId || follower.banned) return jsonError(res, 404, 'That follower was not found.');
      await db.setDockFollower(dock._id, follower.guildId, { level: req.body.level });
      if (follower.level !== req.body.level) {
        const details = client.modules.dockLevels.get(req.body.level);
        await dockNotifications.relayText(
          client,
          dock._id,
          `**${dockNotifications.escape(client, follower.guildName || follower.guildId)}** now has **${details.label}** access to **${dockNotifications.escape(client, dock.name)}**.\n-# ${client.modules.dockLevels.explain(req.body.level)} Updated from the dashboard by ${dockNotifications.escape(client, access.guild.name)}`,
          { guildIds: [dock.guildId, follower.guildId] },
        );
      }
      return res.json({ follower: followerJson({ ...follower, level: req.body.level }, client) });
    } catch (error) {
      return next(error);
    }
  });

  api.delete('/guilds/:guildId/docks/:dockId/followers/:followerGuildId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const dock = await managedDock(req, res, access);
      if (!dock) return;
      const follower = await db.getDockFollower(dock._id, req.params.followerGuildId);
      if (!follower || follower.guildId === dock.guildId) return jsonError(res, 404, 'That follower was not found.');
      if (follower.banned) return jsonError(res, 409, 'Unban this server from the Server bans tab instead.');
      const action = follower.level === 'no-access' ? 'denied the follow request from' : 'removed';
      await dockNotifications.relayText(
        client,
        dock._id,
        `**${dockNotifications.escape(client, access.guild.name)}** ${action} **${dockNotifications.escape(client, follower.guildName || follower.guildId)}** ${follower.level === 'no-access' ? `for **${dockNotifications.escape(client, dock.name)}**` : `from **${dockNotifications.escape(client, dock.name)}**`}.`,
        { guildIds: [dock.guildId, follower.guildId] },
      );
      await db.removeDockFollower(dock._id, follower.guildId);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  api.get('/guilds/:guildId/bans', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      return res.json({ bans: (await db.getDockServerBans(access.guild.id)).map(banJson) });
    } catch (error) {
      return next(error);
    }
  });

  api.get('/guilds/:guildId/ban-candidates', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const banned = new Set(
        (await db.getDockServerBans(access.guild.id)).map((ban) => ban.targetGuildId),
      );
      const guilds = [...client.guilds.cache.values()]
        .filter((guild) => guild.id !== access.guild.id && !banned.has(guild.id))
        .map((guild) => ({
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ size: 128 }),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return res.json({ guilds });
    } catch (error) {
      return next(error);
    }
  });

  api.put('/guilds/:guildId/bans/:targetGuildId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      if (!isRecord(req.body)) return jsonError(res, 400, 'Ban details must be a JSON object.');
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
      const target = client.guilds.cache.get(req.params.targetGuildId);
      if (!target || target.id === access.guild.id || !reason || reason.length > 500) return jsonError(res, 400, 'Choose another known server and provide a reason up to 500 characters.');
      if (await db.getDockServerBan(access.guild.id, target.id)) return jsonError(res, 409, 'That server is already banned.');
      const ownerDocks = await db.getPublishedDocksForGuild(access.guild.id);
      await Promise.all(ownerDocks.map((dock) => dockNotifications.relayText(
        client,
        dock._id,
        `**${dockNotifications.escape(client, target.name)}** was banned from following Docks published by **${dockNotifications.escape(client, access.guild.name)}**.\n\n**Reason:** ${dockNotifications.escape(client, reason)}\n**Moderator:** ${dockNotifications.escape(client, req.user.username)}`,
      )));
      const fields = { ownerGuildName: access.guild.name, targetGuildName: target.name, reason, bannedAt: new Date(), bannedByUserId: req.user.id };
      await db.setDockServerBan(access.guild.id, target.id, fields);
      await db.banDockFollow(access.guild.id, target.id, { guildName: target.name, banReason: reason, bannedAt: fields.bannedAt, bannedByUserId: req.user.id });
      return res.json({ ban: banJson({ targetGuildId: target.id, ...fields }) });
    } catch (error) {
      return next(error);
    }
  });

  api.delete('/guilds/:guildId/bans/:targetGuildId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const ban = await db.getDockServerBan(access.guild.id, req.params.targetGuildId);
      if (!ban) return jsonError(res, 404, 'That ban was not found.');
      const ownerDocks = await db.getPublishedDocksForGuild(access.guild.id);
      await Promise.all(ownerDocks.map((dock) => dockNotifications.relayText(
        client,
        dock._id,
        `**${dockNotifications.escape(client, ban.targetGuildName || ban.targetGuildId)}** was unbanned from following Docks published by **${dockNotifications.escape(client, access.guild.name)}**.`,
        { guildIds: [access.guild.id, ban.targetGuildId] },
      )));
      await db.removeDockServerBan(access.guild.id, req.params.targetGuildId);
      await db.unbanDockFollow(access.guild.id, req.params.targetGuildId);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.use('/api', api);
  app.use('/api', (_req, res) => jsonError(res, 404, 'API route not found.'));

  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, {
      maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0,
      immutable: process.env.NODE_ENV === 'production',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.set('Cache-Control', 'no-cache');
      },
    }));
    app.get(/^\/(?!api(?:\/|$)|auth(?:\/|$)|invite$|brand(?:\/|$)).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      return res.sendFile(path.join(staticDir, 'index.html'));
    });
  } else {
    app.get(/^\/(?!api(?:\/|$)|auth(?:\/|$)|invite$|brand(?:\/|$)).*/, (_req, res) => {
      return jsonError(res, 503, 'The dashboard has not been built. Run npm run build, then restart the bot.');
    });
  }

  Sentry.setupExpressErrorHandler(app);
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const eventId = res.sentry || Sentry.captureException(error, { tags: { source: 'express' } });
    return res.status(500).json({ error: 'Something went wrong.', eventId });
  });
  return app;
}

function startServer(options) {
  const app = createApp(options);
  const port = Number(process.env.PORT) || 7999;
  return app.listen(port, () => console.log(`🌐 Website running on port ${port}`));
}

module.exports = { createApp, startServer, decodeSession, encodeSession, encodeDiscordToken };
