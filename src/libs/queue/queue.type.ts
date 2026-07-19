export type SendEmailJobData = {
  emailLogId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EnqueueEmailResult = {
  jobId: string;
};
