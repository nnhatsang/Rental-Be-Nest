import { ArgumentMetadata, BadRequestException, Injectable, InternalServerErrorException, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ErrorResponse, INCORRECT_INPUT, UNKNOWN_ERROR } from '../constants/error.constants';
@Injectable()
export class ValidatePipe implements PipeTransform<any> {
  async transform(value: any, { metatype, type }: ArgumentMetadata) {
    let errors: ValidationError[] = [];

    try {
      if (type === 'query' && value && typeof value === 'object' && metatype) {
        for (const key of Object.keys(value)) {
          const fieldType = Reflect.getMetadata('design:type', metatype.prototype, key);

          if (fieldType?.name === Boolean.name) {
            value[key] = this.toBoolean(value[key]);
          } else if (fieldType?.name === Number.name) {
            value[key] = this.toNumber(value[key]);
          } else if (fieldType?.name === Date.name) {
            value[key] = this.toDate(value[key]);
          }
        }
      }

      if (!metatype || !this.toValidate(metatype)) {
        return value;
      }

      const data = plainToInstance(metatype, value, {
        enableImplicitConversion: true,
      });

      errors = await validate(data, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: false,
      });

      if (errors.length > 0) {
        const properties = this.formatErrors(errors);

        throw new BadRequestException(
          new ErrorResponse({
            code: INCORRECT_INPUT.code,
            message: properties[0]?.message || INCORRECT_INPUT.message,
          }),
        );
      }

      return data;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(UNKNOWN_ERROR, {
        cause: error,
      });
    }
  }

  private toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object, Date];
    return !types.includes(metatype);
  }

  private toBoolean(value: any): boolean | null {
    if (typeof value === 'boolean') return value;

    if (value === 'true') return true;
    if (value === 'false') return false;

    return null;
  }

  private toNumber(value: any): number | null {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const num = Number(value);

    return Number.isNaN(num) ? null : num;
  }

  private toDate(value: any): Date | null {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatErrors(errors: ValidationError[]) {
    return errors.map((error) => {
      const { property, constraints, children } = error;

      let message: string | undefined;
      let detail: string | undefined;

      if (constraints) {
        message = Object.values(constraints)[0];
      } else if (children?.length) {
        for (const child of children) {
          if (child.constraints) {
            message = Object.values(child.constraints)[0];
            detail = child.property;
            break;
          }
        }
      }

      return {
        property,
        message,
        detail,
      };
    });
  }
}
