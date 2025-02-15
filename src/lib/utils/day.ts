import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";

// Extend dayjs with plugins
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export const formatTime = (time?: string) => {
  if (!time) return "";
  // Google Places returns time in 24hr format (e.g., "1430" for 2:30 PM)
  // We need to add a colon to make it valid HH:mm
  const formattedTime = time.replace(/(\d{2})(\d{2})/, "$1:$2");
  return dayjs(formattedTime, "HH:mm").format("h:mm A");
};

export const formatTimeRange = (start?: string, end?: string) => {
  if (!start || !end) return "";
  return `${formatTime(start)} - ${formatTime(end)}`;
};

// New utility functions
export const startOfDay = (date?: Date) => {
  return dayjs(date).startOf("day").toDate();
};

export const endOfDay = (date?: Date) => {
  return dayjs(date).endOf("day").toDate();
};

export default dayjs;
