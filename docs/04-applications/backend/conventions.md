# Backend module skill — NestJS + Prisma

Tài liệu này là playbook để dựng một module backend mới nhanh, đồng nhất và dễ bàn giao. Khi bắt đầu module, đọc theo thứ tự từ trên xuống; không bắt đầu bằng việc viết controller hoặc copy nguyên một module cũ.

## 0. Nguyên tắc bắt buộc

1. Chốt nghiệp vụ và API contract trước khi code.
2. Controller chỉ nhận request, gọi service và trả response; không chứa business rule.
3. Service điều phối use case; policy/state machine xử lý quy tắc thuần; các service con xử lý capability có thể tái sử dụng.
4. DTO là contract biên. Không dùng Prisma type làm input trực tiếp cho API.
5. Mọi query list phải có pagination, whitelist cho sort và filter có kiểm soát.
6. Mọi thay đổi schema phải đi qua Prisma migration và kiểm tra generated client.
7. Quy tắc ảnh hưởng tiền, trạng thái, tồn kho/availability phải được tách thành policy/state machine có thể kiểm tra độc lập; không tạo file `.spec.ts` mặc định nếu phạm vi module chưa yêu cầu.
8. Không trả entity Prisma thô nếu response contract cần ẩn field, đổi tên field hoặc convert Decimal/Date.

### Thứ tự hiển thị do quản trị viên điều khiển

Khi resource có thứ tự hiển thị:

- dùng field order server-managed, zero-based;
- list mặc định sort order asc, sau đó dùng id asc làm tie-breaker;
- không nhận order tùy ý trong create/update thông thường;
- dùng endpoint reorder riêng, nhận toàn bộ danh sách id theo thứ tự mong muốn;
- validate danh sách đủ item, không trùng và chỉ chứa bản ghi hợp lệ;
- cập nhật order trong một transaction.

### Definition of Done

Một module chỉ được xem là hoàn tất khi có đủ:

- API contract, DTO input/output và permission matrix.
- Migration/schema đã đồng bộ với database dev.
- Controller/service/module đăng ký đúng trong app module.
- Validation, error mapping, pagination và sort whitelist.
- Kiểm tra domain rule và use case quan trọng theo phạm vi module; không bắt buộc tạo file `.spec.ts` mặc định.
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

Đưa ra khỏi controller/service các rule có thể kiểm tra độc lập:

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

### Audit log trong detail của rental-order

`RentalOrder` có hai loại lịch sử và phải giữ đúng ngữ nghĩa:

- `statusHistories`: chỉ ghi các lần chuyển trạng thái workflow của đơn;
- `activityLogs`: ghi thao tác nghiệp vụ chi tiết như tạo/sửa/hủy đơn, ghi nhận hoặc
  xác nhận thanh toán, tạo/xác nhận hoàn tiền, bàn giao, trả máy, kiểm tra và chốt đơn.

API detail `GET /rental-orders/:id` trả cả hai mảng trong cùng response. Không tạo thêm
request riêng cho nhật ký khi mở dialog detail. Service phải include log theo
`createdAt ASC`, map qua output DTO và không trả entity Prisma thô.

Mọi mutation tạo log phải ghi trong cùng transaction với thay đổi nghiệp vụ. Dùng một
helper/service nội bộ dùng chung, action lấy từ constant, và `changes` có envelope ổn
định `{ version: 1, ... }`. Log nên lưu `actorId`, `actorSnapshot` tối thiểu gồm id,
email, fullName và roles; thao tác tự động có thể chỉ cần `actorId`.

