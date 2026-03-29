import { format } from 'date-fns';

export const formatDate = (date, pattern = 'dd MMM yyyy, HH:mm') => {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), pattern);
  } catch {
    return 'Invalid Date';
  }
};
