const chrono = require("chrono-node");

const timeOptions = { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true };
const dateOptionsLong = { weekday: "long", year: "numeric", month: "long", day: "numeric" };

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

function filterTimeChoices(focusedValue) {
  const search = String(focusedValue ?? "").trim();
  let targetDate = new Date();

  if (search.length > 0) {
    const parsedDate = chrono.parseDate(search);
    if (!parsedDate) {
      return [{ name: `Searching/Parsing: "${search}"...`.slice(0, 100), value: "INVALID" }];
    }

    targetDate = parsedDate;
  }

  const timestamp = targetDate.getTime().toString();
  const formatTimeOnly = targetDate.toLocaleTimeString("en-US", timeOptions);
  const formatMedium = targetDate.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const longDateStr = targetDate.toLocaleDateString("en-US", dateOptionsLong);
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

function parseTimeInput(value) {
  const input = String(value ?? "").trim();
  if (!input) return null;

  if (/^\d{10,}$/.test(input)) {
    const timestamp = Number(input);
    if (Number.isSafeInteger(timestamp)) {
      return new Date(input.length === 10 ? timestamp * 1000 : timestamp);
    }
  }

  return chrono.parseDate(input);
}

module.exports = {
  filterTimeChoices,
  getRelativeTimeString,
  parseTimeInput,
};
