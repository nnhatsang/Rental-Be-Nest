import { ApiProperty } from '@nestjs/swagger';
import { ApiRes } from '@/libs/types/custom-response.type';
import { RentalPolicyOutDto } from './rental-policy-out.dto';

export class RentalPolicyResponseDto extends ApiRes<RentalPolicyOutDto> {
  @ApiProperty({ type: RentalPolicyOutDto })
  declare data: RentalPolicyOutDto;
}
