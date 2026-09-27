# Frontend module skill — Next.js + TanStack Query + shadcn

Tài liệu này là playbook để dựng module frontend nhanh nhưng vẫn đúng design system của `rental-admin-fe`. Mỗi module phải được xây theo feature-first: API, model, query state, form và UI nằm trong cùng domain; component dùng lại đặt ở `components/shared` hoặc `components/ui` theo phạm vi sử dụng.

## 0. Nguyên tắc bắt buộc

1. Chốt API contract và capability matrix trước khi thiết kế UI.
2. `index.tsx` chỉ compose provider, table, bulk action và dialog; không chứa business logic dài.
3. Component không gọi Axios/fetch trực tiếp. Component gọi hook; hook gọi service.
4. TanStack Query quản lý server state; React Hook Form quản lý form state; state mở/đóng dialog và filter giữ ở nơi gần nhất có thể.
5. `display-config.ts` chứa mapping status/type → label, icon, tone/class. `display-utils.ts` chỉ chứa hàm format/derive thuần.
6. Không để label, màu status, error message và format tiền/ngày rải rác trong JSX.
7. Dùng primitive shadcn và component đã có trong repo trước khi tạo component mới. Nếu thiếu component, đọc `.agents/skills/shadcn/SKILL.md`, kiểm tra registry và thêm đúng primitive cần thiết.
8. UI ưu tiên hierarchy, whitespace và semantic token; không bọc mọi vùng bằng border/card.
9. Không để frontend tự quyết định business rule về tiền, trạng thái, availability hoặc quyền. FE hiển thị và validate trải nghiệm; BE là nguồn sự thật.

### Definition of Done

Một module chỉ được xem là hoàn tất khi có đủ:

- model type/schema, API service, query key, query/mutation hooks;
- list/table có pagination, filter, sort và empty/loading/error state;
- create/update/detail/delete hoặc capability tương ứng;
- columns có ngữ nghĩa rõ, display config riêng và action theo permission;
- debounce cho search combobox; query invalidation sau mutation;
- dialog có scroll đúng, footer không bị bóp và popover/combobox đúng portal;
- toast/error message ổn định, không lộ raw error;
- `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm run build` chạy đạt.

## 1. Quy trình dựng module trong 8 bước

### Bước 1 — Khảo sát codebase và skill UI

```powershell
rg --files modules components lib | rg "(columns|provider|dialog|schema|services|queries|mutations|display|combobox)"
rg -n "useDataTable|useTableQueryState|CopyText|CurrencyInput|DateTimeRangePicker|ProductCombobox" modules components
```

Kiểm tra trước:

- module gần nhất về domain và module gần nhất về table/dialog;
- `components/ui`, `components/shared`, `lib/utils.ts`;
- `.agents/skills/shadcn/SKILL.md` trước khi thêm primitive mới;
- API response, pagination, permission code và enum từ backend;
- cách project xử lý toast, query error, loading và route permission.

Không copy nguyên module cũ nếu lifecycle khác. Chỉ copy composition pattern và đổi toàn bộ contract/domain rule.

### Bước 2 — Chốt capability matrix và UI contract

| Capability | UI | API hook | Permission | Cache ảnh hưởng |
| --- | --- | --- | --- | --- |
| List | table + filter | `useGetThings` | `thing:read` | `things.list` |
| Detail | detail dialog/page | `useGetThing` | `thing:read` | `things.detail` |
| Create | create dialog | `useCreateThing` | `thing:create` | invalidate list |
| Update | update dialog | `useUpdateThing` | `thing:update` | detail + list |
| Delete/bulk | confirm dialog | `useDeleteThings` | `thing:delete` | invalidate list |
| Workflow | action dialog | `useThingAction` | action permission | detail + list |

Chốt rõ trước khi code:

- field nào chỉ đọc, field nào editable, field nào server-managed;
- update là PATCH dirty fields hay gửi toàn bộ form;
- relation có dùng combobox để đổi hay chỉ render snapshot;
- quote/availability có cần refresh khi đổi input;
- status nào được action nào;
- dialog nào dùng portal container và vùng nào được scroll.

### Bước 3 — Tạo skeleton module

```text
modules/<domain>/
├── index.tsx                         # composition mỏng
├── <domain>-provider.tsx             # chỉ khi cần shared dialog/action state
├── columns.tsx
├── bulk-action.tsx                   # chỉ khi có bulk action
├── dialogs.tsx                       # registry/dialog orchestration
├── constants.ts
├── display-config.ts                 # status/type → presentation
├── display-utils.ts                  # pure formatting/derivation
├── api/
│   ├── index.ts
│   └── services.ts
├── model/
│   ├── index.ts
│   ├── schema.ts
│   └── type.ts
├── hooks/
│   ├── keys.ts
│   ├── queries.ts
│   ├── mutations.ts
│   └── <domain>-logic.tsx            # chỉ khi có domain interaction phức tạp
└── components/
    ├── form/
    ├── create/
    ├── update/
    ├── detail/
    ├── actions/
    └── <domain>-status-badge.tsx
```

Không tạo file chỉ vì skeleton. Nếu module chỉ có list thì chưa cần provider, bulk action hoặc state machine UI.

### Bước 4 — Model, schema và service API

#### Model

- `model/type.ts`: type response, query, mutation input và enum lấy theo API contract.
- `model/schema.ts`: Zod schema cho form/query input; không dùng schema để thay business rule backend.
- `model/index.ts`: export công khai của module.
- Không lặp lại type shared ở nhiều module.

Create/update nên có schema riêng khi quyền sửa hoặc field editable khác nhau:

```ts
export const createThingSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên'),
});

export const updateThingSchema = createThingSchema.partial();
```

#### Service

```ts
export async function getThings(query: GetThingsQuery) {
  const { data } = await apiClient.get<PaginatedResponse<Thing>>('/things', {
    params: query,
  });
  return data;
}
```

Service chỉ serialize request và unwrap response theo chuẩn project. Không đặt state, toast, React hook hoặc JSX trong `api/services.ts`.

Ngày/tiền phải thống nhất:

- dùng helper chung trong `lib/utils.ts` cho parse/ISO/date/currency;
- domain-specific như duration rental, period label, due warning đặt ở `display-utils.ts` của module;
- không tạo `new Date(...).toLocaleString(...)` lặp trong JSX;
- money input dùng `CurrencyInput` và serialize về number/string đúng backend contract.

### Bước 5 — Query, mutation và cache

Query key phải phân cấp và chứa đủ input ảnh hưởng kết quả:

```ts
export const thingKeys = {
  all: ['things'] as const,
  lists: () => [...thingKeys.all, 'list'] as const,
  list: (query: GetThingsQuery) => [...thingKeys.lists(), query] as const,
  details: () => [...thingKeys.all, 'detail'] as const,
  detail: (id: string) => [...thingKeys.details(), id] as const,
};
```

Quy tắc hook:

- `useQuery` chỉ nhận query đã normalize;
- dùng `enabled` khi thiếu id hoặc dependency;
- search combobox phải debounce, hủy/ghi đè request cũ và không query khi input chưa đủ dài nếu API yêu cầu;
- mutation hiển thị toast ở một chỗ thống nhất;
- sau create/update/delete/action, invalidate đúng list/detail/related availability;
- khi mutation ảnh hưởng quote hoặc availability, không giữ data cũ như thể còn hợp lệ.

Đừng đưa toàn bộ query state vào Zustand nếu TanStack Query hoặc URL state đã sở hữu nó.

### Bước 6 — Table và columns

DataTable server-side phải truyền đủ `page`, `perPage`, `sort`, filter và search xuống query. Không filter/sort client một danh sách đã phân trang từ server.

