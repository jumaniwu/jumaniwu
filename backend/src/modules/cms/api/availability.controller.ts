import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('cms')
@Controller({ path: 'availability', version: '1' })
export class AvailabilityController {}
