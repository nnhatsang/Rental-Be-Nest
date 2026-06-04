import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { CustomerOutDto } from './customer-out.dto';

export class CustomerResponseDto extends ApiRes<CustomerOutDto> {
  @ApiProperty({ type: CustomerOutDto })
  declare data: CustomerOutDto;
}

export class CustomersPaginatedDataDto extends ApiPag<CustomerOutDto> {
  @ApiProperty({ type: [CustomerOutDto] })
  declare items: CustomerOutDto[];
}

export class CustomersPaginatedResponseDto extends ApiPaginatedResponseDto<CustomerOutDto> {
  @ApiProperty({ type: CustomersPaginatedDataDto })
  declare data: CustomersPaginatedDataDto;
}

export class DeleteCustomerDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class DeleteCustomerResponseDto extends ApiRes<DeleteCustomerDataDto> {
  @ApiProperty({ type: DeleteCustomerDataDto })
  declare data: DeleteCustomerDataDto;
}
