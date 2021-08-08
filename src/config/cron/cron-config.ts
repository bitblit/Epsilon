import { CronBackgroundEntry } from './cron-background-entry';

export interface CronConfig {
  // Timezone used to evaluate date and time (defaults to etc/gmt)
  timezone: string;
  // Define the current context of this cron executor (typically used to switch prod/qa/dev, etc)
  context: string;

  entries: CronBackgroundEntry[];
}
