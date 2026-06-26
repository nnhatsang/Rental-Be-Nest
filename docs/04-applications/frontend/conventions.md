# Quy chuẩn phát triển Frontend (Next.js Conventions)

> Tài liệu hướng dẫn lập trình, cấu trúc thư mục, và các nguyên tắc phát triển giao diện Admin Console bằng Next.js App Router.

---

## 1. Thứ tự xây dựng tính năng (Development Lifecycle)

Khi xây dựng hoặc cập nhật bất kỳ tính năng nào trên frontend, lập trình viên bắt buộc phải triển khai mã nguồn theo thứ tự phân tầng dưới đây. Tuyệt đối không viết gộp hoặc gọi trực tiếp API từ component.

```text
1. Types ──> 2. Schema Zod ──> 3. Service API ──> 4. React Hook ──> 5. Component/Page
```

Thư mục tương ứng cho mỗi tầng trong từng Module (`modules/<domain>/`):
- Kiểu dữ liệu: `modules/<domain>/types.ts`
- Schema validate Zod: `modules/<domain>/schema.ts`
- Services API: `modules/<domain>/services.ts`
- Zustand Store (nếu cần): `modules/<domain>/store.ts`
- React Hooks: `modules/<domain>/hooks/use<Action>.hook.ts`
- Components nghiệp vụ: `modules/<domain>/components/<Feature>.tsx`
- Next.js Page: `app/<route>/page.tsx` (chỉ import component nghiệp vụ và render)

---

## 2. Chi tiết các lớp kiến trúc

### 2.1 Types (Kiểu dữ liệu)
Định nghĩa toàn bộ request payload và response structure của API tại file `types.ts` trong từng module. Đặt tên type khớp với hành động:
```typescript
export interface ILoginReq {
  email: string;
  password: string;
}

export interface IAuthRes {
  user: IUser;
}
```
*Không định nghĩa kiểu dữ liệu inline trong services hoặc hooks.*

### 2.2 Zod Schema (Ràng buộc Form dữ liệu)
Mọi biểu mẫu (Form) nhập liệu bắt buộc phải được validate ở client thông qua thư viện Zod. Schema đặt ở file `schema.ts` trong từng module, xuất bản cả Schema lẫn kiểu dữ liệu được suy diễn (inferred type):
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, { message: 'Bắt buộc nhập email' }).email({ message: 'Email không hợp lệ' }),
  password: z.string().min(1, { message: 'Bắt buộc nhập mật khẩu' }),
});

export type ILoginInput = z.infer<typeof loginSchema>;
```

### 2.3 Services (Giao tiếp API)
Service chỉ làm nhiệm vụ khai báo cuộc gọi HTTP sử dụng Axios client tại file `services.ts` trong từng module:
- Dùng `apiClient` cho các endpoint public (chưa đăng nhập).
- Dùng `apiAuth` cho các endpoint yêu cầu quyền Admin/Staff.
- Nhận dữ liệu đã định kiểu và trả về `Promise<AxiosResponse<DefaultResponse<T>>>`.
- **Không** lồng ghép toast thông báo, điều hướng router hoặc quản lý trạng thái UI tại đây.

### 2.4 Hooks (Kết nối Logic & Trạng thái)
React Hook nằm tại thư mục `hooks/` của từng module đóng vai trò nhạc trưởng kết nối Form state, Validate resolver, Mutation (TanStack Query), và điều hướng:
- Kết nối React Hook Form với Zod resolver.
- Gọi TanStack Query Mutation/Query.
- Sử dụng hàm `applyApiFormErrors` để tự động map các lỗi validate từ backend trả về vào các trường của form.

```typescript
export const useLogin = () => {
  const form = useForm<ILoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: ILoginInput) => {
      await requestLogin(values);
    },
    onError: (error) => {
      applyApiFormErrors(form, error, {
        fallbackMessage: ERROR_MESSAGES.AUTH.LOGIN,
      });
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.AUTH.LOGIN);
    },
  });

  const onSubmit = (values: ILoginInput) => {
    mutate(values);
  };

  return { form, isPending, onSubmit };
};
```

### 2.5 Components & Pages (Giao diện hiển thị)
Component chỉ tập trung vào việc render HTML/Shadcn UI:
- Lấy thông tin form state, biến `isPending` và callback `onSubmit` từ Hook.
- Gọi `handleSubmit(onSubmit)` của React Hook Form khi submit.
- Render lỗi của từng trường bằng thẻ `<FieldError>` có sẵn:
  ```typescript
  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
  ```
- Render lỗi tổng quát (Root Error) ở đầu form:
  ```typescript
  {errors.root && <FieldError errors={[errors.root]} />}
  ```

---

## 3. Quy chuẩn Ngôn ngữ & Thông báo (Toast Messages)

- **Ngôn ngữ**: Toàn bộ giao diện Admin hiển thị bằng tiếng Việt. Các file mã nguồn cần được lưu với bảng mã **UTF-8** để tránh lỗi hiển thị ký tự (Mojibake).
- **Toast thông báo**: Không tự viết text thông báo thành công hay thất bại dưới dạng chuỗi thô (hardcoded string) trong các file hook.
  - Thành công: Import từ `SUCCESS_MESSAGES` tại `utils/consts/messages-success.const.ts`.
  - Thất bại: Import từ `ERROR_MESSAGES` tại `utils/consts/message-error.const.ts`.
- **Ánh xạ trường lỗi (fieldMap)**: Nếu tên trường lỗi từ Backend trả về khác với tên trường biểu mẫu ở Frontend, hãy dùng tùy chọn `fieldMap` trong hàm `applyApiFormErrors`:
  ```typescript
  applyApiFormErrors(form, error, {
    fallbackMessage: ERROR_MESSAGES.AUTH.RESET_PASSWORD,
    fieldMap: {
      passwordConfirm: 'confirmPassword',
      newPasswordConfirm: 'confirmPassword',
    },
  });
  ```

---

## 4. Xác thực mã nguồn (Verification)

Sau khi chỉnh sửa hoặc thêm mới bất kỳ cấu phần nào trên Frontend, lập trình viên bắt buộc phải chạy lệnh sau ở root frontend để kiểm tra kiểu dữ liệu tĩnh:

```bash
pnpm exec tsc --noEmit
```
*Đảm bảo không có lỗi TypeScript nào trước khi commit code.*
