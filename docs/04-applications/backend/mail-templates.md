# Mail Templates Module

MVP module quan ly mau email dong cho admin. Template duoc luu trong PostgreSQL, render bang placeholder dang `{{variable}}`, va co fallback trong code cho cac email quan trong.

## Scope MVP

- Admin co the xem, cap nhat, preview va gui thu template qua API.
- He thong luu log gui mail vao `EmailLog` voi enum `EmailStatus`: `SENT` hoac `FAILED`.
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

### EmailLog

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
| `GET` | `/:id` | `email_templates.read` | Lay chi tiet template. |
| `PATCH` | `/:id` | `email_templates.update` | Cap nhat subject/body/variables/isActive. |
| `POST` | `/:id/preview` | `email_templates.preview` | Render template voi payload mau. |
| `POST` | `/:id/send-test` | `email_templates.send_test` | Gui thu va ghi EmailLog. |

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
