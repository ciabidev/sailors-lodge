import { ArrowRight, BellRing, ChevronRight, Compass, Menu, Network, PartyPopper, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@/lib/router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const features = [
  { icon: PartyPopper, title: 'Parties that stay together', copy: 'Create rich party cards, share six-digit join codes, and keep every member updated from one Discord-native flow.', tone: 'amber' },
  { icon: BellRing, title: 'Pings with a purpose', copy: 'Give each community its own ping groups, allowed roles, keywords, and Looking For Group role.', tone: 'teal' },
  { icon: Network, title: 'Docks connect servers', copy: 'Publish live channels, follow trusted communities, and carry messages, threads, and party cards between servers.', tone: 'blue' },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300">
      <span className="relative size-10 overflow-hidden rounded-xl border border-amber-200/20 bg-amber-300/10 shadow-[0_0_25px_-10px_rgba(252,211,77,.9)]">
        <img src="/brand/logo.png" alt="" className="size-full scale-[1.65] object-cover object-[50%_56%] transition-transform group-hover:scale-[1.75]" />
      </span>
      {!compact && <span className="font-display text-lg font-semibold tracking-tight text-white">Sailor’s Lodge</span>}
    </Link>
  );
}

function Preview() {
  return (
    <div className="relative mx-auto w-full max-w-[570px] lg:mx-0">
      <div className="absolute -inset-12 -z-10 rounded-full bg-teal-300/10 blur-3xl" />
      <Card className="preview-card overflow-hidden border-white/10 bg-[#08181e]/90 p-2 shadow-[0_40px_100px_-35px_rgba(0,0,0,.95)]">
        <div className="flex items-center gap-2 border-b border-white/[.07] px-4 py-3 text-xs text-slate-500">
          <span className="size-2 rounded-full bg-rose-400/70" /><span className="size-2 rounded-full bg-amber-300/70" /><span className="size-2 rounded-full bg-teal-300/70" />
          <span className="ml-3">docks / grand-navy-expeditions</span>
        </div>
        <div className="grid gap-2 p-2 sm:grid-cols-[150px_1fr]">
          <div className="hidden rounded-xl border border-white/[.06] bg-white/[.025] p-3 sm:block">
            <div className="mb-5 h-2.5 w-20 rounded bg-white/10" />
            {['Overview', 'Ping groups', 'Docks'].map((item, index) => <div key={item} className={`mb-1.5 rounded-lg px-3 py-2 text-xs ${index === 2 ? 'bg-teal-200/10 text-teal-100' : 'text-slate-500'}`}>{item}</div>)}
          </div>
          <div className="space-y-2">
            <div className="rounded-xl border border-white/[.07] bg-white/[.035] p-4">
              <div className="mb-2 flex items-center justify-between"><Badge>Live Dock</Badge><span className="text-xs text-slate-500">12 followers</span></div>
              <h3 className="font-display text-lg text-white">Grand Navy Expeditions</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">Boss hunts, sea events, and coordinated voyages.</p>
              <div className="mt-4 flex flex-wrap gap-1.5"><Badge className="border-white/10 bg-white/[.04] text-slate-300"># expeditions</Badge><Badge className="border-white/10 bg-white/[.04] text-slate-300">Contributor</Badge></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[['Published', '3'], ['Following', '8'], ['Requests', '2']].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[.06] bg-white/[.025] p-3"><div className="font-display text-xl text-white">{value}</div><div className="mt-1 text-[10px] text-slate-500">{label}</div></div>)}
            </div>
          </div>
        </div>
      </Card>
      <div className="float-card absolute -bottom-7 -left-3 hidden items-center gap-3 rounded-xl border border-white/10 bg-[#10242a]/95 px-4 py-3 shadow-2xl backdrop-blur md:flex">
        <span className="grid size-9 place-items-center rounded-lg bg-amber-300/15 text-amber-200"><BellRing className="size-4" /></span>
        <span><span className="block text-xs font-semibold text-white">Party ping delivered</span><span className="block text-[10px] text-slate-400">Across 4 connected servers</span></span>
      </div>
    </div>
  );
}

