import { Scale, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ExternalAnchor } from "@/components/ui/external-anchor";
import { PublicHeader } from "@/pages/Landing";

const SUPPORT_URL = "https://discord.gg/C6XGxP4gjs";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#626880]/50 py-8 first:border-0 first:pt-0">
      <h2 className="font-display text-xl font-semibold text-[#c6d0f5] sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 leading-7 text-[#b5bfe2]">{children}</div>
    </section>
  );
}

function LegalPage({
  title,
  intro,
  icon,
  children,
}: {
  title: string;
  intro: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#303446] text-[#c6d0f5]">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-5 pb-16 pt-32 sm:px-8 sm:pb-24 sm:pt-40">
        <div className="flex items-start gap-4">
          <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-xl border border-[#8caaee]/25 bg-[#8caaee]/10 text-[#8caaee]">
            {icon}
          </span>
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {title}
            </h1>
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-base leading-7 text-[#a5adce] sm:text-lg">{intro}</p>
        <p className="mt-3 text-sm text-[#838ba7]">Last updated July 21, 2026</p>

        <Card className="mt-10 border-[#626880]/60 bg-[#292c3c] p-6 sm:p-10">{children}</Card>
      </main>

      <footer className="border-t border-[#626880]/50">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-8 text-sm text-[#a5adce] sm:px-8">
          <Link to="/" className="hover:text-[#c6d0f5]">
            Sailor’s Lodge
          </Link>
          <Link to="/privacy" className="hover:text-[#c6d0f5]">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-[#c6d0f5]">
            Terms of Service
          </Link>
          <a href={SUPPORT_URL} className="hover:text-[#c6d0f5]">
            Support
          </a>
        </div>
      </footer>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Here's a straightforward explanation of what the official Sailor's Lodge bot and dashboard process, why it's needed, and how you can ask for it to be removed. If you're on a separately hosted instance, that operator controls their own data practices."
      icon={<ShieldCheck className="size-5" aria-hidden="true" />}
    >
      <Section title="What we process">
        <p>Sailor's Lodge doesn't connect to Roblox and doesn't collect any Roblox account data.</p>
        <p>To make its Discord features work, it may process:</p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[#8caaee]">
          <li>Discord user IDs, usernames, display names, and avatars.</li>
          <li>Your saved timezone when you configure scheduled pings.</li>
          <li>
            Server names and IDs, channel and thread IDs, role IDs, permissions, and server
            settings.
          </li>
          <li>
            Party names, descriptions, statuses, hosts, members, join codes, and party-card
            locations.
          </li>
          <li>
            Dock settings, followers, access levels, server bans, and related moderation data.
          </li>
          <li>
            Message content, attachments, embeds, replies, edits, deletions, and threads going
            through configured Docks.
          </li>
          <li>Dashboard session info and a temporary encrypted Discord OAuth token.</li>
          <li>Anything you include in bug reports, plus limited error and diagnostic data.</li>
        </ul>
      </Section>

      <Section title="Why we use it">
        <p>
          The data is used to make features work — Docks, notifications, keyword pings, parties,
          server settings, moderation tools, and the dashboard all rely on it.
        </p>
        <p>
          It's also used for security, abuse prevention, and tracking down bugs when things go
          wrong.
        </p>
        <p>
          We don't sell your information. We don't use it for advertising. We don't profile you for
          anything unrelated to running the bot.
        </p>
      </Section>

      <Section title="How Docks share messages">
        <p>
          Docks read messages in channels chosen by server admins and may copy the author's display
          info, message content, attachments, embeds, replies, and threads to other Discord servers
          connected to that Dock.
        </p>
        <p>
          Depending on the Dock's settings, this happens either for every message or only for
          messages manually published with{" "}
          <code className="rounded bg-[#414559] px-1.5 py-0.5 text-[#c6d0f5]">!p</code>.
        </p>
        <p>
          Both the original message and any relayed copies are stored by Discord under their own
          policies. People in destination servers may be able to see or save that content, so it's
          best not to send anything sensitive through a Dock.
        </p>
      </Section>

      <Section title="Cookies and signing in">
        <p>
          The dashboard uses essential, HTTP-only cookies to handle Discord sign-in, keep you logged
          in, and show the servers you can manage.
        </p>
        <p>
          Signing in requests Discord's{" "}
          <code className="mx-1 rounded bg-[#414559] px-1.5 py-0.5 text-[#c6d0f5]">identify</code>
          and <code className="rounded bg-[#414559] px-1.5 py-0.5 text-[#c6d0f5]">guilds</code>{" "}
          scopes — nothing more.
        </p>
        <p>Cookies expire after seven days at most, or immediately when you sign out.</p>
      </Section>

      <Section title="Who else sees the data">
        <p>
          Since this is a Discord bot, data passes through Discord itself and the services used to
          keep Sailor's Lodge running. That includes Koyeb for hosting, a MongoDB provider for the
          database, and Sentry for error reporting.
        </p>
        <p>
          Outside of that, data may only be shared if the law requires it, if it's needed to protect
          users or the service, or if you directed the bot to relay it to another server.
        </p>
      </Section>

      <Section title="How long we keep things">
        <ul className="list-disc space-y-3 pl-6 marker:text-[#8caaee]">
          <li>Dashboard cookies expire after seven days or when you sign out.</li>
          <li>
            Active parties expire after seven days. When a party is deleted or expires, memberships
            are cleared. The party record and card references may stick around a bit longer to
            cleanly update old cards and avoid errors.
          </li>
          <li>
            Deleting a Dock permanently removes its records and follower list from the database.
          </li>
          <li>
            Technical routing records for relayed messages — things like message, channel, and
            delivery IDs — may currently outlive the messages themselves. These don't include any
            message content. We're working on automatically deleting these records.
          </li>
          <li>
            Other configuration and moderation records stick around as long as they're needed to run
            the service, enforce bans, prevent abuse, or meet legal requirements.
          </li>
        </ul>
      </Section>

      <Section title="Deleting your data">
        <p>
          You can sign out of the dashboard whenever you like. Server admins can unfollow or delete
          Docks, wipe server settings, or remove the bot from their server entirely.
        </p>
        <p>
          To request access to, correction of, or deletion of data tied to your Discord account or
          server, reach out in the{" "}
          <ExternalAnchor href={SUPPORT_URL}>Ciabi support server</ExternalAnchor> and include your
          Discord user or server ID so we can find the right records.
        </p>
        <p>
          We may hold onto limited records where genuinely necessary — things like active server
          bans, open disputes, or legal obligations.
        </p>
      </Section>

      <Section title="Security and updates">
        <p>
          We take reasonable steps to protect stored data, but no online service is completely
          bulletproof.
        </p>
        <p>
          This policy will be updated if Sailor's Lodge changes in ways that affect it. When that
          happens, the date at the top of this page will change too.
        </p>
        <p>
          Any privacy questions or concerns are welcome in the{" "}
          <ExternalAnchor href={SUPPORT_URL}>support server</ExternalAnchor>.
        </p>
      </Section>
    </LegalPage>
  );
}
export function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms apply to the official Sailor's Lodge bot and dashboard, run by Ciabi. If you're on a separately hosted instance, that operator sets their own terms."
      icon={<Scale className="size-5" aria-hidden="true" />}
    >
      <Section title="Using the service">
        <p>
          By using Sailor's Lodge, you're agreeing to these terms and the Privacy Policy. If you
          don't agree, don't use the service. You also need to meet the minimum age to use Discord
          in your country and follow Discord's own Terms of Service and Community Guidelines.
        </p>
      </Section>

      <Section title="We're not affiliated with anyone">
        <p>
          Sailor's Lodge is an unofficial community project. It has no affiliation with, endorsement
          from, or sponsorship by Vetex, Arcane Odyssey, Roblox Corporation, or Discord Inc. All
          game names, trademarks, artwork, and other third-party materials belong to their
          respective owners.
        </p>
      </Section>

      <Section title="What you're responsible for">
        <p>
          You're responsible for how you use Sailor's Lodge and what you send through it. Don't use
          the service to:
        </p>
        <ul className="list-disc space-y-2 pl-6 marker:text-[#8caaee]">
          <li>Harass, threaten, dox, stalk, or discriminate against anyone.</li>
          <li>Spam, coordinate raids, evade bans, or disrupt servers.</li>
          <li>
            Impersonate others or spread scams, phishing, malware, or deliberately misleading
            content.
          </li>
          <li>
            Share illegal, sexually exploitative, infringing, or otherwise prohibited material.
          </li>
          <li>
            Distribute cheats or exploits, compromise accounts or systems, or help with anything
            prohibited by Discord, Roblox, or Arcane Odyssey's rules.
          </li>
          <li>Relay content you don't own or don't have permission to share.</li>
        </ul>
      </Section>

      <Section title="Your content">
        <p>
          What you send is your responsibility. By submitting content, you give Sailor's Lodge
          permission to access, process, display, copy, and transmit it — but only to make the
          features you're using actually work, like Docks, party cards, announcements, DM
          notifications, and moderation tools.
        </p>
        <p>
          Make sure you have the rights to submit and relay anything you send. Don't share
          confidential information or someone else's personal information without their permission.
        </p>
      </Section>

      <Section title="How Docks work">
        <p>
          Docks can copy messages, edits, deletions, attachments, replies, and threads between
          Discord servers. If your server uses a Dock, you need to clearly let members know —
          especially when every message in a channel is forwarded automatically. Make sure channel
          access and permissions are set up appropriately.
        </p>
        <p>
          Everyone using a Dock — hosts, admins, and members — is responsible for following the
          rules of every server they're communicating with. Relayed messages may stay visible or be
          saved by destination servers even after the original is edited or deleted. Once content
          leaves your server, Sailor's Lodge can't control what others do with it.
        </p>
        <p>
          If you need to block another server, you can do that through the dashboard or with{" "}
          <code className="rounded bg-[#414559] px-1.5 py-0.5 text-[#c6d0f5]">/dock ban</code>.
        </p>
      </Section>

      <Section title="Enforcement">
        <p>
          We may remove content or restrict access for users or servers that break these terms,
          threaten the service, try to evade enforcement, or put other users at risk. In serious
          cases, enforcement may extend to other Ciabi services. If you think a decision was wrong,
          you can raise it in the <ExternalAnchor href={SUPPORT_URL}>support server</ExternalAnchor>
          .
        </p>
        <p>
          Sailor's Lodge moderation isn't a replacement for Discord's own reporting tools or server
          moderation. Serious Discord violations should also be reported directly to Discord and the
          relevant server admins.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          Sailor's Lodge is provided as-is and when available. We can't promise it'll be up all the
          time, that every message or notification will be delivered, that content will always be
          preserved, or that everything will work perfectly with every server setup. Features may
          change, go on pause, or be removed when necessary.
        </p>
        <p>
          To the extent the law allows, Ciabi isn't liable for indirect losses or for what users,
          server admins, Discord, Roblox, Vetex, or other third parties do. Nothing here removes
          rights or liabilities that can't legally be excluded.
        </p>
      </Section>

      <Section title="Changes and getting in touch">
        <p>
          These terms may be updated as the service changes. The date at the top of this page
          reflects the latest revision. Continuing to use Sailor's Lodge after an update means you
          accept the new terms — if you don't agree, stop using the service.
        </p>
        <p>
          Questions, reports, appeals, and intellectual property concerns can all be sent through
          the <ExternalAnchor href={SUPPORT_URL}>Ciabi support server</ExternalAnchor>.
        </p>
        <p>
          Sailor's Lodge is open source and contributions are welcome over on{" "} <ExternalAnchor href="https://github.com/ciabidev/sailors-lodge">GitHub</ExternalAnchor>.
        </p>
      </Section>
    </LegalPage>
  );
}
