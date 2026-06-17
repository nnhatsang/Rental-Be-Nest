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

export const USER_SELF_PASSWORD_RESET_NOT_ALLOWED = new ErrorResponse({
  code: 'USER_SELF_PASSWORD_RESET_NOT_ALLOWED',
  message: 'Khôbg thể reset mật khẩu chính mình bằng cách này',
});

export const CUSTOMER_NOT_FOUND = new ErrorResponse({
  code: 'CUSTOMER_NOT_FOUND',
  message: 'Không tìm thấy khách hàng',
});

export const CUSTOMER_EMAIL_EXISTED = new ErrorResponse({
  code: 'CUSTOMER_EMAIL_EXISTED',
  message: 'Email khách hàng đã tồn tại',
});

export const CUSTOMER_PHONE_EXISTED = new ErrorResponse({
  code: 'CUSTOMER_PHONE_EXISTED',
  message: 'Số điện thoại khách hàng đã tồn tại',
});

export const CUSTOMER_CODE_EXISTED = new ErrorResponse({
  code: 'CUSTOMER_CODE_EXISTED',
  message: 'Mã khách hàng đã tồn tại',
});

export const PRODUCT_NOT_FOUND = new ErrorResponse({
  code: 'PRODUCT_NOT_FOUND',
  message: 'Không tìm thấy sản phẩm',
});

export const PRODUCT_SKU_EXISTED = new ErrorResponse({
  code: 'PRODUCT_SKU_EXISTED',
  message: 'SKU sản phẩm đã tồn tại',
});

export const PRODUCT_CATEGORY_NOT_FOUND = new ErrorResponse({
  code: 'PRODUCT_CATEGORY_NOT_FOUND',
  message: 'Không tìm thấy danh mục sản phẩm',
});

export const PRODUCT_BRAND_NOT_FOUND = new ErrorResponse({
  code: 'PRODUCT_BRAND_NOT_FOUND',
  message: 'Không tìm thấy thương hiệu sản phẩm',
});

export const PRODUCT_RENTAL_PRICE_TIER_INVALID = new ErrorResponse({
  code: 'PRODUCT_RENTAL_PRICE_TIER_INVALID',
  message: 'Bậc giá thuê sản phẩm không hợp lệ',
});

export const ASSET_UNIT_NOT_FOUND = new ErrorResponse({
  code: 'ASSET_UNIT_NOT_FOUND',
  message: 'Không tìm thấy đơn vị tài sản',
});

export const ASSET_UNIT_SERIAL_NUMBER_EXISTED = new ErrorResponse({
  code: 'ASSET_UNIT_SERIAL_NUMBER_EXISTED',
  message: 'Serial Number tồn tại',
});

export const RENTAL_POLICY_NOT_FOUND = new ErrorResponse({
  code: 'RENTAL_POLICY_NOT_FOUND',
  message: 'Không tìm thấy chính sách thuê',
});

export const STORE_BUSINESS_HOURS_INVALID = new ErrorResponse({
  code: 'STORE_BUSINESS_HOURS_INVALID',
  message: 'Cấu hình giờ hoạt động không hợp lệ',
});

export const STORE_CLOSURE_NOT_FOUND = new ErrorResponse({
  code: 'STORE_CLOSURE_NOT_FOUND',
  message: 'Không tìm thấy lịch đóng cửa của hàng',
});

export const STORE_CLOSURE_TIME_INVALID = new ErrorResponse({
  code: 'STORE_CLOSURE_TIME_INVALID',
  message: 'Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc',
});

export const RENTAL_ORDER_TIME_INVALID = new ErrorResponse({
  code: 'RENTAL_ORDER_TIME_INVALID',
  message: 'Thời gian thuê không hợp lệ',
});

export const PASSWORD_CONFIRM_NOT_MATCH = new ErrorResponse({
  code: 'PASSWORD_CONFIRM_NOT_MATCH',
  message: 'Xác nhận mật khẩu không khớp',
});

export const PASSWORD_RESET_TOKEN_INVALID = new ErrorResponse({
  code: 'PASSWORD_RESET_TOKEN_INVALID',
  message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn!',
});

export const RENTAL_ORDER_NOT_FOUND = new ErrorResponse({
  code: 'RENTAL_ORDER_NOT_FOUND',
  message: 'Không tìm thấy đơn thuê',
});

export const RENTAL_ORDER_CUSTOMER_INVALID = new ErrorResponse({
  code: 'RENTAL_ORDER_CUSTOMER_INVALID',
  message: 'Khách hàng trong đơn thuê không hợp lệ',
});

export const RENTAL_ORDER_ASSIGNED_USER_INVALID = new ErrorResponse({
  code: 'RENTAL_ORDER_ASSIGNED_USER_INVALID',
  message: 'Nhân viên được phân công không hợp lệ',
});

export const RENTAL_ORDER_PRODUCT_INVALID = new ErrorResponse({
  code: 'RENTAL_ORDER_PRODUCT_INVALID',
  message: 'Sản phẩm trong đơn thuê không hợp lệ',
});

export const RENTAL_ORDER_ASSET_UNIT_INVALID = new ErrorResponse({
  code: 'RENTAL_ORDER_ASSET_UNIT_INVALID',
  message: 'Tài sản gán vào đơn thuê không hợp lệ',
});

export const RENTAL_ORDER_STORE_CLOSED = new ErrorResponse({
  code: 'RENTAL_ORDER_STORE_CLOSED',
  message: 'Cửa hàng đóng cửa trong thời gian này',
});

export const RENTAL_ORDER_UNAVAILABLE = new ErrorResponse({
  code: 'RENTAL_ORDER_UNAVAILABLE',
  message: 'Lịch thuê không còn khả dụng',
});

export const RENTAL_ORDER_STATUS_TRANSITION_INVALID = new ErrorResponse({
  code: 'RENTAL_ORDER_STATUS_TRANSITION_INVALID',
  message: 'Không thể chuyển trạng thái đơn thuê theo yêu cầu',
});

export const ROLE_NOT_FOUND = new ErrorResponse({
  code: 'ROLE_NOT_FOUND',
  message: 'Không tìm thấy vai trò phù hợp',
});

export const ROLE_CODE_EXISTED = new ErrorResponse({
  code: 'ROLE_CODE_EXISTED',
  message: 'Mã vài trò tồn tại',
});

export const ROLE_SYSTEM_PROTECTED = new ErrorResponse({
  code: 'ROLE_SYSTEM_PROTECTED',
  message: 'Không thể thay đổi vài trò hệ thống bằng thao tác này.',
});

export const ROLE_IN_USE = new ErrorResponse({
  code: 'ROLE_IN_USE',
  message: 'Vai tro dang duoc gan cho nguoi dung',
});

export const ROLE_PERMISSION_INVALID = new ErrorResponse({
  code: 'ROLE_PERMISSION_INVALID',
  message: 'Danh sách quyền không hợp lệ',
});

export const ROLE_USER_INVALID = new ErrorResponse({
  code: 'ROLE_USER_INVALID',
  message: 'Danh sách người dùng gán quyền khong hợp lệ',
});

export const PERMISSION_NOT_FOUND = new ErrorResponse({
  code: 'PERMISSION_NOT_FOUND',
  message: 'Không thấy quyền phù hợp',
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
