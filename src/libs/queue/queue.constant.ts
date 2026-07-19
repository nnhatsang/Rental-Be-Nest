export const EMAIL_QUEUE = 'email';

export const EMAIL_JOB = {
  SEND_EMAIL: 'send-email',
} as const;

export const EMAIL_QUEUE_OPTIONS = {
  ATTEMPTS: 3, //Thử gửi tối đa 3 lần.
  BACKOFF_DELAY_MS: 2_000, //Sau lần đầu thất bại, đợi khoảng 2 giây.
  COMPLETED_RETENTION_SECONDS: 24 * 60 * 60,
  COMPLETED_RETENTION_COUNT: 1_000,
  FAILED_RETENTION_SECONDS: 7 * 24 * 60 * 60,
  FAILED_RETENTION_COUNT: 5_000,
  CONCURRENCY: 5, //Worker có thể xử lý đồng thời 5 email.
} as const;

// EMAIL_QUEUE = 'email' nghĩa là tạo một hàng đợi Redis tên email.
// SEND_EMAIL = 'send-email' là tên loại công việc.
