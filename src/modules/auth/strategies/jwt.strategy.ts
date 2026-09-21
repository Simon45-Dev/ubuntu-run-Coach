import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthContext } from '../../../common/auth-context';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret', { infer: true }) as string,
    });
  }

  // The payload here is exactly what AuthService signed - see
  // auth.service.ts#issueTokens. Passport attaches the return value as
  // request.user; JwtAuthGuard copies it to request.authContext.
  validate(payload: AuthContext): AuthContext {
    return payload;
  }
}
