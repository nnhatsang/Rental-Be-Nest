import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CustomerStatus } from '@generated/prisma/enums';

export class UpdateCustomerStatusDto {
  @ApiProperty({ enum: Object.values(CustomerStatus), example: CustomerStatus.ACTIVE })
  @IsIn(Object.values(CustomerStatus))
  status!: CustomerStatus;
}
