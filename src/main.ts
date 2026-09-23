import { mkdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  mkdirSync(join(process.cwd(), 'uploads', 'avatars'), { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    // helmet's default Cross-Origin-Resource-Policy (same-origin) would otherwise
    // block the frontend, on a different origin/port, from loading these images.
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: configService.get<string>('corsOrigin', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ubuntu Run API')
    .setDescription('Coaching platform backend - foundation slice')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('port', { infer: true }) ?? 3000;
  await app.listen(port);
}

bootstrap();
