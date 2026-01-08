// convert a readable duration string to milliseconds

module.exports = (duration) => {
  duration = String(duration);
  duration = duration.toLowerCase();
  const durationRegex = /(\d+)([smhd])/;
  const matches = duration.match(durationRegex);

  console.log(duration);
  if (!matches) {
    throw new Error("Invalid duration format");
  }

  const [, value, unit] = matches;

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error("Invalid duration unit");
  }
};