# Backend module skill — NestJS + Prisma

Tài liệu này là playbook để dựng một module backend mới nhanh, đồng nhất và dễ bàn giao. Khi bắt đầu module, đọc theo thứ tự từ trên xuống; không bắt đầu bằng việc viết controller hoặc copy nguyên một module cũ.

## 0. Nguyên tắc bắt buộc

1. Chốt nghiệp vụ và API contract trước khi code.
2. Controller chỉ nhận request, gọi service và trả response; không chứa business rule.
3. Service điều phối use case; policy/state machine xử lý quy tắc thuần; các service con xử lý capability có thể tái sử dụng.
4. DTO là contract biên. Không dùng Prisma type làm input trực tiếp cho API.
5. Mọi query list phải có pagination, whitelist cho sort và filter có kiểm soát.
6. Mọi thay đổi schema phải đi qua Prisma migration và kiểm tra generated client.
7. Quy tắc ảnh hưởng tiền, trạng thái, tồn kho/availability phải có test unit hoặc integration.
8. Không trả entity Prisma thô nếu response contract cần ẩn field, đổi tên field hoặc convert Decimal/Date.

### Definition of Done

Một module chỉ được xem là hoàn tất khi có đủ:

- API contract, DTO input/output và permission matrix.
- Migration/schema đã đồng bộ với database dev.
- Controller/service/module đăng ký đúng trong app module.
- Validation, error mapping, pagination và sort whitelist.
- Unit test cho domain rule; integration/e2e test cho use case quan trọng.
- Swagger metadata đủ để frontend dùng contract.
- `pnpm run typecheck`, `pnpm run build` và test liên quan chạy đạt.

## 1. Quy trình dựng module trong 8 bước

### Bước 1 — Khảo sát trước khi tạo file

```powershell
rg -n "export class .*Dto|@Controller|ResponseDto|Pagination|Permission|Prisma" src/modules src/libs
rg --files src/modules | rg "(module|controller|service|dto|spec)\.ts$"
```

Kiểm tra trước:

- module gần nhất về nghiệp vụ và module gần nhất về UI/API pattern;
- `AppModule`, auth/permission guard và cách đăng ký permission;
- response wrapper, pagination DTO, exception filter và pipe đang dùng;
- Prisma model, relation, unique index, enum và migration hiện có.

Không copy mù một module cũ nếu nó có lifecycle khác. Chỉ copy cấu trúc, không copy business rule.

### Bước 2 — Chốt contract và capability matrix

Tạo bảng ngắn trước khi code:

| Capability | Method/path | Input | Output | Permission | Transaction? |
| --- | --- | --- | --- | --- | --- |
| List | `GET /things` | query | paginated list | `thing:read` | No |
| Detail | `GET /things/:id` | path | detail | `thing:read` | No |
| Create | `POST /things` | body | detail | `thing:create` | Usually |
| Update | `PATCH /things/:id` | dirty body | detail | `thing:update` | Usually |
| Delete/bulk | `DELETE ...` | ids | result | `thing:delete` | Yes |
| Workflow | `POST /things/:id/action` | action body | detail | action permission | Yes |

Quyết định rõ từ đầu:

- `PATCH` có nghĩa là partial update hay replace;
- field nào là server-managed (`id`, code, timestamps, totals, status);
- relation nào cho phép đổi, relation nào chỉ đọc;
- dữ liệu snapshot có được sửa hay phải tạo snapshot mới;
- thao tác nào cần transaction, optimistic lock, idempotency hoặc kiểm tra availability.

### Bước 3 — Tạo skeleton module

```text
src/modules/<resource>/
├── <resource>.module.ts
├── <resource>.controller.ts
├── <resource>.service.ts
├── dto/
│   ├── create-<resource>.dto.ts
│   ├── update-<resource>.dto.ts
│   ├── get-all-<resource>.dto.ts
│   ├── delete-<resource>s.dto.ts
│   ├── <resource>-actions.dto.ts       # chỉ khi có workflow
│   ├── <resource>-out.dto.ts
│   └── <resource>s-response.dto.ts
├── domain/
│   ├── <resource>-state-machine.ts     # chỉ khi có lifecycle
│   ├── <resource>-pricing.policy.ts    # chỉ khi có tính tiền
│   └── <resource>-*.spec.ts
├── services/
│   ├── <resource>-availability.service.ts
│   └── <resource>-financial.service.ts
└── __tests__/
```

