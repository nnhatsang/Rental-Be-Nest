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
  message: 'Lỗi xác thực',
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

export const USER_NOT_FOUND = new ErrorResponse({
  code: 'USER_NOT_FOUND',
  message: 'Không tìm thấy tài khoản!',
});

export const INVALID_USER = new ErrorResponse({
  code: 'INVALID_USER',
  message: 'Tài khoản không tồn tại',
});

export const USER_EMAIL_EXISTED = new ErrorResponse({
  code: 'USER_EMAIL_EXISTED',
  message: 'Email tài khoản đã tồn tại',
});

export const USER_SELF_DELETE_NOT_ALLOWED = new ErrorResponse({
  code: 'USER_SELF_DELETE_NOT_ALLOWED',
  message: 'Không thể tự xóa tài khoản đang đăng nhập',
});

export const ROLE_NOT_FOUND = new ErrorResponse({
  code: 'ROLE_NOT_FOUND',
  message: 'Không tìm thấy vai trò phù hợp',
});

export const PASSWORD_NOT_MATCH = new ErrorResponse({
  code: 'PASSWORD_NOT_MATCH',
  message: 'Mật khẩu không chính xác',
});

export const DATA_ERROR = new ErrorResponse({
  code: 'DATA_ERROR',
  message: 'Lỗi dữ liệu',
});

export const OLD_PASSWORD_NOT_VALID = new ErrorResponse({
  code: 'OLD_PASSWORD_NOT_VALID',
  message: 'Mật khẩu cũ không đúng',
});
