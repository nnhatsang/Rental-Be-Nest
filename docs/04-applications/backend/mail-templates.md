# Mail Templates Module

MVP module quan ly mau email dong cho admin. Template duoc luu trong PostgreSQL, render bang placeholder dang `{{variable}}`, va co fallback trong code cho cac email quan trong.

## Scope MVP

- Admin co the xem, cap nhat, preview va gui thu template qua API.
- Email duoc dua vao BullMQ email queue; email delivery log chua nam trong pham vi editor MVP.
- Chua lam version history, rollback, multi-language, queue retry, attachment.

## Data model

### EmailLayout

- `key`: ma layout on dinh, vi du `default`.
- `name`: ten hien thi cho admin.
- `htmlLayout`: khung HTML dung placeholder he thong `{{content}}` de chen noi dung template.
- `isActive`: neu false, template gan layout nay se render body truc tiep.
- `createdBy`, `updatedBy`: audit user id.

### EmailTemplate

- `key`: ma template on dinh, vi du `auth.reset_password`.
- `name`: ten hien thi cho admin.
- `layoutId`: layout optional.
- `subject`: subject co the dung placeholder.
- `htmlBody`: noi dung HTML.
- `variables`: danh sach bien hop le, vi du `["userName", "resetPasswordUrl"]`.
- `description`: mo ta noi bo cho admin.
- `isActive`: neu false, email nghiep vu se dung fallback trong code.
- `createdBy`, `updatedBy`: audit user id.

### EmailLog (planned)

- `templateId`: template da dung, nullable neu email gui bang fallback.
- `toEmail`: email nguoi nhan.
- `subject`: subject sau khi render.
- `status`: `EmailStatus.SENT` hoac `EmailStatus.FAILED`.
- `provider`: SMTP/provider optional.
- `error`: loi SMTP/render neu co.
- `payload`: payload render template.
- `sentAt`: thoi diem gui thanh cong.

## Placeholder rules

- Placeholder hop le: `{{userName}}`, `{{resetPasswordUrl}}`, `{{appName}}`.
- Placeholder trong `subject/htmlBody/layout.htmlLayout` bat buoc nam trong `variables`, tru placeholder he thong `{{content}}`.
- Khi preview/send-test, payload phai co du cac placeholder template dang dung.
- Gia tri payload duoc escape HTML co ban khi render.
- `{{content}}` trong layout duoc thay bang HTML body da render, khong can khai bao trong `variables`.

## Initial template

Seeder tao template mac dinh:

```text
layout key: default
key: auth.reset_password
variables: userName, resetPasswordUrl, expiresInMinutes, appName
```

Flow forgot password dung `auth.reset_password` neu template ton tai va `isActive = true`; neu khong, backend fallback ve HTML hard-code trong `MailService`.

## API

Base path: `/api/mail-templates`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/layouts` | `email_templates.read` | List layouts co pagination/search/filter. |
| `GET` | `/layouts/:id` | `email_templates.read` | Lay chi tiet layout. |
| `POST` | `/layouts` | `email_templates.update` | Tao layout moi. |
| `PATCH` | `/layouts/:id` | `email_templates.update` | Cap nhat layout. |
| `GET` | `/` | `email_templates.read` | List templates co pagination/search/filter. |
| `GET` | `/catalog` | `email_templates.read` | Lay purpose, bien va sample payload do backend quan ly. |
| `GET` | `/:id` | `email_templates.read` | Lay chi tiet template. |
| `PATCH` | `/:id` | `email_templates.update` | Cap nhat ten, layout, subject/body/mo ta/trang thai. Variables va key do backend quan ly. |
| `POST` | `/:id/preview` | `email_templates.preview` | Render template voi payload mau. |
| `POST` | `/:id/send-test` | `email_templates.send_test` | Render draft va dua email thu vao queue. |

`POST /:id/preview` va `POST /:id/send-test` co the nhan them draft fields `subject`, `htmlBody`, `layoutId`. Neu khong truyen, backend render noi dung da luu. Draft van phai dung cac bien da khai bao cua template va payload phai co du gia tri.

Catalog purpose la source of truth cua cac key nghiep vu. FE khong tu tao template key hay tu dinh nghia payload; khi them email hop dong, BE them key/catalog/seed va goi `sendTemplateEmail()` tai flow nghiep vu.

## Example preview payload

```json
{
  "payload": {
    "userName": "Nguyen Van A",
    "resetPasswordUrl": "http://localhost:3001/auth/reset-password?token=sample",
    "expiresInMinutes": 30,
    "appName": "Rental Admin"
  }
}
```
