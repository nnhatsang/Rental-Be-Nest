import { ApiProperty } from '@nestjs/swagger';
import { ApiPag, ApiPaginatedResponseDto, ApiRes } from '@/libs/types/custom-response.type';
import { CategoryOutDto } from './category-out.dto';

export class CategoryResponseDto extends ApiRes<CategoryOutDto> {
  @ApiProperty({ type: CategoryOutDto })
  declare data: CategoryOutDto;
}

export class CategoriesPaginatedDataDto extends ApiPag<CategoryOutDto> {
  @ApiProperty({ type: [CategoryOutDto] })
  declare items: CategoryOutDto[];
}

export class CategoriesPaginatedResponseDto extends ApiPaginatedResponseDto<CategoryOutDto> {
  @ApiProperty({ type: CategoriesPaginatedDataDto })
  declare data: CategoriesPaginatedDataDto;
}

export class DeleteCategoriesDataDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class DeleteCategoriesResponseDto extends ApiRes<DeleteCategoriesDataDto> {
  @ApiProperty({ type: DeleteCategoriesDataDto })
  declare data: DeleteCategoriesDataDto;
}
