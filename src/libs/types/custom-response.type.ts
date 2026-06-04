import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { DEFAULT_PAGE, DEFAULT_PER_PAGE } from '../constants/common.constant';
import { INVALID_NUMBER } from '../constants/invalid.constant';
import { SUCCESS } from '../constants/response.constant';

export class ApiError<T = unknown> {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ required: false, nullable: true })
  error?: T;
}
export class ApiRes<T = unknown> {
  constructor(data: T, message = SUCCESS) {
    this.data = data;
    this.message = message;
  }

  @ApiProperty()
  data: T;

  @ApiProperty({ type: String })
  message: string;
}
export class ApiNullableRes<T = unknown> {
  constructor(data: T | null, message = SUCCESS) {
    this.data = data;
    this.message = message;
  }

  @ApiProperty({ nullable: true })
  data: T | null;

  @ApiProperty({ type: String })
  message: string;
}
export class Pagination {
  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  perPage!: number;

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  count!: number;

  @ApiProperty({ type: Number })
  totalPage!: number;

  @ApiProperty({ type: Number, nullable: true })
  nextPage?: number;

  @ApiProperty({ type: Number, nullable: true })
  prevPage?: number;
}

export class ApiPag<T = unknown> {
  @ApiProperty({ isArray: true })
  items!: T[];

  @ApiProperty({ type: Pagination })
  pagination!: Pagination;
}

export class ApiPaginatedResponseDto<T = unknown> {
  constructor(items: T[], total: number, page = DEFAULT_PAGE, perPage = DEFAULT_PER_PAGE, message = SUCCESS) {
    const currentPage = Number(page) || DEFAULT_PAGE;
    const currentPerPage = Number(perPage) || DEFAULT_PER_PAGE;
    const totalPage = Math.max(Math.ceil(total / currentPerPage), 1);

    this.message = message;
    this.data = {
      items,
      pagination: {
        page: currentPage,
        perPage: currentPerPage,
        total,
        count: items.length,
        totalPage,
        prevPage: currentPage > 1 ? currentPage - 1 : undefined,
        nextPage: currentPage < totalPage ? currentPage + 1 : undefined,
      },
    };
  }

  @ApiProperty({ type: String })
  message: string;

  @ApiProperty({ type: ApiPag })
  data: ApiPag<T>;
}

export class ApiPagReq {
  @ApiProperty({ type: Number, required: false, default: DEFAULT_PAGE })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(1)
  @IsOptional()
  page: number = DEFAULT_PAGE;

  @ApiProperty({ type: Number, required: false, default: DEFAULT_PER_PAGE })
  @Type(() => Number)
  @IsNumber({}, { message: INVALID_NUMBER })
  @Min(1)
  @IsOptional()
  perPage: number = DEFAULT_PER_PAGE;

  @ApiProperty({ type: Number, required: false })
  @IsOptional()
  sort?: number;
}
