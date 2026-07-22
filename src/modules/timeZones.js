const zones = ["UTC", ...(Intl.supportedValuesOf?.("timeZone") ?? [])];
const popular = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "UTC",
];

function abbreviations(timeZone) {
  const year = new Date().getUTCFullYear();
  return [new Date(Date.UTC(year, 0, 15)), new Date(Date.UTC(year, 6, 15))]
    .map(
      (date) =>
        new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
          .formatToParts(date)
          .find((part) => part.type === "timeZoneName")?.value,
    )
    .filter((name, index, names) => /^[A-Z]{2,5}$/.test(name) && names.indexOf(name) === index);
}

function label(timeZone) {
  const name = timeZone.replaceAll("_", " ").replaceAll("/", " / ");
  const aliases = abbreviations(timeZone);
  return aliases.length && !aliases.includes(timeZone) ? `${name} (${aliases.join("/")})` : name;
}

const entries = [...popular, ...zones.filter((timeZone) => !popular.includes(timeZone))].map(
  (timeZone) => ({ timeZone, aliases: abbreviations(timeZone), label: label(timeZone) }),
);

function isValid(timeZone) {
  if (!zones.includes(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function choices(query) {
  const search = String(query ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const abbreviation =
    /^[a-z]{2,5}$/.test(search) &&
    entries.some(({ aliases }) => aliases.some((alias) => alias.toLowerCase() === search));
  return entries
    .filter(
      ({ timeZone, aliases }) =>
        !search ||
        (abbreviation
          ? aliases.some((alias) => alias.toLowerCase() === search)
          : timeZone.toLowerCase().includes(search) ||
            aliases.some((alias) => alias.toLowerCase().includes(search))),
    )
    .slice(0, 25)
    .map((entry) => ({ name: entry.label, value: entry.timeZone }));
}

module.exports = { choices, isValid, label, zones };
