import { randomUUID } from 'crypto';
import { basename, join } from 'path';
import { unlink, writeFile } from 'fs/promises';
import type { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface AvatarObject {
  body: Readable;
  contentType?: string;
}

/**
 * Stores to any S3-compatible bucket (Backblaze B2, R2, etc.) when the S3_*
 * env vars are all set; otherwise falls back to local disk under
 * uploads/avatars/ - same dual-mode pattern as EmailService (SMTP vs console
 * log), so local dev needs no setup and callers never need to know which
 * mode is active.
 *
 * Despite the name (kept for the existing user-avatar call sites and the
 * `avatars/` key prefix/proxy route), this is a generic small-image store -
 * OrganisationsService reuses it unchanged for organisation logos, since
 * save/delete/getObject take a plain buffer/mimeType/filename with nothing
 * user-specific about them.
 *
 * The bucket is expected to be PRIVATE - images are served back out through
 * AvatarsController's proxy route rather than a public bucket URL, so no
 * hosting provider requires a card on file just to view one.
 */
@Injectable()
export class AvatarStorageService {
  private readonly s3: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('storage.s3Endpoint');
    const region = this.configService.get<string>('storage.s3Region');
    const accessKeyId = this.configService.get<string>('storage.s3AccessKeyId');
    const secretAccessKey = this.configService.get<string>('storage.s3SecretAccessKey');
    this.bucket = this.configService.get<string>('storage.s3Bucket');

    this.s3 =
      endpoint && region && accessKeyId && secretAccessKey && this.bucket
        ? new S3Client({ region, endpoint, credentials: { accessKeyId, secretAccessKey } })
        : null;
  }

  /** Returns the URL to store as avatarUrl/logoUrl - relative in both modes, resolved by the frontend against the API origin. */
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
      return `/api/v1/avatars/${filename}`;
    }

    await writeFile(join(process.cwd(), 'uploads', 'avatars', filename), buffer);
    return `/uploads/avatars/${filename}`;
  }

  async delete(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl) return;
    const filename = basename(avatarUrl);
    try {
      if (this.s3) {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: `avatars/${filename}` }),
        );
      } else {
        await unlink(join(process.cwd(), 'uploads', 'avatars', filename));
      }
    } catch {
      // Best-effort cleanup - a missing file is not an error the caller needs to see.
    }
  }

  /** Streams an image back from the bucket for AvatarsController - null when not in remote mode (nothing to proxy) or not found. */
  async getObject(filename: string): Promise<AvatarObject | null> {
    if (!this.s3) return null;
    try {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: `avatars/${filename}` }),
      );
      return { body: result.Body as Readable, contentType: result.ContentType };
    } catch {
      return null;
    }
  }
}
