import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateClubMemberPaymentDto {
  @ApiProperty()
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty()
  @IsDateString()
  paidAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