`columns.tsx` chỉ định nghĩa presentation và action; không gọi mutation trực tiếp ngoài callback/hook được truyền vào.

Mỗi bảng nên có các nhóm cột sau, tùy domain:

1. **Primary identity**: code/name, có `CopyText` cho mã cần tra cứu.
2. **Relation**: customer/product/category với label dễ đọc, tránh chỉ render UUID.
3. **Time/state**: period, duration, status; status có badge/config riêng.
4. **Financial/quantity**: tổng tiền, còn phải thu, số lượng; format tiền thống nhất.
5. **Updated**: `updatedAt` hoặc thông tin vận hành cần thiết.
6. **Actions**: detail/update/workflow/delete theo permission và state.

Không nhồi mọi field vào table. Field ít dùng đưa vào detail dialog. Với thời gian vận hành, có thể render cảnh báo `sắp tới`, `đang diễn ra`, `quá hạn` ở FE nhưng màu/label phải lấy từ `display-config` và mốc nghiệp vụ do backend trả hoặc đã chốt chung.

Mẫu mã có thể copy:

```tsx
<CopyText text={String(row.code)} className="py-1 font-bold text-primary underline">
  <span>#{row.code}</span>
</CopyText>
```

### Bước 7 — Form, dialog và design system

#### Form

- Dùng React Hook Form + `zodResolver`.
- Mỗi field dùng `Field`, `FieldLabel`, `FieldDescription`, `FieldError` theo component chuẩn.
- Dùng `getDirtyValues` cho PATCH nếu backend nhận partial update.
- Không gửi `undefined`, field read-only, hoặc relation display-only.
- Disable submit khi pending; chống double submit.
- Khi input ảnh hưởng quote/availability, invalidate quote có chủ đích và hiển thị trạng thái đang tính.
- Combobox customer/product phải debounce; tìm product theo productId/SKU/name theo contract, còn asset-unit assignment để backend xử lý nếu đó là nghiệp vụ server.
- Có thể dùng `DateTimeRangePicker`, `CurrencyInput`, `ProductCombobox` và pattern portal container sẵn có; không tự chế input tương đương nếu component hiện tại đáp ứng.

#### Dialog layout

Dialog có form dài phải tách rõ header, scroll body và footer:

```tsx
<DialogContent className="flex max-h-[min(90vh,900px)] flex-col gap-0 p-0 sm:max-w-3xl">
  <DialogHeader className="shrink-0 px-6 py-5" />
  <ScrollArea className="min-h-0 flex-1">
    <div className="px-6 py-5">...</div>
  </ScrollArea>
  <DialogFooter className="shrink-0 border-t border-accent/60 px-6 py-4" />
</DialogContent>
```

Checklist dialog:

- `DialogFooter` nằm ngoài `ScrollArea`, không bị bóp bởi container chung;
- scroll body có `min-h-0 flex-1` và parent có chiều cao giới hạn;
- `ScrollArea` của dự án đã custom vùng scrollbar với offset âm; không thêm `pr-4` chỉ để chừa chỗ cho scrollbar. Chỉ dùng padding khi đó là spacing thực sự của nội dung;
- Popover/Select/Combobox/DatePicker truyền đúng `portalContainer` khi mở trong dialog;
- không lồng nhiều `ScrollArea` nếu không cần;
- header mô tả mục tiêu, body nhóm theo `FieldGroup`, footer giữ action chính;
- border chỉ dùng để phân vùng: ưu tiên `border-accent/60`, divider nhẹ hoặc whitespace; không bọc mọi field bằng card;
- màu dùng semantic token của design system, không hard-code màu trạng thái trong từng component.

#### Card, FieldGroup và các vùng thông tin

Ưu tiên thứ tự thị giác:

1. tiêu đề/description ngắn;
2. nhóm field liên quan;
3. summary/quote/alert khi có dữ liệu;
4. action ở footer.

