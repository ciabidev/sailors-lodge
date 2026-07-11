const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const Sentry = require('@sentry/node');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { ObjectId } = require('mongodb');

const SESSION_COOKIE = 'sailors_session';
const STATE_COOKIE = 'sailors_oauth_state';
const COOKIE_TTL = 7 * 24 * 60 * 60;
const levels = ['no-access', 'passive', 'sender', 'contributor', 'admin'];

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8000').replace(/\/$/, '');
}

function secret() {
  return process.env.AUTH_SECRET || '';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function encodeSession(user) {
  const payload = Buffer.from(JSON.stringify({ ...user, expiresAt: Date.now() + COOKIE_TTL * 1000 }))
    .toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value) {
  if (!value || !secret()) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key]) => key),
  );
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

function cleanStrings(values, max = 25) {
  if (!Array.isArray(values)) return null;
  const cleaned = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  return cleaned.length <= max ? cleaned : null;
}

function dockJson(dock, follow = null, followerCount = 0) {
  return {
    id: dock._id.toString(),
    name: dock.name,
    description: dock.description || '',
    guildId: dock.guildId,
    guildName: dock.guildName,
    guildIconURL: dock.guildIconURL || null,
    channelIds: dock.channelIds || [],
    keywords: dock.keywords || [],
    publishMode: dock.publishMode || 'manual',
    accessMode: dock.accessMode || 'open',
    defaultLevel: dock.defaultLevel || 'passive',
    gatekeeperRoleId: dock.gatekeeperRoleId || null,
    official: Boolean(dock.official),
    followerCount,
    follow: follow
      ? {
          guildId: follow.guildId,
          guildName: follow.guildName,
          channelIds: follow.channelIds || [],
          keywordPings: follow.keywordPings || {},
          pingOwnServer: follow.pingOwnServer !== false,
          level: follow.level || 'passive',
          banned: Boolean(follow.banned),
        }
      : null,
  };
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
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const channelIds = cleanStrings(body.channelIds, 10);
  const keywords = cleanStrings(body.keywords || [], 25);
  if (!name || name.length > 150) return { error: 'Dock names must be between 1 and 150 characters.' };
  if (description.length > 500) return { error: 'Dock descriptions cannot exceed 500 characters.' };
  if (!channelIds?.length) return { error: 'Choose between 1 and 10 publishing channels.' };
  if (!keywords) return { error: 'Docks can have at most 25 unique keywords.' };
  if (!['all', 'manual'].includes(body.publishMode)) return { error: 'Invalid publishing mode.' };
  if (!['open', 'request'].includes(body.accessMode)) return { error: 'Invalid access mode.' };
  if (!levels.includes(body.defaultLevel || 'passive')) return { error: 'Invalid default follower level.' };
  const channels = channelIds.map((id) => guild.channels.cache.get(id));
  if (channels.some((channel) => !channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type))) {
    return { error: 'Every publishing channel must be a text or announcement channel in this server.' };
  }
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
  app.use(express.json({ limit: '100kb' }));
  app.use('/brand', express.static(path.join(__dirname, '../../static'), { maxAge: '1d' }));
  app.use((req, _res, next) => {
    req.user = decodeSession(cookies(req)[SESSION_COOKIE]);
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

  app.get('/invite', (_req, res) => {
    const clientId = process.env.DEV_MODE === 'true' ? process.env.DEV_CLIENT_ID : process.env.PRODUCTION_CLIENT_ID;
    if (!clientId) return jsonError(res, 503, 'The bot invite is not configured.');
    const query = new URLSearchParams({ client_id: clientId, scope: 'bot applications.commands' });
    return res.redirect(`https://discord.com/oauth2/authorize?${query}`);
  });

  app.get('/auth/discord', (_req, res) => {
    const clientId = process.env.AUTH_DISCORD_ID;
    if (!clientId || !secret()) return jsonError(res, 503, 'Discord sign-in is not configured.');
    const state = crypto.randomBytes(24).toString('base64url');
    setCookie(res, STATE_COOKIE, `${state}.${sign(state)}`, 600);
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'identify',
      state,
      redirect_uri: `${appUrl()}/auth/discord/callback`,
    });
    return res.redirect(`https://discord.com/oauth2/authorize?${query}`);
  });

  app.get('/auth/discord/callback', async (req, res, next) => {
    try {
      const saved = cookies(req)[STATE_COOKIE];
      const [savedState, signature] = (saved || '').split('.');
      if (!savedState || !signature || sign(savedState) !== signature || savedState !== req.query.state) {
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
      setCookie(res, SESSION_COOKIE, encodeSession(cleanUser(await profileResponse.json())), COOKIE_TTL);
      return res.redirect('/dashboard');
    } catch (error) {
      return next(error);
    }
  });

  app.post('/auth/logout', (req, res) => {
    const origin = req.get('origin');
    if (origin && origin !== appUrl() && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin))) return jsonError(res, 403, 'Cross-origin request blocked.');
    clearCookie(res, SESSION_COOKIE);
    return res.status(204).end();
  });

  const api = express.Router();
  api.use((req, res, next) => {
    if (!req.user) return jsonError(res, 401, 'Sign in with Discord to continue.');
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && origin !== appUrl() && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin))) return jsonError(res, 403, 'Cross-origin request blocked.');
      if (!req.is('application/json')) return jsonError(res, 415, 'Use application/json for this request.');
    }
    return next();
  });

  api.get('/me', (req, res) => res.json({ user: cleanUser(req.user) }));

  api.get('/guilds', async (req, res, next) => {
    try {
      const guilds = [];
      for (const guild of client.guilds.cache.values()) {
        const access = await memberAccess(client, guild.id, req.user.id);
        if (!access || (!access.manageGuild && !access.manageChannels)) continue;
        guilds.push({
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ size: 128 }),
          owner: access.owner,
          manageGuild: access.manageGuild,
          manageChannels: access.manageChannels,
        });
      }
      return res.json({ guilds: guilds.sort((a, b) => a.name.localeCompare(b.name)) });
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
    return access;
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
      return res.json({
        guild: {
          id: access.guild.id,
          name: access.guild.name,
          icon: access.guild.iconURL({ size: 128 }),
          owner: access.owner,
          manageGuild: access.manageGuild,
          manageChannels: access.manageChannels,
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
        counts: { published: published.length, following: followed.filter((dock) => dock.guildId !== access.guild.id).length, bans: bans.length },
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
          const name = typeof group.name === 'string' ? group.name.trim() : '';
          const key = name.toLowerCase();
          const allowedRoles = cleanStrings(group.allowedRoles || [], 25);
          const keywords = cleanStrings(group.keywords || [], 25);
          if (!name || name.length > 100 || seen.has(key)) return jsonError(res, 400, 'Every ping group needs a unique name up to 100 characters.');
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
      const access = await withGuild(req, res);
      if (!access) return;
      const view = ['published', 'following', 'discover'].includes(req.query.view) ? req.query.view : 'discover';
      let docks = view === 'published'
        ? await db.getPublishedDocksForGuild(access.guild.id)
        : view === 'following'
          ? await db.getFollowedDocksForGuild(access.guild.id)
          : await db.getDocks();
      const search = String(req.query.q || '').trim().toLowerCase();
      if (search) docks = docks.filter((dock) => `${dock.name} ${dock.guildName} ${dock.description}`.toLowerCase().includes(search));
      const items = await Promise.all(docks.map(async (dock) => dockJson(
        dock,
        await db.getDockFollower(dock._id, access.guild.id),
        await db.countDockFollowers(dock._id, dock.guildId),
      )));
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
      }
      const value = validation.value;
      const result = await db.createDock(value.name, access.guild.id, access.guild.name, value.channelIds, value.description, value.keywords, value.publishMode, value.accessMode, value.defaultLevel);
      await db.updateDock(result.insertedId, { $set: { gatekeeperRoleId: value.gatekeeperRoleId, guildIconURL: access.guild.iconURL({ size: 128 }) } });
      await db.setDockFollower(result.insertedId, access.guild.id, { guildName: access.guild.name, channelIds: value.channelIds, keywordPings: {} });
      const dock = await db.getDock(result.insertedId);
      return res.status(201).json({ dock: dockJson(dock) });
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
      }
      const updated = await db.updateDock(dock._id, { $set: validation.value, $unset: { channelNames: '' } });
      await db.setDockFollower(dock._id, access.guild.id, { channelIds: validation.value.channelIds });
      return res.json({ dock: dockJson(updated) });
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
      await db.removeDock(dock._id);
      return res.status(204).end();
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
      const ban = await db.getDockServerBan(dock.guildId, access.guild.id);
      if (ban) return jsonError(res, 403, 'This server is banned from that publisher’s Docks.');
      const channelIds = cleanStrings(req.body.channelIds, 1);
      if (!channelIds?.length || !access.guild.channels.cache.has(channelIds[0])) return jsonError(res, 400, 'Choose a valid receiving channel.');
      if ((await db.getDocksFromChannelId(channelIds[0])).length) return jsonError(res, 409, 'A Dock publishing channel cannot also receive Docks.');
      const keywordPings = {};
      for (const [keyword, roleIds] of Object.entries(req.body.keywordPings || {})) {
        if (!dock.keywords?.includes(keyword)) return jsonError(res, 400, `“${keyword}” is not a keyword for this Dock.`);
        const roles = cleanStrings(roleIds, 25);
        if (!roles || roles.some((id) => !access.guild.roles.cache.has(id))) return jsonError(res, 400, 'A selected ping role no longer exists.');
        keywordPings[keyword] = roles;
      }
      const existing = await db.getDockFollower(dock._id, access.guild.id);
      await db.setDockFollower(dock._id, access.guild.id, {
        guildName: access.guild.name,
        channelIds,
        keywordPings,
        pingOwnServer: req.body.pingOwnServer !== false,
        level: existing?.level || (dock.accessMode === 'request' ? 'no-access' : dock.defaultLevel),
      });
      return res.json({ follow: await db.getDockFollower(dock._id, access.guild.id) });
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
      if (!isObjectId(req.params.dockId)) return jsonError(res, 400, 'Invalid Dock ID.');
      const dock = await db.getDock(req.params.dockId);
      if (!dock) return jsonError(res, 404, 'That Dock no longer exists.');
      const managingFollow = dock.guildId === access.guild.id ? null : await db.getDockFollower(dock._id, access.guild.id);
      if (dock.guildId !== access.guild.id && !client.modules.dockLevels.canManage(managingFollow?.level)) return jsonError(res, 403, 'Admin Dock access is required.');
      const followers = (await db.getDockFollowers(dock._id)).filter((item) => item.guildId !== dock.guildId);
      return res.json({ followers: followers.map((item) => ({ ...item, _id: undefined, dockId: undefined })) });
    } catch (error) {
      return next(error);
    }
  });

  api.patch('/guilds/:guildId/docks/:dockId/followers/:followerGuildId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      if (!isObjectId(req.params.dockId) || !levels.includes(req.body.level)) return jsonError(res, 400, 'Choose a valid follower level.');
      const dock = await db.getDock(req.params.dockId);
      if (!dock) return jsonError(res, 404, 'That Dock no longer exists.');
      const managingFollow = dock.guildId === access.guild.id ? null : await db.getDockFollower(dock._id, access.guild.id);
      if (dock.guildId !== access.guild.id && !client.modules.dockLevels.canManage(managingFollow?.level)) return jsonError(res, 403, 'Admin Dock access is required.');
      const follower = await db.getDockFollower(dock._id, req.params.followerGuildId);
      if (!follower || follower.guildId === dock.guildId || follower.banned) return jsonError(res, 404, 'That follower was not found.');
      await db.setDockFollower(dock._id, follower.guildId, { level: req.body.level });
      return res.json({ follower: { ...follower, level: req.body.level, _id: undefined, dockId: undefined } });
    } catch (error) {
      return next(error);
    }
  });

  api.delete('/guilds/:guildId/docks/:dockId/followers/:followerGuildId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      if (!isObjectId(req.params.dockId)) return jsonError(res, 400, 'Invalid Dock ID.');
      const dock = await db.getDock(req.params.dockId);
      if (!dock) return jsonError(res, 404, 'That Dock no longer exists.');
      const managingFollow = dock.guildId === access.guild.id ? null : await db.getDockFollower(dock._id, access.guild.id);
      if (dock.guildId !== access.guild.id && !client.modules.dockLevels.canManage(managingFollow?.level)) return jsonError(res, 403, 'Admin Dock access is required.');
      const follower = await db.getDockFollower(dock._id, req.params.followerGuildId);
      if (!follower || follower.guildId === dock.guildId) return jsonError(res, 404, 'That follower was not found.');
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
      return res.json({ bans: await db.getDockServerBans(access.guild.id) });
    } catch (error) {
      return next(error);
    }
  });

  api.put('/guilds/:guildId/bans/:targetGuildId', async (req, res, next) => {
    try {
      const access = await withGuild(req, res, 'manageChannels');
      if (!access) return;
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
      const target = client.guilds.cache.get(req.params.targetGuildId);
      if (!target || target.id === access.guild.id || !reason || reason.length > 500) return jsonError(res, 400, 'Choose another known server and provide a reason up to 500 characters.');
      const fields = { ownerGuildName: access.guild.name, targetGuildName: target.name, reason, bannedAt: new Date(), bannedByUserId: req.user.id };
      await db.setDockServerBan(access.guild.id, target.id, fields);
      await db.banDockFollow(access.guild.id, target.id, { guildName: target.name, banReason: reason, bannedAt: fields.bannedAt, bannedByUserId: req.user.id });
      return res.json({ ban: { ownerGuildId: access.guild.id, targetGuildId: target.id, ...fields } });
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
      await db.removeDockServerBan(access.guild.id, req.params.targetGuildId);
      await db.unbanDockFollow(access.guild.id, req.params.targetGuildId);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.use('/api', api);

  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
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
  const port = Number(process.env.PORT) || 8000;
  return app.listen(port, () => console.log(`🌐 Website running on port ${port}`));
}

module.exports = { createApp, startServer, decodeSession, encodeSession };
