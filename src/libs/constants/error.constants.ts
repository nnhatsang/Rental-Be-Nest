export class ErrorResponse {
  code: string;
  message: string;

  constructor({ code, message }: { code: string; message: string }) {
    this.code = code;
    this.message = message;
  }
}
export const INCORRECT_INPUT = new ErrorResponse({
  code: 'INCORRECT_INPUT',
  message: 'Lỗi dữ liệu không hợp lệ',
});

export const UNKNOWN_ERROR = new ErrorResponse({
  code: 'UNKNOWN_ERROR',
  message: 'lỗi không xác định',
});

export const DATABASE_ERROR = new ErrorResponse({
  code: 'DATABASE_ERROR',
  message: 'Lỗi cơ sở dữ liệu',
});

export const INVALID_CSRF_TOKEN = new ErrorResponse({
  code: 'INVALID_CSRF_TOKEN',
  message: 'CSRF token không hợp lệ',
});

export const INVALID_AUTH_SESSION = new ErrorResponse({
  code: 'INVALID_AUTH_SESSION',
  message: 'Phiên đăng nhập không hợp lệ',
});

export const FORBIDDEN = new ErrorResponse({
  code: 'FORBIDDEN',
  message: 'Không có quyền truy cập',
});

export const UNAUTHORIZED = new ErrorResponse({
  code: 'UNAUTHORIZED',
  message: 'Chưa xác thực',
});

export const INVALID_SESSION = new ErrorResponse({
  code: 'INVALID_SESSION',
  message: 'Phiên làm việc không hợp lệ',
});

export const EUserActivityStatus = {
  Active: 'ACTIVE',
  Banned: 'BANNED',
  Locked: 'LOCKED',
  InActive: 'INACTIVE',
} as const;

export type EUserActivityStatus = (typeof EUserActivityStatus)[keyof typeof EUserActivityStatus];

export const USER_ACTIVITY_ERRORS: Record<Exclude<EUserActivityStatus, typeof EUserActivityStatus.Active>, ErrorResponse> = {
  [EUserActivityStatus.Banned]: new ErrorResponse({
    code: 'USER_BANNED',
    message: 'Tài khoản của bạn đã bị cấm đăng nhập!',
  }),
  [EUserActivityStatus.Locked]: new ErrorResponse({
    code: 'USER_LOCKED',
    message: 'Tài khoản của bạn đã bị khóa, vui lòng liên hệ quản trị viên để mở lại!',
  }),
  [EUserActivityStatus.InActive]: new ErrorResponse({
    code: 'USER_INACTIVE',
    message: 'Tài khoản của bạn chưa được kích hoạt hoặc đã ngừng hoạt động!',
  }),
};
