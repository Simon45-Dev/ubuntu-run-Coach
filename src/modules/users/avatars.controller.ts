import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AvatarStorageService } from './avatar-storage.service';

/**
 * Unauthenticated on purpose - avatars are non-sensitive, UUID-named, and
 * need to load in plain <img> tags without an Authorization header. Only
 * reachable at all when remote (S3-compatible) storage is configured; the
 * local-disk fallback is served separately via useStaticAssets in main.ts.
 */
@ApiTags('avatars')
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly avatarStorage: AvatarStorageService) {}

  @Get(':filename')
  async getAvatar(@Param('filename') filename: string, @Res() res: Response) {
    const object = await this.avatarStorage.getObject(filename);
    if (!object) {
      throw new NotFoundException();
    }
    res.setHeader('Content-Type', object.contentType ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // helmet's default Cross-Origin-Resource-Policy (same-origin) would
    // otherwise block the frontend, on a different origin, from loading this.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    object.body.pipe(res);
  }
}
