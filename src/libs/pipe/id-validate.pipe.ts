import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { INVALID_UUID } from '../constants/invalid.constant';

@Injectable()
export class IdValidatePipe implements PipeTransform<any> {
  transform(value: any, { type }: ArgumentMetadata) {
    // const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!(type === 'param' && UUID_V7_REGEX.test(value))) {
      throw new BadRequestException(INVALID_UUID);
    }
    return value;
  }
}