export function Landing() {
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-screen overflow-hidden bg-[#061217] text-slate-100">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[.06] bg-[#061217]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex" aria-label="Main navigation">
            <a href="#features" className="hover:text-white">Features</a><a href="#docks" className="hover:text-white">How Docks work</a><a href="#faq" className="hover:text-white">FAQ</a>
          </nav>
          <div className="hidden items-center gap-2 md:flex"><Button asChild variant="ghost"><Link to="/dashboard">Dashboard</Link></Button><Button asChild><a href="/invite">Add to Discord <ArrowRight className="size-4" /></a></Button></div>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</Button>
        </div>
        {menu && <div className="border-t border-white/[.06] bg-[#07171c] p-5 md:hidden"><nav className="grid gap-2"><a href="#features" onClick={() => setMenu(false)} className="rounded-lg p-3 text-slate-300">Features</a><a href="#docks" onClick={() => setMenu(false)} className="rounded-lg p-3 text-slate-300">How Docks work</a><Link to="/dashboard" className="rounded-lg p-3 text-slate-300">Dashboard</Link><Button asChild className="mt-2"><a href="/invite">Add to Discord</a></Button></nav></div>}
      </header>

      <main>
        <section className="relative pt-36 sm:pt-44">
          <div className="hero-grid absolute inset-0 -z-10 opacity-40" />
          <div className="absolute left-1/2 top-0 -z-10 h-[620px] w-[900px] -translate-x-1/2 rounded-full bg-teal-400/[.07] blur-3xl" />
          <div className="mx-auto grid min-h-[690px] max-w-7xl items-center gap-16 px-5 pb-24 sm:px-8 lg:grid-cols-[1fr_.95fr]">
            <div className="max-w-2xl">
              <Badge className="mb-6 gap-2 border-amber-200/20 bg-amber-300/[.08] text-amber-100"><Sparkles className="size-3.5" /> Built for Arcane Odyssey communities</Badge>
              <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-[-.04em] text-white sm:text-6xl lg:text-7xl">Find your crew.<br /><span className="text-gradient">Keep every server in sync.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">Create parties, reach the right players, and connect Discord communities through live message feeds called Docks.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button size="lg" asChild><a href="/invite">Add to Discord <ArrowRight className="size-4" /></a></Button><Button size="lg" variant="secondary" asChild><Link to="/dashboard">Open dashboard <ChevronRight className="size-4" /></Link></Button></div>
              <div className="mt-7 flex items-center gap-5 text-xs text-slate-500"><span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-teal-300" /> Server admins stay in control</span><span>No separate account</span></div>
            </div>
            <Preview />
          </div>
        </section>

        <section id="features" className="scroll-mt-28 border-y border-white/[.06] bg-white/[.018] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl"><p className="eyebrow">Everything your community needs</p><h2 className="section-title">From finding a party to building a network.</h2><p className="section-copy">Sailor’s Lodge keeps coordination inside Discord, where your players already are.</p></div>
            <div className="mt-14 grid gap-4 lg:grid-cols-3">{features.map(({ icon: Icon, title, copy, tone }, index) => <Card key={title} className="feature-card group relative overflow-hidden p-7" style={{ animationDelay: `${index * 100}ms` }}><div className={`mb-10 grid size-12 place-items-center rounded-xl icon-${tone}`}><Icon className="size-5" /></div><h3 className="font-display text-2xl text-white">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p><div className="absolute -bottom-16 -right-12 size-36 rounded-full bg-teal-300/[.05] blur-2xl transition group-hover:bg-teal-300/10" /></Card>)}</div>
          </div>
        </section>

        <section id="docks" className="scroll-mt-24 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid items-start gap-16 lg:grid-cols-[.8fr_1.2fr]">
              <div className="lg:sticky lg:top-32"><p className="eyebrow">How Docks work</p><h2 className="section-title">A shared harbor for every server.</h2><p className="section-copy">Docks move relevant conversations between communities without giving up control of your own channels, roles, or moderation.</p><Button asChild variant="outline" className="mt-8"><Link to="/dashboard">Manage your Docks <ArrowRight className="size-4" /></Link></Button></div>
              <div className="space-y-4">{[
                ['01', 'Publish a channel', 'Choose up to ten source channels, set keywords, and decide whether every message or only !p posts should travel.'],
                ['02', 'Communities follow', 'Other server managers choose a receiving channel and map your Dock keywords to their own local roles.'],
                ['03', 'The network stays live', 'Messages, edits, replies, threads, and public party cards stay connected across approved servers.'],
              ].map(([number, title, copy]) => <Card key={number} className="group grid gap-5 p-6 sm:grid-cols-[72px_1fr] sm:p-8"><div className="font-display text-4xl text-amber-200/40 transition group-hover:text-amber-200">{number}</div><div><h3 className="font-display text-xl text-white">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-400">{copy}</p></div></Card>)}</div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-y border-white/[.06] bg-[#08181e] py-24">
          <div className="mx-auto max-w-4xl px-5 sm:px-8"><div className="text-center"><p className="eyebrow">Good to know</p><h2 className="section-title">Questions from the quarterdeck.</h2></div><div className="mt-12 grid gap-4 sm:grid-cols-2">{[
            ['Is a party an in-game party?', 'No. Sailor’s Lodge parties are Discord coordination groups that help players meet before joining in game.'],
            ['Who can configure a server?', 'Discord permissions are the source of truth. Manage Server controls settings; Manage Channels controls Docks.'],
            ['Can a Dock relay every message?', 'Yes, or it can use manual mode where only messages prefixed with !p are published.'],
            ['Do request-only Docks need approval?', 'Yes. A publisher or an approved Dock admin chooses the follower’s access level.'],
          ].map(([question, answer]) => <Card key={question} className="p-6"><h3 className="font-semibold text-white">{question}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{answer}</p></Card>)}</div></div>
        </section>

        <section className="px-5 py-24 sm:px-8"><div className="cta-panel relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-amber-200/15 px-6 py-16 text-center sm:px-12"><Compass className="mx-auto size-9 text-amber-200" /><h2 className="section-title mx-auto mt-5 max-w-2xl">Your next crew is already out there.</h2><p className="mx-auto mt-4 max-w-xl text-slate-400">Bring better party finding and cross-server coordination to your community.</p><Button size="lg" asChild className="mt-8"><a href="/invite">Add Sailor’s Lodge <ArrowRight className="size-4" /></a></Button></div></section>
      </main>

      <footer className="border-t border-white/[.06]"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Brand /><p>Sailor’s Lodge is an independent community project for Arcane Odyssey players.</p></div></footer>
    </div>
  );
}