Không dùng `activityLogs` để thay thế `statusHistories`, không suy diễn action từ label
frontend và không ghi dữ liệu nhạy cảm ngoài phạm vi cần thiết. Khi số log lớn đến mức
làm detail nặng, giữ field tóm tắt trong detail và tách endpoint cursor riêng; không
phân trang ngầm bằng cách trả thiếu log.

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
[ ] Kiểm tra domain rule và các use case quan trọng theo phạm vi module
[ ] Cập nhật Swagger, permission seed và FE contract
[ ] Chạy typecheck, build, test, migrate validate
```

Nếu module có lifecycle hoặc tiền, không merge khi chưa xác định rõ rule cho transition và các case biên: dữ liệu thiếu, thời gian giao nhau, amount âm, retry, conflict và update sau khi đã chốt trạng thái.

## 6. Phân loại module quản trị và hạ tầng

Không mỗi thư mục trong src/modules đều là một API module có màn hình admin. Khi thiết kế hoặc review, phân loại như sau:

| Nhóm | Module | Trách nhiệm |
| --- | --- | --- |
| Quản trị có API | users, roles, permissions, system-settings, store-business-hours, store-closure, mail-template, dashboard | Có controller, permission và contract cho frontend admin |
| Nghiệp vụ | customers, products, categories, brands, asset-units, rental-orders, availability | Vòng đời và thao tác vận hành |
| Hạ tầng | database, mail, rbac | Provider/service dùng nội bộ; không tạo controller chỉ để có UI |
| Domain nội bộ | asset-reservations | Capability phụ trợ cho allocation/reservation; không công bố trực tiếp khi chưa có use case và contract riêng |

database, mail, rbac và asset-reservations phải được ghi nhận trong tài liệu module như dependency/domain support. Frontend không được gọi thông qua service nội bộ hoặc tạo endpoint proxy không có use case.

## 7. Contract cho trang Cài đặt

Trang /settings phía frontend là shell compose ba capability độc lập. Backend giữ boundary theo module, không gộp thành một controller settings lớn.

### 7.1 Quy tắc thuê — system-settings

API hiện có:

| Method | Path | Permission | Nội dung |
| --- | --- | --- | --- |
| GET | /system-settings | settings.read | Lấy một bản ghi cài đặt hiện tại |
| PATCH | /system-settings | settings.update | Partial update các quy tắc thuê |

Field hiện tại:

- bookingHoldPricePerUnit;
- bookingBufferTimeMinutes;
- maxRentalTimeDays;
- maxLateReturnTimeHours.

Service phải validate giá trị không âm, maxRentalTimeDays >= 1 và kiểm tra invariant liên quan trước khi ghi. Output phải convert Decimal/Date theo response DTO. Thay đổi settings không được làm thay đổi snapshot cũ trong đơn thuê.

### 7.2 Giờ hoạt động — store-business-hours

API:

| Method | Path | Permission | Nội dung |
| --- | --- | --- | --- |
| GET | /store-business-hours | settings.read | Lấy 7 ngày hiện tại |
| PUT | /store-business-hours | settings.update | Ghi toàn bộ 7 ngày |

Contract update phải luôn có đúng 7 item, dayOfWeek duy nhất từ 0 đến 6. Khi isOpen = true, openTime và closeTime phải theo HH:mm và khoảng giờ phải hợp lệ. Không update từng ngày bằng nhiều request nếu contract đang quy định replace toàn bộ tuần.

Sau khi update, availability/quote phải đọc giá trị mới; không cache business hours vĩnh viễn trong process.

### 7.3 Ngày đóng cửa — store-closure

API:

| Method | Path | Permission | Nội dung |
| --- | --- | --- | --- |
| GET | /store-closures | settings.read | Danh sách theo khoảng ngày/filter |
| GET | /store-closures/:id | settings.read | Chi tiết |
| POST | /store-closures | settings.update | Tạo khoảng đóng cửa |
| PATCH | /store-closures/:id | settings.update | Cập nhật |
| DELETE | /store-closures | settings.update | Xóa theo id |

Service phải kiểm tra startDate <= endDate, timezone, overlap và tác động đến quote/availability. type và reason là metadata hiển thị; rule không nên suy diễn từ label frontend. Nếu có nhu cầu phân quyền chi tiết, tạo permission riêng sau; hiện dùng settings.read/update để đảm bảo contract đồng bộ.

## 8. Contract Tài khoản cá nhân

Tài khoản của admin là self-service trong auth, không đi qua users:

| Method | Path | Permission | Nội dung |
| --- | --- | --- | --- |
| GET | /admin/auth/me | authenticated | Profile, roles, permissions |
| PATCH | /admin/auth/me | authenticated | Hiện cho phép update fullName, phone |
| PATCH | /admin/auth/me/password | authenticated | Đổi mật khẩu; thu hồi các phiên khác |

Email/avatar không được coi là field update cho đến khi có DTO, validation, uniqueness và flow upload/verify rõ ràng. Backend không cho phép user tự update role, permission, activity status hoặc session id.

## 9. Contract File Storage & Upload

Đây là capability dùng chung cho file, không phải logic riêng của từng module. Module nghiệp vụ chỉ yêu cầu upload theo `purpose` và liên kết `FileObject`; không tự gọi R2, tự tạo object key hoặc tự ký URL.

Trạng thái hiện tại: P0 đã được triển khai ở backend với `FileObject`, `FileObjectEvent`, R2 presigned URL và signed download URL. Frontend mới chỉ preview avatar; avatar admin **không nằm trong phạm vi ưu tiên trước mắt**. Customer avatar đang xuất hiện trong một số type/component frontend nhưng chưa có field tương ứng trong Prisma `Customer`, cần đánh dấu `needs-review` trước khi triển khai.

### 9.1 Phạm vi theo ưu tiên

| Ưu tiên | Capability | File cần xử lý | Quyền lưu trữ |
| --- | --- | --- | --- |
| P0 | File storage dùng chung | Ảnh, PDF, bill, hợp đồng và metadata | R2 + PostgreSQL metadata |
| P1 | Bàn giao/nhận trả/inspection/incident | Ảnh tình trạng máy, phụ kiện, chữ ký, biên bản | Private |
| P1 | Payment/refund | Ảnh bill chuyển khoản, chứng từ hoàn tiền | Private |
| P2 | Product/Catalog | Ảnh sản phẩm, gallery, banner sản phẩm | Public hoặc admin tùy use case |
| P2 | AssetUnit/bảo trì | Ảnh máy theo serial, ảnh hỏng, phiếu sửa chữa | Private/admin |
| P2 | Delivery/Shipper | Ảnh giao nhận, chữ ký, bằng chứng giao hàng | Private |
| P2 | Hợp đồng thuê | PDF hợp đồng và giấy tờ đính kèm theo chính sách bảo mật | Private, signed URL |
| P3 | Chủ máy/góp vốn | Hợp đồng góp vốn, giấy tờ sở hữu, chứng từ thanh toán | Private, bảo mật cao |
| P4 | Chứng từ sinh tự động | PDF/Excel export, biên bản hoặc report | Private, URL có thời hạn |
| P5 | CMS | Banner, bài viết, media, SEO image | Làm sau khi CMS được triển khai; public qua CDN |

Không đưa avatar admin vào các phase đầu. Không triển khai CMS chỉ để có upload; CMS là capability P5 độc lập.

### 9.2 Nguồn dữ liệu và model

- R2 lưu binary/object; PostgreSQL/Prisma lưu metadata, trạng thái, quyền và quan hệ nghiệp vụ.
- Không lưu binary trong PostgreSQL và không dùng URL public làm nguồn định danh duy nhất. Lưu `bucket` + `objectKey`, sau đó tạo URL khi đọc.
- Không lưu URL file trong `PaymentTransaction.metadata` hoặc `Refund.metadata`; chứng từ thanh toán phải có relation rõ ràng.
- Model P0 đã triển khai:

```text
FileObject
- id
- provider/bucket/objectKey
- purpose
- originalName/mimeType/sizeBytes
- checksum/etag
- visibility: PRIVATE | PUBLIC
- status: PENDING | PROCESSING | READY | FAILED | DELETED
- uploadedBy/expiresAt/completedAt/createdAt/updatedAt/deletedAt

