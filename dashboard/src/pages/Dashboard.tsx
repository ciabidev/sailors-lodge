import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  ChevronDown,
  Clock3,
  Compass,
  DoorOpen,
  Hash,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  MessageSquare,
  Network,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldBan,
  ShipWheel,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TagPicker } from "@/components/ui/tag-picker";
import { Brand } from "@/pages/Landing";
import { cn } from "@/lib/utils";
import {
  addBan,
  ApiError,
  api,
  createDock,
  deleteDock,
  deleteFollow,
  getBanCandidates,
  getBans,
  getDocks,
  getFollowers,
  getGuild,
  getGuilds,
  getMe,
  removeBan,
  removeFollower,
  saveFollow,
  saveHomePings,
  saveSettings,
  setDefaultLevel,
  setFollowerLevel,
  updateDock,
  type Ban,
  type BanCandidate,
  type Dock,
  type DockLevel,
  type Follow,
  type Follower,
  type Guild,
  type GuildData,
  type GuildSummary,
  type PingGroup,
} from "@/lib/api";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "settings", label: "Server settings", icon: Settings },
  { id: "pings", label: "Ping groups", icon: BellRing },
  { id: "docks", label: "Docks", icon: Network },
];
const dockLevels: DockLevel[] = ["no-access", "passive", "sender", "contributor", "admin"];
const defaultDockLevels = dockLevels.slice(1);
const levelLabels: Record<DockLevel, string> = {
  "no-access": "Pending / no access",
  passive: "Passive",
  sender: "Sender",
  contributor: "Contributor",
  admin: "Admin",
};