Không tạo `repository` layer chỉ để chuyển tiếp Prisma nếu project chưa dùng pattern đó. Khi cần tách, tách theo capability có ý nghĩa: pricing, availability, financial, notification, export.

### Bước 4 — Thiết kế Prisma và migration

Thứ tự chuẩn:

1. Sửa `schema.prisma`.
2. Thêm index/unique constraint phục vụ query thực tế.
3. Chạy `pnpm prisma migrate dev --name <short-description>` trong môi trường dev.
4. Chạy `pnpm prisma generate` nếu generated client chưa tự cập nhật.
5. Kiểm tra migration SQL và thử query thật.

Quy tắc:

- Không dùng `db push` để thay thế migration cho thay đổi cần commit.
- Không sửa migration đã được áp dụng ở môi trường dùng chung.
- Dev có thể reset dữ liệu khi cần, nhưng phải ghi rõ migration/reset trong handoff.
- Tránh `include` toàn bộ relation. Dùng `select` theo response contract.
- Convert `Decimal`, `Date` và enum tại output mapper; không để frontend tự đoán kiểu.
- Tạo index cho cặp field dùng trong availability/date-range/status query.

### Bước 5 — Viết DTO và response contract

DTO input phải mô tả đúng dữ liệu client được phép gửi:

```ts
export class CreateThingDto {
  @ApiProperty({ example: 'Tên hiển thị' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
```

Checklist DTO:

- có `class-validator` và `@ApiProperty`/`@ApiPropertyOptional`;
- nullable khác với optional: mô tả rõ `null` có ý nghĩa gì;
- không nhận field server-managed;
- update phân biệt field không gửi và field gửi `null`;
- mảng id phải validate từng phần tử và loại duplicate;
- date/number/enum phải validate ở biên, không đợi Prisma báo lỗi.

Output DTO/mapper phải thống nhất:

```ts
private toOut(row: ThingWithRelations): ThingOutDto {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    amount: Number(row.amount),
  };
}
```

Dùng response wrapper và pagination wrapper sẵn có trong `src/libs`; không tạo thêm một format `{ data, meta }` khác nếu project đã có chuẩn chung.

### Bước 6 — Viết service theo use case

Service nên đọc như một workflow:

```ts
async create(dto: CreateThingDto, actor: AuthUser) {
  await this.assertCanCreate(dto, actor);
  const normalized = this.normalizeCreate(dto);

  const row = await this.prisma.thing.create({
    data: normalized,
    select: this.detailSelect,
  });

  return this.toOut(row);
}
```

List chuẩn:

```ts
const where = this.buildWhere(query);
const orderBy = this.buildOrderBy(query.sortBy, query.sort);
const skip = (query.page - 1) * query.perPage;

const [rows, total] = await this.prisma.$transaction([
  this.prisma.thing.findMany({
    where,
    orderBy,
    skip,
    take: query.perPage,
    select: this.listSelect,
  }),
  this.prisma.thing.count({ where }),
]);
```

Update chuẩn:

1. Tìm bản ghi và kiểm tra quyền.
2. Kiểm tra state/immutable fields/invariants.
3. Chuẩn hóa dirty fields, bỏ `undefined`.
4. Nếu thay đổi ảnh hưởng quote/availability/tổng tiền, tính lại trong cùng use case.
5. Update và trả output mới nhất.

Không để `update()` nhận thẳng DTO nếu DTO còn field không thuộc Prisma hoặc cần normalize.

### Bước 7 — Tách domain rule và transaction

Đưa ra khỏi controller/service các rule có thể test thuần:

- state machine: transition hợp lệ và lý do từ chối;
- pricing policy: tính tiền, làm tròn, ngưỡng, phụ phí;
- availability policy: overlap, buffer, conflict;
- financial policy: amount due, deposit, refund, settlement.