UploadBatch
- id/purpose/status
- expectedFileCount/expectedTotalBytes
- uploadedBy/expiresAt/completedAt/cancelledAt
```

`FileObjectEvent` lưu audit append-only cho `PRESIGNED`, `UPLOAD_COMPLETED`, `DOWNLOAD_URL_ISSUED`, `DELETED` và `FAILED`.

Các relation nên có foreign key rõ ràng thay vì một quan hệ polymorphic không kiểm soát được:

```text
RentalInspectionAttachment
RentalIncidentAttachment
PaymentProof
DeliveryProof
ContractDocument
ProductMedia
AssetMedia
ContributorDocument
```

`User.avatarFileId` và `Customer.avatarFileId` chưa tạo ở phase đầu; chỉ bổ sung sau khi chốt nghiệp vụ avatar và đồng bộ backend/frontend.

### 9.3 Upload API P0 đã triển khai

Các endpoint dùng chung đã có trong `file-storage` module. Module nghiệp vụ chưa được phép lưu URL trực tiếp; sau khi complete mới liên kết `fileId` vào attachment relation riêng.

| Method | Path | Mục đích | Permission gợi ý |
| --- | --- | --- | --- |
| GET | `/uploads/policies` | Lấy giới hạn theo purpose, MIME, số file và tổng dung lượng | `files.upload` |
| POST | `/uploads` | Tạo upload batch và cấp presigned upload URL cho từng file | `files.upload` |
| POST | `/files/:id/complete` | Xác nhận từng object trên R2, kiểm tra size/MIME và chuyển sang `READY` | `files.upload` |
| POST | `/uploads/:id/complete` | Kiểm tra tất cả file trong upload batch rồi chuyển batch sang `COMPLETED` | `files.upload` |
| DELETE | `/uploads/:id` | Hủy upload batch và dọn các object chưa hoàn tất | `files.upload` |
| GET | `/files/:id/download-url` | Cấp signed URL theo quyền đọc resource | `files.read` + permission domain |
| DELETE | `/files/:id` | Xóa mềm metadata và xóa object theo policy | `files.delete` + permission domain |

Quy tắc bắt buộc:

- Frontend không được biết R2 access key/secret.
- Backend tự sinh object key theo UUID và purpose; không dùng nguyên tên file từ client làm key.
- `/uploads` không đồng nghĩa file đã hợp lệ; chỉ sau `complete` và kiểm tra hậu xử lý mới được gắn vào entity.
- File private luôn đọc qua signed URL; file public chỉ dành cho product/CMS đã được phép public.
- Backend hiện xác minh object bằng `HEAD`, đối chiếu `Content-Length` và `Content-Type`; checksum/magic bytes và cleanup job là hạng mục hardening tiếp theo.
- Mọi lần tạo upload, complete, delete và cấp download URL đều có audit event trong `FileObjectEvent`.

R2 bucket phải có CORS cho origin admin thực tế, cho phép `PUT`, `GET`, `HEAD`, cho phép request header `Content-Type` và expose `ETag`. Access key/secret chỉ nằm ở backend; không đặt vào frontend hoặc URL cấu hình public.

### 9.3.1 Flow logic upload trực tiếp lên R2

Flow chuẩn của hệ thống là **FE gửi metadata cho BE, sau đó FE upload binary trực tiếp lên R2**. Backend không nhận binary bằng `multipart/form-data` trong flow thông thường và không dùng Multer làm lớp trung gian.

```text
FE chọn file
    │
    ├─ Validate local: MIME, extension, size từng file, số lượng, tổng size
    │
    ├─ POST /uploads (chỉ metadata, không có binary)
    │      │
    │      ├─ BE kiểm tra permission và policy
    │      ├─ Tạo UploadBatch OPEN
    │      ├─ Tạo FileObject PENDING cho từng file
    │      └─ Tạo presigned PUT URL
    │
    ├─ FE PUT trực tiếp từng file lên R2
    │      └─ Có progress, retry, giới hạn concurrency
    │
    ├─ POST /files/:fileId/complete cho từng file
    │      └─ BE HEAD object, kiểm tra size/MIME, chuyển file sang READY
    │
    ├─ POST /uploads/:uploadId/complete
    │      └─ BE kiểm tra tất cả file READY, chuyển batch sang COMPLETED
    │
    └─ Module nghiệp vụ lưu các fileId vào relation attachment riêng
