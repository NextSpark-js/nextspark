# Media uploads

`POST /api/v1/media/upload` stores files with the driver `STORAGE_DRIVER` selects: `vercel-blob` (`BLOB_READ_WRITE_TOKEN`), `s3` (any S3-compatible service, the `S3_*` variables) or `local` (a directory on the server, `UPLOADS_DIR`). Unset, Vercel Blob is used when `BLOB_READ_WRITE_TOKEN` is set.

- **Development without a driver:** files are written to `public/uploads/temp/` (git-ignored) so the library works offline.
- **Production without a driver:** the upload answers `503` with code `STORAGE_NOT_CONFIGURED`. Nothing is written to `public/`: a file there is not served until the next restart and does not survive a redeploy.

Self-hosting needs a storage driver: `s3`, or `local` on a persistent volume for a single server. See the media library docs (`21-media-library/05-configuration.md`).