Dùng Card khi cần tách một nhóm nghiệp vụ lớn; dùng `FieldGroup`/`divide-y` cho danh sách field. Một sản phẩm/dòng item nên hiển thị name, SKU, quantity, price và action trong cùng một row; không lặp border card cho từng item.

### Bước 8 — Detail, update, permission và kiểm tra

Detail dialog nên hiển thị theo thứ tự:

- mã/identity có copy;
- status + cảnh báo vận hành;
- customer/snapshot/relation;
- thời gian + duration/period dễ đọc;
- items/quantity/price;
- financial summary;
- timeline/note/audit nếu có;
- actions hợp lệ theo status.

Update dialog chỉ hiển thị field mà backend cho phép sửa. Nếu nghiệp vụ yêu cầu sửa snapshot, form nhận snapshot fields; không tự đưa `CustomerCombobox` vào chỉ vì bản ghi có customer relation. Nếu muốn đổi relation, phải có API contract và rule backend tương ứng.

Action/status không được suy ra bằng cách so sánh label tiếng Việt. Dùng enum/code từ backend và map tại `display-config.ts`.

## 2. Tách display config và display utils

### `display-config.ts`

Chứa presentation mapping ổn định:

```ts
export const thingStatusConfig = {
  DRAFT: { label: 'Nháp', tone: 'muted', icon: IconFileText },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'success', icon: IconCircleCheck },
  CANCELLED: { label: 'Đã hủy', tone: 'danger', icon: IconCircleX },
} as const;
```

Config có thể chứa label/icon/variant/className/accessibility label, nhưng không gọi hook, query hoặc tính nghiệp vụ.

### `display-utils.ts`

Chỉ chứa hàm thuần:

- format date/time, period, duration;
- format quantity/price/summary;
- derive warning presentation từ dữ liệu đã có;
- normalize text hiển thị.

Dùng `parseDate`, `toIso`, `formatDate`, `formatCurrency` từ `lib/utils.ts` nếu phù hợp. Không định nghĩa lại helper date dùng chung trong từng module. Hàm phải xử lý `undefined`, `null`, date invalid và khoảng thời gian không hợp lệ.

## 3. Permission, error và text

- Permission guard ở page/hook/action chỉ là UX; backend vẫn kiểm tra quyền.
- Nút ẩn/disable phải dựa trên permission + trạng thái record.
- Error API map về message tiếng Việt ổn định qua constants/utility; không render `error.message` thô nếu có thể chứa chi tiết kỹ thuật.
- Toast success/error dùng một pattern; không bắn toast trong nhiều tầng cho cùng một mutation.
- Text người dùng nhìn thấy viết tiếng Việt nhất quán; enum/code nội bộ giữ tiếng Anh theo API.

## 4. Checklist copy cho module mới

```text
[ ] Đọc skill shadcn và khảo sát module tương tự
[ ] Chốt capability/permission/API contract
[ ] Tạo module skeleton tối thiểu
[ ] Tạo type + schema create/update/query
[ ] Tạo service + query keys + queries/mutations
[ ] Nối DataTable server-side: page/filter/sort/search
[ ] Tạo display-config và display-utils
[ ] Tạo columns theo identity/relation/time/state/financial/actions
[ ] Tạo detail/create/update dialog theo layout header/body/footer
[ ] Dùng Field/FieldGroup, CurrencyInput/DateTimeRangePicker/Combobox đúng pattern
[ ] Debounce search và invalidate cache sau mutation
[ ] Kiểm tra permission, error, loading, empty và optimistic/stale state
[ ] Chạy typecheck, lint, build và git diff --check
```

## 5. Lệnh kiểm tra tối thiểu

```powershell
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
git diff --check
```

Nếu build module có thay đổi API, migration hoặc enum, phải kiểm tra cả backend contract và thực hiện một smoke test từ table → detail → create/update → refresh list. Không coi việc TypeScript compile được là đủ nếu cache, permission hoặc dialog flow chưa được kiểm tra.
