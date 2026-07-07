# Quy chuẩn phát triển Frontend (Next.js Conventions)

> Tài liệu hướng dẫn lập trình, cấu trúc thư mục và các nguyên tắc phát triển giao diện Admin Console bằng Next.js App Router.

---

## 1. Thứ tự xây dựng tính năng

Khi xây dựng hoặc cập nhật tính năng frontend, triển khai theo thứ tự phân tầng dưới đây. Không gọi API trực tiếp từ component.

```text
1. Types -> 2. Schema Zod -> 3. Service API -> 4. React Hook -> 5. Component/Page
```

Cấu trúc khuyến nghị trong từng module `modules/<domain>/`:

- Kiểu dữ liệu: `modules/<domain>/type.ts`
- Schema validate Zod: `modules/<domain>/schema.ts`
- Services API: `modules/<domain>/services.ts`
- React Query hooks: `modules/<domain>/hooks/use-*.ts`
- State orchestration hook nếu cần: `modules/<domain>/hooks/use-<domain>-state.ts`
- Component nghiệp vụ: `modules/<domain>/<Feature>.tsx` hoặc `modules/<domain>/components/<Feature>.tsx`
- Next.js Page: `app/<route>/page.tsx` chỉ import component nghiệp vụ và render

---

## 2. Các lớp kiến trúc

### 2.1 Types

Định nghĩa request payload và response structure của API tại `type.ts` trong từng module.

```ts
export interface ILoginReq {
  email: string;
  password: string;
}

export interface IAuthRes {
  user: IUser;
}
```

Không định nghĩa type dữ liệu inline trong services hoặc hooks nếu type đó là contract API/module.

### 2.2 Zod Schema

Mọi form nhập liệu phải validate bằng Zod. Schema đặt ở `schema.ts`, export cả schema và inferred type.

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, { message: 'Bắt buộc nhập email' }).email({ message: 'Email không hợp lệ' }),
  password: z.string().min(1, { message: 'Bắt buộc nhập mật khẩu' }),
});

