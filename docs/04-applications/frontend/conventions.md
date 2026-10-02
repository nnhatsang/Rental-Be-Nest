# Frontend application conventions

## 1. Mục tiêu và phạm vi

Tài liệu này là quy ước triển khai module frontend cho admin app. Mục tiêu là để một module mới có cấu trúc nhất quán, dễ đọc, dễ mở rộng và không lặp lại logic giữa table, dropdown action, context menu, dialog và detail.

Phạm vi áp dụng:

- Next.js App Router và React client components.
- TanStack Query cho server state.
- TanStack Table cho bảng dữ liệu.
- React Hook Form + Zod cho form.
- shadcn/ui là lớp UI mặc định.
- Các primitive dùng chung trong components/ui và design token của dự án.
- Backend là nguồn quyết định cuối cùng cho permission, trạng thái nghiệp vụ, khả dụng và số tiền.

Nguyên tắc cốt lõi:

1. index.tsx của module chỉ compose page; không chứa business logic dài.
2. Logic gọi API nằm trong api/ hoặc hook chuyên trách; component không tự viết request.
3. Logic hiển thị trạng thái, màu, nhãn và định dạng dùng display-config.ts và display-utils.ts.
4. Một hành động chỉ có một nơi quyết định điều kiện; các nơi render khác nhau dùng lại descriptor đó.
5. UI chỉ cải thiện trải nghiệm. Backend vẫn phải kiểm tra lại quyền, trạng thái, tiền và điều kiện chuyển bước.
6. Không tạo bản sao server state trong nhiều local state nếu không cần thiết.
7. Ưu tiên primitive đã có của dự án trước khi thêm component mới.

---

## 2. Cấu trúc module chuẩn

Dùng feature-first. Mỗi module tự sở hữu model, query, UI và action của mình.

```text
modules/<domain>/
├── index.tsx
├── <domain>-provider.tsx
├── columns.tsx
├── constants.ts
├── display-config.ts
├── display-utils.ts
├── bulk-action.tsx                 # chỉ tạo khi module có bulk action
├── api/
│   ├── services.ts                 # lớp gọi HTTP thuần
│   ├── queries.ts                  # query options/query hooks
│   └── mutations.ts                # mutation hooks
├── model/
│   ├── index.ts
│   ├── schema.ts                   # schema form/filter
│   └── types.ts                    # response/view model
├── hooks/
│   ├── <domain>-logic.tsx          # orchestration cho page
│   └── use-<domain>-*.ts           # hook tái sử dụng
└── components/
    ├── actions/
    │   ├── <domain>-action-dialog.tsx
    │   ├── <domain>-action-definitions.ts
    │   ├── <domain>-action-items.tsx
    │   ├── <domain>-actions-cell.tsx
    │   ├── <domain>-context-menu.tsx
    │   └── index.ts
    ├── create/
    ├── update/
    ├── detail/
    ├── filters/
    └── <domain>-status-badge.tsx
```

Không bắt buộc tạo mọi file. Chỉ tạo file khi module thực sự có nhu cầu; không tạo spec/, domain/ hoặc wrapper rỗng chỉ để làm đầy cấu trúc.

---

## 3. Luồng xây dựng module

### Bước 1: Chốt contract

Trước khi code UI, xác định:

- endpoint và HTTP method;
- query params, pagination và sort;
- response item, summary và pagination;
- enum trạng thái;
- permission cần dùng;
- lỗi nghiệp vụ có thể trả về;
- field nào là dữ liệu hiện tại và field nào là snapshot.

Không tự suy diễn rule từ UI. Nếu một rule ảnh hưởng đến tiền, khả dụng, allocation hoặc chuyển trạng thái thì phải có backend xác nhận.

### Bước 2: Tạo model và schema

- model/types.ts mô tả response và view model.
- model/schema.ts mô tả input của form/filter.
- Dùng z.coerce cho số và ngày khi phù hợp.
- Chuẩn hóa date ở một nơi; tránh mỗi component tự new Date() theo cách khác nhau.
- Không dùng any. Nếu response chưa ổn định, dùng type rõ ràng và ghi chú điểm cần đồng bộ backend.

### Bước 3: Tách lớp API và server state

api/services.ts chỉ chịu trách nhiệm gọi API và nhận DTO.

api/queries.ts chịu trách nhiệm:

- query key;
- query params;
- loading/error state;
- pagination/cursor;
- stale time nếu module cần.

api/mutations.ts chịu trách nhiệm:

- create/update/action mutation;
- toast hoặc error mapping ở lớp phù hợp;
- invalidate/refetch các query bị ảnh hưởng.

