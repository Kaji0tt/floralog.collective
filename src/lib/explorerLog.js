export const EXPLORER_PAGE_SIZE = 40;

export const getExplorerThresholdIso = () => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString();
};