# Media uploads

`POST /api/v1/media/upload` stores files in **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set. The media library lists the Blob URLs.

- **Development without a token:** files are written to `public/uploads/temp/` (git-ignored) so the library works offline.
- **Production without a token:** the upload answers `503` with code `STORAGE_NOT_CONFIGURED`. Nothing is written to disk: a file under `public/` is not served until the next restart and does not survive a redeploy.

Self-hosting needs a storage provider: set `BLOB_READ_WRITE_TOKEN` (a Vercel Blob token, starts with `vercel_blob_`). See the media library docs.
