// Normalizes any date input to midnight (00:00:00.000) local server time,
// so visitDate comparisons are purely calendar-date comparisons.
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isSameCalendarDate = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const isBeforeToday = (date) => startOfDay(date).getTime() < startOfDay(new Date()).getTime();

// Compares an "HH:mm" string against the current time-of-day.
// Returns true if the given time is earlier than "now".
const isTimeBeforeNow = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  const candidate = new Date();
  candidate.setHours(h, m, 0, 0);
  return candidate.getTime() < now.getTime();
};

module.exports = { startOfDay, isSameCalendarDate, isBeforeToday, isTimeBeforeNow };