Sau mutation, invalidate theo resource và các màn hình liên quan. Không tự sửa cache bằng dữ liệu thiếu field nếu chưa chắc response đầy đủ.

### Bước 4: Viết display config

Tạo một nguồn cấu hình cho:

- status;
- source;
- handover/return/settlement;
- asset status/condition;
- màu, nhãn, icon và mô tả ngắn.

Ví dụ:

```ts
export const orderStatusConfig = {
  CREATED: {
    label: 'Mới tạo',
    className: 'border-slate-300 bg-slate-50 text-slate-700',
    ganttColor: '#94a3b8',
  },
} as const;
```

Table, detail, dialog, Gantt và tooltip phải lấy cùng config. Không khai báo một màu khác ở từng component.

### Bước 5: Xây table và filter

columns.tsx chỉ mô tả cột, cell và metadata; không chứa request hoặc mở dialog bằng nhiều điều kiện rời rạc.

Nên sắp xếp cột theo ngữ nghĩa:

1. mã/định danh;
2. khách hàng hoặc quan hệ chính;
3. thời gian;
4. vận hành;
5. trạng thái;
6. tài chính;
7. action.

Filter có thể là:

- column filter hiển thị trực tiếp;
- filter-only column;
- external filter như customer combobox, date range, product combobox;
- search debounce.

Filter-only dùng metadata, không cần render thành cột dữ liệu:

```tsx
{
  accessorKey: 'source',
  header: 'Nguồn đơn',
  meta: {
    label: 'Nguồn đơn',
    variant: 'select',
    filterMode: 'equals',
    filterOnly: true,
    options: orderSourceOptions,
  },
  enableColumnFilter: true,
}
```

Nút Xóa bộ lọc phải kiểm tra toàn bộ nguồn filter: table state, URL params và external state. Khi clear phải reset cả customer/product/date/search, sau đó refetch đúng một lần theo cơ chế của page.

### Bước 6: Tổ chức action theo Action Registry + Adapter

Action của module phải nằm trong components/actions/. Mặc định không tách mỗi responsibility UI thành một file riêng. Dùng một registry khai báo để tập trung điều kiện và một renderer dùng chung cho các menu.

Cấu trúc gọn:

```text
components/actions/
├── <domain>-action-dialog.tsx
├── <domain>-actions.tsx
└── index.ts
```

Trách nhiệm:

- <domain>-actions.tsx
  - Chứa type descriptor, registry action và hook use<Domain>Actions.
  - Mỗi action khai báo id, section, label, icon, permission, dialog, visible, disabled và variant.
  - Chuyển registry thành action runtime sau khi áp dụng status và permission.
  - Render cùng descriptor thành DropdownMenuItem hoặc ContextMenuItem.
  - Export ActionsCell và ContextMenuItems như hai adapter mỏng.

- <domain>-action-dialog.tsx
  - Chứa form, summary, mutation và nội dung xác nhận của workflow.
  - Không quyết định danh sách action của table.
  - Footer phải tách khỏi vùng scroll; body dùng ScrollArea khi nội dung dài.

- index.ts
  - Là public API của cụm action.
  - Page, columns và hook chỉ import từ components/actions, không import sâu vào file nội bộ.

Pattern luồng dữ liệu:

```text
ACTION_REGISTRY
  └── use<Domain>Actions(row)
        └── ActionItems(menu)
              ├── ActionsCell       → DropdownMenu
              └── ContextMenuItems  → ContextMenu

onSelect
  └── mở dialog/provider hoặc gọi workflow đã chuẩn hóa
```

Ví dụ descriptor:

```ts
{
  id: 'handover',
  section: 'handover',
  label: 'Bàn giao máy',
  icon: IconPackageExport,
  permission: PermissionCode.OrdersUpdateStatus,
  dialog: 'handover',
  visible: ({ order }) => order.status === 'CONFIRMED',
  disabled: ({ order }) => order.handoverStatus !== 'READY',
  title: ({ order }) => (
    order.handoverStatus !== 'READY' ? 'Cần thanh toán đủ trước khi bàn giao' : undefined
  ),
}
```

Một action cần phân biệt rõ:

- visible: action có áp dụng với trạng thái hiện tại hay không;
- disabled: action áp dụng nhưng chưa đủ điều kiện, cần tooltip lý do;
- permission: lớp UX; backend vẫn kiểm tra lại;
- dialog: workflow sẽ mở khi user chọn action.

Không copy điều kiện action vào columns, detail và dialog. Nếu registry vượt quá mức dễ đọc hoặc có nhiều nhóm nghiệp vụ độc lập, chỉ khi đó mới tách registry theo nhóm; không tách riêng các adapter nhỏ nếu chưa cần.

