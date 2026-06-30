<div align="center">
    <br/>
    <p>
        <img src="/static/logo.png" title="sailor's lodge" alt="sailor's lodge logo" width="200" />
    </p>
    <p>
        An Arcane Odyssey Discord bot for creating parties, finding players, and sharing live message feeds across servers.
        <br/>
    </p>
    <br/>
</div>

Sailor's Lodge gives Arcane Odyssey communities a port to manage parties and player-hosted events. Players can create a customizable Party Card with buttons, share a join code, and keep party members updated through announcements. Server owners can connect their community to a larger network of party activity while keeping control of which channels and roles are used.

## Get started

**[Add Sailor's Lodge to your Discord server](https://discord.com/oauth2/authorize?client_id=1460833970748002404)**

After adding the bot:

- Run `/help` for the player and party guide.
- Run `/dock help` to set up cross-server party feeds.
- Run `/settings help` to configure this server's ping groups, keyword pings, and LFG role.

## Why add Sailor's Lodge?

- Create parties with a name, description, status, member limit, visibility, and join code.
- Let players join, leave, view, edit, lock, or manage a party through simple slash commands.
- Send party announcements and notifications directly to party members.
- Recruit immediately or schedule a ping for later with server-configured ping groups and Looking For Group roles.
- Connect your community or personal server to live boards from other Discord servers through Docks.
- Configure ping roles, allowed roles, and optional keyword triggers specifically for your server.

## Party cards

Party cards keep the important details of a group all in one message: its name, description, status, visibility, join code, member limit, host, and current members. The card also includes buttons to join, leave, or refresh the Discord group.
- Create a party with `/party create`
- Manage your party with `/party togglelock`, `/party kick`, `/party delete`, `/party edit`
- Show your party card to your friends with `/party show`.
- If your server owner has configured Ping Groups with Sailor's Lodge, you can use `/party ping` to ping a role for your party

## What are Docks?

Docks are shared, live message boards between Discord servers. (dont worry, you choose which channels get added)

A server can follow a Dock and receive relevant messages and pings in one of its own channels!

A server manager can:

1. Use `/dock publish` to turn up to 10 channels into a Dock that other servers can discover.
2. Choose whether the Dock forwards every message, or only messages published with `!p` prefix.
3. Keep the Dock open for anyone to follow, or request-to-follow
4. Add keywords that trigger configured Dock ping roles
5. Use `/dock browse` to discover another server's Dock.
6. Use `/dock manage` to configure published or followed docks

**Note:** Dock settings and Dock ping roles are *separate* from the regular ping groups. Regular ping groups only belong only to the Discord server where they were created, while Dock pings are across servers
- Dock management requires the **Manage Channels** permission so server owners remain in control.