export type ILoginInput = z.infer<typeof loginSchema>;
```

### 2.3 Services

Service chỉ khai báo HTTP call bằng Axios client:

- Dùng `apiClient` cho endpoint public.
- Dùng `apiAuth` cho endpoint yêu cầu đăng nhập/quyền admin.
- Nhận dữ liệu đã định kiểu và trả về `Promise<AxiosResponse<DefaultResponse<T>>>`.
- Không toast, không router, không quản lý UI state trong service.

### 2.4 Hooks

Hooks kết nối form state, TanStack Query, mutation/query và UI state:

- Query/mutation hooks đặt trong `modules/<domain>/hooks`.
- State orchestration hook như `use-users-state.ts` chỉ gom state và handler cho page/module.
- Dùng `applyApiFormErrors` để map lỗi backend vào React Hook Form.
- Toast thành công/thất bại lấy từ constants, không hard-code trong mutation hooks.

```ts
export const useLogin = () => {
  const form = useForm<ILoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: ILoginInput) => requestLogin(values),
    onError: (error) => {
      applyApiFormErrors(form, error, {
        fallbackMessage: ERROR_MESSAGES.AUTH.LOGIN,
      });
    },
    onSuccess: () => {
      toast.success(SUCCESS_MESSAGES.AUTH.LOGIN);
    },
  });

  return {
    form,
    isPending,
    onSubmit: (values: ILoginInput) => mutate(values),
  };
};
```

### 2.5 Components & Pages

Component tập trung render UI:

- Nhận form/table/state từ hook.
- Gọi `handleSubmit(onSubmit)` khi submit form.
- Render field error bằng `<FieldError>`.
- Không gọi API trực tiếp từ component.

```tsx
{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
```

---

## 3. Text, constants và ngôn ngữ

- Toàn bộ UI admin hiển thị tiếng Việt.
- File mã nguồn phải lưu UTF-8 để tránh lỗi mojibake.
- Page title, dialog title, button text, label text dài và fallback error text phải đặt trong constants.
- Với page/module, ưu tiên gom text vào `TITLE_PAGE.<DOMAIN>`.

Ví dụ module users:

```ts
TITLE_PAGE.USERS.ACTIONS.CREATE
TITLE_PAGE.USERS.FORM.FULL_NAME
TITLE_PAGE.USERS.DIALOG.FORM_CREATE_TITLE
TITLE_PAGE.USERS.ERRORS.UPDATE_FAILED
```

Không hard-code text dài trong dialog/component nếu text đó thuộc business UI hoặc có khả năng dùng lại.

Toast messages:

- Thành công: dùng `SUCCESS_MESSAGES` tại `utils/consts/messages-success.const.ts`.
- Thất bại: dùng `ERROR_MESSAGES` tại `utils/consts/message-error.const.ts` hoặc fallback text trong `TITLE_PAGE.<DOMAIN>.ERRORS` nếu lỗi gắn với form/dialog cụ thể.

Nếu backend trả field error khác tên field frontend, dùng `fieldMap`:

```ts
applyApiFormErrors(form, error, {
  fallbackMessage: ERROR_MESSAGES.AUTH.RESET_PASSWORD,
  fieldMap: {
    passwordConfirm: 'confirmPassword',
    newPasswordConfirm: 'confirmPassword',
  },
});
```

---

## 4. Data Table và query params

Các màn danh sách admin nên dùng `components/ui/data-table` thay vì tự render table mới.

Pattern khuyến nghị:

- Dùng `useDataTable` để tạo table instance.
- Dùng `useTableQueryState` cho pagination, sorting, global search, column filters, row selection.
- Bật `syncUrl: true` nếu list state cần nằm trên URL.
- Khi gọi list API server-side, map sorting thành query `sortBy=<columnId>` và `sort=asc|desc` theo whitelist của backend.
- Global search dùng toolbar search của data-table.
- Column filter chỉ bật ở cột được khai báo trong `ColumnDef.meta`.
- Filter select dùng `meta.variant: 'select'` và `meta.options`.
- Export bật bằng `enableExport: true`.

Ví dụ column filter:

```ts
{
  accessorKey: 'activityStatus',
  header: 'Trạng thái',
  meta: {
    label: 'Trạng thái',
    variant: 'select',
    options: statusFilterOptions,
  },
  enableSorting: false,
}
```

Ví dụ map column filter sang query param:

```ts
const tableQuery = useTableQueryState({
  initialPageSize: 10,
  initialColumnFilters,
  columnFilterQueryParamMap: { activityStatus: 'status' },
  syncUrl: true,
});
```

Với API server-side:

```ts
const table = useDataTable({
  data,
  columns,
  pageCount,
  state: {
    pagination: tableQuery.pagination,
    rowSelection: tableQuery.rowSelection,
    sorting: tableQuery.sorting,
    columnFilters: tableQuery.columnFilters,
    globalFilter: tableQuery.globalFilter,
  },
  manualPagination: true,
  manualSorting: true,
  manualFiltering: true,
  enableColumnFilters: true,
  enableColumnFilterModes: false,
  enableGlobalFilter: true,
  enableExport: true,
  onPaginationChange: tableQuery.onPaginationChange,
  onSortingChange: tableQuery.onSortingChange,
  onColumnFiltersChange: tableQuery.onColumnFiltersChange,
  onGlobalFilterChange: tableQuery.onGlobalFilterChange,
  onRowSelectionChange: tableQuery.onRowSelectionChange,
});
```

Giữ table option tối giản theo nhu cầu màn hình. Không bật editing, grouping, virtualization, pinning nếu module không dùng.

---

## 5. Form edit và dirty values

Với form edit/PATCH, chỉ gửi field đã thay đổi.

- Dùng `getDirtyValues` từ `@/lib/dirty-form`.
- Nếu không có field dirty thì đóng dialog hoặc bỏ qua mutation.
- Field optional rỗng như `phone` nên normalize theo contract API trước khi gửi.

```ts
const dirtyValues = getDirtyValues(
  values as IUpdateUserInput,
  form.formState.dirtyFields as Partial<Record<keyof IUpdateUserInput, boolean>>,
);

if (Object.keys(dirtyValues).length === 0) {
  handleClose();
  return;
}

const data = {
  ...dirtyValues,
  ...(Object.prototype.hasOwnProperty.call(dirtyValues, 'phone')
    ? { phone: dirtyValues.phone || undefined }
    : {}),
};
```

Create form vẫn gửi full payload theo schema create.

---

## 6. Verification

Sau khi chỉnh sửa frontend, chạy typecheck ở root frontend:

```bash
pnpm exec tsc --noEmit --pretty false
```

Khi chỉ sửa một module, chạy thêm scoped eslint:

```bash
pnpm exec eslint modules/<domain> hooks/use-table-query-state.ts
```

Với module users hiện tại:

```bash
pnpm exec eslint modules/users hooks/use-table-query-state.ts lib/dirty-form.ts utils/consts/title-page.const.ts
```

Không commit code khi còn lỗi TypeScript hoặc scoped eslint error.