Transaction dùng khi nhiều thay đổi phải thành công cùng nhau:

```ts
return this.prisma.$transaction(async (tx) => {
  const current = await tx.thing.findUnique({ where: { id } });
  this.stateMachine.assertCan(current.status, action);

  const updated = await tx.thing.update({ ... });
  await tx.auditLog.create({ ... });
  return this.toOut(updated);
});
```

Với nghiệp vụ đặt máy/thuê máy:

1. kiểm tra khoảng thời gian và availability;
2. tính quote từ input chuẩn hóa;
3. chỉ commit reservation/hold sau điều kiện nghiệp vụ đã chốt;
4. xử lý conflict ở database/transaction, không chỉ tin kết quả FE;
5. trả lại availability/quote mới để FE hiển thị.

Nếu thao tác có thể retry, dùng idempotency key hoặc kiểm tra trạng thái trước khi tạo bản ghi phụ.

### Bước 8 — Đăng ký, test và kiểm tra

Checklist đăng ký:

- import module vào module cha;
- controller dùng đúng prefix và guard;
- permission code được khai báo và seed/đăng ký;
- Swagger tag/response/params đầy đủ;
- event/queue/socket chỉ thêm khi có use case rõ ràng.

Lệnh kiểm tra tối thiểu:

```powershell
pnpm run typecheck
pnpm run build
pnpm test -- --runInBand
```

Khi sửa schema:

```powershell
pnpm prisma validate
pnpm prisma migrate dev --name <short-description>
pnpm prisma generate
```

## 2. Quy ước controller, error và permission

Controller chỉ làm bốn việc: đọc params/query/body, gọi service, map actor/context, trả response. Không query Prisma hoặc tính tiền trong controller.

Các lỗi nghiệp vụ phải dùng exception chuẩn của NestJS/project (`BadRequest`, `NotFound`, `Conflict`, `Forbidden`...) và error code ổn định. Exception filter chịu trách nhiệm format response; service không tự nuốt lỗi hoặc trả message database thô.

Permission kiểm tra ở backend là bắt buộc dù frontend đã ẩn nút. Với bulk action, kiểm tra quyền và state của từng id; response nên chỉ rõ item nào thành công/thất bại nếu nghiệp vụ cho phép partial result.

## 3. Quy ước query list

- Query DTO dùng một format pagination chung (`page`, `perPage`, `sort`, filter).
- Sort chỉ cho phép field trong whitelist, không ghép trực tiếp tên field từ request.
- Search phải normalize trim/case và giới hạn độ dài.
- Filter date phải quy định timezone và inclusive/exclusive rõ ràng.
- Query có relation phải `select` field cần dùng cho table, tránh trả dữ liệu nhạy cảm.
- Tổng count và danh sách phải dùng cùng `where`.

## 4. Contract với frontend

Khi API thay đổi, cập nhật cùng một lượt:

1. DTO/output/Swagger backend.
2. FE `model/type.ts`, `model/schema.ts` và service mapper.
3. Query key/invalidation và UI state.
4. Test các field mới, đặc biệt date, money, status, snapshot và nullable.

Không để FE tự suy luận trạng thái từ màu hoặc text. Backend trả enum/code ổn định; FE tự chọn label/icon/class qua `display-config`.

## 5. Template checklist copy cho module mới

```text
[ ] Chốt capability matrix + permission matrix
[ ] Chốt input/output/error contract
[ ] Sửa Prisma schema, index và migration
[ ] Tạo module/controller/service/module registration
[ ] Tạo DTO create/update/list/action/output
[ ] Tạo select + output mapper
[ ] Tạo list pagination/filter/sort whitelist
[ ] Tách state/pricing/availability/financial policy nếu có
[ ] Thêm transaction và idempotency cho use case cần thiết
[ ] Thêm unit/integration/e2e test
[ ] Cập nhật Swagger, permission seed và FE contract
[ ] Chạy typecheck, build, test, migrate validate
```

Nếu module có lifecycle hoặc tiền, không merge khi chưa có test cho transition và các case biên: dữ liệu thiếu, thời gian giao nhau, amount âm, retry, conflict và update sau khi đã chốt trạng thái.
