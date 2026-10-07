-- Prevent deleting an email layout that is still referenced by templates.
ALTER TABLE "EmailTemplate" DROP CONSTRAINT "EmailTemplate_layoutId_fkey";

ALTER TABLE "EmailTemplate"
ADD CONSTRAINT "EmailTemplate_layoutId_fkey"
FOREIGN KEY ("layoutId") REFERENCES "EmailLayout"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
