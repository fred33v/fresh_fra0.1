/** An id-safe form of a question or option id ("Within 24 hours" → "Within-24-hours"). */
export const domId = (raw: string) => raw.replace(/[^A-Za-z0-9_-]+/g, '-');
