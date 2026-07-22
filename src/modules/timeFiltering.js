const chrono = require("chrono-node");

const scheduleTimeZone = process.env.SCHEDULE_TIME_ZONE || "America/New_York";
const timeOptions = {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: scheduleTimeZone,
};
const dateOptionsLong = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: scheduleTimeZone,
};

function getTimeZoneOffsetMinutes(date = new Date(), timeZone = scheduleTimeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce((values, part) => {
      if (part.type !== "literal") values[part.type] = Number(part.value);
      return values;
    }, {});

  const zonedTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return Math.round((zonedTimeAsUtc - date.getTime()) / 60000);
}

function getParsingReference(now = new Date(), timeZone = scheduleTimeZone) {
  const instant = now instanceof Date ? now : new Date(now);
  return {
    instant,
    timezone: getTimeZoneOffsetMinutes(instant, timeZone),
  };
}

function fromWallTime(date, referenceOffset, timeZone) {
  const wallTime = date.getTime() + referenceOffset * 60_000;
  let instant = wallTime;

  // Timezone offsets can change between the parsing reference and the target
  // date because of daylight saving time. Re-evaluate until the instant settles.
  for (let attempt = 0; attempt < 3; attempt++) {
    const offset = getTimeZoneOffsetMinutes(new Date(instant), timeZone);
    const next = wallTime - offset * 60_000;
    if (next === instant) break;
    instant = next;
  }

  return new Date(instant);
}

function getRelativeTimeString(targetDate, now = Date.now()) {
  const msDiff = targetDate.getTime() - now;
  const secDiff = Math.round(msDiff / 1000);
  const minDiff = Math.round(secDiff / 60);
  const hourDiff = Math.round(minDiff / 60);
  const dayDiff = Math.round(hourDiff / 24);

  const absHours = Math.abs(hourDiff);
  const absMinutes = Math.abs(minDiff);
  const absDays = Math.abs(dayDiff);

  if (secDiff >= -5 && secDiff <= 5) return "just now";

  if (msDiff > 0) {
    if (absHours >= 24) return `in ${absDays} day${absDays > 1 ? "s" : ""}`;
    if (absMinutes >= 60) return `in ${absHours} hour${absHours > 1 ? "s" : ""}`;
    return `in ${absMinutes} minute${absMinutes > 1 ? "s" : ""}`;
  }

  if (absHours >= 24) return `${absDays} day${absDays > 1 ? "s" : ""} ago`;
  if (absMinutes >= 60) return `${absHours} hour${absHours > 1 ? "s" : ""} ago`;
  return `${absMinutes} minute${absMinutes > 1 ? "s" : ""} ago`;
}

function filterTimeChoices(focusedValue, timeZone = scheduleTimeZone) {
  const search = String(focusedValue ?? "").trim();
  let targetDate = new Date();

  if (search.length > 0) {
    const parsedDate = parseTimeInput(search, targetDate, timeZone);
    if (!parsedDate) {
      return [{ name: `Searching/Parsing: "${search}"...`.slice(0, 100), value: "INVALID" }];
    }

    targetDate = parsedDate;
  }

  const timestamp = targetDate.getTime().toString();
  const options = { ...timeOptions, timeZone };
  const formatTimeOnly = targetDate.toLocaleTimeString("en-US", options);
  const formatMedium = targetDate.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  });
  const longDateStr = targetDate.toLocaleDateString("en-US", {
    ...dateOptionsLong,
    timeZone,
  });
  const formatLongComplete = `${longDateStr} at ${formatTimeOnly}`;
  const formatRelative = getRelativeTimeString(targetDate);

  const choices = [
    { name: formatTimeOnly, value: timestamp },
    { name: formatMedium, value: timestamp },
    { name: formatLongComplete, value: timestamp },
    { name: formatRelative, value: timestamp },
  ];

  return choices
    .filter((item, index, self) => index === self.findIndex((choice) => choice.name === item.name))
    .slice(0, 25);
}

function parseTimeInput(value, now = new Date(), timeZone = scheduleTimeZone) {
  const input = String(value ?? "").trim();
  if (!input) return null;

  if (/^\d{10,}$/.test(input)) {
    const timestamp = Number(input);
    if (Number.isSafeInteger(timestamp)) {
      return new Date(input.length === 10 ? timestamp * 1000 : timestamp);
    }
  }

  const reference = getParsingReference(now, timeZone);
  const [result] = chrono.parse(input, reference, { forwardDate: true });
  if (!result) return null;

  const parsed = result.date();
  return result.start.isCertain("timezoneOffset")
    ? parsed
    : fromWallTime(parsed, reference.timezone, timeZone);
}

module.exports = {
  filterTimeChoices,
  getParsingReference,
  getRelativeTimeString,
  getTimeZoneOffsetMinutes,
  parseTimeInput,
};
