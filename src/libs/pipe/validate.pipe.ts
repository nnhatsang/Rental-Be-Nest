import { ArgumentMetadata, BadRequestException, Injectable, InternalServerErrorException, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { INCORRECT_INPUT, UNKNOWN_ERROR } from '../constants/error.constants';

export type ValidationErrorItem = {
  property: string;
  message: string;
  detail?: string;
};

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
        throw new BadRequestException({
          code: INCORRECT_INPUT.code,
          message: INCORRECT_INPUT.message,
          error: this.formatErrors(errors),
        });
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

  private formatErrors(errors: ValidationError[], parentPath = ''): ValidationErrorItem[] {
    return errors.flatMap((error) => {
      const propertyPath = parentPath ? `${parentPath}.${error.property}` : error.property;
      const currentErrors = this.formatConstraintErrors(error, propertyPath);
      const childErrors = error.children?.length ? this.formatErrors(error.children, propertyPath) : [];

      return [...currentErrors, ...childErrors];
    });
  }

  private formatConstraintErrors(error: ValidationError, propertyPath: string): ValidationErrorItem[] {
    if (!error.constraints) {
      return [];
    }

    return Object.values(error.constraints).map((message) => ({ property: propertyPath, message }));
  }
}