DataTable dùng context menu phải bật opt-in:

```tsx
const table = useDataTable({
  data,
  columns,
  enableRowContextMenu: true,
  renderRowContextMenuItems: ({ row }) => (
    <DomainContextMenu row={row} />
  ),
});
```

Không thêm wrapper DOM vào tbody. Context menu phải bọc trực tiếp TableRow để không phá layout table, virtual row hoặc drag-and-drop.

### Bước 7: Thiết kế dialog

Dialog form có hai layout và phải chọn theo lượng nội dung, không dùng một
template flex/max-height/overflow cho tất cả dialog.

#### 7.1. Dialog thường (mặc định)

Dùng layout mặc định khi form có ít field, mô tả ngắn và vẫn vừa trong
viewport desktop/mobile. Mẫu tham chiếu là
modules/store-closures/components/store-closure-form-dialog.tsx.

- DialogContent dùng layout mặc định; chỉ thêm sm:max-w-* khi cần;
- không thêm flex, max-h, overflow-y-auto hoặc ScrollArea nếu chưa có nhu cầu
  cuộn;
- DialogHeader, form và DialogFooter là các vùng trực tiếp của DialogContent;
- dùng FieldGroup và các component Field chuẩn;
- có thể đặt footer ngoài form, sau đó liên kết nút submit bằng thuộc tính form;
- luôn có action phụ Đóng/Hủy và action chính khi user có quyền chỉnh sửa.

#### 7.2. Dialog dài hoặc nhiều field

Chỉ dùng ScrollArea khi form có nhiều field, nhiều section điều kiện, summary
dài hoặc không thể vừa trong viewport mobile. Mẫu tham chiếu là
modules/customers/dialog.tsx.

Với dialog dài:

```tsx
<DialogContent className="flex max-h-[90vh] flex-col p-0">
  <DialogHeader className="shrink-0 px-6 py-5" />
  <ScrollArea className="min-h-0 flex-1">
    <div className="px-6 py-5">
      {/* form */}
    </div>
  </ScrollArea>
  <DialogFooter className="shrink-0 border-t px-6 py-4" />
</DialogContent>
```

Nếu ScrollArea đã có padding custom thì không cộng thêm pr-4 ở form. Không đặt
footer vào vùng scroll để footer không bị bóp hoặc trôi khỏi viewport.

Quy tắc bổ sung:

- chỉ body/form bên trong ScrollArea chịu trách nhiệm cuộn;
- không đặt overflow-y-auto đồng thời lên form và ScrollArea;
- footer dùng shrink-0, nằm ngoài ScrollArea và có thể dùng border-accent/60;
- form ngắn vẫn dùng layout thường, không dùng ScrollArea chỉ để đồng nhất
  cấu trúc;
- nếu footer nằm ngoài form, nút submit phải khai báo đúng form id.

### Portal cho Combobox và DatePicker trong Dialog

Khi Dialog chứa Combobox, DatePicker hoặc component có popup, phải truyền một
`portalContainer` nằm trong chính `DialogContent` để popup giữ đúng stacking
context và không bị cắt bởi lớp overlay của Dialog.

Portal host phải là một lớp overlay tuyệt đối, không tham gia layout của Dialog:

```tsx
<DialogContent className="relative flex max-h-[90dvh] flex-col overflow-hidden">
  <div ref={setPortalContainer} className="pointer-events-none absolute inset-0" />

  <DialogHeader className="shrink-0" />
  <form className="min-h-0">
    <ScrollArea className="min-h-0 flex-1">
      {/* form fields */}
    </ScrollArea>
    <DialogFooter className="shrink-0" />
  </form>
</DialogContent>
```

Quy tắc bắt buộc:

- truyền cùng `portalContainer` cho mọi Combobox/DatePicker trong Dialog;
- đặt portal host làm sibling của header, body và footer;
- dùng `pointer-events-none absolute inset-0` cho host; popup bên trong phải
  tự bật `pointer-events-auto`;
- không dùng `display: contents` (`className="contents"`) làm portal host;
- không mount popup vào `ScrollArea`, `form` hoặc `DialogFooter`;
- footer phải là phần tử cố định ngoài vùng scroll để mở popup không làm thay
  đổi grid row, padding hoặc vị trí footer.

`display: contents` làm mất box layout của portal host. Khi popup được mount
vào host này, nó có thể ảnh hưởng lại grid của `DialogContent` và làm footer
nhảy lên/xuống một khoảng padding. Nếu module có nhiều Dialog, nên dùng cùng
pattern portal host như trên thay vì tự tạo wrapper riêng cho từng Combobox.