function SelectField({
  label,
  value,
  onChange,
  children,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          className="select-field"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4 text-[#838ba7]" />
      </div>
      {hint && <p className="text-xs text-[#a5adce]">{hint}</p>}
    </div>
  );
}

function Empty({
  icon: Icon = Compass,
  title,
  copy,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#626880] bg-[#414559]/45 p-8 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-lg bg-[#8caaee]/12 text-[#8caaee]">
          <Icon className="size-5" />
        </span>
        <h3 className="mt-4 font-display text-xl text-[#c6d0f5]">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#a5adce]">{copy}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Card className="border-[#e78284]/35 p-6">
      <div className="flex gap-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#e78284]" />
        <div>
          <h3 className="font-semibold text-[#c6d0f5]">Couldn’t load this view</h3>
          <p className="mt-1 text-sm text-[#a5adce]">{error.message}</p>
          {retry && (
            <Button size="sm" variant="secondary" className="mt-4" onClick={retry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function ServerChooser({ guilds }: { guilds: GuildSummary[] }) {
  const installed = guilds.filter((guild) => guild.installed);
  const setup = guilds.filter((guild) => !guild.installed);
  const cards = (items: GuildSummary[]) => (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map((guild) => (
        <Card key={guild.id} className="flex items-center gap-4 p-5">
          <GuildIcon guild={guild} className="size-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="break-words font-semibold text-[#c6d0f5]">{guild.name}</div>
          </div>
          <Button size="sm" variant={guild.installed ? "secondary" : "default"} asChild>
            {guild.installed ? (
              <Link to={`/dashboard/${guild.id}/overview`}>Manage</Link>
            ) : (
              <a href={`/invite?guild_id=${guild.id}`}>Setup</a>
            )}
          </Button>
        </Card>
      ))}
    </div>
  );
  return (
    <div className="min-h-screen bg-[#303446] px-5 py-12 text-[#c6d0f5]">
      <div className="mx-auto max-w-4xl">
        <Brand />
        <div className="mt-20 max-w-xl">
          <p className="eyebrow">Dashboard</p>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">
            Manage your servers.
          </h1>
          <p className="mt-4 leading-7 text-[#a5adce]">
            Servers where you have Discord’s Manage Server permission appear here. Install
            Sailor’s Lodge where needed, then manage everything from one place.
          </p>
        </div>
        {guilds.length ? (
          <div className="mt-12 space-y-10">
            {installed.length > 0 && (
              <section aria-labelledby="installed-servers">
                <h2 id="installed-servers" className="font-display text-xl font-semibold">Ready to manage</h2>
                <p className="mt-1 text-sm text-[#a5adce]">Sailor’s Lodge is already installed.</p>
                {cards(installed)}
              </section>
            )}
            {setup.length > 0 && (
              <section aria-labelledby="setup-servers">
                <h2 id="setup-servers" className="font-display text-xl font-semibold">Needs setup</h2>
                <p className="mt-1 text-sm text-[#a5adce]">Install the bot to unlock this server’s dashboard.</p>
                {cards(setup)}
              </section>
            )}
          </div>
        ) : (
          <div className="mt-10">
            <Empty
              title="No manageable servers found"
              copy="Discord did not report any servers where you have Manage Server permission."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function GuildIcon({
  guild,
  className,
}: {
  guild: Pick<GuildSummary, "name" | "icon">;
  className?: string;
}) {
  return guild.icon ? (
    <img src={guild.icon} alt="" className={cn("size-10 rounded-lg object-cover", className)} />
  ) : (
    <span
      className={cn(
        "grid size-10 place-items-center rounded-lg bg-[#8caaee]/15 font-display font-semibold text-[#c6d0f5]",
        className,
      )}
    >
      {guild.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Shell({
  user,
  guilds,
  data,
  section,
  children,
}: {
  user: { username: string; avatar: string | null };
  guilds: GuildSummary[];
  data: GuildData;
  section: string;
  children: React.ReactNode;
}) {
  const [mobile, setMobile] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#303446] text-[#c6d0f5]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-[#626880]/60 bg-[#292c3c] p-5 transition-transform lg:translate-x-0",
          mobile ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Brand />
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="mt-8">
          <Label htmlFor="server-selector" className="mb-2 block text-xs uppercase tracking-[.12em] text-[#a5adce]">
            Server
          </Label>
          <div className="relative">
            <select
              id="server-selector"
              aria-label="Server"
              className="select-field server-select"
              value={data.guild.id}
              onChange={(event) => navigate(`/dashboard/${event.target.value}/overview`)}
            >
              {guilds.map((guild) => (
                <option key={guild.id} value={guild.id}>
                  {guild.name}
                </option>
              ))}
            </select>
            <GuildIcon guild={data.guild} className="pointer-events-none absolute left-2 top-2 size-10" />
            <ChevronDown className="pointer-events-none absolute right-3 top-5 size-4 text-[#838ba7]" />
          </div>
        </div>
        <nav className="mt-8 space-y-1" aria-label="Dashboard navigation">
          {sections.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={`/dashboard/${data.guild.id}/${id}`}
              onClick={() => setMobile(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                section === id
                  ? "bg-[#8caaee]/15 text-[#c6d0f5] ring-1 ring-inset ring-[#8caaee]/35"
                  : "text-[#a5adce] hover:bg-[#414559] hover:text-[#c6d0f5]",
              )}
            >
              <Icon className="size-4.5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-5 bottom-5">
          <div className="flex items-center gap-3 border-t border-[#626880]/60 pt-5">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="size-9 rounded-full" />
            ) : (
              <span className="grid size-9 place-items-center rounded-full bg-[#414559]">
                {user.username[0]}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#c6d0f5]">{user.username}</p>
              <button
                className="text-xs text-[#a5adce] hover:text-[#c6d0f5]"
                onClick={async () => {
                  await api("/auth/logout", { method: "POST", body: "{}" });
                  window.location.href = "/";
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobile(false)}
          aria-label="Close navigation overlay"
        />
      )}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-17 items-center gap-4 border-b border-[#626880]/60 bg-[#303446]/95 px-5 sm:px-8">
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <div>
            <p className="text-xs text-[#a5adce]">{data.guild.name}</p>
            <h1 className="font-display text-lg font-semibold capitalize text-[#c6d0f5]">
              {sections.find((item) => item.id === section)?.label || "Overview"}
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

function Overview({ data }: { data: GuildData }) {
  const ready = Boolean(data.settings.lfgRoleId) && data.settings.pingGroups.length > 0;
  const stats = [
    { label: "Ping groups", value: data.settings.pingGroups.length, icon: BellRing, href: "pings" },
    { label: "Published Docks", value: data.counts.published, icon: Radio, href: "docks#published" },
    { label: "Following", value: data.counts.following, icon: Network, href: "docks#following" },
    { label: "Pending follows", value: data.counts.pendingFollowing, icon: Clock3, href: "docks" },
  ];
  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h2 className="font-display text-3xl font-semibold text-[#c6d0f5] sm:text-4xl">
          Server overview
        </h2>
        <p className="mt-3 text-[#a5adce]">
          Manage party pings and Dock connections for {data.guild.name}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link to={`/dashboard/${data.guild.id}/${href}`} key={label}>
            <Card className="group p-6 transition hover:border-[#8caaee]/60">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[#a5adce]">{label}</p>
                  <p className="mt-2 font-display text-4xl text-[#c6d0f5]">{value}</p>
                </div>
                <span className="grid size-10 place-items-center rounded-lg bg-[#8caaee]/12 text-[#8caaee]">
                  <Icon className="size-4.5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
  
    </div>
  );
}

function ServerSettings({ data, refresh }: { data: GuildData; refresh: () => void }) {
  const form = useForm<{ lfgRoleId: string; keywordPingsEnabled: boolean }>({
    defaultValues: {
      lfgRoleId: data.settings.lfgRoleId || "",
      keywordPingsEnabled: data.settings.keywordPingsEnabled,
    },
  });
  const mutation = useMutation({
    mutationFn: (values: { lfgRoleId: string; keywordPingsEnabled: boolean }) =>
      saveSettings(data.guild.id, {
        lfgRoleId: values.lfgRoleId || null,
        keywordPingsEnabled: values.keywordPingsEnabled,
      }),
    onSuccess: () => {
      toast.success("Server settings saved");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!data.guild.manageGuild)
    return (
      <Empty
        icon={Settings}
        title="Manage Server required"
        copy="Discord’s Manage Server permission is required to change these settings."
      />
    );
  return (
    <form
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      className="max-w-3xl space-y-5"
    >
      <Card>
        <CardHeader>
          <CardTitle>Looking For Group</CardTitle>
          <CardDescription>Choose the role mentioned by the `/party lfg` command.</CardDescription>
        </CardHeader>
        <CardContent>
          <TagPicker
            label="LFG role"
            options={data.guild.roles.map((role) => ({ value: role.id, label: role.name }))}
            values={form.watch("lfgRoleId") ? [form.watch("lfgRoleId")] : []}
            onChange={(values) => form.setValue("lfgRoleId", values[0] || "", { shouldDirty: true })}
            placeholder="Search roles…"
            emptyText="No roles matched"
            multiple={false}
            hint="Leave empty to disable the /party lfg mention."
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Keyword pings</CardTitle>
          <CardDescription>
            Allow messages containing configured keywords to trigger their mapped ping groups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-6 rounded-lg border border-[#626880]/60 bg-[#303446] p-4">
            <div>
              <p className="font-medium text-[#c6d0f5]">Enable keyword matching</p>
              <p className="mt-1 text-sm text-[#a5adce]">
                Individual keywords are managed inside each ping group.
              </p>
            </div>
            <Switch
              aria-label="Enable keyword matching"
              checked={form.watch("keywordPingsEnabled")}
              onCheckedChange={(value) =>
                form.setValue("keywordPingsEnabled", value, { shouldDirty: true })
              }
            />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={!form.formState.isDirty || mutation.isPending}>
          {mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}Save settings
        </Button>
      </div>
    </form>
  );
}

const emptyGroup: PingGroup = { name: "", roleId: "", allowedRoles: [], keywords: [] };
function PingGroups({ data, refresh }: { data: GuildData; refresh: () => void }) {
  const [groups, setGroups] = useState(data.settings.pingGroups);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<PingGroup>(emptyGroup);
  const [keywordsText, setKeywordsText] = useState("");
  useEffect(() => setGroups(data.settings.pingGroups), [data.settings.pingGroups]);
  const save = useMutation({
    mutationFn: (next: PingGroup[]) => saveSettings(data.guild.id, { pingGroups: next }),
    onSuccess: ({ settings }) => {
      setGroups(settings.pingGroups);
      setEditing(null);
      toast.success("Ping groups saved");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!data.guild.manageGuild)
    return (
      <Empty
        icon={BellRing}
        title="Manage Server required"
        copy="Discord’s Manage Server permission is required to manage ping groups."
      />
    );
  function open(group?: PingGroup, index?: number) {
    setDraft(
      group
        ? { ...group, allowedRoles: [...group.allowedRoles], keywords: [...group.keywords] }
        : emptyGroup,
    );
    setKeywordsText(group?.keywords.join("\n") || "");
    setEditing(index ?? -1);
  }
  function commit() {
    const normalized = {
      ...draft,
      name: draft.name.trim(),
      keywords: parseKeywords(keywordsText),
    };
    if (
      groups.some(
        (group, index) =>
          index !== editing && group.name.trim().toLowerCase() === normalized.name.toLowerCase(),
      )
    ) {
      toast.error("Ping group names must be unique");
      return;
    }
    if (normalized.keywords.length > 25) {
      toast.error("A ping group can have at most 25 keywords");
      return;
    }
    const next =
      editing === -1
        ? [...groups, normalized]
        : groups.map((group, index) => (index === editing ? normalized : group));
    save.mutate(next);
  }
  function remove(index: number) {
    const next = groups.filter((_, item) => item !== index);
    save.mutate(next);
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-[#c6d0f5]">Ping groups</h2>
          <p className="mt-1 text-sm text-[#a5adce]">
            Set up organized keywords and ping commands for any activity. These only apply to your server
          </p>
        </div>
        <Button onClick={() => open()}>
          <Plus className="size-4" />
          Add ping group
        </Button>
      </div>
      {groups.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group, index) => (
            <Card key={`${group.name}-${index}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{group.name}</CardTitle>
                    <CardDescription>
                      {data.guild.roles.find((role) => role.id === group.roleId)?.name ||
                        "Missing role"}
                    </CardDescription>
                  </div>
                  <Badge>
                    {group.keywords.length} keyword{group.keywords.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-5 flex flex-wrap gap-2">
                  {group.keywords.length ? (
                    group.keywords.map((keyword) => (
                      <Badge key={keyword} className="border-[#626880] bg-[#303446] text-[#c6d0f5]">
                        {keyword}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-[#a5adce]">No keyword triggers</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => open(group, index)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${group.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          icon={BellRing}
          title="No ping groups yet"
          copy="Create a group to give players a clear, permission-aware way to reach the right role."
          action={
            <Button onClick={() => open()}>
              <Plus className="size-4" />
              Create first group
            </Button>
          }
        />
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === -1 ? "Add ping group" : "Edit ping group"}</DialogTitle>
            <DialogDescription>
              Choose the pinged role, who can use it, and the words that trigger it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Boss hunts"
                maxLength={100}
              />
            </div>
            <TagPicker
              label="Ping role"
              options={data.guild.roles.map((role) => ({ value: role.id, label: role.name }))}
              values={draft.roleId ? [draft.roleId] : []}
              onChange={(values) => setDraft({ ...draft, roleId: values[0] || "" })}
              placeholder="Search roles…"
              emptyText="No roles matched"
              multiple={false}
            />
            <TagPicker
              label="Allowed roles"
              options={data.guild.roles.map((role) => ({ value: role.id, label: role.name }))}
              values={draft.allowedRoles}
              onChange={(allowedRoles) => setDraft({ ...draft, allowedRoles })}
              placeholder="Search roles to allow…"
              emptyText="No roles matched"
              hint="Leave empty to let anyone use this group."
            />
            <div className="space-y-2">
              <Label htmlFor="group-keywords">Ping keywords</Label>
              <Textarea
                id="group-keywords"
                value={keywordsText}
                onChange={(event) => setKeywordsText(event.target.value)}
                placeholder={"dragonping\nluckparty\n-chartping"}
                maxLength={500}
              />
              <p className="text-xs text-[#a5adce]">
                Separate with commas or new lines, up to 25. {parseKeywords(keywordsText).length}/25
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={commit}
              disabled={
                !draft.name.trim() ||
                !draft.roleId ||
                parseKeywords(keywordsText).length > 25 ||
                save.isPending
              }
            >
              Save group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const dockSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(500),
  publishMode: z.enum(["all", "manual"]),
  accessMode: z.enum(["open", "request"]),
  defaultLevel: z.enum(["no-access", "passive", "sender", "contributor", "admin"]),
  gatekeeperRoleId: z.string(),
  keywordsText: z.string().max(500),
});
type DockValues = z.infer<typeof dockSchema>;

function parseKeywords(value: string) {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}

function DockEditor({
  guild,
  dock,
  open,
  onOpenChange,
  done,
}: {
  guild: Guild;
  dock: Dock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  done: () => void;
}) {
  const query = useQueryClient();
  const form = useForm<DockValues>({
    resolver: zodResolver(dockSchema),
    defaultValues: {
      name: "",
      description: "",
      publishMode: "all",
      accessMode: "open",
      defaultLevel: "passive",
      gatekeeperRoleId: "",
      keywordsText: "",
    },
  });
  const [channels, setChannels] = useState<string[]>([]);
  useEffect(() => {
    form.reset({
      name: dock?.name || "",
      description: dock?.description || "",
      publishMode: dock?.publishMode || "all",
      accessMode: dock?.accessMode || "open",
      defaultLevel: dock?.defaultLevel || "passive",
      gatekeeperRoleId: dock?.gatekeeperRoleId || "",
      keywordsText: dock?.keywords.join(", ") || "",
    });
    setChannels(dock?.channelIds || []);
  }, [dock, open]);
  const mutation = useMutation({
    mutationFn: (values: DockValues) => {
      const payload = {
        ...values,
        channelIds: channels,
        gatekeeperRoleId: values.gatekeeperRoleId || null,
        keywords: parseKeywords(values.keywordsText),
      };
      return dock ? updateDock(guild.id, dock.id, payload) : createDock(guild.id, payload);
    },
    onSuccess: () => {
      toast.success(dock ? "Dock updated" : "Dock published");
      query.invalidateQueries({ queryKey: ["docks", guild.id] });
      done();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dock ? "Edit Dock" : "Publish a Dock"}</DialogTitle>
          <DialogDescription>
            Choose source channels, forwarding behavior, and follower access.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="dock-name">Dock name</Label>
            <Input id="dock-name" {...form.register("name")} placeholder="AO Parties" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dock-description">Description</Label>
            <Textarea
              id="dock-description"
              {...form.register("description")}
              placeholder="What should other communities expect here?"
              maxLength={500}
            />
          </div>
          <TagPicker
            label="Publishing channels"
            options={guild.channels.map((channel) => ({ value: channel.id, label: `#${channel.name}` }))}
            values={channels}
            onChange={setChannels}
            placeholder="Search channels…"
            emptyText="No channels matched"
            max={10}
            hint="Choose up to 10 text or announcement channels. Only channels I have access to will be available."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Publish mode"
              value={form.watch("publishMode")}
              onChange={(value) => form.setValue("publishMode", value as "all" | "manual")}
              hint={
                form.watch("publishMode") === "all"
                  ? "Every message in a publishing channel will be forwarded."
                  : "Only messages published with !p will be forwarded."
              }
            >
              <option value="all">Forward every message</option>
              <option value="manual">Forward only with !p</option>
            </SelectField>
            <SelectField
              label="Who can follow"
              value={form.watch("accessMode")}
              onChange={(value) => form.setValue("accessMode", value as "open" | "request")}
            >
              <option value="open">Open</option>
              <option value="request">Request approval</option>
            </SelectField>
            {form.watch("accessMode") === "request" && (
              <TagPicker
                label="Approval role"
                options={guild.roles.map((role) => ({ value: role.id, label: role.name }))}
                values={form.watch("gatekeeperRoleId") ? [form.watch("gatekeeperRoleId")] : []}
                onChange={(values) => form.setValue("gatekeeperRoleId", values[0] || "")}
                placeholder="Search roles…"
                emptyText="No roles matched"
                multiple={false}
                hint="Members with this role can approve follow requests."
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dock-keywords">Ping keywords</Label>
            <Textarea
              id="dock-keywords"
              {...form.register("keywordsText")}
              placeholder={"boss hunt\ndark sea\nexpedition"}
              maxLength={500}
            />
            <p className="text-xs text-[#a5adce]">
              Separate with commas or new lines, up to 25. {parseKeywords(form.watch("keywordsText")).length}/25
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!channels.length || parseKeywords(form.watch("keywordsText")).length > 25 || mutation.isPending}
            >
              {mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {dock ? "Save changes" : "Publish Dock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FollowEditor({
  guild,
  dock,
  open,
  onOpenChange,
  done,
}: {
  guild: Guild;
  dock: Dock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  done: () => void;
}) {
  const [channelId, setChannelId] = useState("");
  const [pingOwnServer, setPingOwnServer] = useState(true);
  const [shareVoiceInvites, setShareVoiceInvites] = useState(false);
  const [hostRoleIds, setHostRoleIds] = useState<string[]>([]);
  const [pings, setPings] = useState<Record<string, string[]>>({});
  const home = dock?.guildId === guild.id;
  useEffect(() => {
    setChannelId(dock?.follow?.channelIds[0] || "");
    setPingOwnServer(dock?.follow?.pingOwnServer !== false);
    setShareVoiceInvites(dock?.follow?.shareVoiceInvites === true);
    setHostRoleIds(dock?.follow?.hostRoleIds || []);
    setPings(
      Object.fromEntries(
        (dock?.keywords || []).map((keyword) => [
          keyword,
          dock?.follow?.keywordPings?.[keyword] || [],
        ]),
      ),
    );
  }, [dock, open]);
  const mutation = useMutation({
    mutationFn: () => {
      const settings = { keywordPings: pings, hostRoleIds, pingOwnServer, shareVoiceInvites };
      return home
        ? saveHomePings(guild.id, dock!.id, settings)
        : saveFollow(guild.id, dock!.id, {
            ...settings,
            channelIds: [channelId],
          } as Partial<Follow>);
    },
    onSuccess: () => {
      toast.success(
        home
          ? "Server settings saved"
          : dock?.follow
            ? "Follow settings saved"
            : dock?.accessMode === "request"
              ? "Follow request sent"
              : "Dock followed",
      );
      done();
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!dock) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dock.follow ? "Server settings" : `Follow ${dock.name}`}
          </DialogTitle>
          <DialogDescription>
            {home
              ? "Choose who can trigger keyword pings and which local roles are pinged."
              : "Choose where messages arrive and which local roles each keyword should ping."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!home && (
            <TagPicker
              label="Receiving channel"
              options={guild.channels.map((channel) => ({ value: channel.id, label: `#${channel.name}` }))}
              values={channelId ? [channelId] : []}
              onChange={(values) => setChannelId(values[0] || "")}
              placeholder="Search channels…"
              emptyText="No channels matched"
              multiple={false}
            />
          )}
          <TagPicker
            label="Host roles"
            options={guild.roles.map((role) => ({ value: role.id, label: role.name }))}
            values={hostRoleIds}
            onChange={setHostRoleIds}
            placeholder="Everyone can trigger keyword pings"
            emptyText="No roles matched"
          />
          <p className="-mt-2 text-xs text-[#a5adce]">
            Members need one of these roles to trigger Dock keyword pings. Leave empty for everyone.
          </p>
          {dock.keywords.map((keyword) => (
            <TagPicker
              key={keyword}
              label={`${keyword} roles`}
              options={guild.roles.map((role) => ({ value: role.id, label: role.name }))}
              values={pings[keyword] || []}
              onChange={(roles) => setPings({ ...pings, [keyword]: roles })}
              placeholder="Search roles to ping…"
              emptyText="No roles matched"
            />
          ))}
          {!dock.keywords.length && (
            <p className="rounded-lg border border-[#626880]/70 p-4 text-sm text-[#a5adce]">
              This Dock has no keywords, so no ping roles can be assigned.
            </p>
          )}
          {!home && (
            <div className="flex items-center justify-between rounded-lg border border-[#626880]/70 p-4">
              <div>
                <p className="text-sm font-medium text-[#c6d0f5]">Ping roles for local messages</p>
                <p className="mt-1 text-xs text-[#a5adce]">
                  Apply these keyword pings when a message originates in {guild.name}.
                </p>
              </div>
              <Switch
                aria-label="Ping roles for local messages"
                checked={pingOwnServer}
                onCheckedChange={setPingOwnServer}
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[#626880]/70 p-4">
            <div>
              <p className="text-sm font-medium text-[#c6d0f5]">Share voice invite links</p>
              <p className="mt-1 text-xs text-[#a5adce]">
                When someone triggers this Dock's ping from voice chat, create a temporary invite
                for receiving servers. Requires the bot to have Create Invite permission.
              </p>
            </div>
            <Switch
              aria-label="Share voice invite links"
              checked={shareVoiceInvites}
              onCheckedChange={setShareVoiceInvites}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={(!home && !channelId) || mutation.isPending}>
            {mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
            {dock.follow ? "Save settings" : "Save follow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FollowersDialog({
  guild,
  dock,
  open,
  onOpenChange,
}: {
  guild: Guild;
  dock: Dock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [defaultAccess, setDefaultAccess] = useState(dock?.defaultLevel || "passive");
  useEffect(() => setDefaultAccess(dock?.defaultLevel || "passive"), [dock]);
  const query = useQuery({
    queryKey: ["followers", guild.id, dock?.id],
    queryFn: () => getFollowers(guild.id, dock!.id),
    enabled: open && Boolean(dock),
  });
  const mutation = useMutation({
    mutationFn: ({ id, level }: { id: string; level: string }) =>
      setFollowerLevel(guild.id, dock!.id, id, level),
    onSuccess: ({ follower }) => {
      toast.success("Follower access updated");
      queryClient.setQueryData<{ followers: Follower[] }>(
        ["followers", guild.id, dock?.id],
        (current) => current
          ? {
              followers: current.followers.map((item) =>
                item.guildId === follower.guildId ? follower : item,
              ),
            }
          : current,
      );
      queryClient.invalidateQueries({ queryKey: ["followers", guild.id, dock?.id] });
      queryClient.invalidateQueries({ queryKey: ["docks", guild.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFollower(guild.id, dock!.id, id),
    onSuccess: (_data, id) => {
      toast.success("Follower removed");
      queryClient.setQueryData<{ followers: Follower[] }>(
        ["followers", guild.id, dock?.id],
        (current) => current
          ? { followers: current.followers.filter((item) => item.guildId !== id) }
          : current,
      );
      queryClient.invalidateQueries({ queryKey: ["followers", guild.id, dock?.id] });
      queryClient.invalidateQueries({ queryKey: ["docks", guild.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const defaultMutation = useMutation({
    mutationFn: (level: DockLevel) => setDefaultLevel(guild.id, dock!.id, level),
    onMutate: () => ({ previous: defaultAccess }),
    onSuccess: ({ defaultLevel }) => {
      setDefaultAccess(defaultLevel);
      toast.success("Default follower access updated");
      queryClient.invalidateQueries({ queryKey: ["docks", guild.id] });
    },
    onError: (error: Error, _level, context) => {
      if (context?.previous) setDefaultAccess(context.previous);
      toast.error(error.message);
    },
  });
  const followers = query.data?.followers || [];
  const pendingFollowers = followers.filter(
    (follower) => !follower.banned && follower.level === "no-access",
  );
  const activeFollowers = followers.filter(
    (follower) => !follower.banned && follower.level !== "no-access",
  );
  const bannedFollowers = followers.filter((follower) => follower.banned);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-3xl flex-col gap-6">
        <DialogHeader className="mb-0">
          <DialogTitle>Manage followers</DialogTitle>
          <DialogDescription>
            Approve requests and manage access to {dock?.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 rounded-lg border border-[#626880]/70 bg-[#303446] p-5 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
          <div>
            <Label htmlFor="default-follower-access">New follower access</Label>
            <p className="mt-1 text-xs text-[#a5adce]">
              {dock?.accessMode === "request" ? "Applied when a request is approved." : "Applied immediately when a server follows."}
            </p>
          </div>
          <select
            id="default-follower-access"
            aria-label="Default access for new followers"
            className="select-field"
            value={defaultAccess}
            onChange={(event) => {
              const level = event.target.value as DockLevel;
              setDefaultAccess(level);
              defaultMutation.mutate(level);
            }}
            disabled={defaultMutation.isPending}
          >
            {defaultDockLevels.map((level) => (
              <option key={level} value={level}>
                {levelLabels[level]}
              </option>
            ))}
          </select>
        </div>
        {query.isLoading ? (
          <Skeleton className="h-44" />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : followers.length ? (
          <div className="space-y-8">
            {pendingFollowers.length > 0 && (
              <section aria-labelledby="pending-followers">
                <div className="mb-4 flex items-center justify-between">
                  <h3 id="pending-followers" className="text-base font-semibold text-[#c6d0f5]">
                    Pending requests
                  </h3>
                  <Badge>{pendingFollowers.length}</Badge>
                </div>
                <div className="space-y-3">
                  {pendingFollowers.map((follower) => (
                    <div
                      key={follower.guildId}
                      className="grid gap-5 rounded-lg border border-[#e5c890]/25 bg-[#e5c890]/5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <GuildIcon
                          guild={{ name: follower.guildName || follower.guildId, icon: follower.guildIconURL }}
                          className="size-11 shrink-0"
                        />
                        <p className="min-w-0 break-words text-base font-medium text-[#c6d0f5]">
                          {follower.guildName || follower.guildId}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Button
                          size="sm"
                          disabled={mutation.isPending}
                          onClick={() => mutation.mutate({ id: follower.guildId, level: defaultAccess })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(follower.guildId)}
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {activeFollowers.length > 0 && (
              <section aria-labelledby="active-followers">
                <h3 id="active-followers" className="mb-4 text-base font-semibold text-[#c6d0f5]">
                  Active followers
                </h3>
                <div className="space-y-3">
                  {activeFollowers.map((follower) => (
                    <div
                      key={follower.guildId}
                      className="grid gap-5 rounded-lg border border-[#626880]/70 p-5 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <GuildIcon
                          guild={{ name: follower.guildName || follower.guildId, icon: follower.guildIconURL }}
                          className="size-11 shrink-0"
                        />
                        <p className="min-w-0 break-words text-base font-medium text-[#c6d0f5]">
                          {follower.guildName || follower.guildId}
                        </p>
                      </div>
                      <select
                        aria-label={`Access level for ${follower.guildName || follower.guildId}`}
                        className="select-field"
                        value={follower.level}
                        disabled={mutation.isPending}
                        onChange={(event) =>
                          mutation.mutate({ id: follower.guildId, level: event.target.value })
                        }
                      >
                        {defaultDockLevels.map((level) => (
                          <option key={level} value={level}>
                            {levelLabels[level]}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(follower.guildId)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {bannedFollowers.length > 0 && (
              <section aria-labelledby="banned-followers">
                <h3 id="banned-followers" className="mb-4 text-base font-semibold text-[#c6d0f5]">
                  Banned servers
                </h3>
                <div className="space-y-3">
                  {bannedFollowers.map((follower) => (
                    <div
                      key={follower.guildId}
                      className="flex items-center gap-4 rounded-lg border border-[#e78284]/25 bg-[#e78284]/5 p-5"
                    >
                      <GuildIcon
                        guild={{ name: follower.guildName || follower.guildId, icon: follower.guildIconURL }}
                        className="size-9 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#c6d0f5]">
                          {follower.guildName || follower.guildId}
                        </p>
                        <p className="mt-1 text-xs text-[#e78284]">
                          {follower.banReason || "Banned from this server’s Docks"}
                        </p>
                      </div>
                      <span className="text-xs text-[#a5adce]">Manage in Server bans</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#626880] p-8 text-center">
            <Users className="mx-auto size-5 text-[#838ba7]" />
            <p className="mt-3 text-sm font-medium text-[#c6d0f5]">No followers yet</p>
            <p className="mt-1 text-xs text-[#a5adce]">Follow requests and active servers will appear here.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BansPanel({ guild }: { guild: Guild }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["bans", guild.id], queryFn: () => getBans(guild.id) });
  const candidates = useQuery({
    queryKey: ["ban-candidates", guild.id],
    queryFn: () => getBanCandidates(guild.id),
  });
  const candidateList = useId();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const add = useMutation({
    mutationFn: () => addBan(guild.id, target, reason),
    onSuccess: () => {
      toast.success("Server banned from published Docks");
      setTarget("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["bans", guild.id] });
      queryClient.invalidateQueries({ queryKey: ["ban-candidates", guild.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeBan(guild.id, id),
    onSuccess: () => {
      toast.success("Server unbanned");
      queryClient.invalidateQueries({ queryKey: ["bans", guild.id] });
      queryClient.invalidateQueries({ queryKey: ["ban-candidates", guild.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Server bans</CardTitle>
          <CardDescription>
            Block another known Sailor’s Lodge server from following any Dock published here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="ban-server">Server</Label>
              <Input
                id="ban-server"
                list={candidateList}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="Choose a server or enter its ID"
                maxLength={32}
                spellCheck={false}
              />
            </div>
            <datalist id={candidateList}>
              {candidates.data?.guilds.map((candidate: BanCandidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </datalist>
            <div className="space-y-2">
              <Label htmlFor="ban-reason">Reason</Label>
              <Input
                id="ban-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why this server is being blocked"
                maxLength={500}
              />
            </div>
            <Button
              variant="destructive"
              className="sm:mt-7"
              onClick={() => add.mutate()}
              disabled={!target || !reason || add.isPending}
            >
              <ShieldBan className="size-4" />
              Ban
            </Button>
          </div>
        </CardContent>
      </Card>
      {query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.data?.bans.length ? query.data.bans.map((ban: Ban) => (
        <div
          key={ban.targetGuildId}
          className="flex items-center gap-4 rounded-lg border border-[#e78284]/35 bg-[#e78284]/10 p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[#c6d0f5]">{ban.targetGuildName || ban.targetGuildId}</p>
            <p className="mt-1 text-xs leading-5 text-[#a5adce]">{ban.reason}</p>
            {ban.bannedAt && (
              <p className="mt-1 text-xs text-[#838ba7]">
                Banned {new Date(ban.bannedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => remove.mutate(ban.targetGuildId)}>
            Unban
          </Button>
        </div>
      )) : !query.isLoading ? (
        <Empty
          icon={ShieldBan}
          title="No server bans"
          copy="Servers blocked from this server’s published Docks will appear here."
        />
      ) : null}
    </div>
  );
}

function DockCard({
  guild,
  dock,
  discovering,
  edit,
  follow,
  followers,
  changed,
}: {
  guild: Guild;
  dock: Dock;
  discovering: boolean;
  edit: () => void;
  follow: () => void;
  followers: () => void;
  changed: () => void;
}) {
  const [confirming, setConfirming] = useState<"delete" | "unfollow" | null>(null);
  const queryClient = useQueryClient();
  const removeDockMutation = useMutation({
    mutationFn: () => deleteDock(guild.id, dock.id),
    onSuccess: () => {
      setConfirming(null);
      toast.success("Dock deleted");
      queryClient.invalidateQueries({ queryKey: ["docks", guild.id] });
      changed();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const unfollow = useMutation({
    mutationFn: () => deleteFollow(guild.id, dock.id),
    onSuccess: () => {
      setConfirming(null);
      toast.success("Dock unfollowed");
      queryClient.invalidateQueries({ queryKey: ["docks", guild.id] });
      changed();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const own = dock.guildId === guild.id;
  const pending = dock.follow?.level === "no-access";
  const canManageFollowers = own || dock.follow?.level === "admin";
  const localChannelNames = (dock.follow?.channelIds || [])
    .map((id) => guild.channels.find((channel) => channel.id === id)?.name)
    .filter(Boolean);
  const publishedChannelNames = dock.channelNames.filter(Boolean);
  const displayedChannels = own || !dock.follow ? publishedChannelNames : localChannelNames;
  const channelSummary = displayedChannels.map((name) => `#${name}`).join(", ");
  return (
    <>
      <Card
        className={cn("flex flex-col overflow-hidden", discovering && dock.follow && "opacity-60")}
      >
        <div
          className="relative h-24 shrink-0 bg-[#414559] bg-cover bg-center"
          style={
            dock.guildBannerURL ? { backgroundImage: `url(${dock.guildBannerURL})` } : undefined
          }
        >
          <div className="absolute bottom-0 left-6 translate-y-1/2">
            <GuildIcon
              guild={{ name: dock.guildName || dock.guildId, icon: dock.guildIconURL }}
              className="size-20 shrink-0 rounded-2xl border-4 border-[#414559] shadow-lg"
            />
          </div>
        </div>
        <CardHeader className="pt-12">
          <CardTitle className="truncate inline-flex gap-2">
            {dock.name}{" "}
            <div className="flex flex-wrap gap-2">
              {dock.official && (
                <Badge className="border-[#e5c890]/35 bg-[#e5c890]/12 text-[#f2d5cf]">
                  Official
                </Badge>
              )}

              {dock.blocked && (
                <Badge className="border-[#e78284]/35 bg-[#e78284]/10 text-[#e78284]">
                  Blocked
                </Badge>
              )}
            </div>
          </CardTitle>
          <span className="inline-flex items-center gap-1 text-xs text-[#a5adce]">
            <Users className="size-3.5 text-[#8caaee]" />
            {dock.followerCount} {dock.followerCount === 1 ? "follower" : "followers"}
            {canManageFollowers && dock.pendingFollowerCount > 0
              ? ` · ${dock.pendingFollowerCount} pending`
              : ""}
          </span>
          <CardDescription>by {dock.guildName || dock.guildId}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {dock.description && (
            <p className="line-clamp-3 text-sm leading-6 text-[#a5adce]">{dock.description}</p>
          )}

          <div className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[#c6d0f5]">
              <span className="inline-flex items-center gap-2">
                <MessageSquare className="size-4 text-[#8caaee]" />
                {dock.publishMode === "all" ? "Every message" : "Only !p messages"}
              </span>
            </div>
            <p className="flex items-start gap-2 text-[#a5adce]">
              <Hash className="mt-0.5 size-4 shrink-0 text-[#8caaee]" />
              <span className="min-w-0 break-words">
                {own
                  ? `Publishes from ${channelSummary || "an unavailable channel"}`
                  : dock.follow
                    ? `Delivers to ${channelSummary || "an unavailable channel"}`
                    : `Publishes from ${channelSummary || "an unavailable channel"}`}
              </span>
            </p>

            {dock.blockedReason && (
              <p className="text-xs leading-5 text-[#e78284]">Reason: {dock.blockedReason}</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {discovering ? (
              own ? (
                <Button size="sm" variant="secondary" disabled>
                  Published
                </Button>
              ) : dock.follow ? (
                <Button size="sm" variant="secondary" disabled>
                  {pending ? "Pending" : "Following"}
                </Button>
              ) : (
                <Button size="sm" onClick={follow}>
                  {dock.accessMode === "request" ? "Request access" : "Follow Dock"}
                </Button>
              )
            ) : own ? (
              <>
                <Button size="sm" variant="secondary" onClick={edit}>
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={follow}>
                  <BellRing className="size-4" />
                  Server settings
                </Button>
                <Button size="sm" variant="outline" onClick={followers}>
                  <Users className="size-4" />
                  Manage Followers
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  aria-label={`Delete ${dock.name}`}
                  onClick={() => setConfirming("delete")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            ) : dock.blocked ? (
              <p className="text-xs text-[#e78284]">
                This server cannot follow this publisher’s Docks.
              </p>
            ) : dock.follow ? (
              <>
                <Button size="sm" variant="secondary" onClick={follow}>
                  Server settings
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirming("unfollow")}>
                  {pending ? "Cancel request" : "Unfollow"}
                </Button>
                {canManageFollowers && (
                  <Button size="sm" variant="outline" onClick={followers}>
                    Manage Followers
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" onClick={follow}>
                {dock.accessMode === "request" ? "Request access" : "Follow Dock"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirming === "delete"
                ? `Delete ${dock.name}?`
                : pending
                  ? `Cancel request for ${dock.name}?`
                  : `Unfollow ${dock.name}?`}
            </DialogTitle>
            <DialogDescription>
              {confirming === "delete"
                ? "This permanently removes the Dock and disconnects every follower."
                : pending
                  ? "The publisher will no longer see this follow request."
                  : "Messages from this Dock will stop arriving in this server."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirming === "delete" ? removeDockMutation.mutate() : unfollow.mutate()
              }
            >
              {confirming === "delete" ? "Delete Dock" : pending ? "Cancel request" : "Unfollow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const dockViews = {
  discover: {
    label: "Discover",
    title: "Discover Docks",
    copy: "Find live boards from other communities.",
  },
  published: {
    label: "Published",
    title: "Published Docks",
    copy: "Manage the boards this server shares.",
  },
  following: {
    label: "Following",
    title: "Following Docks",
    copy: "Configure the boards connected to this server.",
  },
  bans: {
    label: "Server bans",
    title: "Server bans",
    copy: "Control which servers can follow your published Docks.",
  },
} as const;

type DockView = keyof typeof dockViews;

function Docks({ data, refresh }: { data: GuildData; refresh: () => void }) {
  const location = useLocation();
  const hash = location.hash.slice(1);
  const view: DockView = hash in dockViews ? hash as DockView : "discover";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [editing, setEditing] = useState<Dock | null | undefined>();
  const [following, setFollowing] = useState<Dock | null>(null);
  const [managing, setManaging] = useState<Dock | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["docks", data.guild.id, view, deferredSearch],
    queryFn: () => getDocks(data.guild.id, view, deferredSearch),
    enabled: view !== "bans",
  });
  const docks = useMemo(
    () =>
      view === "following"
        ? (query.data?.docks || []).filter((dock) => dock.guildId !== data.guild.id)
        : query.data?.docks || [],
    [query.data, view, data.guild.id],
  );
  const changed = () => {
    queryClient.invalidateQueries({ queryKey: ["docks", data.guild.id] });
    refresh();
  };
  if (!data.guild.manageChannels)
    return (
      <Empty
        icon={Network}
        title="Manage Channels required"
        copy="Discord’s Manage Channels permission is required to publish, follow, or administer Docks."
      />
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-display text-2xl text-[#c6d0f5]">{dockViews[view].title}</h2>
          <p className="mt-1 text-sm text-[#a5adce]">
            {dockViews[view].copy}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {view !== "bans" && (
            <div className="relative">
              <Search className="absolute left-3 top-3.5 size-4 text-[#838ba7]" />
              <Input
                aria-label="Search Docks"
                className="pl-10 sm:w-64"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Docks"
                maxLength={100}
              />
            </div>
          )}
          <Button onClick={() => setEditing(null)}>
            <Plus className="size-4" />
            Publish Dock
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-[#626880]/60 pb-4">
        {(Object.entries(dockViews) as [DockView, (typeof dockViews)[DockView]][]).map(
          ([item, config]) => (
            <Button
              key={item}
              size="sm"
              variant={view === item ? "outline" : "ghost"}
              asChild
            >
              <Link to={`#${item}`} aria-current={view === item ? "page" : undefined}>
                {config.label}
              </Link>
            </Button>
          ),
        )}
      </div>
      {view === "bans" ? (
        <BansPanel guild={data.guild} />
      ) : query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-72" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : docks.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {docks.map((dock) => (
            <DockCard
              key={dock.id}
              guild={data.guild}
              dock={dock}
              discovering={view === "discover"}
              edit={() => setEditing(dock)}
              follow={() => setFollowing(dock)}
              followers={() => setManaging(dock)}
              changed={changed}
            />
          ))}
        </div>
      ) : (
        <Empty
          icon={ShipWheel}
          title={
            search
              ? "No Docks matched"
              : view === "published"
                ? "No published Docks"
                : view === "following"
                  ? "Not following any Docks"
                  : "No Docks available"
          }
          copy={
            search
              ? "Try a different name, publisher, or description."
              : view === "published"
                ? "Publish a channel so other communities can discover and follow it."
                : "Browse the directory or publish the first Dock."
          }
          action={
            view === "published" ? (
              <Button onClick={() => setEditing(null)}>
                <Plus className="size-4" />
                Publish Dock
              </Button>
            ) : undefined
          }
        />
      )}
      <DockEditor
        guild={data.guild}
        dock={editing || null}
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        done={changed}
      />
      <FollowEditor
        guild={data.guild}
        dock={following}
        open={Boolean(following)}
        onOpenChange={(open) => !open && setFollowing(null)}
        done={changed}
      />
      <FollowersDialog
        guild={data.guild}
        dock={managing}
        open={Boolean(managing)}
        onOpenChange={(open) => !open && setManaging(null)}
      />
    </div>
  );
}

export function Dashboard() {
  const { guildId, section = "overview" } = useParams();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false });
  const guilds = useQuery({ queryKey: ["guilds"], queryFn: getGuilds, enabled: Boolean(me.data) });
  const data = useQuery({
    queryKey: ["guild", guildId],
    queryFn: () => getGuild(guildId!),
    enabled: Boolean(me.data && guildId),
  });
  if (me.isLoading || (me.data && guilds.isLoading) || (guildId && data.isLoading))
    return (
      <div className="grid min-h-screen place-items-center bg-[#303446] text-[#8caaee]">
        <LoaderCircle className="size-7 animate-spin" />
        <span className="sr-only">Loading dashboard</span>
      </div>
    );
  if (me.error instanceof ApiError && me.error.status === 401)
    return (
      <div className="grid min-h-screen place-items-center bg-[#303446] px-5 text-center text-[#c6d0f5]">
        <Card className="max-w-md p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-lg bg-[#8caaee]/12 text-[#8caaee]">
            <DoorOpen className="size-5" />
          </span>
          <h1 className="mt-5 font-display text-3xl">Come aboard</h1>
          <p className="mt-3 text-sm leading-6 text-[#a5adce]">
            Sign in with Discord to see servers where you can manage Sailor’s Lodge.
          </p>
          <Button asChild className="mt-6 w-full">
            <a href="/auth/discord">Continue with Discord</a>
          </Button>
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link to="/">Back to home</Link>
          </Button>
        </Card>
      </div>
    );
  if (me.error)
    return (
      <div className="min-h-screen bg-[#303446] p-8 text-[#c6d0f5]">
        <ErrorState error={me.error} />
      </div>
    );
  if (guilds.error)
    return (
      <div className="grid min-h-screen place-items-center bg-[#303446] p-8 text-[#c6d0f5]">
        <div className="w-full max-w-md">
          <ErrorState error={guilds.error} />
          <Button asChild className="mt-4 w-full">
            <a href="/auth/discord">Refresh Discord servers</a>
          </Button>
        </div>
      </div>
    );
  if (!guildId) return <ServerChooser guilds={guilds.data?.guilds || []} />;
  if (data.error)
    return (
      <div className="min-h-screen bg-[#303446] p-8 text-[#c6d0f5]">
        <ErrorState error={data.error} />
        <Button asChild variant="ghost" className="mt-4">
          <Link to="/dashboard">Choose another server</Link>
        </Button>
      </div>
    );
  if (!data.data || !me.data) return null;
  if (!sections.some((item) => item.id === section))
    return <Navigate to={`/dashboard/${guildId}/overview`} replace />;
  const refresh = () => data.refetch();
  return (
    <Shell
      user={me.data.user}
      guilds={(guilds.data?.guilds || []).filter((guild) => guild.installed)}
      data={data.data}
      section={section}
    >
      <>
        {section === "overview" && <Overview data={data.data} />}
        {section === "settings" && <ServerSettings data={data.data} refresh={refresh} />}
        {section === "pings" && <PingGroups data={data.data} refresh={refresh} />}
        {section === "docks" && <Docks data={data.data} refresh={refresh} />}
      </>
    </Shell>
  );
}
