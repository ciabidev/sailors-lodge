import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, Radio, Server, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatus, type ShardStatus } from "@/lib/api";
import { Brand } from "@/pages/Landing";

const number = new Intl.NumberFormat();

function formatUptime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days && `${days}d`, (days || hours) && `${hours}h`, `${minutes}m`].filter(Boolean).join(" ");
}

function ShardCard({ shard }: { shard: ShardStatus }) {
  const metrics = [
    { label: "Uptime", value: formatUptime(shard.uptime), icon: Clock3 },
    { label: "Latency", value: shard.latency === null ? "Unavailable" : `${shard.latency} ms`, icon: Radio },
    { label: "Servers", value: number.format(shard.servers), icon: Server },
    { label: "Total Users", value: number.format(shard.users), icon: Users },
  ];

  return (
    <Card className="overflow-hidden border-[#626880]/60 bg-[#292c3c]">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-[#626880]/50 p-5 sm:p-6">
        <CardTitle>Shard {shard.id}</CardTitle>
        <Badge className={shard.operational
          ? "border-[#a6d189]/30 bg-[#a6d189]/10 text-[#a6d189]"
          : "border-[#e78284]/30 bg-[#e78284]/10 text-[#e78284] "}
        >
          <span className="mr-1.5 size-2 rounded-full bg-current" aria-hidden="true" />
          {shard.operational ? "Operational" : "Not operational"}
        </Badge>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-px bg-[#626880]/40 p-0">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#292c3c] p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-[#838ba7]">
              <Icon className="size-3.5 text-[#8caaee]" aria-hidden="true" />
              {label}
            </div>
            <p className="mt-2 font-display text-xl font-semibold text-[#c6d0f5]">{value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Status() {
  const status = useQuery({ queryKey: ["status"], queryFn: getStatus, refetchInterval: 30_000 });

  return (
    <div className="min-h-screen bg-[#303446] text-[#c6d0f5]">
      <header className="border-b border-[#626880]/50 bg-[#292c3c]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <Button asChild variant="ghost"><Link to="/">Back home</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Live service health</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">System status</h1>
          <p className="mt-4 text-base leading-7 text-[#a5adce]">Current Discord connection and usage metrics for every bot shard. Updates automatically every 30 seconds.</p>
        </div>

        {status.isLoading && <p className="mt-12 text-[#a5adce]">Loading shard status…</p>}
        {status.isError && <Card className="mt-12 border-[#e78284]/30 bg-[#e78284]/10 p-6 text-[#f2d5cf]">Status data is temporarily unavailable. Please try again shortly.</Card>}
        {status.data && (
          <>
            <div className="mt-10 flex items-center gap-3 border-y border-[#626880]/50 py-4">
              <Activity className={`size-5 ${status.data.operational ? "text-[#a6d189]" : "text-[#e78284]"}`} aria-hidden="true" />
              <p className="font-medium">{status.data.operational ? "All systems operational" : "Some systems are not operational"}</p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {status.data.shards.map((shard) => <ShardCard key={shard.id} shard={shard} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
