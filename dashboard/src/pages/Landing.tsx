import {
  Anchor,
  ArrowRight,
  BellRing,
  Crown,
  Fish,
  Flame,
  Github,
  Hash,
  Menu,
  Moon,
  Network,
  PartyPopper,
  Radio,
  ShieldCheck,
  Swords,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalAnchor } from "@/components/ui/external-anchor";
import { getPublicServers, type PublicServer } from "@/lib/api";
const features = [
  {
    icon: Network,
    title: "build your feed",
    copy: "let the parties come to you, or contribute to your community. choose the party docks youre interested in and control the channels",
    tone: "blue",
  },
  {
    icon: BellRing,
    title: "any kind of activity",
    copy: "easily set up docks and ping groups for about anything in the game, even elysium pvp",
    tone: "lavender",
  },
  {
    icon: PartyPopper,
    title: "host without chaos",
    copy: "use /party create to create a party card that also counts members who will join. when used with Docks, these party cards are relayed across servers with cross-server threads.",
    tone: "yellow",
  },
];

const dockBenefits = [
  {
    icon: Users,
    title: "like a real chat",
    copy: "everything works as it would in a normal channel, you can send, delete, edit messages, and everything will be replicated on other Discord servers.",
  },
  {
    icon: Anchor,
    title: "you're in control",
    copy: "you decide what roles get pinged, who can follow your docks, and what messages get forwarded.",
  },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="group flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8caaee]"
    >
      <span className="relative size-10 overflow-hidden rounded-lg border border-[#626880] bg-[#414559]">
        <img
          src="/logo.png"
          alt=""
          className="size-full scale-[1.65] object-cover object-[50%_56%] transition-transform group-hover:scale-[1.75]"
        />
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold text-[#c6d0f5]">Sailor’s Lodge</span>
      )}
    </Link>
  );
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      element.dataset.visible = "true";
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.visible = "true";
        observer.disconnect();
      },
      { threshold: 0.10, rootMargin: "0px 0px -3%" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

function DockAvatar({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-full text-[#303446] ${className}`}
      aria-hidden="true"
    >
      <Icon className="size-5" strokeWidth={2.5} />
    </span>
  );
}

function DockChat() {
  const partyMembers = [
    [Crown, "bg-[#e5c890]"],
    [Fish, "bg-[#8caaee]"],
    [Moon, "bg-[#babbf1]"],
    [Flame, "bg-[#ef9f76]"],
    [Anchor, "bg-[#a6d189]"],
    [Swords, "bg-[#e78284]"],
  ] as const;

  return (
    <Card className="dock-chat overflow-hidden border-[#626880]/60 bg-[#232634] p-0 shadow-[0_30px_80px_-35px_rgba(0,0,0,.9)]">
      <div className="flex items-center gap-2 border-b border-[#414559] bg-[#292c3c] px-4 py-3 shadow-sm">
        <Hash className="size-5 text-[#838ba7]" />
        <span className="font-semibold text-[#c6d0f5]">dragon-hunts</span>
        <span className="hidden border-l border-[#51576d] pl-3 text-xs text-[#838ba7] sm:block">
          Dragon Hunts Dock feed
        </span>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex gap-3">
          <DockAvatar icon={Anchor} className="bg-[#8caaee]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-[#c6d0f5]">Sailor’s Lodge</span>
              <Badge className="h-4 rounded-sm border-0 bg-[#5865f2] px-1 text-[9px] text-white">
                APP
              </Badge>
              <span className="text-[11px] text-[#737994]">Today at 8:12 PM</span>
            </div>
            <div className="mt-2 rounded-md border-l-4 border-[#a6d189] bg-[#292c3c] p-3">
              <p className="text-sm font-semibold text-[#c6d0f5]">
                Coral Keep is now following Dragon Hunts
              </p>
              <p className="mt-1 text-xs leading-5 text-[#a5adce]">
                Messages, pings, threads, and party cards from this Dock will appear here.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <DockAvatar icon={Flame} className="bg-[#ef9f76]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-[#f2d5cf]">
                Chibi [Dragon Hunts] [Sunfish Village]
              </span>

              <span className="text-[11px] text-[#737994]">Today at 8:16 PM</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#c6d0f5]">
              hosting dragon hunt in 30 minutes meet at sameria <br />
              -dragonping
            </p>
          </div>
        </div>
        <div className="ml-0 flex items-center gap-3 rounded-md border border-[#51576d] bg-[#292c3c] px-3 py-2.5 sm:ml-[52px]">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#babbf1]/15 text-[#babbf1]">
            <BellRing className="size-4" />
          </span>
          <p className="text-sm leading-5 text-[#b5bfe2]">
            <span className="rounded bg-[#5865f2]/30 px-1 font-semibold text-[#c6d0f5]">
              @Dragon Ping
            </span>{" "}
            Dragon Hunts ping triggered by Chibi!
          </p>
        </div>
        <div className="flex gap-3">
          <DockAvatar icon={Moon} className="bg-[#babbf1]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-[#babbf1]">Mira [Dragon Hunts] [Constellia]</span>

              <span className="text-[11px] text-[#737994]">Today at 8:18 PM</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#c6d0f5]">which dragons are we going for</p>
          </div>
        </div>
        <div className="flex gap-3">
          <DockAvatar icon={Flame} className="bg-[#ef9f76]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-[#f2d5cf]">
                Chibi [Dragon Hunts] [Sunfish Village]
              </span>

              <span className="text-[11px] text-[#737994]">Today at 8:18 PM</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#c6d0f5]">
              all information is in the party card
            </p>
          </div>
        </div>
        <div className="ml-0 overflow-hidden rounded-md border border-[#51576d] bg-[#292c3c] sm:ml-[52px]">
          <div className="border-l-4 border-[#8caaee] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-[#c6d0f5]">dragon hunt </p>
                <p className="mt-1 text-xs text-[#a5adce]">
                  Primary target is dragonlord dragon. were gonna be skipping any mythical dragons,
                  and skipping any omen on the way. bring your own warding build or potions, 14
                  seats
                </p>
              </div>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#8caaee]/15 text-[#8caaee]">
                <Swords className="size-5" />
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#b5bfe2]">
              <p>
                <span className="font-semibold text-[#c6d0f5]">Status:</span> Not Started
              </p>
              <p>
                <span className="font-semibold text-[#c6d0f5]">Visibility:</span> Public
              </p>
            </div>
            <div className="mt-4 border-t border-[#414559] pt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-[#c6d0f5]">
                  <Users className="size-4 text-[#8caaee]" /> 9/14 Members
                </p>
                <div className="flex -space-x-1.5" aria-label="Nine party members">
                  {partyMembers.map(([Icon, color], index) => (
                    <span
                      key={index}
                      className={`grid size-6 place-items-center rounded-full border-2 border-[#292c3c] text-[#303446] ${color}`}
                    >
                      <Icon className="size-3" strokeWidth={2.5} />
                    </span>
                  ))}
                  <span className="grid size-6 place-items-center rounded-full border-2 border-[#292c3c] bg-[#414559] text-[9px] font-semibold text-[#c6d0f5]">
                    +3
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-[#a5adce]">
                Party code: <span className="font-semibold text-[#c6d0f5]">/join TIDE42</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[#414559] p-3">
            <Button
              size="sm"
              aria-disabled="true"
              tabIndex={-1}
              className="pointer-events-none h-8 bg-[#40a25b] text-xs text-white hover:bg-[#35904d]"
            >
              Join Group
            </Button>
            <Button
              size="sm"
              variant="destructive"
              aria-disabled="true"
              tabIndex={-1}
              className="pointer-events-none h-8 text-xs"
            >
              Leave
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-disabled="true"
              tabIndex={-1}
              className="pointer-events-none h-8 text-xs"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PublicHeader() {
  const [menu, setMenu] = useState(false);
  return (
    <header className="fixed inset-x-0 top-4 z-40 px-4 sm:px-6">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#626880]/60 bg-[#303446]/90 shadow-[0_18px_50px_-24px_rgba(0,0,0,.9)] backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <nav
            className="hidden items-center gap-5 text-sm text-[#b5bfe2] md:flex"
            aria-label="Main navigation"
          >
            <Brand />

            <Link to="/status" className="hover:text-[#c6d0f5] font-semibold">Status</Link>
            <Link to="/privacy" className="hover:text-[#c6d0f5] font-semibold">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[#c6d0f5] font-semibold">Terms</Link>
            <a href="https://discord.gg/C6XGxP4gjs" className="hover:text-[#c6d0f5] font-semibold">Help</a>
              <a
                href="https://github.com/ciabidev/sailors-lodge"
                target="_blank"
                rel="noreferrer"
                aria-label="View Sailor's Lodge on GitHub"
                className="hover:text-[#c6d0f5] font-semibold"
              >
                GitHub
              </a>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost"><Link to="/dashboard">Manage Servers</Link></Button>
            <Button asChild className="bg-[#a6d189] text-[#303446] hover:bg-[#b4dda0]">
              <a href="/invite">Add to Discord <ArrowRight className="size-4" /></a>
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>
            {menu ? <X /> : <Menu />}
          </Button>
        </div>
        {menu && (
          <div className="border-t border-[#626880]/50 bg-[#292c3c] p-5 md:hidden">
            <nav className="grid gap-2">
              <Link to="/status" onClick={() => setMenu(false)} className="rounded-lg p-3 text-[#b5bfe2]">Status</Link>
              <Link to="/privacy" onClick={() => setMenu(false)} className="rounded-lg p-3 text-[#b5bfe2]">Privacy Policy</Link>
              <Link to="/terms" onClick={() => setMenu(false)} className="rounded-lg p-3 text-[#b5bfe2]">Terms of Service</Link>
              <a href="/#features" onClick={() => setMenu(false)} className="rounded-lg p-3 text-[#b5bfe2]">For AO crews</a>
              <a href="/#docks" onClick={() => setMenu(false)} className="rounded-lg p-3 text-[#b5bfe2]">How Docks work</a>
              <Button asChild variant="ghost" className="justify-start">
                <a
                  href="https://github.com/ciabidev/sailors-lodge"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenu(false)}
                >
                  <Github className="size-4" />
                  GitHub
                </a>
              </Button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button asChild variant="secondary"><Link to="/dashboard">Manage Servers</Link></Button>
                <Button asChild className="bg-[#a6d189] text-[#303446] hover:bg-[#b4dda0]"><a href="/invite">Add to Discord</a></Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

const memberFormatter = new Intl.NumberFormat("en-US");

function ServerCard({ server }: { server: PublicServer }) {
  return (
    <div className="flex h-15 min-w-52 max-w-64 items-center gap-3 rounded-xl border border-[#626880]/60 bg-[#292c3c]/90 px-3 text-left shadow-sm backdrop-blur-sm">
      {server.iconURL ? (
        <img
          src={server.iconURL}
          alt=""
          className="size-10 shrink-0 rounded-lg bg-[#414559] object-cover"
          loading="lazy"
        />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#414559] text-[#8caaee]">
          <Users className="size-4" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[#c6d0f5]">{server.name}</span>
        <span className="block text-xs text-[#a5adce]">
          {memberFormatter.format(server.memberCount)} members
        </span>
      </span>
    </div>
  );
}

function ServerRow({ servers, reverse = false }: { servers: PublicServer[]; reverse?: boolean }) {
  const count = Math.max(servers.length, 6);
  const cards = Array.from({ length: count }, (_, index) => servers[index % servers.length]);

  return (
    <div className="server-marquee-mask">
      <div className={`server-marquee-track${reverse ? " server-marquee-reverse" : ""}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className="server-marquee-group" aria-hidden={copy === 1}>
            {cards.map((server, index) => (
              <ServerCard key={`${copy}-${server.name}-${index}`} server={server} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ServerMarquee({ servers }: { servers: PublicServer[] | null }) {
  if (!servers) {
    return (
      <div className="server-marquee mt-7 w-full" aria-hidden="true">
        {[0, 1].map((row) => (
          <div key={row} className="mb-2 flex justify-center gap-3 overflow-hidden">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-12 min-w-52 animate-pulse rounded-xl bg-[#414559]/60" />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (!servers.length) return null;

  const first = servers.filter((_, index) => index % 2 === 0);
  const second = servers.filter((_, index) => index % 2 === 1);

  return (
    <section
      className="server-marquee mt-7 w-full"
      aria-label="Discord communities using Sailor's Lodge"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.16em]">
        trusted by your favorite communities
      </p>
      <div className="space-y-2">
        <ServerRow servers={first.length ? first : servers} />
        <ServerRow servers={second.length ? second : servers} reverse />
      </div>
    </section>
  );
}

export function Landing() {
  const [servers, setServers] = useState<PublicServer[] | null>(null);

  useEffect(() => {
    let active = true;
    getPublicServers()
      .then((response) => {
        if (active) setServers(response.servers);
      })
      .catch(() => {
        if (active) setServers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-[#303446] text-[#c6d0f5]">
      <PublicHeader />

      <main>
        <section className="landing-hero relative flex min-h-[100svh] items-center overflow-hidden px-0 pb-5 pt-24 text-center sm:pt-28">
          <div className="hero-grid absolute inset-0 -z-10 opacity-45" />
          <div aria-hidden="true" className="hero-orb hero-orb-one" />
          <div aria-hidden="true" className="hero-orb hero-orb-two" />
          <svg
            aria-hidden="true"
            className="hero-routes absolute inset-0 -z-10 size-full"
            viewBox="0 0 1200 760"
            preserveAspectRatio="xMidYMid slice"
          >
            <path d="M70 590 C250 430 320 680 505 510 S790 315 1120 440" pathLength="1" />
            <path d="M120 235 C310 370 420 160 620 300 S930 620 1160 535" pathLength="1" />
            {[
              [70, 590],
              [505, 510],
              [1120, 440],
              [120, 235],
              [620, 300],
              [1160, 535],
            ].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" />
            ))}
          </svg>
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center">
            <div className="hero-copy flex max-w-4xl flex-col items-center px-5 sm:px-8">
              <h1 className="font-display font-semibold leading-[1.02] text-[#c6d0f5] sm:text-6xl lg:text-7xl xl:text-7xl">
                for arcane odyssey communities, parties and hunts
              </h1>
              <p className="hero-subtitle mt-5 max-w-3xl text-base leading-7 text-[#b5bfe2] sm:text-xl sm:leading-8">
                you no longer have to join a specific server or guild/clan to find parties and hunts. fully <ExternalAnchor href="https://github.com/ciabidev/sailors-lodge">open source</ExternalAnchor>.
              </p>
              
              <div className="hero-actions mt-7 flex flex-wrap justify-center gap-3">
                <Button
                  size="lg"
                  asChild
                  className="bg-[#a6d189] text-[#303446] hover:bg-[#b4dda0]"
                >
                  <a href="/invite">
                    Add to Discord <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button size="lg" asChild variant="outline">
                  <Link to="/dashboard">Manage Servers</Link>
                </Button>
              </div>
              <div className="hero-assurances mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#a5adce]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-[#8caaee]" /> Every server keeps control
                </span>
                <span>Local roles, channels, and approvals</span>
              </div>
            </div>
            <ServerMarquee servers={servers} />
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-28 border-y border-[#626880]/50 bg-[#292c3c] py-24 sm:py-32"
        >
          <Reveal className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-20 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
              <div className="max-w-3xl flex flex-col gap-8">
                <p className="eyebrow">Built for AO communities</p>
                <h2 className="section-title">simplifying parties and activities for all</h2>
                <p className="text-base leading-8 text-[#a5adce]">
                  Full Release added many more activities, but finding parties is still fragmented
                  across clan, guild, hunt, and community servers. Sailor’s Lodge gives people a
                  shared harbor to find parties and simplifies pinging and coordination.
                </p>
              </div>
            </div>
            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, copy, tone }, index) => (
                <Card
                  key={title}
                  className="feature-card flex flex-col p-7"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`mb-5 grid size-12 place-items-center rounded-lg icon-${tone}`}>
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-display text-2xl text-[#c6d0f5]">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-7 text-[#a5adce]">{copy}</p>
                </Card>
              ))}
            </div>
          </Reveal>
        </section>
        <section id="docks" className="scroll-mt-20 border-b border-[#626880]/50 py-24 sm:py-32">
          <Reveal className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:gap-16">
            <div className="max-w-xl">
              <h2 className="section-title">connect with communities through Docks</h2>
              <p className="section-copy">
                join cross-server groups and receive party or event messages in your own server—or
                publish a Dock for others to discover.
              </p>
              <div className="mt-8 space-y-5">
                {dockBenefits.map(({ icon: Icon, title, copy }) => (
                  <div key={title} className="flex gap-4">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-[#8caaee]/20 bg-[#8caaee]/10 text-[#8caaee]">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-[#c6d0f5]">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#a5adce]">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" className="mt-9">
                <Link to="/dashboard">
                  Manage your Docks <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <DockChat />
          </Reveal>
        </section>
        <section className="px-5 py-24 sm:px-8">
          <Reveal className="cta-panel relative mx-auto max-w-6xl overflow-hidden rounded-lg border border-[#626880]/70 px-6 py-10 text-center sm:px-12">
            <h2 className="section-title mx-auto mt-5 max-w-3xl">ready to connect?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-[#a5adce]">
              join tons of servers already using Sailor's Lodge
            </p>
            <Button
              size="lg"
              asChild
              className="mt-8 bg-[#a6d189] text-[#303446] hover:bg-[#b4dda0]"
            >
              <a href="/invite">
                Add to Discord <ArrowRight className="size-4" />
              </a>
            </Button>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#626880]/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-[#a5adce] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Brand />
          <div className="flex flex-col gap-3 sm:items-end">
            <p>Sailor’s Lodge is an independent community project for Arcane Odyssey players.</p>
            <nav className="flex gap-5" aria-label="Legal">
              <Link to="/privacy" className="hover:text-[#c6d0f5]">Privacy</Link>
              <Link to="/terms" className="hover:text-[#c6d0f5]">Terms</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
