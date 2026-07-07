import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { CustomerStatus } from '@generated/prisma/enums';
import { ApiPagReq } from '@/libs/types/custom-response.type';

export enum CustomerSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  CODE = 'code',
  NAME = 'name',
  PHONE = 'phone',
  EMAIL = 'email',
  STATUS = 'status',
}

export class GetAllCustomersInDto extends ApiPagReq {
  @ApiPropertyOptional({ enum: Object.values(CustomerStatus) })
  @IsIn(Object.values(CustomerStatus))
  @IsOptional()
  status?: CustomerStatus;

  @ApiPropertyOptional({
    enum: CustomerSortBy,
    default: CustomerSortBy.CREATED_AT,
  })
  @IsEnum(CustomerSortBy)
  @IsOptional()
  sortBy: CustomerSortBy = CustomerSortBy.CREATED_AT;
}