Quy tắc UI:

- dùng Field, FieldLabel, FieldDescription, FieldError;
- dùng CurrencyInput cho tiền;
- dùng DateTimeRangePicker cho khoảng ngày giờ;
- truyền portalContainer khi dialog có combobox/date picker;
- disable field theo permission và trạng thái;
- hiển thị lỗi server gần field hoặc summary có nội dung user hiểu được;
- tránh border dày; dùng border-accent/60, divide-y hoặc surface nhẹ khi phù hợp.

### Bước 8: Detail và update

Detail phải trả lời nhanh:

- đơn/vật thể nào;
- ai liên quan;
- thời gian nào;
- trạng thái hiện tại;
- tiền đã thu, còn phải thu, hoàn tiền;
- action tiếp theo là gì.

Update chỉ cho sửa field mà backend cho phép ở trạng thái hiện tại. Nếu update snapshot:

- hiển thị dữ liệu snapshot đang lưu;
- cho sửa đúng phần snapshot được phép;
- gửi payload rõ nghĩa;
- không tự dùng combobox dữ liệu hiện tại nếu nghiệp vụ yêu cầu sửa snapshot tĩnh;
- sau khi thành công phải refetch detail/list.

Không dùng customer hiện tại để thay thế snapshot trong phần lịch sử. Snapshot là bản ghi tại thời điểm tạo hoặc cập nhật nghiệp vụ.

### Bước 9: Kiểm tra và hoàn thiện

Trước khi kết thúc:

1. typecheck;
2. lint;
3. test hoặc kiểm tra manual các trạng thái chính;
4. kiểm tra mobile/tablet;
5. kiểm tra loading, empty, error và permission;
6. kiểm tra keyboard và context menu;
7. kiểm tra cache sau create/update/action;
8. kiểm tra không có import sâu vượt public API của module.

---

## 4. Quy ước permission và trạng thái

Permission được dùng để ẩn hoặc disable action ở frontend nhằm tránh thao tác nhầm. Backend luôn là nguồn kiểm tra cuối cùng.

Status config cần có tối thiểu:

- label: nhãn cho user;
- className hoặc token màu;
- icon nếu cần;
- description cho tooltip/detail;
- màu Gantt nếu module có timeline.

Không render status bằng enum thô hoặc màu tự viết trong JSX.

Action condition nên đặt ở action-definitions.ts, ví dụ:

```ts
const canRecordPayment =
  order.status !== 'DONE' &&
  order.status !== 'CANCELLED' &&
  order.amountDueBeforeHandover > 0;
```

Nếu điều kiện này được dùng ở nhiều nơi, đưa thành helper hoặc display utility có tên nghĩa rõ ràng. Không copy điều kiện vào columns, detail và dialog.

---

## 5. Quy ước lỗi và thông báo

Error hiển thị cho user phải nói:

- thao tác nào không thực hiện được;
- nguyên nhân hiện tại;
- cần làm gì tiếp theo.

Tránh hiển thị nguyên văn BadRequestException, tên method, stack trace hoặc câu chung chung như “Backend từ chối yêu cầu”.

Ví dụ tốt:

- “Không thể hoàn tiền: đơn này không còn khoản tiền đã thanh toán chưa hoàn.”
- “Chưa thể bàn giao máy: đơn còn 500.000 đ cần thanh toán.”
- “Không đủ máy trống trong khoảng thời gian đã chọn.”

Chi tiết kỹ thuật chỉ ghi vào log dành cho developer.

---

## 6. Quy ước import và public API

- Import component dùng chung từ @/components/ui/....
- Import module action từ modules/<domain>/components/actions.
- Dùng index.ts làm public boundary.
- Không import từ file nội bộ của module khác nếu có thể dùng public API.
- Không tạo barrel toàn ứng dụng nếu không cần; barrel nên nằm ở boundary có ý nghĩa.

Ví dụ:

```ts
import {
  RentalOrderActionsCell,
  RentalOrderContextMenuItems,
} from './components/actions';
```

Không nên import trực tiếp action item nội bộ trong page hoặc columns, trừ khi đang làm việc bên trong chính cụm actions.

---

## 7. Definition of Done

Một module được xem là hoàn tất khi:

- contract frontend/backend rõ ràng;
- model và schema không dùng any;
- query key và cache invalidation đúng;
- columns chỉ làm nhiệm vụ hiển thị;
- filter hiển thị và filter-only hoạt động đúng;
- nút clear filter reset cả external filter;
- action được tách trong components/actions;
- dropdown và context menu dùng chung action descriptor;
- dialog có loading, lỗi, xác nhận và footer đúng layout;
- status, màu và nhãn dùng display config;
- detail hiển thị đủ thông tin để user quyết định action tiếp theo;
- permission frontend khớp backend;
- responsive ở desktop, tablet và mobile;
- typecheck/lint/test hoặc manual QA đã chạy.

