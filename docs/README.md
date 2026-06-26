# Tài liệu dự án Rental Admin

> Nguồn sự thật (Source of Truth) cho nghiệp vụ, kiến trúc, quy trình phát triển và vận hành của hệ thống Quản lý Cho thuê Thiết bị Rental Admin.  
> Phiên bản tài liệu: Phase 1 (Admin-first)  
> Cập nhật gần nhất: 2026-06-26

---

## 🧭 Bắt đầu ở đây

| Thứ tự | File tài liệu | Mục đích |
|---|---|---|
| 1 | [documentation-map.md](file:///d:/Admin%20Rental/rental-admin-be/docs/00-start-here/documentation-map.md) | Bản đồ định hướng toàn bộ tài liệu và tuyến đọc theo vai trò |
| 2 | [project-overview.md](file:///d:/Admin%20Rental/rental-admin-be/docs/00-start-here/project-overview.md) | Tổng quan nghiệp vụ, bài toán và đối tượng sử dụng hệ thống |
| 3 | [glossary.md](file:///d:/Admin%20Rental/rental-admin-be/docs/00-start-here/glossary.md) | Từ điển giải thích các thuật ngữ chuyên ngành (Product, AssetUnit,...) |
| 4 | [CLAUDE.md](file:///d:/Admin%20Rental/rental-admin-be/docs/CLAUDE.md) | Hướng dẫn AI Agent định vị và chỉnh sửa tài liệu đúng quy chuẩn |

---

## 📁 Cấu trúc thư mục tài liệu

```text
docs/
├── 00-start-here/               ← Đọc trước tiên — Bản đồ, tổng quan & thuật ngữ
├── 01-product/                  ← Mô hình sản phẩm, phạm vi dự án & yêu cầu nghiệp vụ
├── 02-architecture/             ← Thiết kế kiến trúc hệ thống và cơ sở dữ liệu
├── 03-domains/                  ← Chi tiết nghiệp vụ cốt lõi (rental orders, availability, RBAC)
├── 04-applications/             ← Hướng dẫn và quy ước lập trình theo repo nguồn
│   ├── backend/                 ← Quy chuẩn Code NestJS & danh sách Endpoints
│   └── frontend/                ← Quy chuẩn Code Next.js & luồng logic Flow
├── 06-operations/               ← Hướng dẫn seed dữ liệu, các lệnh chạy dev & deploy
├── 08-decisions/                ← Quyết định kiến trúc quan trọng (ADR)
└── 99-archive/                  ← Lịch sử Q&A và tài liệu lưu trữ cũ
```

---

## 🔗 Tuyến đọc nhanh theo vai trò

### Phát triển Backend (NestJS)
- [database-schema.md](file:///d:/Admin%20Rental/rental-admin-be/docs/02-architecture/database-schema.md)
- [rbac-rules.md](file:///d:/Admin%20Rental/rental-admin-be/docs/03-domains/rbac/rbac-rules.md)
- [conventions.md](file:///d:/Admin%20Rental/rental-admin-be/docs/04-applications/backend/conventions.md)
- [endpoints.md](file:///d:/Admin%20Rental/rental-admin-be/docs/04-applications/backend/endpoints.md)

### Phát triển Frontend (Next.js)
- [conventions.md](file:///d:/Admin%20Rental/rental-admin-be/docs/04-applications/frontend/conventions.md)
- [status-flow-rules.md](file:///d:/Admin%20Rental/rental-admin-be/docs/03-domains/rental-orders/status-flow-rules.md)
- [project-overview.md](file:///d:/Admin%20Rental/rental-admin-be/docs/00-start-here/project-overview.md)

### Vận hành & DevOps
- [seeding.md](file:///d:/Admin%20Rental/rental-admin-be/docs/06-operations/seeding.md)
- [dev-commands.md](file:///d:/Admin%20Rental/rental-admin-be/docs/06-operations/dev-commands.md)

---

## 🛠️ Nguyên tắc nguồn sự thật (Source of Truth)

Tài liệu là bản mô tả kiến trúc mong muốn hoặc thiết kế nghiệp vụ. Khi có mâu thuẫn giữa code thực tế và tài liệu, hãy tuân theo độ ưu tiên sau:
1. **Mã nguồn thực thi** (Source Code) luôn là sự thật cuối cùng.
2. **Prisma Schema** (`prisma/schema.prisma`) là nguồn sự thật cho cấu trúc DB.
3. Các quyết định kiến trúc trong **ADR (`08-decisions/`)** đè lên các giả định trong tài liệu nghiệp vụ chung.

Nếu phát hiện tài liệu lệch so với code thực tế mà không có lý do thỏa đáng, hãy cập nhật lại tài liệu hoặc đánh dấu `needs-review` ở dòng tương ứng.