```

#### Bước 1: FE chuẩn bị và validate

1. Người dùng chọn một hoặc nhiều file.
2. FE tạo `clientId` cho từng file để ghép kết quả với item đang hiển thị.
3. FE kiểm tra sớm MIME, extension, kích thước từng file, số lượng file và tổng dung lượng theo policy.
4. FE không chuyển file thành base64 và không đưa binary vào React state hoặc request tới BE.
5. Nếu validation local thất bại, không gọi API.

`GET /uploads/policies` là nguồn policy để FE hiển thị giới hạn; BE vẫn phải kiểm tra lại toàn bộ vì validation phía client không phải security boundary.

#### Bước 2: BE tạo upload batch

FE gọi `POST /uploads` với metadata:

```json
{
  "purpose": "INSPECTION",
  "visibility": "PRIVATE",
  "files": [
    {
      "clientId": "local-file-1",
      "originalName": "machine-front.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 5242880
    }
  ]
}
```

BE thực hiện theo thứ tự:

1. Kiểm tra user có `files.upload`.
2. Kiểm tra `purpose`, MIME allowlist, extension, kích thước từng file, số lượng và tổng size.
3. Chuẩn hóa `originalName`; không dùng tên gốc để làm object key.
4. Sinh object key ngẫu nhiên theo `purpose`, user và UUID.
5. Trong một transaction PostgreSQL:
   - tạo `UploadBatch` với trạng thái `OPEN`;
   - tạo các `FileObject` với trạng thái `PENDING`;
   - ghi `FileObjectEvent.PRESIGNED`.
6. Tạo presigned `PUT` URL cho từng object R2.
7. Trả `uploadId`, `fileId`, `uploadUrl`, `requiredHeaders` và thời hạn URL cho FE.

Permission của entity nghiệp vụ được kiểm tra ở bước liên kết `fileId` vào entity, không kiểm tra bằng một polymorphic upload endpoint.

Nếu tạo presigned URL thất bại, batch chuyển sang `FAILED`; các file PENDING không được phép liên kết vào entity nghiệp vụ.

#### Bước 3: FE upload trực tiếp lên R2

1. FE dùng `XMLHttpRequest` hoặc `fetch` để `PUT` binary tới `uploadUrl`.
2. FE gửi đúng header `Content-Type` đã được BE ký.
3. FE theo dõi progress từng file và progress tổng theo trọng số `sizeBytes`.
4. FE chỉ upload song song một số lượng nhỏ, mặc định 3 file; không mở hàng chục request đồng thời.
5. Khi request R2 lỗi mạng, FE retry cùng URL nếu URL còn hạn.
6. Nếu URL hết hạn, batch hiện tại phải được hủy/tạo lại; có thể bổ sung API cấp lại URL ở phase hardening.

Request `PUT` trực tiếp lên R2 không đi qua NestJS và không tính là API upload của backend. R2 presigned URL là bearer token nên phải đặt thời hạn ngắn và không ghi vào log ứng dụng.

#### Bước 4: BE complete từng file

Sau khi `PUT` thành công, FE gọi:

```http
POST /files/:fileId/complete
```

BE thực hiện:

1. Kiểm tra file tồn tại, chưa bị xóa và actor có quyền complete.
2. Kiểm tra file còn trong thời hạn upload.
3. Gọi `HEAD` tới R2 bằng `objectKey` trong database.
4. So sánh `Content-Length` với `sizeBytes` đã đăng ký.
5. So sánh `Content-Type` với MIME đã đăng ký.
6. Nếu hợp lệ, cập nhật `FileObject` thành `READY`, lưu `etag`, `completedAt` và ghi event `UPLOAD_COMPLETED`.
7. Nếu object không tồn tại hoặc metadata không khớp, file chuyển `FAILED`; object sai metadata bị xóa best-effort.

Chỉ file `READY` mới được phép gắn vào relation nghiệp vụ.

#### Bước 5: BE complete cả batch

Sau khi tất cả file đã complete, FE gọi:

```http
POST /uploads/:uploadId/complete
```

BE kiểm tra:

- batch thuộc actor hoặc actor có role quản trị;
- batch đang ở trạng thái `OPEN`;
- batch chưa hết hạn;
- số file thực tế khớp `expectedFileCount`;
- tất cả file đều ở trạng thái `READY`.

Nếu còn file `PENDING` hoặc `FAILED`, trả lỗi `UPLOAD_INCOMPLETE` kèm danh sách `fileId` và status. Không chuyển batch sang `COMPLETED` một phần.

Sau khi batch `COMPLETED`, module nghiệp vụ mới được lưu các `fileId`, ví dụ:

```text
RentalInspectionAttachment.fileId
PaymentProof.fileId
ContractDocument.fileId
DeliveryProof.fileId
```

Không lưu `uploadUrl`, signed URL hoặc URL public trong bảng nghiệp vụ.

#### Bước 6: Hủy upload và cleanup

Khi người dùng bấm hủy hoặc form nghiệp vụ bị đóng trước khi lưu:

```http
DELETE /uploads/:uploadId
```

BE sẽ:

1. Kiểm tra actor có quyền quản lý batch.
2. Xóa các object R2 theo `objectKey` bằng thao tác best-effort.
3. Đánh dấu các `FileObject` liên quan là `DELETED`.
4. Chuyển `UploadBatch` sang `CANCELLED`.

Job cleanup định kỳ phải tìm các batch/file `OPEN` hoặc `PENDING` quá hạn để xóa object mồ côi và cập nhật trạng thái. Không được coi database metadata là bằng chứng object đã tồn tại trên R2 nếu chưa complete.

#### Trạng thái lifecycle

```text
UploadBatch:
OPEN ────────────────→ COMPLETED
  │
  ├──────────────────→ CANCELLED
  ├──────────────────→ FAILED
  └──────────────────→ EXPIRED

