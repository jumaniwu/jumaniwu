import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('cms')
@Controller({ path: 'rate-plans', version: '1' })
export class RatePlanController {}
