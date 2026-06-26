# Instructions for AI agents

## Entry points

1. Read [README.md](file:///d:/Admin%20Rental/rental-admin-be/docs/README.md).
2. Read [documentation-map.md](file:///d:/Admin%20Rental/rental-admin-be/docs/00-start-here/documentation-map.md).
3. Use [docs-map.yml](file:///d:/Admin%20Rental/rental-admin-be/docs/docs-map.yml) to locate the owning section for the current task.
4. Read only documents relevant to the current task.

## Source-of-truth rules

- Source code overrides technical documentation.
- Database migrations & Prisma schema (`prisma/schema.prisma`) override manually written schema descriptions.
- Package manifests (`package.json`, `pnpm-lock.yaml`) override manually written dependency versions.
- ADR in [08-decisions/](file:///d:/Admin%20Rental/rental-admin-be/docs/08-decisions/) override architectural assumptions in other documents.

If a document conflicts with source code, mark the claim `needs-review` — do not silently trust the document.

## Do not read by default

```text
99-archive/
```

Read these only when explicitly needed for the current task.

## When updating documentation

- Do not create a new file if an existing file covers the topic — update that file instead.
- Xóa nội dung lỗi thời, sai hoặc trùng lặp — Git lưu lịch sử thay đổi.
- Chỉ di chuyển vào `99-archive/` khi có giá trị audit hoặc lịch sử hỏi đáp cần giữ lại.
- Keep each document focused on one responsibility.
- Update all internal links after moving files.