FileObject:
PENDING ─────────────→ READY
   │                     │
   ├──────────────────→ FAILED
   └──────────────────→ DELETED
```

#### Quyết định về Multer

Multer không nằm trong flow upload chính vì nó khiến binary đi qua NestJS trước khi tới R2, làm tăng băng thông, RAM, latency, timeout và công việc cleanup file tạm.

Chỉ dùng Multer hoặc server-side multipart khi:

- client không hỗ trợ presigned URL;
- cần xử lý file trước khi lưu và file đủ nhỏ;
- cần nhận file từ một integration nội bộ/legacy;
- có một pipeline riêng cho OCR, virus scan hoặc parse tài liệu.

Với ảnh inspection, bill, hợp đồng và chứng từ, ưu tiên upload trực tiếp R2 trước; các tác vụ resize, scan, OCR hoặc tạo preview chạy sau đó bằng queue `media`/`document`.

### 9.4 Validation và xử lý bất đồng bộ

- Validate ở backend cả `purpose`, MIME allowlist, extension, dung lượng và quyền trên entity.
- Không chỉ tin `Content-Type` do trình duyệt gửi; cần kiểm tra signature/magic bytes khi file đã nằm trên R2.
- Ảnh inspection/bằng chứng: giữ bản gốc private, tạo thumbnail/preview để hiển thị; không ghi đè bản gốc nếu có khả năng dùng cho dispute.
- Ảnh product/asset: có thể resize và chuyển WebP/AVIF; lưu preview/thumbnail theo nhu cầu UI.
- PDF hợp đồng/bill không chuyển thành ảnh; giữ nguyên file và dùng signed download.
- Tác vụ resize, virus scan và xử lý ảnh dùng queue `media`; tạo hợp đồng PDF, biên bản hoặc report export nặng dùng queue `document`. Không xử lý CPU/RAM lớn trong request upload.
- Chỉ enqueue sau khi transaction metadata đã commit; retry phải idempotent theo `fileId`/processing version.

### 9.5 Ma trận liên kết nghiệp vụ

| Nghiệp vụ | Relation chính | Có giữ bản gốc? | Hiển thị |
| --- | --- | --- | --- |
| Inspection/incident | `RentalInspectionAttachment`, `RentalIncidentAttachment` | Có | Signed URL, staff có quyền xem |
| Payment/refund | `PaymentProof` | Có | Signed URL, chỉ role tài chính/vận hành được cấp quyền |
| Product/catalog | `ProductMedia` | Tùy policy | CDN/public hoặc admin |
| Asset/bảo trì | `AssetMedia` | Có nếu là bằng chứng hỏng | Private/admin |
| Delivery | `DeliveryProof` | Có | Private/signed URL |
| Contract | `ContractDocument` | Có | Private/signed URL, audit download |
| Contributor | `ContributorDocument` | Có | Private, retention riêng |
| Report/export | `FileObject` với purpose export | Không nhất thiết lâu dài | Signed URL có expiry |

### 9.6 Definition of Done cho module upload

- P0 đã có Prisma migration, DTO input/output, Swagger, permission seed, upload/complete/download/delete và audit.
- P0 đã validation theo purpose, MIME allowlist, giới hạn dung lượng và trạng thái lifecycle.
- P0 có signed URL cho file private; `PUBLIC` mới chỉ là metadata policy cho product/CMS, chưa mở public bucket/CDN.
- Còn phải bổ sung checksum/magic bytes, cleanup file mồ côi, queue resize/scan và các attachment relation theo từng domain.
- Còn phải nối queue `media`/`document` khi xử lý vượt quá request ngắn.
- Còn phải bổ sung test module cho upload thất bại, retry, file sai MIME, file quá lớn, quyền sai và cleanup theo policy.

### 9.7 File lớn, nén ảnh và resumable upload

P0 dùng single-part `PUT` trực tiếp lên R2 với giới hạn ứng dụng thấp hơn giới hạn hạ tầng:

| Loại | Giới hạn hiện tại | FE | BE |
| --- | ---: | --- | --- |
| Ảnh | 12 MB | Kiểm tra trước khi gọi `/uploads`; có thể resize/nén bản sao với media catalog | Kiểm tra lại MIME, extension và size trước khi tạo metadata |
| PDF | 30 MB | Không rasterize; báo lỗi rõ ràng hoặc yêu cầu nén PDF | Reject trước upload nếu vượt ngưỡng |
| CSV/XLSX/export | 50 MB | Reject sớm nếu vượt ngưỡng | `@Max` và policy purpose kiểm tra lại |

Không upload file quá giới hạn lên backend bằng `multipart/form-data` và không convert mọi ảnh bằng server trong request. FE dùng `File.slice()`/`XMLHttpRequest` để upload trực tiếp, không chuyển file thành base64 và không giữ toàn bộ bản sao trong state.

Ảnh `PRODUCT_MEDIA`/catalog có thể resize theo kích thước hiển thị và chuyển WebP/JPEG trước khi upload. Ảnh `INSPECTION`, `INCIDENT`, `PAYMENT_PROOF` và `DELIVERY_PROOF` phải giữ bản gốc private; nếu cần preview thì tạo derivative riêng, không ghi đè bản gốc.

Nếu nghiệp vụ bắt buộc nhận file lớn hơn các ngưỡng trên, mở rộng bằng multipart/resumable upload:

1. `POST /uploads` tạo `FileObject` PENDING; nếu file vượt ngưỡng thì BE khởi tạo multipart upload trên R2.
2. BE trả `uploadId`, `partSize`, `partCount`; FE gọi `POST /files/:id/parts` để lấy presigned URL cho từng part.
3. FE dùng `File.slice()`, upload song song tối đa 3–4 part, retry từng part và lưu `partNumber`/`ETag` trong state.
4. `POST /files/:id/complete` gửi danh sách part; BE gọi `CompleteMultipartUpload`, rồi `HEAD` kiểm tra tổng size/MIME và chuyển READY.
5. `DELETE /uploads/:id` hủy batch và cleanup job dọn upload PENDING quá hạn; không dựa duy nhất vào ETag multipart để coi là checksum của toàn file.

Flow multipart nên bổ sung `uploadMode`, `multipartUploadId`, `partSizeBytes` và bảng `FileObjectPart` nếu cần resume sau reload. Không bật multipart chỉ để xử lý ảnh thông thường; single-part hiện tại đủ cho các file vận hành của shop.

## 10. Module tương lai cần contract riêng

- reports: dashboard đã có aggregate vận hành cơ bản; báo cáo tài chính/kế toán độc lập vẫn phải thiết kế query, range, timezone, permission và aggregate riêng trước khi frontend gọi /reports.
- blacklist: chốt model customer, reason, expiry, scope và rule không cho tạo đơn trước khi tạo controller.
- audit-log: ghi actor, action, resource, before/after, request id và timestamp; không lấy status history của rental order làm audit log toàn hệ thống.

## 11. Dashboard vận hành

Dashboard vận hành là capability đọc dữ liệu tổng hợp để điều phối cửa hàng. Dashboard không thay thế danh sách đơn thuê, Gantt availability hoặc module báo cáo.

### 11.1 API và permission

Các endpoint hiện có:

| Method | Path | Permission | Nội dung |
| --- | --- | --- | --- |
| GET | /dashboard/operations/overview | orders.read | KPI vận hành, snapshot tài chính, tình trạng thiết bị, top sản phẩm và preview việc cần xử lý |
| GET | /dashboard/operations/attention | orders.read | Danh sách phân trang các đơn cần thao tác |
| GET | /dashboard/operations/trends | orders.read | Xu hướng theo ngày/tuần/tháng dựa trên ngày bắt đầu thuê |

Dashboard dùng `orders.read` vì đây là màn hình điều phối đơn thuê và availability. `reports.read` dành cho module báo cáo phân tích độc lập; khi nghiệp vụ tài chính tách riêng cần bổ sung permission tài chính thay vì mở rộng dữ liệu dashboard cho mọi role.

### 11.2 Khoảng thời gian và timezone

Request bắt buộc có `fromDate` và `toDate`. Khoảng thời gian dùng nửa kín `[fromDate, toDate)`, tức bản ghi có thời điểm đúng `toDate` không thuộc kỳ.

Request có thể truyền `timezone`, mặc định `Asia/Ho_Chi_Minh`. Backend dùng Date đã được parse để lọc dữ liệu và dùng timezone để tạo bucket cho trends. Khoảng dashboard tối đa 366 ngày.

`dateBasis` của v1 là `RENTAL_PERIOD`:

- đơn tổng hợp theo khoảng giao nhau giữa `startDate` và `endDate` với kỳ xem;
- lịch nhận máy dùng `startDate` nằm trong kỳ;
- lịch trả máy dùng `endDate` nằm trong kỳ;
- đơn quá hạn được đưa vào việc cần xử lý dù thời gian thuê đã bắt đầu trước kỳ;
- số tiền tài chính là snapshot trên các đơn được chọn theo kỳ thuê.

Dashboard v1 chưa phải sổ cái dòng tiền. `paidTotal` là tiền đã thu trên đơn và có thể gồm tiền thuê, tiền giữ lịch và tiền cọc; không được gắn nhãn là doanh thu kế toán. Nếu cần thống kê tiền theo ngày thanh toán, phải tạo query/report theo `PaymentTransaction.createdAt`.

### 11.3 Quy tắc tổng hợp

- Đơn hủy bị loại khỏi số liệu vận hành mặc định. `cancelledOrders` vẫn luôn đếm riêng các đơn hủy trong kỳ để KPI không bị hiểu sai.
- `includeCancelled=true` mở rộng các tổng hợp kiểm tra (đơn, tiền và thiết bị); không biến đơn hủy thành việc cần nhận/trả máy.
- `rentalRevenue` lấy từ `RentalOrder.rentalFeeTotal` của các đơn được chọn.
- `deliveryRevenue` lấy từ `deliveryFeeTotal` và hiển thị tách khỏi tiền thuê.
- `collectedTotal` lấy từ `paidTotal`, không phải doanh thu.
- `depositHeldTotal` ở v1 được ước tính bằng tiền cọc snapshot trừ tiền hoàn thực tế, giới hạn tối thiểu bằng 0.
- `amountDueBeforeHandover` hiển thị là “Còn phải thu trước khi bàn giao”.
- `refundDueTotal` là nghĩa vụ cần hoàn theo snapshot đơn.
- `pendingRefundTotal` chỉ cộng các refund có trạng thái `PENDING` hoặc `PROCESSING`; refund của đơn hủy vẫn được tính để không bỏ sót việc hoàn tiền.
- `damageCompensationTotal` là khoản bồi thường hư hỏng đã tính cho khách.
- `repairCostTotal` trả `null` vì schema hiện tại chưa có chi phí sửa chữa thực tế. Không dùng `damageCompensationTotal` thay cho chi phí sửa chữa.
- Top sản phẩm được tính từ `RentalOrderLine`, loại đơn hủy mặc định, trả số lượng thuê, số đơn, ngày-thiết bị và tiền thuê.
- `rentalDeviceDays` bằng thời lượng thuê theo ngày nhân số lượng trên line; đây là chỉ số vận hành, không phải công suất kế toán.
- Top thiết bị trả tối đa 5 serial có nhiều allocation thực tế nhất; chỉ allocation `HANDED_OVER` hoặc `RETURNED` được tính, không tính lịch mới `RESERVED`.

### 11.4 Việc cần xử lý

Mỗi đơn chỉ tạo một attention item chính theo thứ tự ưu tiên:

1. `DISPUTE` — đơn tranh chấp.
2. `OVERDUE_RETURN` — đơn `RENTING`, quá `endDate` và chưa có `actualReturnDate`.
3. `REFUND_PENDING` — có `refundDue` hoặc refund đang `PENDING/PROCESSING`.
4. `PAYMENT_CONFIRMATION` — còn tiền trước bàn giao hoặc có payment inbound đang `PENDING`.
5. `PICKUP_DUE` — đến kỳ nhận nhưng chưa `HANDED_OVER`.
6. `RETURN_DUE` — đến kỳ trả nhưng chưa `INSPECTED`.

`attentionOrders` là số đơn duy nhất khớp các điều kiện trên. Một đơn hủy chỉ xuất hiện trong attention khi còn nghĩa vụ hoàn tiền. FE dùng `type`, `priority`, `message` và enum status để render; không tự suy diễn việc cần làm từ màu badge.

### 11.5 Availability trong dashboard

- `totalAssets`: tất cả asset chưa xóa mềm.
- `scheduledAssets`: asset có allocation giao nhau với khoảng xem và allocation ở trạng thái blocking.
- `freeAssets`: asset active, `AVAILABLE`, không có allocation blocking giao nhau.
- `unavailableAssets`: asset inactive hoặc status khác `AVAILABLE`.
- `maintenanceAssets`, `lostAssets`, `damagedAssets`: đếm riêng theo status/condition hiện tại của asset.

Chi tiết lịch vẫn dùng `/availability/gantt`; dashboard chỉ trả summary để tải nhanh.

### 11.6 Realtime và dữ liệu chưa có

V1 dùng frontend polling và nút làm mới. Backend chưa phát event riêng cho dashboard. Khi cần realtime, dùng event invalidation cho các thay đổi:

- tạo/cập nhật/hủy đơn;
- payment xác nhận/từ chối;
- tạo/xác nhận refund;
- bàn giao/trả máy/inspection;
- asset đổi status hoặc condition.

Không push toàn bộ aggregate qua socket. Socket chỉ gửi event thay đổi, sau đó FE gọi lại overview/attention với cùng filter.

Các capability chưa triển khai trong dashboard:

- chi phí sửa chữa thực tế: cần module maintenance cost/incident cost;
- doanh thu theo ngày thanh toán: cần report query trên payment transaction;
- audit log toàn hệ thống: cần audit contract riêng;
- blacklist: cần model và rule chặn đơn riêng.
