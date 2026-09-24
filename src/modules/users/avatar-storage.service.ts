import { randomUUID } from 'crypto';
import { basename, join } from 'path';
import { unlink, writeFile } from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Stores to Cloudflare R2 (S3-compatible) when the R2_* env vars are all set;
 * otherwise falls back to local disk under uploads/avatars/ - same dual-mode
 * pattern as EmailService (SMTP vs console log), so local dev needs no setup
 * and callers never need to know which mode is active.
 */
@Injectable()
export class AvatarStorageService {
  private readonly s3: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly publicUrl: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('storage.r2AccountId');
    const accessKeyId = this.configService.get<string>('storage.r2AccessKeyId');
    const secretAccessKey = this.configService.get<string>('storage.r2SecretAccessKey');
    this.bucket = this.configService.get<string>('storage.r2Bucket');
    this.publicUrl = this.configService.get<string>('storage.r2PublicUrl');

    this.s3 =
      accountId && accessKeyId && secretAccessKey && this.bucket && this.publicUrl
        ? new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  async save(buffer: Buffer, mimeType: string): Promise<string> {
    const filename = `${randomUUID()}${EXT_BY_MIME[mimeType]}`;

    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: `avatars/${filename}`,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
      return `${this.publicUrl}/avatars/${filename}`;
    }

    await writeFile(join(process.cwd(), 'uploads', 'avatars', filename), buffer);
    return `/uploads/avatars/${filename}`;
  }

  async delete(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl) return;
    const filename = basename(avatarUrl);
    try {
      if (this.s3) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: `avatars/${filename}` }));
      } else {
        await unlink(join(process.cwd(), 'uploads', 'avatars', filename));
      }
    } catch {
      // Best-effort cleanup - a missing file is not an error the caller needs to see.
    }
  }
}
