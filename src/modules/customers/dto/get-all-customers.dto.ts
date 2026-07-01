import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CustomerStatus } from '@generated/prisma/enums';
import { INVALID_STRING } from '@/libs/constants/invalid.constant';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export class GetAllCustomersInDto extends ApiPagReq {
  @ApiPropertyOptional({ enum: Object.values(CustomerStatus) })
  @IsIn(Object.values(CustomerStatus))
  @IsOptional()
  status?: CustomerStatus;
}