Các lệnh kiểm tra thông thường:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Nếu repository đang có lỗi nền từ trước, ghi rõ lỗi đó trong handoff và phân biệt với lỗi do module vừa thay đổi.

## 8. Kiến trúc chức năng quản trị hệ thống

### 8.1 Phân loại module

Không phải module backend nào cũng cần một màn hình frontend. Trước khi tạo route, xác định module thuộc một trong ba nhóm:

| Nhóm | Module | Quy tắc frontend |
| --- | --- | --- |
| Quản trị có UI | users, roles, system-settings, store-business-hours, store-closure, mail-template | Có route/module riêng khi có thao tác admin thực tế |
| Nghiệp vụ vận hành | customers, products, asset-units, rental-orders, availability, categories, brands | Có page và workflow theo use case |
| Hạ tầng/domain nội bộ | database, mail, rbac, asset-reservations | Không tạo page trùng lên module. Chỉ tạo UI nếu backend sau này công bố contract quản trị riêng. |

asset-reservations hiện không có controller; allocation/reservation đang được thao tác qua rental-orders và availability. Frontend không được tự gọi domain service hoặc tạo màn hình cho module này.

### 8.2 Thiết kế trang Cài đặt

Route /settings là shell quản trị, không chứa business logic. Shell chỉ hiển thị tabs và compose các module domain độc lập:

    app/(admin)/settings/page.tsx
    modules/settings/index.tsx
    modules/system-settings/
    modules/store-business-hours/
    modules/store-closures/

Các tab chuẩn:

1. Quy tắc cho thuê (system-settings): giá giữ lịch mỗi đơn vị, buffer giao/nhận máy, thời gian thuê tối đa và ngưỡng trả trễ.
2. Giờ hoạt động (store-business-hours): đủ 7 ngày, isOpen, giờ mở và giờ đóng. DateTimeRangePicker dùng cùng query này nhưng không thay thế màn hình cài đặt.
3. Ngày đóng cửa (store-closure): danh sách khoảng ngày nghỉ/bảo trì, loại đóng cửa và lý do; có create, update và delete.

Nguyên tắc UI:

- Mỗi tab có query/mutation và nút Lưu riêng; không gộp ba API thành một form khó kiểm soát.
- Hiển thị isDirty, loading, lỗi và thông báo đã lưu ngay trên card có thay đổi.
- Thay đổi system settings hoặc ngày đóng cửa phải mô tả rõ ảnh hưởng đến quote/availability.
- Chỉ user có settings.read được xem; chỉ user có settings.update được sửa. Khi backend chưa tách permission cho business hours/closures thì dùng hai permission này làm boundary chung.
- Sau khi lưu phải invalidate query cài đặt, business hours và availability/quote liên quan.

### 8.3 Thiết kế Tài khoản cá nhân

Tài khoản cá nhân không nên đi qua module users: đó là workflow admin sửa người khác. Dùng modules/account cho UI self-service, còn modules/auth giữ vai trò API/session infrastructure.

Luồng UI:

    NavUser → /account
                ├─ Thông tin cá nhân
                └─ Bảo mật

- Thông tin cá nhân: cho sửa fullName và phone; hiển thị email read-only vì backend hiện chưa cho phép đổi email và avatar chưa có API upload.
- Avatar chỉ được chọn và xem trước ở FE bằng `useFileUpload`; không đưa file vào request cập nhật profile cho đến khi backend công bố contract upload, lưu trữ, validate và xoá ảnh.
- Bảo mật: nhận mật khẩu cũ và mật khẩu mới, gọi PATCH /admin/auth/me/password; thông báo rõ backend sẽ thu hồi các phiên khác.
- Sau PATCH /admin/auth/me, cập nhật auth store hoặc refetch /admin/auth/me; không reload toàn app.
- Không cho phép user tự sửa role, permission, activity status hoặc session id.
- Dialog/sheet phải tách footer khỏi ScrollArea và dùng chung quy tắc portal combobox/dialog trong tài liệu này.

### 8.4 Chức năng cần backend trước khi làm frontend

- reports: backend chưa có module/contract báo cáo; không dùng dashboard số liệu mẫu làm báo cáo thật.
- blacklist: backend chưa có module; cần chốt model, lý do, thời hạn và rule chặn trước khi tạo page.
- audit-log/nhật ký quản trị: nên có backend event/audit contract trước khi hiển thị frontend.
