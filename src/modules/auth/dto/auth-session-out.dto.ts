import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';

export class AuthSessionOutDto {
  @ApiProperty({ type: String, format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ example: 'Windows device' })
  deviceName!: string;

  @ApiProperty({ example: 'Chrome' })
  browser!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  lastUsedAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: Boolean })
  isCurrent!: boolean;
}

export class AuthSessionsResponseDto extends ApiRes<AuthSessionOutDto[]> {
  @ApiProperty({ type: [AuthSessionOutDto] })
  declare data: AuthSessionOutDto[];
}

export class RevokeSessionDataDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: false })
  isCurrent!: boolean;
}

export class RevokeSessionResponseDto extends ApiRes<RevokeSessionDataDto> {
  @ApiProperty({ type: RevokeSessionDataDto })
  declare data: RevokeSessionDataDto;
}

export class RevokeOtherSessionsDataDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 2 })
  revokedCount!: number;
}

export class RevokeOtherSessionsResponseDto extends ApiRes<RevokeOtherSessionsDataDto> {
  @ApiProperty({ type: RevokeOtherSessionsDataDto })
  declare data: RevokeOtherSessionsDataDto;
}
